import { eq, asc } from 'drizzle-orm';
import {
  NewRepairAttemptInputSchema,
  ErrorClassificationSchema,
  RepairResultSchema,
  type NewRepairAttemptInput,
  type RepairAttempt,
} from '@smart-e2e/shared';
import type { AppDatabase } from '../db.js';
import { repairAttempts, type RepairAttemptRow } from '../schema/repairAttempt.js';
import { NotFoundError, runWithConflictMapping } from '../errors.js';
import { epochMsToDate } from '../mappers/dateMapper.js';

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
}
