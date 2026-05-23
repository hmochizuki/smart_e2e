import { randomUUID } from 'node:crypto';
import { ok, type Step, type Suite, type Result } from '@smart-e2e/shared';
import { runStepWithRepair } from './runStepWithRepair.js';
import type { RunStepWithRepairDeps } from './runStepWithRepair.js';
import type { LLMClient } from '../repair/llmClient.js';
import type { FileSystem } from '../playwright/runStep.js';
import type { SpawnFn } from '../playwright/spawn.js';
import type { RunnerEmitter } from '../events/emitter.js';

export type SuiteInput = {
  suite: Suite;
  steps: ReadonlyArray<Step>;
};

export type RunSuiteDeps = {
  spawnFn: SpawnFn;
  fs: FileSystem;
  llmClient: LLMClient;
  emitter: RunnerEmitter;
  workDir: string;
  stepTimeoutMs: number;
  maxAttempts: number;
  suiteRunId: string;
  stepRunIdFor?: (step: Step) => string;
};

export type RunSuiteStatus = 'succeeded' | 'aborted';

export type RunSuiteOutcome = {
  status: RunSuiteStatus;
  stepRunIds: ReadonlyArray<string>;
  failureReason: string | null;
};

// Suite 実行は「Step を順次実行 + 失敗時に残り step を skip して中断」。
// 中断時の終了 status は shared 規約に従い 'aborted'。永続化は emitter subscriber の責務。
export const runSuite = async (
  input: SuiteInput,
  deps: RunSuiteDeps,
): Promise<Result<RunSuiteOutcome, never>> => {
  const stepRunIdFor = deps.stepRunIdFor ?? (() => randomUUID());
  // order でソート (呼び出し側が逆順を渡してきても安定動作させる)
  const ordered = [...input.steps].sort((a, b) => a.order - b.order);

  deps.emitter.emit({
    type: 'suite_started',
    suiteRunId: deps.suiteRunId,
    suiteId: input.suite.id,
    startedAt: new Date(),
  });

  const stepRunIds: string[] = [];
  let aborted = false;
  let failureReason: string | null = null;

  for (let i = 0; i < ordered.length; i += 1) {
    const step = ordered[i];
    if (step === undefined) continue;
    const stepRunId = stepRunIdFor(step);
    stepRunIds.push(stepRunId);

    if (aborted) {
      deps.emitter.emit({
        type: 'step_skipped',
        stepRunId,
        reason: failureReason ?? 'aborted by previous step failure',
      });
      continue;
    }

    const stepDeps: RunStepWithRepairDeps = {
      spawnFn: deps.spawnFn,
      fs: deps.fs,
      llmClient: deps.llmClient,
      emitter: deps.emitter,
      workDir: deps.workDir,
      stepTimeoutMs: deps.stepTimeoutMs,
      maxAttempts: deps.maxAttempts,
      stepRunId,
    };
    const result = await runStepWithRepair(step, stepDeps);
    if (!result.ok) {
      aborted = true;
      failureReason = `step "${step.name}" failed: ${result.error.message}`;
    } else if (result.value.status === 'failed') {
      aborted = true;
      failureReason = `step "${step.name}" failed after ${String(result.value.attempts)} attempts`;
    }
  }

  const status: RunSuiteStatus = aborted ? 'aborted' : 'succeeded';
  deps.emitter.emit({
    type: 'suite_finished',
    suiteRunId: deps.suiteRunId,
    status,
    finishedAt: new Date(),
  });

  return ok({ status, stepRunIds, failureReason });
};
