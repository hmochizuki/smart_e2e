import { randomUUID } from 'node:crypto';
import { eq, asc } from 'drizzle-orm';
import { NewStepInputSchema, type NewStepInput, type Step } from '@smart-e2e/shared';
import type { AppDatabase } from '../db.js';
import { steps, type StepRow } from '../schema/step.js';
import { NotFoundError, runWithConflictMapping } from '../errors.js';
import { epochMsToDate } from '../mappers/dateMapper.js';

const rowToStep = (row: StepRow): Step => ({
  id: row.id,
  suiteId: row.suiteId,
  order: row.order,
  name: row.name,
  script: row.script,
  createdAt: epochMsToDate(row.createdAt),
  updatedAt: epochMsToDate(row.updatedAt),
});

export class StepRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: NewStepInput): Promise<Step> {
    const parsed = NewStepInputSchema.parse(input);
    const id = randomUUID();
    const now = Date.now();
    runWithConflictMapping('Step', () => {
      this.db
        .insert(steps)
        .values({
          id,
          suiteId: parsed.suiteId,
          order: parsed.order,
          name: parsed.name,
          script: parsed.script,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    });
    return this.findByIdOrThrow(id);
  }

  findById(id: string): Promise<Step | null> {
    const rows = this.db.select().from(steps).where(eq(steps.id, id)).all();
    const row = rows[0];
    return Promise.resolve(row ? rowToStep(row) : null);
  }

  async findByIdOrThrow(id: string): Promise<Step> {
    const found = await this.findById(id);
    if (!found) {
      throw new NotFoundError('Step', id);
    }
    return found;
  }

  listBySuite(suiteId: string): Promise<Step[]> {
    const rows = this.db
      .select()
      .from(steps)
      .where(eq(steps.suiteId, suiteId))
      .orderBy(asc(steps.order))
      .all();
    return Promise.resolve(rows.map(rowToStep));
  }

  async update(id: string, patch: Partial<NewStepInput>): Promise<Step> {
    const existing = await this.findByIdOrThrow(id);
    const merged: NewStepInput = {
      suiteId: patch.suiteId ?? existing.suiteId,
      order: patch.order ?? existing.order,
      name: patch.name ?? existing.name,
      script: patch.script ?? existing.script,
    };
    const parsed = NewStepInputSchema.parse(merged);
    const now = Date.now();
    runWithConflictMapping('Step', () => {
      this.db
        .update(steps)
        .set({
          suiteId: parsed.suiteId,
          order: parsed.order,
          name: parsed.name,
          script: parsed.script,
          updatedAt: now,
        })
        .where(eq(steps.id, id))
        .run();
    });
    return this.findByIdOrThrow(id);
  }

  delete(id: string): Promise<void> {
    this.db.delete(steps).where(eq(steps.id, id)).run();
    return Promise.resolve();
  }
}
