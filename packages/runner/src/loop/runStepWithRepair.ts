import { err, ok, type ErrorClassification, type Result, type Step } from '@smart-e2e/shared';
import {
  IncidentDetectedError,
  LLMInvocationError,
  LLMResponseInvalidError,
  RepairLimitExceededError,
  StepRunInvocationError,
} from '../errors.js';
import { classifyError } from '../repair/classify.js';
import { generateRepair } from '../repair/generate.js';
import type { LLMClient } from '../repair/llmClient.js';
import { runStep, type FileSystem, type RunStepDeps } from '../playwright/runStep.js';
import type { SpawnFn } from '../playwright/spawn.js';
import type { RunnerEmitter } from '../events/emitter.js';

export type RunStepWithRepairDeps = {
  spawnFn: SpawnFn;
  fs: FileSystem;
  llmClient: LLMClient;
  emitter: RunnerEmitter;
  workDir: string;
  stepTimeoutMs: number;
  maxAttempts: number;
  stepRunId: string;
  runStepDeps?: Partial<RunStepDeps>;
};

export type StepRepairOutcome = {
  status: 'succeeded' | 'failed';
  attempts: number;
  finalScript: string;
};

export type StepRepairError =
  | RepairLimitExceededError
  | IncidentDetectedError
  | LLMInvocationError
  | LLMResponseInvalidError
  | StepRunInvocationError;

const isRepairableScriptCategory = (c: ErrorClassification): c is 'precondition' | 'ui_change' =>
  c === 'precondition' || c === 'ui_change';

export const runStepWithRepair = async (
  step: Step,
  deps: RunStepWithRepairDeps,
): Promise<Result<StepRepairOutcome, StepRepairError>> => {
  const {
    spawnFn,
    fs,
    llmClient,
    emitter,
    workDir,
    stepTimeoutMs,
    maxAttempts,
    stepRunId,
    runStepDeps,
  } = deps;

  emitter.emit({
    type: 'step_started',
    stepRunId,
    stepId: step.id,
    order: step.order,
    name: step.name,
  });

  let currentScript = step.script;
  let attempt = 1;
  // 最終試行失敗時の repair_exhausted イベント発火に使う「最後の分類」と「最後のエラーログ」。
  // どの試行も一度も分類できていない場合 (=最終試行で初めて失敗するなど) は、
  // 上限到達直前にもう一度だけ分類して埋める。
  let lastClassification: ErrorClassification | null = null;
  let lastErrorLog = '';

  while (attempt <= maxAttempts) {
    emitter.emit({
      type: 'step_attempt',
      stepRunId,
      attempt,
      script: currentScript,
    });

    const runResult = await runStep(
      { script: currentScript, workDir, timeoutMs: stepTimeoutMs },
      { spawnFn, fs, ...runStepDeps },
    );

    if (!runResult.ok) {
      // テスト実行そのものが起動失敗。修復不能。
      emitter.emit({
        type: 'step_finished',
        stepRunId,
        status: 'failed',
        attempts: attempt,
        finalScript: currentScript,
      });
      return err(runResult.error);
    }

    const stepRun = runResult.value;
    if (stepRun.status === 'succeeded') {
      emitter.emit({
        type: 'step_finished',
        stepRunId,
        status: 'succeeded',
        attempts: attempt,
        finalScript: currentScript,
      });
      return ok({
        status: 'succeeded',
        attempts: attempt,
        finalScript: currentScript,
      });
    }

    const currentErrorLog = stepRun.artifacts.errorMessage ?? '';

    // 失敗時は分類を行う (最終試行であっても repair_exhausted の payload を埋めるため必須)。
    const classifyResult = await classifyError(
      { script: currentScript, artifacts: stepRun.artifacts },
      { client: llmClient },
    );
    if (!classifyResult.ok) {
      emitter.emit({
        type: 'step_finished',
        stepRunId,
        status: 'failed',
        attempts: attempt,
        finalScript: currentScript,
      });
      return err(classifyResult.error);
    }
    const { classification, rationale } = classifyResult.value;
    lastClassification = classification;
    lastErrorLog = currentErrorLog;
    emitter.emit({
      type: 'repair_classified',
      stepRunId,
      attempt,
      classification,
      errorLog: currentErrorLog,
    });

    // incident は分類後に即座に abort (修復しない)。
    if (classification === 'incident') {
      emitter.emit({
        type: 'step_finished',
        stepRunId,
        status: 'failed',
        attempts: attempt,
        finalScript: currentScript,
      });
      return err(new IncidentDetectedError(rationale));
    }

    // 最終試行で失敗していたら、ここで repair_exhausted を打って打ち切り。
    // 修復生成 (generateRepair) は次の試行のためのものなので不要。
    if (attempt >= maxAttempts) {
      emitter.emit({
        type: 'repair_exhausted',
        stepRunId,
        attempts: attempt,
        classification,
        finalErrorLog: currentErrorLog,
      });
      emitter.emit({
        type: 'step_finished',
        stepRunId,
        status: 'failed',
        attempts: attempt,
        finalScript: currentScript,
      });
      return err(new RepairLimitExceededError(attempt));
    }

    if (isRepairableScriptCategory(classification)) {
      const genResult = await generateRepair(
        {
          script: currentScript,
          artifacts: stepRun.artifacts,
          classification,
        },
        { client: llmClient },
      );
      if (!genResult.ok) {
        emitter.emit({
          type: 'step_finished',
          stepRunId,
          status: 'failed',
          attempts: attempt,
          finalScript: currentScript,
        });
        return err(genResult.error);
      }
      emitter.emit({
        type: 'repair_generated',
        stepRunId,
        attempt,
        diff: genResult.value.diff,
      });
      currentScript = genResult.value.newScript;
    }
    // transient はスクリプト変えずに再実行
    attempt += 1;
  }

  // ループ脱出は理論上ここまで来ないが、フォールバックとして repair_exhausted も発火。
  emitter.emit({
    type: 'repair_exhausted',
    stepRunId,
    attempts: attempt,
    classification: lastClassification ?? 'transient',
    finalErrorLog: lastErrorLog,
  });
  emitter.emit({
    type: 'step_finished',
    stepRunId,
    status: 'failed',
    attempts: attempt,
    finalScript: currentScript,
  });
  return err(new RepairLimitExceededError(attempt));
};
