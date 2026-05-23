import { describe, expect, it } from 'vitest';
import {
  ErrorClassificationSchema,
  RepairAttemptSchema,
  NewRepairAttemptInputSchema,
} from '../../src/domain/repair.js';

const validId = '00000000-0000-4000-8000-000000000000';
const stepRunId = '11111111-1111-4111-8111-111111111111';

const baseRepair = {
  id: validId,
  stepRunId,
  n: 1,
  classification: 'ui_change',
  errorLog: 'TimeoutError: locator.click: Timeout 30000ms exceeded.',
  screenshotPath: null,
  domSnapshot: null,
  llmInputScript: "test('x', async () => { await page.click('#old'); });",
  llmOutputScript: "test('x', async () => { await page.click('#new'); });",
  result: 'success',
  createdAt: new Date('2025-01-01T00:00:00Z'),
};

describe('ErrorClassificationSchema', () => {
  it.each(['transient', 'precondition', 'ui_change', 'incident'])('%s は valid', (value) => {
    expect(ErrorClassificationSchema.safeParse(value).success).toBe(true);
  });

  it('未定義の classification は invalid', () => {
    expect(ErrorClassificationSchema.safeParse('unknown').success).toBe(false);
  });
});

describe('RepairAttemptSchema', () => {
  it('valid なオブジェクトをパースできる', () => {
    const parsed = RepairAttemptSchema.parse(baseRepair);
    expect(parsed.classification).toBe('ui_change');
    expect(parsed.result).toBe('success');
  });

  it('n が 0 だと失敗', () => {
    expect(RepairAttemptSchema.safeParse({ ...baseRepair, n: 0 }).success).toBe(false);
  });

  it('n が整数でないと失敗', () => {
    expect(RepairAttemptSchema.safeParse({ ...baseRepair, n: 1.2 }).success).toBe(false);
  });

  it('screenshotPath / domSnapshot は null OK', () => {
    const parsed = RepairAttemptSchema.parse(baseRepair);
    expect(parsed.screenshotPath).toBeNull();
    expect(parsed.domSnapshot).toBeNull();
  });

  it('screenshotPath は文字列でもOK', () => {
    const parsed = RepairAttemptSchema.parse({
      ...baseRepair,
      screenshotPath: '/tmp/screenshots/foo.png',
    });
    expect(parsed.screenshotPath).toBe('/tmp/screenshots/foo.png');
  });

  it('llmOutputScript は null OK (修復しなかった場合)', () => {
    const parsed = RepairAttemptSchema.parse({
      ...baseRepair,
      classification: 'incident',
      llmOutputScript: null,
      result: 'failure',
    });
    expect(parsed.llmOutputScript).toBeNull();
  });

  it('result が success/failure 以外は失敗', () => {
    expect(RepairAttemptSchema.safeParse({ ...baseRepair, result: 'unknown' }).success).toBe(false);
  });

  it('errorLog が空文字でも parse 可 (短い stderr 等)', () => {
    const parsed = RepairAttemptSchema.parse({ ...baseRepair, errorLog: '' });
    expect(parsed.errorLog).toBe('');
  });

  it("classification: 'transient' で llmOutputScript: null は valid (LLM未呼び出し)", () => {
    const parsed = RepairAttemptSchema.parse({
      ...baseRepair,
      classification: 'transient',
      llmOutputScript: null,
      result: 'failure',
    });
    expect(parsed.classification).toBe('transient');
    expect(parsed.llmOutputScript).toBeNull();
  });
});

describe('NewRepairAttemptInputSchema', () => {
  it('id を含まない入力をパースできる', () => {
    const { id: _id, ...withoutId } = baseRepair;
    const parsed = NewRepairAttemptInputSchema.parse(withoutId);
    expect(parsed.classification).toBe('ui_change');
  });
});
