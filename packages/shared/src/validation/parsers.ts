import type { ZodError, ZodType } from 'zod';
import { SuiteSchema, type Suite } from '../domain/suite.js';
import { StepSchema, type Step } from '../domain/step.js';
import { SuiteRunSchema, type SuiteRun } from '../domain/run.js';
import { StepRunSchema, type StepRun } from '../domain/stepRun.js';
import { RepairAttemptSchema, type RepairAttempt } from '../domain/repair.js';
import { ScriptHistorySchema, type ScriptHistory } from '../domain/scriptHistory.js';
import { RunnerEventSchema, type RunnerEvent } from '../events/runnerEvent.js';
import { ok, err, type Result } from './result.js';

const safeParseWith = <T>(schema: ZodType<T>, input: unknown): Result<T, ZodError> => {
  const r = schema.safeParse(input);
  return r.success ? ok(r.data) : err(r.error);
};

export const parseSuite = (input: unknown): Result<Suite, ZodError> =>
  safeParseWith(SuiteSchema, input);

export const parseStep = (input: unknown): Result<Step, ZodError> =>
  safeParseWith(StepSchema, input);

export const parseSuiteRun = (input: unknown): Result<SuiteRun, ZodError> =>
  safeParseWith(SuiteRunSchema, input);

export const parseStepRun = (input: unknown): Result<StepRun, ZodError> =>
  safeParseWith(StepRunSchema, input);

export const parseRepairAttempt = (input: unknown): Result<RepairAttempt, ZodError> =>
  safeParseWith(RepairAttemptSchema, input);

export const parseScriptHistory = (input: unknown): Result<ScriptHistory, ZodError> =>
  safeParseWith(ScriptHistorySchema, input);

export const parseRunnerEvent = (input: unknown): Result<RunnerEvent, ZodError> =>
  safeParseWith(RunnerEventSchema, input);
