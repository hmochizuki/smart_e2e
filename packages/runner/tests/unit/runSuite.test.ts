import { describe, expect, it } from 'vitest';
import type { RunnerEvent, Step, Suite } from '@smart-e2e/shared';
import type { SpawnFn, SpawnResult } from '../../src/playwright/spawn.js';
import { createRunnerEmitter } from '../../src/events/emitter.js';
import { runSuite } from '../../src/loop/runSuite.js';
import { createFakeFileSystem } from '../helpers/fakeFs.js';
import { createFakeLLMClient } from '../helpers/fakeLLMClient.js';

const SUITE_ID = '00000000-0000-0000-0000-000000000001';

const suite = (): Suite => ({
  id: SUITE_ID,
  name: 's',
  createdAt: new Date(),
  updatedAt: new Date(),
});

const step = (id: string, order: number): Step => ({
  id,
  suiteId: SUITE_ID,
  order,
  name: `step-${order.toString()}`,
  script: "import { test } from '@playwright/test';\ntest('x', async () => {});",
  createdAt: new Date(),
  updatedAt: new Date(),
});

const succ: SpawnResult = {
  exitCode: 0,
  stdout: '',
  stderr: '',
  timedOut: false,
  durationMs: 1,
};
const fail: SpawnResult = {
  exitCode: 1,
  stdout: '',
  stderr: 'Error: boom',
  timedOut: false,
  durationMs: 1,
};

const seqSpawn = (rs: ReadonlyArray<SpawnResult>): SpawnFn => {
  let i = 0;
  return () => {
    if (i >= rs.length) return Promise.reject(new Error('exhausted'));
    const r = rs[i] ?? succ;
    i += 1;
    return Promise.resolve(r);
  };
};

const collect = () => {
  const events: RunnerEvent[] = [];
  const emitter = createRunnerEmitter();
  emitter.on((ev) => events.push(ev));
  return { emitter, events };
};

describe('runSuite', () => {
  it('全 step 成功で suite_finished succeeded', async () => {
    const { fs } = createFakeFileSystem();
    const { client } = createFakeLLMClient([]);
    const { emitter, events } = collect();
    const result = await runSuite(
      { suite: suite(), steps: [step('s1', 0), step('s2', 1)] },
      {
        spawnFn: seqSpawn([succ, succ]),
        fs,
        llmClient: client,
        emitter,
        workDir: '/tmp',
        stepTimeoutMs: 1000,
        maxAttempts: 3,
        suiteRunId: '00000000-0000-0000-0000-0000000000aa',
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe('succeeded');
    const finished = events.find((e) => e.type === 'suite_finished');
    expect(finished).toBeDefined();
    if (finished?.type === 'suite_finished') {
      expect(finished.status).toBe('succeeded');
    }
    expect(events.filter((e) => e.type === 'step_started').length).toBe(2);
  });

  it('途中 step 失敗で残りを skip し suite_finished aborted', async () => {
    const { fs } = createFakeFileSystem();
    const { client } = createFakeLLMClient([
      JSON.stringify({ classification: 'incident', rationale: '500' }),
    ]);
    const { emitter, events } = collect();
    const result = await runSuite(
      { suite: suite(), steps: [step('s1', 0), step('s2', 1), step('s3', 2)] },
      {
        spawnFn: seqSpawn([fail]),
        fs,
        llmClient: client,
        emitter,
        workDir: '/tmp',
        stepTimeoutMs: 1000,
        maxAttempts: 3,
        suiteRunId: '00000000-0000-0000-0000-0000000000aa',
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe('aborted');
    const skipped = events.filter((e) => e.type === 'step_skipped');
    expect(skipped.length).toBe(2);
    const finished = events.find((e) => e.type === 'suite_finished');
    if (finished?.type === 'suite_finished') {
      expect(finished.status).toBe('aborted');
    }
  });

  it('複合パターン: 1番目は ui_change で修復成功、2番目は incident で abort', async () => {
    const { fs } = createFakeFileSystem();
    const repairedScript =
      "import { test } from '@playwright/test';\ntest('x2', async () => {});\n";
    const { client } = createFakeLLMClient([
      // step1: 1回目失敗 → ui_change → 修復スクリプト → 2回目成功
      JSON.stringify({ classification: 'ui_change', rationale: 'sel' }),
      JSON.stringify({ script: repairedScript }),
      // step2: 1回目失敗 → incident → abort
      JSON.stringify({ classification: 'incident', rationale: '500' }),
    ]);
    const { emitter, events } = collect();
    const result = await runSuite(
      { suite: suite(), steps: [step('s1', 0), step('s2', 1), step('s3', 2)] },
      {
        spawnFn: seqSpawn([fail, succ, fail]),
        fs,
        llmClient: client,
        emitter,
        workDir: '/tmp',
        stepTimeoutMs: 1000,
        maxAttempts: 3,
        suiteRunId: '00000000-0000-0000-0000-0000000000aa',
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.status).toBe('aborted');
    expect(events.filter((e) => e.type === 'step_skipped').length).toBe(1);
    // step1 で repair_generated が一度発火しているはず
    expect(events.filter((e) => e.type === 'repair_generated').length).toBe(1);
    // step2 で incident classification があるはず
    const classified = events.filter((e) => e.type === 'repair_classified');
    expect(classified.length).toBe(2); // step1: ui_change, step2: incident
  });

  it('step が order 順で実行される', async () => {
    const { fs } = createFakeFileSystem();
    const { client } = createFakeLLMClient([]);
    const { emitter, events } = collect();
    // 順番にバラした入力でも order でソートされること
    await runSuite(
      {
        suite: suite(),
        steps: [step('s3', 2), step('s1', 0), step('s2', 1)],
      },
      {
        spawnFn: seqSpawn([succ, succ, succ]),
        fs,
        llmClient: client,
        emitter,
        workDir: '/tmp',
        stepTimeoutMs: 1000,
        maxAttempts: 3,
        suiteRunId: '00000000-0000-0000-0000-0000000000aa',
      },
    );
    const startedOrder = events
      .filter((e): e is Extract<RunnerEvent, { type: 'step_started' }> => e.type === 'step_started')
      .map((e) => e.order);
    expect(startedOrder).toEqual([0, 1, 2]);
  });
});
