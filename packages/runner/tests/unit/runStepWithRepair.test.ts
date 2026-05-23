import { describe, expect, it, vi } from 'vitest';
import type { RunnerEvent } from '@smart-e2e/shared';
import type { SpawnFn, SpawnResult } from '../../src/playwright/spawn.js';
import { createRunnerEmitter } from '../../src/events/emitter.js';
import { runStepWithRepair } from '../../src/loop/runStepWithRepair.js';
import { createFakeFileSystem } from '../helpers/fakeFs.js';
import { createFakeLLMClient } from '../helpers/fakeLLMClient.js';

const STEP_ID = '00000000-0000-0000-0000-0000000000aa';
const STEP_RUN_ID = '00000000-0000-0000-0000-0000000000ab';

const baseStep = () => ({
  id: STEP_ID,
  suiteId: '00000000-0000-0000-0000-0000000000ad',
  order: 0,
  name: 'login',
  script:
    "import { test } from '@playwright/test';\ntest('x', async ({ page }) => { await page.goto('/'); });",
  createdAt: new Date(),
  updatedAt: new Date(),
});

const successResult: SpawnResult = {
  exitCode: 0,
  stdout: '',
  stderr: '',
  timedOut: false,
  durationMs: 1,
};

const failureResult: SpawnResult = {
  exitCode: 1,
  stdout: '',
  stderr: 'TimeoutError: locator not found',
  timedOut: false,
  durationMs: 1,
};

const sequencedSpawn = (results: ReadonlyArray<SpawnResult>): SpawnFn => {
  let i = 0;
  return () => {
    if (i >= results.length) return Promise.reject(new Error('sequencedSpawn exhausted'));
    const r = results[i] ?? successResult;
    i += 1;
    return Promise.resolve(r);
  };
};

const collectEvents = () => {
  const events: RunnerEvent[] = [];
  const emitter = createRunnerEmitter();
  emitter.on((ev) => events.push(ev));
  return { emitter, events };
};

const baseDeps = (
  spawnFn: SpawnFn,
  llmResponses: ReadonlyArray<string | Error>,
  overrides: { maxAttempts?: number } = {},
) => {
  const { fs } = createFakeFileSystem();
  const { client } = createFakeLLMClient(llmResponses);
  const { emitter, events } = collectEvents();
  return {
    deps: {
      spawnFn,
      fs,
      llmClient: client,
      emitter,
      workDir: '/tmp/runner',
      stepTimeoutMs: 1000,
      maxAttempts: overrides.maxAttempts ?? 3,
      stepRunId: STEP_RUN_ID,
    },
    events,
  };
};

describe('runStepWithRepair', () => {
  it('1回目で成功した場合は LLM を呼ばずに succeeded', async () => {
    const { deps, events } = baseDeps(sequencedSpawn([successResult]), []);
    const result = await runStepWithRepair(baseStep(), deps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('succeeded');
      expect(result.value.attempts).toBe(1);
    }
    expect(events.find((e) => e.type === 'step_started')).toBeDefined();
    expect(events.find((e) => e.type === 'step_finished')).toBeDefined();
    expect(events.find((e) => e.type === 'repair_classified')).toBeUndefined();
  });

  it('transient: スクリプトを変えずに再実行し2回目で成功', async () => {
    const { deps, events } = baseDeps(sequencedSpawn([failureResult, successResult]), [
      JSON.stringify({ classification: 'transient', rationale: 'timeout' }),
    ]);
    const result = await runStepWithRepair(baseStep(), deps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('succeeded');
      expect(result.value.attempts).toBe(2);
      expect(result.value.finalScript).toBe(baseStep().script);
    }
    expect(events.filter((e) => e.type === 'step_attempt').length).toBe(2);
    expect(events.filter((e) => e.type === 'repair_classified').length).toBe(1);
    expect(events.filter((e) => e.type === 'repair_generated').length).toBe(0);
  });

  it('ui_change: 修復スクリプトで2回目に成功する', async () => {
    const newScript =
      "import { test } from '@playwright/test';\ntest('x', async ({ page }) => { await page.goto('/new'); });\n";
    const { deps, events } = baseDeps(sequencedSpawn([failureResult, successResult]), [
      JSON.stringify({ classification: 'ui_change', rationale: 'selector' }),
      JSON.stringify({ script: newScript }),
    ]);
    const result = await runStepWithRepair(baseStep(), deps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('succeeded');
      expect(result.value.attempts).toBe(2);
      expect(result.value.finalScript).toBe(newScript);
    }
    expect(events.filter((e) => e.type === 'repair_generated').length).toBe(1);
  });

  it('precondition: 修復スクリプトで2回目に成功する', async () => {
    const newScript =
      "import { test } from '@playwright/test';\ntest('x', async ({ page }) => { /* both branches */ });\n";
    const { deps } = baseDeps(sequencedSpawn([failureResult, successResult]), [
      JSON.stringify({
        classification: 'precondition',
        rationale: 'existing data',
      }),
      JSON.stringify({ script: newScript }),
    ]);
    const result = await runStepWithRepair(baseStep(), deps);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('succeeded');
      expect(result.value.finalScript).toBe(newScript);
    }
  });

  it('incident: 即 abort で failed', async () => {
    const { deps, events } = baseDeps(sequencedSpawn([failureResult]), [
      JSON.stringify({ classification: 'incident', rationale: '500' }),
    ]);
    const result = await runStepWithRepair(baseStep(), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('RUNNER_INCIDENT_DETECTED');
    }
    expect(events.filter((e) => e.type === 'step_attempt').length).toBe(1);
    expect(events.find((e) => e.type === 'step_finished' && e.status === 'failed')).toBeDefined();
  });

  it('上限到達 (3回連続 transient で失敗) で failed、repair_exhausted が発火', async () => {
    // 新仕様: 最終試行でも失敗時に分類が走るため LLM 応答は3件必要
    const { deps, events } = baseDeps(
      sequencedSpawn([failureResult, failureResult, failureResult]),
      [
        JSON.stringify({ classification: 'transient', rationale: 't1' }),
        JSON.stringify({ classification: 'transient', rationale: 't2' }),
        JSON.stringify({ classification: 'transient', rationale: 't3' }),
      ],
    );
    const result = await runStepWithRepair(baseStep(), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('RUNNER_REPAIR_LIMIT_EXCEEDED');
    }
    expect(events.filter((e) => e.type === 'step_attempt').length).toBe(3);
    const exhausted = events.find((e) => e.type === 'repair_exhausted');
    expect(exhausted).toBeDefined();
    if (exhausted?.type === 'repair_exhausted') {
      expect(exhausted.attempts).toBe(3);
      expect(exhausted.classification).toBe('transient');
      expect(exhausted.finalErrorLog).toContain('TimeoutError');
    }
    // 順序: 最後の step_attempt の後に repair_classified, repair_exhausted, step_finished の順
    const types = events.map((e) => e.type);
    const exhaustedIdx = types.lastIndexOf('repair_exhausted');
    const finishedIdx = types.lastIndexOf('step_finished');
    expect(exhaustedIdx).toBeLessThan(finishedIdx);
  });

  it('repair_exhausted の payload に最後の classification と errorLog が入る (ui_change で2回繰り返してから上限)', async () => {
    const newScript =
      "import { test } from '@playwright/test';\ntest('x', async ({ page }) => { await page.goto('/v2'); });\n";
    const { deps, events } = baseDeps(
      sequencedSpawn([failureResult, failureResult, failureResult]),
      [
        JSON.stringify({ classification: 'ui_change', rationale: 'sel-1' }),
        JSON.stringify({ script: newScript }),
        JSON.stringify({ classification: 'ui_change', rationale: 'sel-2' }),
        JSON.stringify({ script: newScript }),
        JSON.stringify({ classification: 'ui_change', rationale: 'sel-3' }),
      ],
    );
    const result = await runStepWithRepair(baseStep(), deps);
    expect(result.ok).toBe(false);
    const exhausted = events.find((e) => e.type === 'repair_exhausted');
    expect(exhausted).toBeDefined();
    if (exhausted?.type === 'repair_exhausted') {
      expect(exhausted.attempts).toBe(3);
      expect(exhausted.classification).toBe('ui_change');
    }
  });

  it('maxAttempts=1 で1回目失敗 → 分類 → repair_exhausted で打ち切り', async () => {
    const { deps, events } = baseDeps(
      sequencedSpawn([failureResult]),
      [JSON.stringify({ classification: 'transient', rationale: 'first' })],
      { maxAttempts: 1 },
    );
    const result = await runStepWithRepair(baseStep(), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('RUNNER_REPAIR_LIMIT_EXCEEDED');
    }
    expect(events.filter((e) => e.type === 'step_attempt').length).toBe(1);
    const exhausted = events.find((e) => e.type === 'repair_exhausted');
    expect(exhausted).toBeDefined();
    if (exhausted?.type === 'repair_exhausted') {
      expect(exhausted.attempts).toBe(1);
      expect(exhausted.classification).toBe('transient');
    }
  });

  it('LLM 分類失敗で err', async () => {
    const { deps } = baseDeps(sequencedSpawn([failureResult]), ['not json at all']);
    const result = await runStepWithRepair(baseStep(), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('RUNNER_LLM_RESPONSE_INVALID');
    }
  });

  it('修復生成失敗で err', async () => {
    const { deps } = baseDeps(sequencedSpawn([failureResult]), [
      JSON.stringify({ classification: 'ui_change', rationale: 'x' }),
      'not json',
    ]);
    const result = await runStepWithRepair(baseStep(), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('RUNNER_LLM_RESPONSE_INVALID');
    }
  });

  it('emitter のイベント順序が想定どおり (success ケース)', async () => {
    const { deps, events } = baseDeps(sequencedSpawn([successResult]), []);
    const result = await runStepWithRepair(baseStep(), deps);
    expect(result.ok).toBe(true);
    const types = events.map((e) => e.type);
    expect(types[0]).toBe('step_started');
    expect(types[1]).toBe('step_attempt');
    expect(types[types.length - 1]).toBe('step_finished');
  });

  it('vi.fn でモックしても deps が呼ばれる', async () => {
    const spawnFn = vi.fn(sequencedSpawn([successResult]));
    const { deps } = baseDeps(spawnFn, []);
    const result = await runStepWithRepair(baseStep(), deps);
    expect(result.ok).toBe(true);
    expect(spawnFn).toHaveBeenCalledTimes(1);
  });
});
