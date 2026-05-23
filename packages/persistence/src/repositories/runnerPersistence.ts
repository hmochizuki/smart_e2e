import type {
  RunStatus,
  StepRunStatus,
  ErrorClassification,
  RepairResult,
  ScriptSource,
} from '@smart-e2e/shared';
import type { RunRepository } from './runRepository.js';
import type { RepairRepository } from './repairRepository.js';
import type { ScriptHistoryRepository } from './scriptHistoryRepository.js';

export type SuiteRunId = string;
export type StepRunId = string;
export type RepairAttemptId = string;

export type CreateSuiteRunInput = {
  suiteRunId: SuiteRunId;
  suiteId: string;
  status: RunStatus;
  startedAt: Date;
};

export type UpdateSuiteRunPatch = {
  status?: RunStatus;
  finishedAt?: Date | null;
  error?: string;
};

export type CreateStepRunInput = {
  stepRunId: StepRunId;
  suiteRunId: SuiteRunId;
  stepId: string;
  status: StepRunStatus;
  attempts: number;
  startedAt: Date;
  finalScript: string | null;
};

export type UpdateStepRunPatch = {
  status?: StepRunStatus;
  attempts?: number;
  finishedAt?: Date | null;
  finalScript?: string | null;
};

export type CreateRepairAttemptInput = {
  repairAttemptId: RepairAttemptId;
  stepRunId: StepRunId;
  n: number;
  classification: ErrorClassification;
  errorLog: string;
  screenshotPath: string | null;
  domSnapshot: string | null;
  llmInputScript: string;
  llmOutputScript: string | null;
  result: RepairResult;
  createdAt: Date;
};

export type SaveScriptHistoryInput = {
  stepId: string;
  script: string;
  source: ScriptSource;
  sourceRepairAttemptId: RepairAttemptId | null;
  createdAt: Date;
};

export type RunnerPersistence = {
  createSuiteRun: (input: CreateSuiteRunInput) => Promise<SuiteRunId>;
  updateSuiteRun: (id: SuiteRunId, patch: UpdateSuiteRunPatch) => Promise<void>;
  createStepRun: (input: CreateStepRunInput) => Promise<StepRunId>;
  updateStepRun: (id: StepRunId, patch: UpdateStepRunPatch) => Promise<void>;
  createRepairAttempt: (input: CreateRepairAttemptInput) => Promise<RepairAttemptId>;
  saveScriptHistory: (input: SaveScriptHistoryInput) => Promise<void>;
};

export class DrizzleRunnerPersistence implements RunnerPersistence {
  constructor(
    private readonly runRepo: RunRepository,
    private readonly repairRepo: RepairRepository,
    private readonly scriptHistoryRepo: ScriptHistoryRepository,
  ) {}

  async createSuiteRun(input: CreateSuiteRunInput): Promise<SuiteRunId> {
    await this.runRepo.createSuiteRun(input.suiteRunId, {
      suiteId: input.suiteId,
      status: input.status,
      startedAt: input.startedAt,
      finishedAt: null,
    });
    return input.suiteRunId;
  }

  async updateSuiteRun(id: SuiteRunId, patch: UpdateSuiteRunPatch): Promise<void> {
    await this.runRepo.updateSuiteRun(id, patch);
  }

  async createStepRun(input: CreateStepRunInput): Promise<StepRunId> {
    await this.runRepo.createStepRun(input.stepRunId, {
      suiteRunId: input.suiteRunId,
      stepId: input.stepId,
      status: input.status,
      attempts: input.attempts,
      startedAt: input.startedAt,
      finishedAt: null,
      finalScript: input.finalScript,
    });
    return input.stepRunId;
  }

  async updateStepRun(id: StepRunId, patch: UpdateStepRunPatch): Promise<void> {
    await this.runRepo.updateStepRun(id, patch);
  }

  async createRepairAttempt(input: CreateRepairAttemptInput): Promise<RepairAttemptId> {
    await this.repairRepo.createRepairAttempt(input.repairAttemptId, {
      stepRunId: input.stepRunId,
      n: input.n,
      classification: input.classification,
      errorLog: input.errorLog,
      screenshotPath: input.screenshotPath,
      domSnapshot: input.domSnapshot,
      llmInputScript: input.llmInputScript,
      llmOutputScript: input.llmOutputScript,
      result: input.result,
      createdAt: input.createdAt,
    });
    return input.repairAttemptId;
  }

  async saveScriptHistory(input: SaveScriptHistoryInput): Promise<void> {
    await this.scriptHistoryRepo.createScriptHistory({
      stepId: input.stepId,
      script: input.script,
      source: input.source,
      sourceRepairAttemptId: input.sourceRepairAttemptId,
      createdAt: input.createdAt,
    });
  }
}
