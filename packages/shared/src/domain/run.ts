import { z } from 'zod';

export const RunStatusSchema = z.enum(['pending', 'running', 'succeeded', 'failed', 'aborted']);

export type RunStatus = z.infer<typeof RunStatusSchema>;

export const SuiteRunSchema = z.object({
  id: z.uuid(),
  suiteId: z.uuid(),
  status: RunStatusSchema,
  startedAt: z.date(),
  finishedAt: z.date().nullable(),
  error: z.string().nullish(),
});

export type SuiteRun = z.infer<typeof SuiteRunSchema>;

export const NewSuiteRunInputSchema = SuiteRunSchema.omit({ id: true });

export type NewSuiteRunInput = z.infer<typeof NewSuiteRunInputSchema>;
