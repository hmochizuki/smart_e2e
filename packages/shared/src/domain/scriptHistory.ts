import { z } from 'zod';
import { SCRIPT_MAX_CHARS } from '../constants.js';

export const ScriptSourceSchema = z.enum(['codegen', 'user_edit', 'auto_repair']);

export type ScriptSource = z.infer<typeof ScriptSourceSchema>;

const ScriptHistoryShape = z.object({
  id: z.uuid(),
  stepId: z.uuid(),
  script: z.string().min(1).max(SCRIPT_MAX_CHARS),
  source: ScriptSourceSchema,
  sourceRepairAttemptId: z.uuid().nullable(),
  createdAt: z.date(),
});

type ScriptHistoryRefineInput = {
  source: ScriptSource;
  sourceRepairAttemptId: string | null;
};

const scriptHistoryRefine = (d: ScriptHistoryRefineInput): boolean =>
  d.source === 'auto_repair' ? d.sourceRepairAttemptId !== null : d.sourceRepairAttemptId === null;

const refineMessage = {
  message: 'sourceRepairAttemptId は source が auto_repair のときのみ非nullにしてください',
  path: ['sourceRepairAttemptId'],
};

export const ScriptHistorySchema = ScriptHistoryShape.refine(scriptHistoryRefine, refineMessage);

export type ScriptHistory = z.infer<typeof ScriptHistoryShape>;

export const NewScriptHistoryInputSchema = ScriptHistoryShape.omit({
  id: true,
}).refine(scriptHistoryRefine, refineMessage);

export type NewScriptHistory = z.infer<typeof NewScriptHistoryInputSchema>;
