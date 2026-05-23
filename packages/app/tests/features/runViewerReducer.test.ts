import { describe, expect, it } from 'vitest';
import {
  initialRunViewerState,
  runViewerReducer,
  type RunViewerState,
} from '../../src/features/run-viewer/runViewerReducer.js';
import type { RunnerEventWire } from '../../src/ipc/types.js';

const SUITE_RUN_ID = '00000000-0000-0000-0000-0000000000aa';
const STEP_RUN_ID_1 = '00000000-0000-0000-0000-0000000000a1';
const STEP_RUN_ID_2 = '00000000-0000-0000-0000-0000000000a2';
const STEP_ID_1 = '00000000-0000-0000-0000-0000000000b1';
const STEP_ID_2 = '00000000-0000-0000-0000-0000000000b2';
const SUITE_ID = '00000000-0000-0000-0000-0000000000c1';

const apply = (events: ReadonlyArray<RunnerEventWire>): RunViewerState =>
  events.reduce((s, ev) => runViewerReducer(s, ev), initialRunViewerState);

describe('runViewerReducer', () => {
  it('suite_started で suiteStatus を running にセット', () => {
    const s = runViewerReducer(initialRunViewerState, {
      type: 'suite_started',
      suiteRunId: SUITE_RUN_ID,
      suiteId: SUITE_ID,
      startedAt: '2026-05-22T01:00:00.000Z',
    });
    expect(s.suiteStatus).toBe('running');
    expect(s.suiteStartedAt).toBe('2026-05-22T01:00:00.000Z');
  });

  it('step_started で新しい step を追加', () => {
    const s = apply([
      {
        type: 'step_started',
        stepRunId: STEP_RUN_ID_1,
        stepId: STEP_ID_1,
        order: 0,
        name: 'step A',
      },
    ]);
    expect(s.steps).toHaveLength(1);
    const step = s.steps[0];
    expect(step?.stepRunId).toBe(STEP_RUN_ID_1);
    expect(step?.name).toBe('step A');
    expect(step?.status).toBe('running');
  });

  it('複数 step は order 順にソートされる', () => {
    const s = apply([
      {
        type: 'step_started',
        stepRunId: STEP_RUN_ID_2,
        stepId: STEP_ID_2,
        order: 1,
        name: 'second',
      },
      {
        type: 'step_started',
        stepRunId: STEP_RUN_ID_1,
        stepId: STEP_ID_1,
        order: 0,
        name: 'first',
      },
    ]);
    expect(s.steps.map((x) => x.name)).toEqual(['first', 'second']);
  });

  it('step_attempt で attempts を更新する', () => {
    const s = apply([
      {
        type: 'step_started',
        stepRunId: STEP_RUN_ID_1,
        stepId: STEP_ID_1,
        order: 0,
        name: 'a',
      },
      { type: 'step_attempt', stepRunId: STEP_RUN_ID_1, attempt: 3, script: '...' },
    ]);
    expect(s.steps[0]?.attempts).toBe(3);
  });

  it('repair_classified で classification / errorLog をセット', () => {
    const s = apply([
      {
        type: 'step_started',
        stepRunId: STEP_RUN_ID_1,
        stepId: STEP_ID_1,
        order: 0,
        name: 'a',
      },
      {
        type: 'repair_classified',
        stepRunId: STEP_RUN_ID_1,
        attempt: 1,
        classification: 'ui_change',
        errorLog: 'click failed',
      },
    ]);
    expect(s.steps[0]?.classification).toBe('ui_change');
    expect(s.steps[0]?.errorLog).toBe('click failed');
  });

  it('repair_generated で diff を保持', () => {
    const s = apply([
      {
        type: 'step_started',
        stepRunId: STEP_RUN_ID_1,
        stepId: STEP_ID_1,
        order: 0,
        name: 'a',
      },
      { type: 'repair_generated', stepRunId: STEP_RUN_ID_1, attempt: 1, diff: '@@diff@@' },
    ]);
    expect(s.steps[0]?.diff).toBe('@@diff@@');
  });

  it('repair_exhausted で exhausted フラグを true に', () => {
    const s = apply([
      {
        type: 'step_started',
        stepRunId: STEP_RUN_ID_1,
        stepId: STEP_ID_1,
        order: 0,
        name: 'a',
      },
      {
        type: 'repair_exhausted',
        stepRunId: STEP_RUN_ID_1,
        attempts: 3,
        classification: 'ui_change',
        finalErrorLog: 'final',
      },
    ]);
    expect(s.steps[0]?.exhausted).toBe(true);
    expect(s.steps[0]?.errorLog).toBe('final');
  });

  it('step_finished で status / finalScript を確定', () => {
    const s = apply([
      {
        type: 'step_started',
        stepRunId: STEP_RUN_ID_1,
        stepId: STEP_ID_1,
        order: 0,
        name: 'a',
      },
      {
        type: 'step_finished',
        stepRunId: STEP_RUN_ID_1,
        status: 'succeeded',
        attempts: 2,
        finalScript: 'final script',
      },
    ]);
    expect(s.steps[0]?.status).toBe('succeeded');
    expect(s.steps[0]?.finalScript).toBe('final script');
    expect(s.steps[0]?.attempts).toBe(2);
  });

  it('step_skipped で status を skipped に', () => {
    const s = apply([
      {
        type: 'step_started',
        stepRunId: STEP_RUN_ID_1,
        stepId: STEP_ID_1,
        order: 0,
        name: 'a',
      },
      { type: 'step_skipped', stepRunId: STEP_RUN_ID_1, reason: 'aborted' },
    ]);
    expect(s.steps[0]?.status).toBe('skipped');
    expect(s.steps[0]?.skippedReason).toBe('aborted');
  });

  it('suite_finished で suiteStatus と finishedAt を確定', () => {
    const s = apply([
      {
        type: 'suite_finished',
        suiteRunId: SUITE_RUN_ID,
        status: 'aborted',
        finishedAt: '2026-05-22T01:01:00.000Z',
      },
    ]);
    expect(s.suiteStatus).toBe('aborted');
    expect(s.suiteFinishedAt).toBe('2026-05-22T01:01:00.000Z');
  });

  it('log event は logs に追記される', () => {
    const s = apply([{ type: 'log', stepRunId: STEP_RUN_ID_1, level: 'warn', message: 'oops' }]);
    expect(s.logs[0]).toContain('[warn]');
    expect(s.logs[0]).toContain('oops');
  });
});
