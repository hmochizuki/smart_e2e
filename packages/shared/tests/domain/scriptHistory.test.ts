import { describe, expect, it } from 'vitest';
import {
  ScriptHistorySchema,
  ScriptSourceSchema,
  NewScriptHistoryInputSchema,
} from '../../src/domain/scriptHistory.js';

const validId = '00000000-0000-4000-8000-000000000000';
const stepId = '11111111-1111-4111-8111-111111111111';
const repairAttemptId = '22222222-2222-4222-8222-222222222222';

const baseHistory = {
  id: validId,
  stepId,
  script: "test('x', async () => {});",
  source: 'codegen',
  sourceRepairAttemptId: null,
  createdAt: new Date('2025-01-01T00:00:00Z'),
};

describe('ScriptSourceSchema', () => {
  it.each(['codegen', 'user_edit', 'auto_repair'])('%s は valid', (source) => {
    expect(ScriptSourceSchema.safeParse(source).success).toBe(true);
  });

  it('未定義のソースは invalid', () => {
    expect(ScriptSourceSchema.safeParse('manual').success).toBe(false);
  });
});

describe('ScriptHistorySchema', () => {
  it('valid なオブジェクトをパースできる', () => {
    const parsed = ScriptHistorySchema.parse(baseHistory);
    expect(parsed.source).toBe('codegen');
    expect(parsed.sourceRepairAttemptId).toBeNull();
  });

  it('auto_repair の場合は sourceRepairAttemptId が uuid', () => {
    const parsed = ScriptHistorySchema.parse({
      ...baseHistory,
      source: 'auto_repair',
      sourceRepairAttemptId: repairAttemptId,
    });
    expect(parsed.sourceRepairAttemptId).toBe(repairAttemptId);
  });

  it('sourceRepairAttemptId が不正な uuid だと失敗', () => {
    expect(
      ScriptHistorySchema.safeParse({
        ...baseHistory,
        sourceRepairAttemptId: 'invalid',
      }).success,
    ).toBe(false);
  });

  it('script が空文字だと失敗', () => {
    expect(ScriptHistorySchema.safeParse({ ...baseHistory, script: '' }).success).toBe(false);
  });
});

describe('ScriptHistorySchema refine: source と sourceRepairAttemptId の整合', () => {
  it('auto_repair + uuid → OK', () => {
    const result = ScriptHistorySchema.safeParse({
      ...baseHistory,
      source: 'auto_repair',
      sourceRepairAttemptId: repairAttemptId,
    });
    expect(result.success).toBe(true);
  });

  it('auto_repair + null → NG', () => {
    const result = ScriptHistorySchema.safeParse({
      ...baseHistory,
      source: 'auto_repair',
      sourceRepairAttemptId: null,
    });
    expect(result.success).toBe(false);
  });

  it('codegen + uuid → NG', () => {
    const result = ScriptHistorySchema.safeParse({
      ...baseHistory,
      source: 'codegen',
      sourceRepairAttemptId: repairAttemptId,
    });
    expect(result.success).toBe(false);
  });

  it('codegen + null → OK', () => {
    const result = ScriptHistorySchema.safeParse({
      ...baseHistory,
      source: 'codegen',
      sourceRepairAttemptId: null,
    });
    expect(result.success).toBe(true);
  });
});

describe('NewScriptHistoryInputSchema', () => {
  it('id を含まない入力で auto_repair + uuid をパースできる', () => {
    const parsed = NewScriptHistoryInputSchema.parse({
      stepId,
      script: "test('x', async () => {});",
      source: 'auto_repair',
      sourceRepairAttemptId: repairAttemptId,
      createdAt: new Date('2025-01-01T00:00:00Z'),
    });
    expect(parsed.source).toBe('auto_repair');
  });

  it('refine 制約が NewScriptHistoryInputSchema でも効く', () => {
    const result = NewScriptHistoryInputSchema.safeParse({
      stepId,
      script: "test('x', async () => {});",
      source: 'codegen',
      sourceRepairAttemptId: repairAttemptId,
      createdAt: new Date('2025-01-01T00:00:00Z'),
    });
    expect(result.success).toBe(false);
  });
});
