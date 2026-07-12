import type {
  DishSchedule,
  ScheduledStep,
  StepRef,
  ThaliPlan,
  ThaliRecipe,
  TimelineEvent,
} from "./types";

interface InternalNode {
  readonly key: string;
  readonly dishId: string;
  readonly dishLabel?: string;
  readonly dishIndex: number;
  readonly stepId: string;
  readonly stepIndex: number;
  readonly label?: string;
  readonly durationSec: number;
  readonly attention: "active" | "passive";
  readonly dependsOn: readonly string[];
  readonly dependencyKeys: readonly string[];
}

interface LatestSlot {
  readonly startSec: number;
  readonly endSec: number;
}

const MAX_DISHES = 3;
const KEY_SEPARATOR = "\u0000";

export function stepKey(dishId: string, stepId: string): string {
  return `${dishId}${KEY_SEPARATOR}${stepId}`;
}

function compareNodeOrder(a: InternalNode, b: InternalNode): number {
  return (
    a.dishIndex - b.dishIndex ||
    a.stepIndex - b.stepIndex ||
    a.dishId.localeCompare(b.dishId) ||
    a.stepId.localeCompare(b.stepId)
  );
}

function assertFinite(label: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be finite`);
  }
}

function buildNodes(recipes: readonly ThaliRecipe[]): InternalNode[] {
  if (recipes.length === 0) {
    throw new RangeError("Thali mode needs at least one recipe");
  }
  if (recipes.length > MAX_DISHES) {
    throw new RangeError(`Thali mode supports at most ${MAX_DISHES} recipes`);
  }

  const dishIds = new Set<string>();
  const nodes: InternalNode[] = [];

  recipes.forEach((recipe, dishIndex) => {
    if (recipe.id.trim() === "") {
      throw new TypeError("Recipe id cannot be empty");
    }
    if (dishIds.has(recipe.id)) {
      throw new TypeError(`Duplicate recipe id: ${recipe.id}`);
    }
    dishIds.add(recipe.id);
    if (recipe.steps.length === 0) {
      throw new RangeError(`Recipe ${recipe.id} has no steps`);
    }

    const stepIds = new Set<string>();
    recipe.steps.forEach((step) => {
      if (step.id.trim() === "") {
        throw new TypeError(`Recipe ${recipe.id} has an empty step id`);
      }
      if (stepIds.has(step.id)) {
        throw new TypeError(`Duplicate step id ${step.id} in recipe ${recipe.id}`);
      }
      stepIds.add(step.id);
      assertFinite(`Duration for ${recipe.id}/${step.id}`, step.durationSec);
      if (step.durationSec <= 0) {
        throw new RangeError(`Duration for ${recipe.id}/${step.id} must be greater than zero`);
      }
      if (step.attention !== "active" && step.attention !== "passive") {
        throw new TypeError(`Invalid attention for ${recipe.id}/${step.id}`);
      }
    });

    recipe.steps.forEach((step, stepIndex) => {
      const inferredDependencies =
        step.dependsOn === undefined && stepIndex > 0
          ? [recipe.steps[stepIndex - 1]!.id]
          : (step.dependsOn ?? []);
      const dependsOn = [...new Set(inferredDependencies)];
      for (const dependency of dependsOn) {
        if (!stepIds.has(dependency)) {
          throw new TypeError(
            `Unknown dependency ${dependency} for ${recipe.id}/${step.id}`,
          );
        }
        if (dependency === step.id) {
          throw new TypeError(`${recipe.id}/${step.id} cannot depend on itself`);
        }
      }

      nodes.push({
        key: stepKey(recipe.id, step.id),
        dishId: recipe.id,
        ...(recipe.label === undefined ? {} : { dishLabel: recipe.label }),
        dishIndex,
        stepId: step.id,
        stepIndex,
        ...(step.label === undefined ? {} : { label: step.label }),
        durationSec: step.durationSec,
        attention: step.attention,
        dependsOn,
        dependencyKeys: dependsOn.map((dependency) => stepKey(recipe.id, dependency)),
      });
    });
  });

  return nodes;
}

function buildSuccessors(
  nodes: readonly InternalNode[],
): Map<string, Set<string>> {
  const successors = new Map(nodes.map((node) => [node.key, new Set<string>()]));
  for (const node of nodes) {
    for (const dependencyKey of node.dependencyKeys) {
      successors.get(dependencyKey)!.add(node.key);
    }
  }
  return successors;
}

function topologicalSort(
  nodes: readonly InternalNode[],
  successors: ReadonlyMap<string, ReadonlySet<string>>,
): InternalNode[] {
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const inDegree = new Map(nodes.map((node) => [node.key, 0]));
  for (const nextKeys of successors.values()) {
    for (const nextKey of nextKeys) {
      inDegree.set(nextKey, (inDegree.get(nextKey) ?? 0) + 1);
    }
  }

  const ready = nodes
    .filter((node) => inDegree.get(node.key) === 0)
    .sort(compareNodeOrder);
  const ordered: InternalNode[] = [];

  while (ready.length > 0) {
    const node = ready.shift()!;
    ordered.push(node);
    for (const nextKey of successors.get(node.key) ?? []) {
      const remaining = inDegree.get(nextKey)! - 1;
      inDegree.set(nextKey, remaining);
      if (remaining === 0) {
        ready.push(byKey.get(nextKey)!);
        ready.sort(compareNodeOrder);
      }
    }
  }

  if (ordered.length !== nodes.length) {
    throw new TypeError("Recipe step dependencies must form a DAG");
  }
  return ordered;
}

function backwardLatestSlots(
  nodes: readonly InternalNode[],
  successors: ReadonlyMap<string, ReadonlySet<string>>,
  targetFinishSec: number,
): Map<string, LatestSlot> {
  const ordered = topologicalSort(nodes, successors);
  const slots = new Map<string, LatestSlot>();

  for (const node of [...ordered].reverse()) {
    const nextKeys = successors.get(node.key) ?? new Set<string>();
    let endSec = targetFinishSec;
    for (const nextKey of nextKeys) {
      endSec = Math.min(endSec, slots.get(nextKey)!.startSec);
    }
    slots.set(node.key, {
      startSec: endSec - node.durationSec,
      endSec,
    });
  }

  return slots;
}

function buildEvents(steps: readonly ScheduledStep[], revision: number): TimelineEvent[] {
  const events = steps.flatMap<TimelineEvent>((step) => [
    {
      id: `${step.key}:start:r${revision}`,
      dishId: step.dishId,
      stepId: step.stepId,
      atSec: step.startSec,
      type: "step-start",
      attention: step.attention,
      revision,
      completed: step.status === "completed",
    },
    {
      id: `${step.key}:complete:r${revision}`,
      dishId: step.dishId,
      stepId: step.stepId,
      atSec: step.endSec,
      type: "step-complete",
      attention: step.attention,
      revision,
      completed: step.status === "completed",
    },
  ]);

  return events.sort(
    (a, b) =>
      a.atSec - b.atSec ||
      (a.type === b.type ? 0 : a.type === "step-complete" ? -1 : 1) ||
      a.dishId.localeCompare(b.dishId) ||
      a.stepId.localeCompare(b.stepId),
  );
}

function dishSchedules(
  recipes: readonly ThaliRecipe[],
  nodes: readonly InternalNode[],
  originalSuccessors: ReadonlyMap<string, ReadonlySet<string>>,
  scheduledSteps: readonly ScheduledStep[],
  targetFinishSec: number,
): DishSchedule[] {
  const stepByKey = new Map(scheduledSteps.map((step) => [step.key, step]));
  return recipes.map((recipe) => {
    const recipeNodes = nodes.filter((node) => node.dishId === recipe.id);
    const originalSinks = recipeNodes.filter((node) => {
      const sameDishSuccessors = [...(originalSuccessors.get(node.key) ?? [])].filter(
        (key) => key.startsWith(`${recipe.id}${KEY_SEPARATOR}`),
      );
      return sameDishSuccessors.length === 0;
    });
    return {
      dishId: recipe.id,
      ...(recipe.label === undefined ? {} : { dishLabel: recipe.label }),
      targetFinishSec,
      scheduledFinishSec: Math.max(
        ...originalSinks.map((node) => stepByKey.get(node.key)!.endSec),
      ),
      stepKeys: recipeNodes.map((node) => node.key),
    };
  });
}

/**
 * Builds a latest-possible Thali plan from a common target finish.
 *
 * First, each recipe DAG is backward-scheduled independently. Active work is
 * then ordered by earliest deadline first and added as a single-resource chain;
 * a second backward pass shifts conflicts earlier without moving passive work
 * that can safely overlap.
 */
export function scheduleThali(
  recipes: readonly ThaliRecipe[],
  targetFinishSec: number,
): ThaliPlan {
  assertFinite("Target finish", targetFinishSec);
  const nodes = buildNodes(recipes);
  const originalSuccessors = buildSuccessors(nodes);
  const baseline = backwardLatestSlots(nodes, originalSuccessors, targetFinishSec);

  const activeNodes = nodes
    .filter((node) => node.attention === "active")
    .sort((a, b) => {
      const aSlot = baseline.get(a.key)!;
      const bSlot = baseline.get(b.key)!;
      return (
        aSlot.endSec - bSlot.endSec ||
        aSlot.startSec - bSlot.startSec ||
        compareNodeOrder(a, b)
      );
    });

  const constrainedSuccessors = new Map(
    [...originalSuccessors].map(([key, successors]) => [key, new Set(successors)]),
  );
  for (let index = 1; index < activeNodes.length; index += 1) {
    constrainedSuccessors
      .get(activeNodes[index - 1]!.key)!
      .add(activeNodes[index]!.key);
  }

  // This also asserts that EDF resource edges did not violate the recipe DAG.
  topologicalSort(nodes, constrainedSuccessors);
  const finalSlots = backwardLatestSlots(nodes, constrainedSuccessors, targetFinishSec);
  const scheduledSteps: ScheduledStep[] = nodes
    .map<ScheduledStep>((node) => {
      const slot = finalSlots.get(node.key)!;
      const deadline = baseline.get(node.key)!.endSec;
      return {
        key: node.key,
        dishId: node.dishId,
        stepId: node.stepId,
        ...(node.dishLabel === undefined ? {} : { dishLabel: node.dishLabel }),
        ...(node.label === undefined ? {} : { label: node.label }),
        durationSec: node.durationSec,
        attention: node.attention,
        dependsOn: node.dependsOn,
        deadlineSec: deadline,
        startSec: slot.startSec,
        endSec: slot.endSec,
        pausedDurationSec: 0,
        status: "scheduled",
      };
    })
    .sort((a, b) => a.startSec - b.startSec || a.endSec - b.endSec || a.key.localeCompare(b.key));

  const activeOrder: StepRef[] = activeNodes.map((node) => ({
    dishId: node.dishId,
    stepId: node.stepId,
  }));

  return {
    targetFinishSec,
    originalTargetFinishSec: targetFinishSec,
    revision: 0,
    dishes: dishSchedules(
      recipes,
      nodes,
      originalSuccessors,
      scheduledSteps,
      targetFinishSec,
    ),
    steps: scheduledSteps,
    events: buildEvents(scheduledSteps, 0),
    activeOrder,
  };
}

export const schedulerInternals = {
  buildEvents,
  keySeparator: KEY_SEPARATOR,
};
