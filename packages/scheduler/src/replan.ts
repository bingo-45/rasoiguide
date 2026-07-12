import { schedulerInternals, stepKey } from "./schedule";
import type {
  DishSchedule,
  ReplanSignal,
  ScheduledStep,
  StepRef,
  ThaliPlan,
} from "./types";

interface MutableStep {
  key: string;
  dishId: string;
  stepId: string;
  dishLabel?: string;
  label?: string;
  durationSec: number;
  attention: "active" | "passive";
  dependsOn: string[];
  deadlineSec: number;
  startSec: number;
  endSec: number;
  pausedDurationSec: number;
  status: "scheduled" | "completed";
  actualEndSec?: number;
}

function assertFinite(label: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be finite`);
  }
}

function cloneSteps(plan: ThaliPlan): MutableStep[] {
  return plan.steps.map((step) => ({
    ...step,
    dependsOn: [...step.dependsOn],
  }));
}

function activeRefKey(ref: StepRef): string {
  return stepKey(ref.dishId, ref.stepId);
}

function descendantsOf(
  steps: readonly MutableStep[],
  originKey: string,
): Set<string> {
  const successors = new Map(steps.map((step) => [step.key, new Set<string>()]));
  for (const step of steps) {
    for (const dependency of step.dependsOn) {
      successors.get(stepKey(step.dishId, dependency))!.add(step.key);
    }
  }

  const descendants = new Set<string>();
  const queue = [...(successors.get(originKey) ?? [])];
  while (queue.length > 0) {
    const key = queue.shift()!;
    if (descendants.has(key)) continue;
    descendants.add(key);
    queue.push(...(successors.get(key) ?? []));
  }
  return descendants;
}

/**
 * Keeps the established EDF active order, then pushes only unfinished work
 * forward until both DAG and one-cook constraints hold. Nothing is pulled
 * earlier after drift; a broken target silently becomes a new projection.
 */
function repairForward(steps: MutableStep[], activeOrder: readonly StepRef[]): void {
  const byKey = new Map(steps.map((step) => [step.key, step]));
  const predecessors = new Map(steps.map((step) => [step.key, new Set<string>()]));
  const successors = new Map(steps.map((step) => [step.key, new Set<string>()]));

  for (const step of steps) {
    for (const dependency of step.dependsOn) {
      const dependencyKey = stepKey(step.dishId, dependency);
      predecessors.get(step.key)!.add(dependencyKey);
      successors.get(dependencyKey)!.add(step.key);
    }
  }
  for (let index = 1; index < activeOrder.length; index += 1) {
    const previousKey = activeRefKey(activeOrder[index - 1]!);
    const currentKey = activeRefKey(activeOrder[index]!);
    predecessors.get(currentKey)!.add(previousKey);
    successors.get(previousKey)!.add(currentKey);
  }

  const inDegree = new Map([...predecessors].map(([key, values]) => [key, values.size]));
  const ready = steps
    .filter((step) => inDegree.get(step.key) === 0)
    .sort((a, b) => a.startSec - b.startSec || a.key.localeCompare(b.key));
  let visited = 0;

  while (ready.length > 0) {
    const step = ready.shift()!;
    visited += 1;
    if (step.status !== "completed") {
      let earliestStartSec = step.startSec;
      for (const predecessorKey of predecessors.get(step.key) ?? []) {
        earliestStartSec = Math.max(earliestStartSec, byKey.get(predecessorKey)!.endSec);
      }
      if (earliestStartSec > step.startSec) {
        step.startSec = earliestStartSec;
        step.endSec = earliestStartSec + step.durationSec + step.pausedDurationSec;
      }
    }

    for (const successorKey of successors.get(step.key) ?? []) {
      const remaining = inDegree.get(successorKey)! - 1;
      inDegree.set(successorKey, remaining);
      if (remaining === 0) {
        ready.push(byKey.get(successorKey)!);
        ready.sort((a, b) => a.startSec - b.startSec || a.key.localeCompare(b.key));
      }
    }
  }

  if (visited !== steps.length) {
    throw new TypeError("Cannot re-plan a cyclic schedule");
  }
}

function rebuildDishSchedules(plan: ThaliPlan, steps: readonly ScheduledStep[]): DishSchedule[] {
  const byKey = new Map(steps.map((step) => [step.key, step]));
  return plan.dishes.map((dish) => ({
    ...dish,
    scheduledFinishSec: Math.max(...dish.stepKeys.map((key) => byKey.get(key)!.endSec)),
  }));
}

function finishReplan(
  plan: ThaliPlan,
  steps: MutableStep[],
  record: NonNullable<ThaliPlan["lastReplan"]>,
): ThaliPlan {
  const revision = plan.revision + 1;
  const orderedSteps: ScheduledStep[] = steps
    .sort((a, b) => a.startSec - b.startSec || a.endSec - b.endSec || a.key.localeCompare(b.key))
    .map((step) => ({ ...step }));
  const projectedFinish = Math.max(...orderedSteps.map((step) => step.endSec));
  const targetFinishSec = Math.max(plan.targetFinishSec, projectedFinish);
  const dishes = rebuildDishSchedules(plan, orderedSteps).map((dish) => ({
    ...dish,
    targetFinishSec,
  }));

  return {
    ...plan,
    targetFinishSec,
    revision,
    dishes,
    steps: orderedSteps,
    events: schedulerInternals.buildEvents(orderedSteps, revision),
    lastReplan: record,
  };
}

function replanCompletion(plan: ThaliPlan, signal: Extract<ReplanSignal, { type: "step-completed" }>): ThaliPlan {
  assertFinite("Actual completion time", signal.actualEndSec);
  const steps = cloneSteps(plan);
  const key = stepKey(signal.dishId, signal.stepId);
  const completed = steps.find((step) => step.key === key);
  if (completed === undefined) {
    throw new RangeError(`Unknown scheduled step ${signal.dishId}/${signal.stepId}`);
  }
  if (signal.actualEndSec < completed.startSec) {
    throw new RangeError("A step cannot complete before its scheduled start");
  }

  const scheduledEndSec = completed.endSec;
  const driftSec = Math.max(0, signal.actualEndSec - scheduledEndSec);
  completed.endSec = signal.actualEndSec;
  completed.actualEndSec = signal.actualEndSec;
  completed.status = "completed";

  if (driftSec > 0) {
    const descendants = descendantsOf(steps, key);
    for (const step of steps) {
      if (step.status === "scheduled" && descendants.has(step.key)) {
        step.startSec += driftSec;
        step.endSec += driftSec;
      }
    }
    repairForward(steps, plan.activeOrder);
  }

  return finishReplan(plan, steps, {
    kind: "step-completed",
    driftSec,
    atSec: signal.actualEndSec,
    detail: `${signal.dishId}/${signal.stepId}`,
  });
}

function replanPause(plan: ThaliPlan, signal: Extract<ReplanSignal, { type: "pause" }>): ThaliPlan {
  assertFinite("Pause start", signal.pausedAtSec);
  assertFinite("Resume time", signal.resumedAtSec);
  if (signal.resumedAtSec < signal.pausedAtSec) {
    throw new RangeError("Resume time cannot be before pause time");
  }
  const driftSec = signal.resumedAtSec - signal.pausedAtSec;
  const steps = cloneSteps(plan);

  if (driftSec > 0) {
    for (const step of steps) {
      if (step.status === "completed" || step.endSec <= signal.pausedAtSec) continue;
      if (step.startSec >= signal.pausedAtSec) {
        step.startSec += driftSec;
        step.endSec += driftSec;
      } else {
        // The timer was running at the pause boundary: freeze its remaining
        // work, so only its end moves and elapsed wall time records the pause.
        step.endSec += driftSec;
        step.pausedDurationSec += driftSec;
      }
    }
  }

  return finishReplan(plan, steps, {
    kind: "pause",
    driftSec,
    atSec: signal.resumedAtSec,
    detail: `${signal.pausedAtSec}-${signal.resumedAtSec}`,
  });
}

export function replanThali(plan: ThaliPlan, signal: ReplanSignal): ThaliPlan {
  return signal.type === "step-completed"
    ? replanCompletion(plan, signal)
    : replanPause(plan, signal);
}
