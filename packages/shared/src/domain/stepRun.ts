import { z } from 'zod';
import { SCRIPT_MAX_CHARS } from '../constants.js';

export const StepRunStatusSchema = z.enum(['pending', 'running', 'succeeded', 'failed', 'skipped']);

export type StepRunStatus = z.infer<typeof StepRunStatusSchema>;

export const StepRunSchema = z.object({
  id: z.uuid(),
  suiteRunId: z.uuid(),
  stepId: z.uuid(),
  status: StepRunStatusSchema,
  attempts: z.int().min(1),
  startedAt: z.date(),
  finishedAt: z.date().nullable(),
  finalScript: z.string().min(1).max(SCRIPT_MAX_CHARS).nullable(),
});

export type StepRun = z.infer<typeof StepRunSchema>;

export const NewStepRunInputSchema = StepRunSchema.omit({ id: true });

export type NewStepRunInput = z.infer<typeof NewStepRunInputSchema>;
