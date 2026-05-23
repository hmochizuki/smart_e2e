import type { NewSuiteInput, NewStepInput, RunStatus, StepRunStatus } from '@smart-e2e/shared';

export interface SuiteWire {
  readonly id: string;
  readonly name: string;
  readonly description?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StepWire {
  readonly id: string;
  readonly suiteId: string;
  readonly order: number;
  readonly name: string;
  readonly script: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SuiteRunWire {
  readonly id: string;
  readonly suiteId: string;
  readonly status: RunStatus;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly error?: string | null;
}

export interface StepRunWire {
  readonly id: string;
  readonly suiteRunId: string;
  readonly stepId: string;
  readonly status: StepRunStatus;
  readonly attempts: number;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly finalScript: string | null;
}

export type NewSuiteInputWire = NewSuiteInput;
export type NewStepInputWire = NewStepInput;
export type SuitePatchWire = Partial<NewSuiteInput>;
export type StepPatchWire = Partial<NewStepInput>;

export type CodegenTarget = 'playwright-test' | 'javascript';

export interface CodegenInputWire {
  readonly url: string;
  readonly target?: CodegenTarget;
}

export interface CodegenResultWire {
  readonly script: string;
  readonly targetUrl: string;
}
