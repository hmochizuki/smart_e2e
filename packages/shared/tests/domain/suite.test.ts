import { describe, expect, it } from 'vitest';
import { SuiteSchema, NewSuiteInputSchema } from '../../src/domain/suite.js';

const validId = '00000000-0000-4000-8000-000000000000';

const baseSuite = {
  id: validId,
  name: 'Login flow',
  description: 'ログインしてダッシュボードに遷移するスイート',
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-02T00:00:00Z'),
};

describe('SuiteSchema', () => {
  it('valid なオブジェクトをパースできる', () => {
    const parsed = SuiteSchema.parse(baseSuite);
    expect(parsed.id).toBe(validId);
    expect(parsed.name).toBe('Login flow');
  });

  it('description は省略可能', () => {
    const { description: _description, ...withoutDescription } = baseSuite;
    const parsed = SuiteSchema.parse(withoutDescription);
    expect(parsed.description).toBeUndefined();
  });

  it('description は null OK (nullish)', () => {
    const parsed = SuiteSchema.parse({ ...baseSuite, description: null });
    expect(parsed.description).toBeNull();
  });

  it('name が空文字だと失敗する', () => {
    const result = SuiteSchema.safeParse({ ...baseSuite, name: '' });
    expect(result.success).toBe(false);
  });

  it('name が 100 文字だとOK', () => {
    const name = 'a'.repeat(100);
    const result = SuiteSchema.safeParse({ ...baseSuite, name });
    expect(result.success).toBe(true);
  });

  it('name が 101 文字だと失敗する', () => {
    const name = 'a'.repeat(101);
    const result = SuiteSchema.safeParse({ ...baseSuite, name });
    expect(result.success).toBe(false);
  });

  it('description が 500 文字だとOK', () => {
    const description = 'a'.repeat(500);
    const result = SuiteSchema.safeParse({ ...baseSuite, description });
    expect(result.success).toBe(true);
  });

  it('description が 501 文字だと失敗する', () => {
    const description = 'a'.repeat(501);
    const result = SuiteSchema.safeParse({ ...baseSuite, description });
    expect(result.success).toBe(false);
  });

  it('id が不正な uuid だと失敗する', () => {
    const result = SuiteSchema.safeParse({ ...baseSuite, id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('createdAt が Date でないと失敗する', () => {
    const result = SuiteSchema.safeParse({
      ...baseSuite,
      createdAt: '2025-01-01',
    });
    expect(result.success).toBe(false);
  });
});

describe('NewSuiteInputSchema', () => {
  it('id / createdAt / updatedAt を含まない入力をパースできる', () => {
    const parsed = NewSuiteInputSchema.parse({
      name: 'New suite',
      description: 'desc',
    });
    expect(parsed.name).toBe('New suite');
  });

  it('description なしでもOK', () => {
    const parsed = NewSuiteInputSchema.parse({ name: 'New suite' });
    expect(parsed.name).toBe('New suite');
    expect(parsed.description).toBeUndefined();
  });

  it('name が空だと失敗', () => {
    const result = NewSuiteInputSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});
