import { describe, expect, it } from 'vitest';
import { RunnerEventSchema } from '../../src/events/runnerEvent.js';

const suiteRunId = '00000000-0000-4000-8000-000000000000';
const suiteId = '11111111-1111-4111-8111-111111111111';
const stepRunId = '22222222-2222-4222-8222-222222222222';
const stepId = '33333333-3333-4333-8333-333333333333';

describe('RunnerEventSchema (discriminated union)', () => {
  it('suite_started を parse できる', () => {
    const event = {
      type: 'suite_started' as const,
      suiteRunId,
      suiteId,
      startedAt: new Date('2025-01-01T00:00:00Z'),
    };
    const parsed = RunnerEventSchema.parse(event);
    expect(parsed.type).toBe('suite_started');
  });

  it('step_started を parse できる', () => {
    const parsed = RunnerEventSchema.parse({
      type: 'step_started',
      stepRunId,
      stepId,
      order: 0,
      name: 'click login',
    });
    expect(parsed.type).toBe('step_started');
  });

  it('step_attempt を parse できる', () => {
    const parsed = RunnerEventSchema.parse({
      type: 'step_attempt',
      stepRunId,
      attempt: 2,
      script: "test('x', async () => {});",
    });
    expect(parsed.type).toBe('step_attempt');
  });

  it('repair_classified を parse できる', () => {
    const parsed = RunnerEventSchema.parse({
      type: 'repair_classified',
      stepRunId,
      attempt: 1,
      classification: 'ui_change',
      errorLog: 'TimeoutError',
    });
    expect(parsed.type).toBe('repair_classified');
  });

  it('repair_generated を parse できる', () => {
    const parsed = RunnerEventSchema.parse({
      type: 'repair_generated',
      stepRunId,
      attempt: 1,
      diff: '@@ -1 +1 @@\n-old\n+new\n',
    });
    expect(parsed.type).toBe('repair_generated');
  });

  it('repair_exhausted を parse できる', () => {
    const parsed = RunnerEventSchema.parse({
      type: 'repair_exhausted',
      stepRunId,
      attempts: 3,
      classification: 'ui_change',
      finalErrorLog: 'still failing after 3 attempts',
    });
    expect(parsed.type).toBe('repair_exhausted');
  });

  it('repair_exhausted で attempts: 0 だと失敗', () => {
    const result = RunnerEventSchema.safeParse({
      type: 'repair_exhausted',
      stepRunId,
      attempts: 0,
      classification: 'ui_change',
      finalErrorLog: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('step_finished を parse できる', () => {
    const parsed = RunnerEventSchema.parse({
      type: 'step_finished',
      stepRunId,
      status: 'succeeded',
      attempts: 1,
      finalScript: "test('x', async () => {});",
    });
    expect(parsed.type).toBe('step_finished');
  });

  it('step_skipped を parse できる', () => {
    const parsed = RunnerEventSchema.parse({
      type: 'step_skipped',
      stepRunId,
      reason: 'previous step failed',
    });
    expect(parsed.type).toBe('step_skipped');
  });

  it('suite_finished を parse できる', () => {
    const parsed = RunnerEventSchema.parse({
      type: 'suite_finished',
      suiteRunId,
      status: 'succeeded',
      finishedAt: new Date('2025-01-01T00:01:00Z'),
    });
    expect(parsed.type).toBe('suite_finished');
  });

  it('log を parse できる (stepRunId null)', () => {
    const parsed = RunnerEventSchema.parse({
      type: 'log',
      stepRunId: null,
      level: 'info',
      message: 'starting',
    });
    expect(parsed.type).toBe('log');
  });

  it('log を parse できる (stepRunId uuid)', () => {
    const parsed = RunnerEventSchema.parse({
      type: 'log',
      stepRunId,
      level: 'error',
      message: 'failed',
    });
    expect(parsed.type).toBe('log');
  });

  it('log の level が不正だと失敗', () => {
    const result = RunnerEventSchema.safeParse({
      type: 'log',
      stepRunId: null,
      level: 'debug',
      message: 'x',
    });
    expect(result.success).toBe(false);
  });

  it('screenshot を parse できる', () => {
    const parsed = RunnerEventSchema.parse({
      type: 'screenshot',
      stepRunId,
      path: '/tmp/shot.png',
    });
    expect(parsed.type).toBe('screenshot');
  });

  it('未定義の type は失敗', () => {
    expect(RunnerEventSchema.safeParse({ type: 'unknown' }).success).toBe(false);
  });
});
