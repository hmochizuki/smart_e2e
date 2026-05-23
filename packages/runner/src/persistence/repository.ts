import type {
  ErrorClassification,
  RepairResult,
  RunStatus,
  ScriptSource,
  StepRunStatus,
} from '@smart-e2e/shared';

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

// step_started イベント時点では「initial script」をそのまま finalScript フィールドに渡し、
// step_finished イベントを受けた段階で updateStepRun の finalScript として実際の最終スクリプトを上書きする運用。
// shared の StepRun.finalScript が nullable のため、未確定中は null も許可する。
export type CreateStepRunInput = {
  stepRunId: StepRunId;
  suiteRunId: SuiteRunId;
  stepId: string;
  status: StepRunStatus;
  attempts: number;
  startedAt: Date;
  finalScript: string | null;
};

// step_finished / repair_exhausted などのイベントを受けて呼ばれる。
// finalScript は「最終的に実行されたスクリプト (修復後 or 元のまま)」を入れる。
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

// runner 自体は永続化を行わない。
// 呼び出し側 (Tauri command や CLI ホスト) がこの interface を実装し、
// emitter のイベントを購読しながら DB / ファイルに書き出す。
export type RunnerPersistence = {
  createSuiteRun: (input: CreateSuiteRunInput) => Promise<SuiteRunId>;
  updateSuiteRun: (id: SuiteRunId, patch: UpdateSuiteRunPatch) => Promise<void>;
  createStepRun: (input: CreateStepRunInput) => Promise<StepRunId>;
  updateStepRun: (id: StepRunId, patch: UpdateStepRunPatch) => Promise<void>;
  createRepairAttempt: (input: CreateRepairAttemptInput) => Promise<RepairAttemptId>;
  saveScriptHistory: (input: SaveScriptHistoryInput) => Promise<void>;
};
