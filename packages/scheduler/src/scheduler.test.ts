import { describe, expect, it } from "vitest";

import { replanThali, scheduleThali, stepKey } from "./index";
import type { ScheduledStep, ThaliPlan, ThaliRecipe } from "./index";

function getStep(plan: ThaliPlan, dishId: string, stepId: string): ScheduledStep {
  const step = plan.steps.find((candidate) => candidate.key === stepKey(dishId, stepId));
  if (step === undefined) throw new Error(`Missing ${dishId}/${stepId}`);
  return step;
}

function expectNoActiveOverlap(plan: ThaliPlan): void {
  const active = plan.steps
    .filter((step) => step.attention === "active")
    .sort((a, b) => a.startSec - b.startSec);
  for (let index = 1; index < active.length; index += 1) {
    expect(active[index]!.startSec).toBeGreaterThanOrEqual(active[index - 1]!.endSec);
  }
}

function expectDependenciesHold(plan: ThaliPlan): void {
  for (const step of plan.steps) {
    for (const dependencyId of step.dependsOn) {
      expect(step.startSec).toBeGreaterThanOrEqual(
        getStep(plan, step.dishId, dependencyId).endSec,
      );
    }
  }
}

describe("scheduleThali", () => {
  it("backward-schedules each DAG from a common target while passive work overlaps", () => {
    const recipes: ThaliRecipe[] = [
      {
        id: "dal",
        label: "Dal",
        steps: [
          { id: "chop", durationSec: 10, attention: "active" },
          { id: "simmer", durationSec: 30, attention: "passive" },
          { id: "tadka", durationSec: 5, attention: "active" },
        ],
      },
      {
        id: "rice",
        label: "Rice",
        steps: [
          { id: "rinse", durationSec: 8, attention: "active" },
          { id: "cook", durationSec: 20, attention: "passive" },
        ],
      },
    ];

    const plan = scheduleThali(recipes, 1_000);

    expect(getStep(plan, "dal", "tadka").endSec).toBe(1_000);
    expect(getStep(plan, "rice", "cook").endSec).toBe(1_000);
    expect(getStep(plan, "dal", "simmer").startSec).toBeLessThan(
      getStep(plan, "rice", "cook").endSec,
    );
    expect(getStep(plan, "rice", "cook").startSec).toBeLessThan(
      getStep(plan, "dal", "simmer").endSec,
    );
    expect(plan.activeOrder).toEqual([
      { dishId: "dal", stepId: "chop" },
      { dishId: "rice", stepId: "rinse" },
      { dishId: "dal", stepId: "tadka" },
    ]);
    expectNoActiveOverlap(plan);
    expectDependenciesHold(plan);
    expect(plan.revision).toBe(0);
    expect(plan.events).toHaveLength(10);
  });

  it("serializes conflicting active sinks by EDF and shifts the first one earlier", () => {
    const plan = scheduleThali(
      [
        { id: "dal", steps: [{ id: "finish", durationSec: 10, attention: "active" }] },
        { id: "rice", steps: [{ id: "finish", durationSec: 10, attention: "active" }] },
      ],
      100,
    );

    expect(plan.activeOrder).toEqual([
      { dishId: "dal", stepId: "finish" },
      { dishId: "rice", stepId: "finish" },
    ]);
    expect(getStep(plan, "dal", "finish")).toMatchObject({ startSec: 80, endSec: 90 });
    expect(getStep(plan, "rice", "finish")).toMatchObject({ startSec: 90, endSec: 100 });
    expect(plan.dishes.map((dish) => dish.scheduledFinishSec)).toEqual([90, 100]);
    expectNoActiveOverlap(plan);

    const boundary = plan.events.filter((event) => event.atSec === 90);
    expect(boundary.map((event) => event.type)).toEqual(["step-complete", "step-start"]);
  });

  it("supports explicit fork-and-join DAGs", () => {
    const plan = scheduleThali(
      [
        {
          id: "sabzi",
          steps: [
            { id: "base", durationSec: 5, attention: "active", dependsOn: [] },
            { id: "steam", durationSec: 20, attention: "passive", dependsOn: ["base"] },
            { id: "rest", durationSec: 10, attention: "passive", dependsOn: ["base"] },
            {
              id: "finish",
              durationSec: 5,
              attention: "active",
              dependsOn: ["steam", "rest"],
            },
          ],
        },
      ],
      100,
    );

    expect(getStep(plan, "sabzi", "finish")).toMatchObject({ startSec: 95, endSec: 100 });
    expect(getStep(plan, "sabzi", "steam")).toMatchObject({ startSec: 75, endSec: 95 });
    expect(getStep(plan, "sabzi", "rest")).toMatchObject({ startSec: 85, endSec: 95 });
    expect(getStep(plan, "sabzi", "base")).toMatchObject({ startSec: 70, endSec: 75 });
    expectDependenciesHold(plan);
  });

  it("rejects malformed recipes instead of emitting an unsafe timeline", () => {
    expect(() => scheduleThali([], 100)).toThrow(/at least one recipe/);
    expect(() =>
      scheduleThali(
        ["a", "b", "c", "d"].map((id) => ({
          id,
          steps: [{ id: "one", durationSec: 1, attention: "passive" as const }],
        })),
        100,
      ),
    ).toThrow(/at most 3/);
    expect(() =>
      scheduleThali(
        [
          {
            id: "dal",
            steps: [
              { id: "a", durationSec: 1, attention: "active", dependsOn: ["b"] },
              { id: "b", durationSec: 1, attention: "active", dependsOn: ["a"] },
            ],
          },
        ],
        100,
      ),
    ).toThrow(/must form a DAG/);
    expect(() =>
      scheduleThali(
        [
          {
            id: "dal",
            steps: [{ id: "a", durationSec: 0, attention: "active" }],
          },
        ],
        100,
      ),
    ).toThrow(/greater than zero/);
    expect(() =>
      scheduleThali(
        [
          {
            id: "dal",
            steps: [
              { id: "a", durationSec: 1, attention: "active", dependsOn: ["missing"] },
            ],
          },
        ],
        100,
      ),
    ).toThrow(/Unknown dependency/);
  });
});

describe("replanThali", () => {
  it("pushes downstream active work forward after a late completion", () => {
    const original = scheduleThali(
      [
        { id: "dal", steps: [{ id: "finish", durationSec: 10, attention: "active" }] },
        { id: "rice", steps: [{ id: "finish", durationSec: 10, attention: "active" }] },
      ],
      100,
    );

    const replanned = replanThali(original, {
      type: "step-completed",
      dishId: "dal",
      stepId: "finish",
      actualEndSec: 95,
    });

    expect(getStep(replanned, "dal", "finish")).toMatchObject({
      endSec: 95,
      actualEndSec: 95,
      status: "completed",
    });
    expect(getStep(replanned, "rice", "finish")).toMatchObject({
      startSec: 95,
      endSec: 105,
    });
    expect(replanned.targetFinishSec).toBe(105);
    expect(replanned.originalTargetFinishSec).toBe(100);
    expect(replanned.revision).toBe(1);
    expect(replanned.lastReplan).toMatchObject({ kind: "step-completed", driftSec: 5 });
    expectNoActiveOverlap(replanned);
  });

  it("records an early completion without pulling later work earlier", () => {
    const original = scheduleThali(
      [
        {
          id: "dal",
          steps: [
            { id: "prep", durationSec: 10, attention: "active" },
            { id: "simmer", durationSec: 10, attention: "passive" },
          ],
        },
      ],
      100,
    );
    const originalSimmer = getStep(original, "dal", "simmer");

    const replanned = replanThali(original, {
      type: "step-completed",
      dishId: "dal",
      stepId: "prep",
      actualEndSec: getStep(original, "dal", "prep").endSec - 2,
    });

    expect(getStep(replanned, "dal", "simmer").startSec).toBe(originalSimmer.startSec);
    expect(replanned.targetFinishSec).toBe(100);
    expect(replanned.lastReplan?.driftSec).toBe(0);
  });

  it("shifts only true DAG descendants until a shared active resource causes ripple", () => {
    const original = scheduleThali(
      [
        {
          id: "dal",
          steps: [
            { id: "prep", durationSec: 10, attention: "active", dependsOn: [] },
            { id: "simmer", durationSec: 20, attention: "passive", dependsOn: ["prep"] },
            { id: "rest", durationSec: 5, attention: "passive", dependsOn: [] },
          ],
        },
      ],
      100,
    );
    const untouched = getStep(original, "dal", "rest");
    const prep = getStep(original, "dal", "prep");

    const replanned = replanThali(original, {
      type: "step-completed",
      dishId: "dal",
      stepId: "prep",
      actualEndSec: prep.endSec + 5,
    });

    expect(getStep(replanned, "dal", "simmer")).toMatchObject({
      startSec: prep.endSec + 5,
      endSec: 105,
    });
    expect(getStep(replanned, "dal", "rest")).toMatchObject({
      startSec: untouched.startSec,
      endSec: untouched.endSec,
    });
    expect(replanned.targetFinishSec).toBe(105);
    expectDependenciesHold(replanned);
  });

  it("freezes in-flight work and shifts every future event for a global pause", () => {
    const original = scheduleThali(
      [
        {
          id: "dal",
          steps: [
            { id: "simmer", durationSec: 20, attention: "passive" },
            { id: "tadka", durationSec: 10, attention: "active" },
          ],
        },
      ],
      100,
    );

    const replanned = replanThali(original, {
      type: "pause",
      pausedAtSec: 80,
      resumedAtSec: 95,
    });

    expect(getStep(replanned, "dal", "simmer")).toMatchObject({
      startSec: 70,
      endSec: 105,
      pausedDurationSec: 15,
    });
    expect(getStep(replanned, "dal", "tadka")).toMatchObject({
      startSec: 105,
      endSec: 115,
    });
    expect(replanned.targetFinishSec).toBe(115);
    expect(replanned.lastReplan).toMatchObject({ kind: "pause", driftSec: 15 });
    expectDependenciesHold(replanned);
  });

  it("rejects impossible completion and pause timestamps", () => {
    const plan = scheduleThali(
      [{ id: "dal", steps: [{ id: "one", durationSec: 10, attention: "active" }] }],
      100,
    );
    expect(() =>
      replanThali(plan, {
        type: "step-completed",
        dishId: "dal",
        stepId: "one",
        actualEndSec: 89,
      }),
    ).toThrow(/before its scheduled start/);
    expect(() =>
      replanThali(plan, { type: "pause", pausedAtSec: 90, resumedAtSec: 89 }),
    ).toThrow(/before pause time/);
  });
});
