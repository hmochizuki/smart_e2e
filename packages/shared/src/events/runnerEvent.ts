import { z } from 'zod';
import { SCRIPT_MAX_CHARS } from '../constants.js';
import { RunStatusSchema } from '../domain/run.js';
import { StepRunStatusSchema } from '../domain/stepRun.js';
import { ErrorClassificationSchema } from '../domain/repair.js';

const LogLevelSchema = z.enum(['info', 'warn', 'error']);

export type LogLevel = z.infer<typeof LogLevelSchema>;

const SuiteStartedEventSchema = z.object({
  type: z.literal('suite_started'),
  suiteRunId: z.uuid(),
  suiteId: z.uuid(),
  startedAt: z.date(),
});

const StepStartedEventSchema = z.object({
  type: z.literal('step_started'),
  stepRunId: z.uuid(),
  stepId: z.uuid(),
  order: z.int().min(0),
  name: z.string().min(1).max(100),
});

const StepAttemptEventSchema = z.object({
  type: z.literal('step_attempt'),
  stepRunId: z.uuid(),
  attempt: z.int().min(1),
  script: z.string().min(1).max(SCRIPT_MAX_CHARS),
});

const RepairClassifiedEventSchema = z.object({
  type: z.literal('repair_classified'),
  stepRunId: z.uuid(),
  attempt: z.int().min(1),
  classification: ErrorClassificationSchema,
  errorLog: z.string(),
});

const RepairGeneratedEventSchema = z.object({
  type: z.literal('repair_generated'),
  stepRunId: z.uuid(),
  attempt: z.int().min(1),
  diff: z.string(),
});

const RepairExhaustedEventSchema = z.object({
  type: z.literal('repair_exhausted'),
  stepRunId: z.uuid(),
  attempts: z.int().min(1),
  classification: ErrorClassificationSchema,
  finalErrorLog: z.string(),
});

const StepFinishedEventSchema = z.object({
  type: z.literal('step_finished'),
  stepRunId: z.uuid(),
  status: StepRunStatusSchema,
  attempts: z.int().min(1),
  finalScript: z.string().min(1).max(SCRIPT_MAX_CHARS),
});

const StepSkippedEventSchema = z.object({
  type: z.literal('step_skipped'),
  stepRunId: z.uuid(),
  reason: z.string(),
});

// suite_finished は abort 時も status: 'aborted' で発火する (suite_aborted イベントは存在しない)
const SuiteFinishedEventSchema = z.object({
  type: z.literal('suite_finished'),
  suiteRunId: z.uuid(),
  status: RunStatusSchema,
  finishedAt: z.date(),
});

const LogEventSchema = z.object({
  type: z.literal('log'),
  stepRunId: z.uuid().nullable(),
  level: LogLevelSchema,
  message: z.string(),
});

const ScreenshotEventSchema = z.object({
  type: z.literal('screenshot'),
  stepRunId: z.uuid(),
  path: z.string().min(1),
});

export const RunnerEventSchema = z.discriminatedUnion('type', [
  SuiteStartedEventSchema,
  StepStartedEventSchema,
  StepAttemptEventSchema,
  RepairClassifiedEventSchema,
  RepairGeneratedEventSchema,
  RepairExhaustedEventSchema,
  StepFinishedEventSchema,
  StepSkippedEventSchema,
  SuiteFinishedEventSchema,
  LogEventSchema,
  ScreenshotEventSchema,
]);

export type RunnerEvent = z.infer<typeof RunnerEventSchema>;
