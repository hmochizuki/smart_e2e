import { z } from 'zod';
import { SCRIPT_MAX_CHARS } from '../constants.js';

export const StepSchema = z.object({
  id: z.uuid(),
  suiteId: z.uuid(),
  order: z.int().min(0),
  name: z.string().min(1).max(100),
  script: z.string().min(1).max(SCRIPT_MAX_CHARS),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Step = z.infer<typeof StepSchema>;

export const NewStepInputSchema = StepSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type NewStepInput = z.infer<typeof NewStepInputSchema>;
