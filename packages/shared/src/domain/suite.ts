import { z } from 'zod';

export const SuiteSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Suite = z.infer<typeof SuiteSchema>;

export const NewSuiteInputSchema = SuiteSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type NewSuiteInput = z.infer<typeof NewSuiteInputSchema>;
