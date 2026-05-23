// llmOutputScript の null は LLM未呼び出しを意味する。
// - classification 'transient' or 'incident': LLM は分類のみ判定し修復スクリプトを生成しない → null
// - classification 'precondition' or 'ui_change': LLM が修復スクリプトを生成 → 必ず1文字以上
import { z } from 'zod';
import { SCRIPT_MAX_CHARS } from '../constants.js';

export const ErrorClassificationSchema = z.enum([
  'transient',
  'precondition',
  'ui_change',
  'incident',
]);

export type ErrorClassification = z.infer<typeof ErrorClassificationSchema>;

export const RepairResultSchema = z.enum(['success', 'failure']);

export type RepairResult = z.infer<typeof RepairResultSchema>;

export const RepairAttemptSchema = z.object({
  id: z.uuid(),
  stepRunId: z.uuid(),
  n: z.int().min(1),
  classification: ErrorClassificationSchema,
  errorLog: z.string(),
  screenshotPath: z.string().nullable(),
  domSnapshot: z.string().nullable(),
  llmInputScript: z.string().min(1).max(SCRIPT_MAX_CHARS),
  llmOutputScript: z.string().min(1).max(SCRIPT_MAX_CHARS).nullable(),
  result: RepairResultSchema,
  createdAt: z.date(),
});

export type RepairAttempt = z.infer<typeof RepairAttemptSchema>;

export const NewRepairAttemptInputSchema = RepairAttemptSchema.omit({
  id: true,
});

export type NewRepairAttemptInput = z.infer<typeof NewRepairAttemptInputSchema>;
