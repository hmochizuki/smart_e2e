import { eq, asc } from 'drizzle-orm';
import {
  NewSuiteRunInputSchema,
  NewStepRunInputSchema,
  RunStatusSchema,
  StepRunStatusSchema,
  type NewSuiteRunInput,
  type NewStepRunInput,
  type SuiteRun,
  type StepRun,
  type RunStatus,
  type StepRunStatus,
} from '@smart-e2e/shared';
import type { AppDatabase } from '../db.js';
import { suiteRuns, type SuiteRunRow } from '../schema/suiteRun.js';
import { stepRuns, type StepRunRow } from '../schema/stepRun.js';
import { NotFoundError, runWithConflictMapping } from '../errors.js';
import {
  epochMsToDate,
  epochMsToNullableDate,
  nullishToNullable,
  nullableDateInputToEpochMs,
} from '../mappers/dateMapper.js';

type TxDb = Parameters<Parameters<AppDatabase['transaction']>[0]>[0];
type AnyDb = AppDatabase | TxDb;

const rowToSuiteRun = (row: SuiteRunRow): SuiteRun => {
  const error = row.error;
  const base = {
    id: row.id,
    suiteId: row.suiteId,
    status: RunStatusSchema.parse(row.status),
    startedAt: epochMsToDate(row.startedAt),
    finishedAt: epochMsToNullableDate(row.finishedAt),
  } as const;
  return error === null ? base : { ...base, error };
};

const rowToStepRun = (row: StepRunRow): StepRun => ({
  id: row.id,
  suiteRunId: row.suiteRunId,
  stepId: row.stepId,
  status: StepRunStatusSchema.parse(row.status),
  attempts: row.attempts,
  startedAt: epochMsToDate(row.startedAt),
  finishedAt: epochMsToNullableDate(row.finishedAt),
  finalScript: row.finalScript,
});

const selectSuiteRunById = (db: AnyDb, id: string): SuiteRun | null => {
  const rows = db.select().from(suiteRuns).where(eq(suiteRuns.id, id)).all();
  const row = rows[0];
  return row ? rowToSuiteRun(row) : null;
};

const selectStepRunById = (db: AnyDb, id: string): StepRun | null => {
  const rows = db.select().from(stepRuns).where(eq(stepRuns.id, id)).all();
  const row = rows[0];
  return row ? rowToStepRun(row) : null;
};

export interface RunRepositoryUpdateSuiteRunPatch {
  readonly status?: RunStatus;
  readonly finishedAt?: Date | null;
  readonly error?: string;
}

export interface RunRepositoryUpdateStepRunPatch {
  readonly status?: StepRunStatus;
  readonly attempts?: number;
  readonly finishedAt?: Date | null;
  readonly finalScript?: string | null;
}

export class RunRepository {
  constructor(private readonly db: AppDatabase) {}

  async createSuiteRun(id: string, input: NewSuiteRunInput): Promise<SuiteRun> {
    const parsed = NewSuiteRunInputSchema.parse(input);
    runWithConflictMapping('SuiteRun', () => {
      this.db
        .insert(suiteRuns)
        .values({
          id,
          suiteId: parsed.suiteId,
          status: parsed.status,
          startedAt: parsed.startedAt.getTime(),
          finishedAt: nullableDateInputToEpochMs(parsed.finishedAt),
          error: nullishToNullable(parsed.error),
        })
        .run();
    });
    return this.findSuiteRunByIdOrThrow(id);
  }

  findSuiteRunById(id: string): Promise<SuiteRun | null> {
    return Promise.resolve(selectSuiteRunById(this.db, id));
  }

  async findSuiteRunByIdOrThrow(id: string): Promise<SuiteRun> {
    const found = await this.findSuiteRunById(id);
    if (!found) {
      throw new NotFoundError('SuiteRun', id);
    }
    return found;
  }

  listSuiteRunsBySuiteId(suiteId: string): Promise<SuiteRun[]> {
    const rows = this.db
      .select()
      .from(suiteRuns)
      .where(eq(suiteRuns.suiteId, suiteId))
      .orderBy(asc(suiteRuns.startedAt))
      .all();
    return Promise.resolve(rows.map(rowToSuiteRun));
  }

  async updateSuiteRun(id: string, patch: RunRepositoryUpdateSuiteRunPatch): Promise<void> {
    await Promise.resolve();
    this.db.transaction((tx) => {
      const existing = selectSuiteRunById(tx, id);
      if (!existing) {
        throw new NotFoundError('SuiteRun', id);
      }
      const setValues: {
        status?: RunStatus;
        finishedAt?: number | null;
        error?: string | null;
      } = {};
      if (patch.status !== undefined) {
        setValues.status = patch.status;
      }
      if ('finishedAt' in patch) {
        setValues.finishedAt = nullableDateInputToEpochMs(patch.finishedAt ?? null);
      }
      if (patch.error !== undefined) {
        setValues.error = patch.error;
      }
      if (Object.keys(setValues).length === 0) {
        return;
      }
      tx.update(suiteRuns).set(setValues).where(eq(suiteRuns.id, id)).run();
    });
  }

  deleteSuiteRun(id: string): Promise<void> {
    this.db.delete(suiteRuns).where(eq(suiteRuns.id, id)).run();
    return Promise.resolve();
  }

  async createStepRun(id: string, input: NewStepRunInput): Promise<StepRun> {
    const parsed = NewStepRunInputSchema.parse(input);
    runWithConflictMapping('StepRun', () => {
      this.db
        .insert(stepRuns)
        .values({
          id,
          suiteRunId: parsed.suiteRunId,
          stepId: parsed.stepId,
          status: parsed.status,
          attempts: parsed.attempts,
          startedAt: parsed.startedAt.getTime(),
          finishedAt: nullableDateInputToEpochMs(parsed.finishedAt),
          finalScript: parsed.finalScript,
        })
        .run();
    });
    return this.findStepRunByIdOrThrow(id);
  }

  findStepRunById(id: string): Promise<StepRun | null> {
    return Promise.resolve(selectStepRunById(this.db, id));
  }

  async findStepRunByIdOrThrow(id: string): Promise<StepRun> {
    const found = await this.findStepRunById(id);
    if (!found) {
      throw new NotFoundError('StepRun', id);
    }
    return found;
  }

  listStepRunsBySuiteRunId(suiteRunId: string): Promise<StepRun[]> {
    const rows = this.db
      .select()
      .from(stepRuns)
      .where(eq(stepRuns.suiteRunId, suiteRunId))
      .orderBy(asc(stepRuns.startedAt))
      .all();
    return Promise.resolve(rows.map(rowToStepRun));
  }

  async updateStepRun(id: string, patch: RunRepositoryUpdateStepRunPatch): Promise<void> {
    await Promise.resolve();
    this.db.transaction((tx) => {
      const existing = selectStepRunById(tx, id);
      if (!existing) {
        throw new NotFoundError('StepRun', id);
      }
      const setValues: {
        status?: StepRunStatus;
        attempts?: number;
        finishedAt?: number | null;
        finalScript?: string | null;
      } = {};
      if (patch.status !== undefined) {
        setValues.status = patch.status;
      }
      if (patch.attempts !== undefined) {
        setValues.attempts = patch.attempts;
      }
      if ('finishedAt' in patch) {
        setValues.finishedAt = nullableDateInputToEpochMs(patch.finishedAt ?? null);
      }
      if ('finalScript' in patch) {
        setValues.finalScript = patch.finalScript ?? null;
      }
      if (Object.keys(setValues).length === 0) {
        return;
      }
      tx.update(stepRuns).set(setValues).where(eq(stepRuns.id, id)).run();
    });
  }
}
