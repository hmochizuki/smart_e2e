import { describe, expect, it } from 'vitest';
import {
  StepRunSchema,
  StepRunStatusSchema,
  NewStepRunInputSchema,
} from '../../src/domain/stepRun.js';

const validId = '00000000-0000-4000-8000-000000000000';
const suiteRunId = '11111111-1111-4111-8111-111111111111';
const stepId = '22222222-2222-4222-8222-222222222222';

const baseStepRun = {
  id: validId,
  suiteRunId,
  stepId,
  status: 'pending',
  attempts: 1,
  startedAt: new Date('2025-01-01T00:00:00Z'),
  finishedAt: null,
  finalScript: "test('x', async () => {});",
};

describe('StepRunStatusSchema', () => {
  it.each(['pending', 'running', 'succeeded', 'failed', 'skipped'])('%s は valid', (status) => {
    expect(StepRunStatusSchema.safeParse(status).success).toBe(true);
  });

  it('未定義の status は invalid', () => {
    expect(StepRunStatusSchema.safeParse('aborted').success).toBe(false);
  });
});

describe('StepRunSchema', () => {
  it('valid なオブジェクトをパースできる', () => {
    const parsed = StepRunSchema.parse(baseStepRun);
    expect(parsed.attempts).toBe(1);
    expect(parsed.finishedAt).toBeNull();
  });

  it('attempts が 0 だと失敗', () => {
    expect(StepRunSchema.safeParse({ ...baseStepRun, attempts: 0 }).success).toBe(false);
  });

  it('attempts が整数でないと失敗', () => {
    expect(StepRunSchema.safeParse({ ...baseStepRun, attempts: 1.5 }).success).toBe(false);
  });

  it('finishedAt は Date でもOK', () => {
    const parsed = StepRunSchema.parse({
      ...baseStepRun,
      finishedAt: new Date('2025-01-01T00:01:00Z'),
      status: 'succeeded',
    });
    expect(parsed.finishedAt).toBeInstanceOf(Date);
  });

  it('finalScript が空文字だと失敗', () => {
    expect(StepRunSchema.safeParse({ ...baseStepRun, finalScript: '' }).success).toBe(false);
  });

  it('pending 状態で finalScript: null が valid', () => {
    const parsed = StepRunSchema.parse({
      ...baseStepRun,
      status: 'pending',
      finalScript: null,
    });
    expect(parsed.finalScript).toBeNull();
  });

  it('running 状態で finalScript: null が valid', () => {
    const parsed = StepRunSchema.parse({
      ...baseStepRun,
      status: 'running',
      finalScript: null,
    });
    expect(parsed.finalScript).toBeNull();
  });
});

describe('NewStepRunInputSchema', () => {
  it('id を含まない入力をパースできる', () => {
    const parsed = NewStepRunInputSchema.parse({
      suiteRunId,
      stepId,
      status: 'pending',
      attempts: 1,
      startedAt: new Date('2025-01-01T00:00:00Z'),
      finishedAt: null,
      finalScript: null,
    });
    expect(parsed.status).toBe('pending');
    expect(parsed.finalScript).toBeNull();
  });
});
