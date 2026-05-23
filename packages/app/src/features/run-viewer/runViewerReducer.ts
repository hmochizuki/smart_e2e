import type { ErrorClassification, StepRunStatus, RunStatus } from '@smart-e2e/shared';
import type { RunnerEventWire } from '../../ipc/types.js';

export interface StepProgress {
  readonly stepRunId: string;
  readonly stepId: string;
  readonly order: number;
  readonly name: string;
  readonly status: StepRunStatus;
  readonly attempts: number;
  readonly finalScript: string | null;
  readonly classification: ErrorClassification | null;
  readonly errorLog: string;
  readonly diff: string | null;
  readonly skippedReason: string | null;
  readonly exhausted: boolean;
}

export interface RunViewerState {
  readonly suiteStatus: RunStatus | null;
  readonly suiteStartedAt: string | null;
  readonly suiteFinishedAt: string | null;
  readonly steps: ReadonlyArray<StepProgress>;
  readonly logs: ReadonlyArray<string>;
}

export const initialRunViewerState: RunViewerState = {
  suiteStatus: null,
  suiteStartedAt: null,
  suiteFinishedAt: null,
  steps: [],
  logs: [],
};

const upsertStep = (
  steps: ReadonlyArray<StepProgress>,
  stepRunId: string,
  patch: (prev: StepProgress) => StepProgress,
  initial?: StepProgress,
): ReadonlyArray<StepProgress> => {
  const idx = steps.findIndex((s) => s.stepRunId === stepRunId);
  if (idx === -1) {
    if (initial === undefined) {
      return steps;
    }
    const next = [...steps, patch(initial)];
    next.sort((a, b) => a.order - b.order);
    return next;
  }
  const current = steps[idx];
  if (!current) return steps;
  const updated = patch(current);
  const next = [...steps];
  next[idx] = updated;
  return next;
};

const blankStep = (
  stepRunId: string,
  stepId: string,
  order: number,
  name: string,
): StepProgress => ({
  stepRunId,
  stepId,
  order,
  name,
  status: 'running',
  attempts: 0,
  finalScript: null,
  classification: null,
  errorLog: '',
  diff: null,
  skippedReason: null,
  exhausted: false,
});

export const runViewerReducer = (state: RunViewerState, event: RunnerEventWire): RunViewerState => {
  switch (event.type) {
    case 'suite_started':
      return {
        ...state,
        suiteStatus: 'running',
        suiteStartedAt: typeof event.startedAt === 'string' ? event.startedAt : null,
      };
    case 'step_started': {
      const fresh = blankStep(event.stepRunId, event.stepId, event.order, event.name);
      const steps = upsertStep(state.steps, event.stepRunId, () => fresh, fresh);
      return { ...state, steps };
    }
    case 'step_attempt': {
      const steps = upsertStep(state.steps, event.stepRunId, (prev) => ({
        ...prev,
        attempts: event.attempt,
      }));
      return { ...state, steps };
    }
    case 'repair_classified': {
      const steps = upsertStep(state.steps, event.stepRunId, (prev) => ({
        ...prev,
        classification: event.classification,
        errorLog: event.errorLog,
      }));
      return { ...state, steps };
    }
    case 'repair_generated': {
      const steps = upsertStep(state.steps, event.stepRunId, (prev) => ({
        ...prev,
        diff: event.diff,
      }));
      return { ...state, steps };
    }
    case 'repair_exhausted': {
      const steps = upsertStep(state.steps, event.stepRunId, (prev) => ({
        ...prev,
        exhausted: true,
        classification: event.classification,
        errorLog: event.finalErrorLog,
      }));
      return { ...state, steps };
    }
    case 'step_finished': {
      const steps = upsertStep(state.steps, event.stepRunId, (prev) => ({
        ...prev,
        status: event.status,
        attempts: event.attempts,
        finalScript: event.finalScript,
      }));
      return { ...state, steps };
    }
    case 'step_skipped': {
      const steps = upsertStep(state.steps, event.stepRunId, (prev) => ({
        ...prev,
        status: 'skipped',
        skippedReason: event.reason,
      }));
      return { ...state, steps };
    }
    case 'suite_finished':
      return {
        ...state,
        suiteStatus: event.status,
        suiteFinishedAt: typeof event.finishedAt === 'string' ? event.finishedAt : null,
      };
    case 'log':
      return { ...state, logs: [...state.logs, `[${event.level}] ${event.message}`] };
    case 'screenshot':
      return { ...state, logs: [...state.logs, `[screenshot] ${event.path}`] };
    default:
      return state;
  }
};
