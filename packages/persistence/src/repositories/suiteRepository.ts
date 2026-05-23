import { randomUUID } from 'node:crypto';
import { eq, asc } from 'drizzle-orm';
import { NewSuiteInputSchema, type NewSuiteInput, type Suite } from '@smart-e2e/shared';
import type { AppDatabase } from '../db.js';
import { suites, type SuiteRow } from '../schema/suite.js';
import { NotFoundError, runWithConflictMapping } from '../errors.js';
import { epochMsToDate, nullableToOptional, nullishToNullable } from '../mappers/dateMapper.js';

const rowToSuite = (row: SuiteRow): Suite => {
  const description = nullableToOptional(row.description);
  const base = {
    id: row.id,
    name: row.name,
    createdAt: epochMsToDate(row.createdAt),
    updatedAt: epochMsToDate(row.updatedAt),
  } as const;
  return description === undefined ? base : { ...base, description };
};

export class SuiteRepository {
  constructor(private readonly db: AppDatabase) {}

  async create(input: NewSuiteInput): Promise<Suite> {
    const parsed = NewSuiteInputSchema.parse(input);
    const id = randomUUID();
    const now = Date.now();
    runWithConflictMapping('Suite', () => {
      this.db
        .insert(suites)
        .values({
          id,
          name: parsed.name,
          description: nullishToNullable(parsed.description),
          createdAt: now,
          updatedAt: now,
        })
        .run();
    });
    return this.findByIdOrThrow(id);
  }

  findById(id: string): Promise<Suite | null> {
    const rows = this.db.select().from(suites).where(eq(suites.id, id)).all();
    const row = rows[0];
    return Promise.resolve(row ? rowToSuite(row) : null);
  }

  async findByIdOrThrow(id: string): Promise<Suite> {
    const found = await this.findById(id);
    if (!found) {
      throw new NotFoundError('Suite', id);
    }
    return found;
  }

  list(): Promise<Suite[]> {
    const rows = this.db.select().from(suites).orderBy(asc(suites.createdAt)).all();
    return Promise.resolve(rows.map(rowToSuite));
  }

  async update(id: string, patch: Partial<NewSuiteInput>): Promise<Suite> {
    const existing = await this.findByIdOrThrow(id);
    const hasDescriptionKey = 'description' in patch;
    const merged: NewSuiteInput = hasDescriptionKey
      ? patch.description === undefined || patch.description === null
        ? { name: patch.name ?? existing.name }
        : {
            name: patch.name ?? existing.name,
            description: patch.description,
          }
      : existing.description === undefined || existing.description === null
        ? { name: patch.name ?? existing.name }
        : {
            name: patch.name ?? existing.name,
            description: existing.description,
          };
    const parsed = NewSuiteInputSchema.parse(merged);
    const now = Date.now();
    runWithConflictMapping('Suite', () => {
      this.db
        .update(suites)
        .set({
          name: parsed.name,
          description: nullishToNullable(parsed.description),
          updatedAt: now,
        })
        .where(eq(suites.id, id))
        .run();
    });
    return this.findByIdOrThrow(id);
  }

  delete(id: string): Promise<void> {
    this.db.delete(suites).where(eq(suites.id, id)).run();
    return Promise.resolve();
  }
}
