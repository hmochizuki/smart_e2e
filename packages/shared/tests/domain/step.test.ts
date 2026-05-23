import { describe, expect, it } from 'vitest';
import { StepSchema, NewStepInputSchema } from '../../src/domain/step.js';
import { SCRIPT_MAX_CHARS } from '../../src/constants.js';

const validId = '00000000-0000-4000-8000-000000000000';
const suiteId = '11111111-1111-4111-8111-111111111111';

const baseStep = {
  id: validId,
  suiteId,
  order: 0,
  name: 'click login button',
  script: "test('login', async ({ page }) => { await page.click('#login'); });",
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-02T00:00:00Z'),
};

describe('StepSchema', () => {
  it('valid なオブジェクトをパースできる', () => {
    const parsed = StepSchema.parse(baseStep);
    expect(parsed.id).toBe(validId);
    expect(parsed.order).toBe(0);
  });

  it('order が負数だと失敗', () => {
    const result = StepSchema.safeParse({ ...baseStep, order: -1 });
    expect(result.success).toBe(false);
  });

  it('order が整数でないと失敗', () => {
    const result = StepSchema.safeParse({ ...baseStep, order: 1.5 });
    expect(result.success).toBe(false);
  });

  it('name が空文字だと失敗', () => {
    const result = StepSchema.safeParse({ ...baseStep, name: '' });
    expect(result.success).toBe(false);
  });

  it('name が 100 文字だとOK / 101 文字だとNG', () => {
    expect(StepSchema.safeParse({ ...baseStep, name: 'a'.repeat(100) }).success).toBe(true);
    expect(StepSchema.safeParse({ ...baseStep, name: 'a'.repeat(101) }).success).toBe(false);
  });

  it('script が空文字だと失敗', () => {
    const result = StepSchema.safeParse({ ...baseStep, script: '' });
    expect(result.success).toBe(false);
  });

  it(`script が ${String(SCRIPT_MAX_CHARS)} chars 以下ならOK`, () => {
    const result = StepSchema.safeParse({
      ...baseStep,
      script: 'a'.repeat(SCRIPT_MAX_CHARS),
    });
    expect(result.success).toBe(true);
  });

  it('script が SCRIPT_MAX_CHARS 超過だと失敗', () => {
    const result = StepSchema.safeParse({
      ...baseStep,
      script: 'a'.repeat(SCRIPT_MAX_CHARS + 1),
    });
    expect(result.success).toBe(false);
  });

  it('suiteId が不正な uuid だと失敗', () => {
    const result = StepSchema.safeParse({ ...baseStep, suiteId: 'invalid' });
    expect(result.success).toBe(false);
  });
});

describe('NewStepInputSchema', () => {
  it('id / createdAt / updatedAt を含まない入力をパースできる', () => {
    const parsed = NewStepInputSchema.parse({
      suiteId,
      order: 1,
      name: 'next step',
      script: "test('x', async () => {});",
    });
    expect(parsed.order).toBe(1);
  });
});
