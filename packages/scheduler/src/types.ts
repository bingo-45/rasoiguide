export type StepAttention = "active" | "passive";

/**
 * A recipe step in the scheduler's DAG.
 *
 * When `dependsOn` is omitted, the previous array item is used. Pass an empty
 * array explicitly for a root step that may run independently.
 */
export interface ThaliStep {
  readonly id: string;
  readonly durationSec: number;
  readonly attention: StepAttention;
  readonly dependsOn?: readonly string[];
  readonly label?: string;
}

export interface ThaliRecipe {
  readonly id: string;
  readonly label?: string;
  readonly steps: readonly ThaliStep[];
}

export interface StepRef {
  readonly dishId: string;
  readonly stepId: string;
}

export type ScheduledStepStatus = "scheduled" | "completed";

export interface ScheduledStep extends StepRef {
  /** Stable internal/public lookup key. */
  readonly key: string;
  readonly dishLabel?: string;
  readonly label?: string;
  readonly durationSec: number;
  readonly attention: StepAttention;
  /** Original same-dish DAG dependencies, expressed as step ids. */
  readonly dependsOn: readonly string[];
  /** Latest legal finish before single-cook conflict resolution. */
  readonly deadlineSec: number;
  readonly startSec: number;
  readonly endSec: number;
  /** Wall-clock pause time accumulated while this step was in flight. */
  readonly pausedDurationSec: number;
  readonly status: ScheduledStepStatus;
  readonly actualEndSec?: number;
}

export type TimelineEventType = "step-complete" | "step-start";

export interface TimelineEvent extends StepRef {
  readonly id: string;
  readonly atSec: number;
  readonly type: TimelineEventType;
  readonly attention: StepAttention;
  readonly revision: number;
  readonly completed: boolean;
}

export interface DishSchedule {
  readonly dishId: string;
  readonly dishLabel?: string;
  readonly targetFinishSec: number;
  readonly scheduledFinishSec: number;
  readonly stepKeys: readonly string[];
}

export interface ReplanRecord {
  readonly kind: "step-completed" | "pause";
  readonly driftSec: number;
  readonly atSec: number;
  readonly detail: string;
}

export interface ThaliPlan {
  /** Current projected finish after any drift. */
  readonly targetFinishSec: number;
  /** The cook's originally requested common finish time. */
  readonly originalTargetFinishSec: number;
  readonly revision: number;
  readonly dishes: readonly DishSchedule[];
  readonly steps: readonly ScheduledStep[];
  readonly events: readonly TimelineEvent[];
  /** EDF order used for the single active-step resource. */
  readonly activeOrder: readonly StepRef[];
  readonly lastReplan?: ReplanRecord;
}

export interface StepCompletedSignal extends StepRef {
  readonly type: "step-completed";
  readonly actualEndSec: number;
}

export interface PauseSignal {
  readonly type: "pause";
  readonly pausedAtSec: number;
  readonly resumedAtSec: number;
}

export type ReplanSignal = StepCompletedSignal | PauseSignal;
