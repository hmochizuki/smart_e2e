import { eq, asc } from 'drizzle-orm';
import {
  NewRepairAttemptInputSchema,
  ErrorClassificationSchema,
  RepairResultSchema,
  type NewRepairAttemptInput,
  type RepairAttempt,
  type RepairResult,
} from '@smart-e2e/shared';
import type { AppDatabase } from '../db.js';
import { repairAttempts, type RepairAttemptRow } from '../schema/repairAttempt.js';
import { NotFoundError, runWithConflictMapping } from '../errors.js';
import { epochMsToDate } from '../mappers/dateMapper.js';

type TxDb = Parameters<Parameters<AppDatabase['transaction']>[0]>[0];
type AnyDb = AppDatabase | TxDb;

const selectRepairAttemptById = (db: AnyDb, id: string): RepairAttemptRow | null => {
  const rows = db.select().from(repairAttempts).where(eq(repairAttempts.id, id)).all();
  return rows[0] ?? null;
};

export interface RepairRepositoryUpdateRepairAttemptPatch {
  readonly llmOutputScript?: string | null;
  readonly result?: RepairResult;
}

const rowToRepairAttempt = (row: RepairAttemptRow): RepairAttempt => ({
  id: row.id,
  stepRunId: row.stepRunId,
  n: row.n,
  classification: ErrorClassificationSchema.parse(row.classification),
  errorLog: row.errorLog,
  screenshotPath: row.screenshotPath,
  domSnapshot: row.domSnapshot,
  llmInputScript: row.llmInputScript,
  llmOutputScript: row.llmOutputScript,
  result: RepairResultSchema.parse(row.result),
  createdAt: epochMsToDate(row.createdAt),
});

export class RepairRepository {
  constructor(private readonly db: AppDatabase) {}

  async createRepairAttempt(id: string, input: NewRepairAttemptInput): Promise<RepairAttempt> {
    const parsed = NewRepairAttemptInputSchema.parse(input);
    runWithConflictMapping('RepairAttempt', () => {
      this.db
        .insert(repairAttempts)
        .values({
          id,
          stepRunId: parsed.stepRunId,
          n: parsed.n,
          classification: parsed.classification,
          errorLog: parsed.errorLog,
          screenshotPath: parsed.screenshotPath,
          domSnapshot: parsed.domSnapshot,
          llmInputScript: parsed.llmInputScript,
          llmOutputScript: parsed.llmOutputScript,
          result: parsed.result,
          createdAt: parsed.createdAt.getTime(),
        })
        .run();
    });
    return this.findRepairAttemptByIdOrThrow(id);
  }

  findRepairAttemptById(id: string): Promise<RepairAttempt | null> {
    const rows = this.db.select().from(repairAttempts).where(eq(repairAttempts.id, id)).all();
    const row = rows[0];
    return Promise.resolve(row ? rowToRepairAttempt(row) : null);
  }

  async findRepairAttemptByIdOrThrow(id: string): Promise<RepairAttempt> {
    const found = await this.findRepairAttemptById(id);
    if (!found) {
      throw new NotFoundError('RepairAttempt', id);
    }
    return found;
  }

  listRepairAttemptsByStepRunId(stepRunId: string): Promise<RepairAttempt[]> {
    const rows = this.db
      .select()
      .from(repairAttempts)
      .where(eq(repairAttempts.stepRunId, stepRunId))
      .orderBy(asc(repairAttempts.n))
      .all();
    return Promise.resolve(rows.map(rowToRepairAttempt));
  }

  async updateRepairAttempt(
    id: string,
    patch: RepairRepositoryUpdateRepairAttemptPatch,
  ): Promise<RepairAttempt> {
    await Promise.resolve();
    const updated = this.db.transaction((tx) => {
      const existing = selectRepairAttemptById(tx, id);
      if (!existing) {
        throw new NotFoundError('RepairAttempt', id);
      }
      const setValues: {
        llmOutputScript?: string | null;
        result?: RepairResult;
      } = {};
      if ('llmOutputScript' in patch) {
        setValues.llmOutputScript = patch.llmOutputScript ?? null;
      }
      if (patch.result !== undefined) {
        setValues.result = patch.result;
      }
      if (Object.keys(setValues).length === 0) {
        return rowToRepairAttempt(existing);
      }
      runWithConflictMapping('RepairAttempt', () => {
        tx.update(repairAttempts).set(setValues).where(eq(repairAttempts.id, id)).run();
      });
      const fresh = selectRepairAttemptById(tx, id);
      if (!fresh) {
        throw new NotFoundError('RepairAttempt', id);
      }
      return rowToRepairAttempt(fresh);
    });
    return updated;
  }
}
