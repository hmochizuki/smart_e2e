import { randomUUID } from 'node:crypto';
import { eq, asc } from 'drizzle-orm';
import {
  NewScriptHistoryInputSchema,
  ScriptSourceSchema,
  type NewScriptHistory,
  type ScriptHistory,
} from '@smart-e2e/shared';
import type { AppDatabase } from '../db.js';
import { scriptHistories, type ScriptHistoryRow } from '../schema/scriptHistory.js';
import { NotFoundError, runWithConflictMapping } from '../errors.js';
import { epochMsToDate } from '../mappers/dateMapper.js';

const rowToScriptHistory = (row: ScriptHistoryRow): ScriptHistory => ({
  id: row.id,
  stepId: row.stepId,
  script: row.script,
  source: ScriptSourceSchema.parse(row.source),
  sourceRepairAttemptId: row.sourceRepairAttemptId,
  createdAt: epochMsToDate(row.createdAt),
});

export class ScriptHistoryRepository {
  constructor(private readonly db: AppDatabase) {}

  async createScriptHistory(input: NewScriptHistory): Promise<ScriptHistory> {
    const parsed = NewScriptHistoryInputSchema.parse(input);
    const id = randomUUID();
    runWithConflictMapping('ScriptHistory', () => {
      this.db
        .insert(scriptHistories)
        .values({
          id,
          stepId: parsed.stepId,
          script: parsed.script,
          source: parsed.source,
          sourceRepairAttemptId: parsed.sourceRepairAttemptId,
          createdAt: parsed.createdAt.getTime(),
        })
        .run();
    });
    return this.findScriptHistoryByIdOrThrow(id);
  }

  findScriptHistoryById(id: string): Promise<ScriptHistory | null> {
    const rows = this.db.select().from(scriptHistories).where(eq(scriptHistories.id, id)).all();
    const row = rows[0];
    return Promise.resolve(row ? rowToScriptHistory(row) : null);
  }

  async findScriptHistoryByIdOrThrow(id: string): Promise<ScriptHistory> {
    const found = await this.findScriptHistoryById(id);
    if (!found) {
      throw new NotFoundError('ScriptHistory', id);
    }
    return found;
  }

  listScriptHistoriesByStepId(stepId: string): Promise<ScriptHistory[]> {
    const rows = this.db
      .select()
      .from(scriptHistories)
      .where(eq(scriptHistories.stepId, stepId))
      .orderBy(asc(scriptHistories.createdAt))
      .all();
    return Promise.resolve(rows.map(rowToScriptHistory));
  }
}
