import { describe, expect, it } from 'vitest';
import { SuiteRunSchema, RunStatusSchema, NewSuiteRunInputSchema } from '../../src/domain/run.js';

const validId = '00000000-0000-4000-8000-000000000000';
const suiteId = '11111111-1111-4111-8111-111111111111';

const baseRun = {
  id: validId,
  suiteId,
  status: 'pending',
  startedAt: new Date('2025-01-01T00:00:00Z'),
  finishedAt: null,
};

describe('RunStatusSchema', () => {
  it.each(['pending', 'running', 'succeeded', 'failed', 'aborted'])('%s は valid', (status) => {
    expect(RunStatusSchema.safeParse(status).success).toBe(true);
  });

  it('未定義の status は invalid', () => {
    expect(RunStatusSchema.safeParse('unknown').success).toBe(false);
  });
});

describe('SuiteRunSchema', () => {
  it('valid なオブジェクトをパースできる', () => {
    const parsed = SuiteRunSchema.parse(baseRun);
    expect(parsed.status).toBe('pending');
    expect(parsed.finishedAt).toBeNull();
  });

  it('finishedAt が Date でもOK', () => {
    const parsed = SuiteRunSchema.parse({
      ...baseRun,
      status: 'succeeded',
      finishedAt: new Date('2025-01-01T00:01:00Z'),
    });
    expect(parsed.finishedAt).toBeInstanceOf(Date);
  });

  it('error は optional', () => {
    const parsed = SuiteRunSchema.parse({
      ...baseRun,
      status: 'failed',
      error: 'something went wrong',
    });
    expect(parsed.error).toBe('something went wrong');
  });

  it('error なしでもOK', () => {
    const parsed = SuiteRunSchema.parse(baseRun);
    expect(parsed.error).toBeUndefined();
  });

  it('id が不正だと失敗', () => {
    expect(SuiteRunSchema.safeParse({ ...baseRun, id: 'invalid' }).success).toBe(false);
  });

  it('status が不正だと失敗', () => {
    expect(SuiteRunSchema.safeParse({ ...baseRun, status: 'unknown' }).success).toBe(false);
  });

  it('error は null OK (nullish)', () => {
    const parsed = SuiteRunSchema.parse({ ...baseRun, error: null });
    expect(parsed.error).toBeNull();
  });
});

describe('NewSuiteRunInputSchema', () => {
  it('id を含まない入力をパースできる', () => {
    const parsed = NewSuiteRunInputSchema.parse({
      suiteId,
      status: 'running',
      startedAt: new Date('2025-01-01T00:00:00Z'),
      finishedAt: null,
    });
    expect(parsed.status).toBe('running');
  });
});
