import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { suites } from './suite.js';

export const suiteRuns = sqliteTable(
  'suite_runs',
  {
    id: text('id').primaryKey(),
    suiteId: text('suite_id')
      .notNull()
      .references(() => suites.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    startedAt: integer('started_at').notNull(),
    finishedAt: integer('finished_at'),
    error: text('error'),
  },
  (t) => ({
    suiteIdIdx: index('suite_runs_suite_id_idx').on(t.suiteId),
    startedAtIdx: index('suite_runs_started_at_idx').on(t.startedAt),
  }),
);

export type SuiteRunRow = typeof suiteRuns.$inferSelect;
export type NewSuiteRunRow = typeof suiteRuns.$inferInsert;
