import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { suiteRuns } from './suiteRun.js';
import { steps } from './step.js';

export const stepRuns = sqliteTable(
  'step_runs',
  {
    id: text('id').primaryKey(),
    suiteRunId: text('suite_run_id')
      .notNull()
      .references(() => suiteRuns.id, { onDelete: 'cascade' }),
    stepId: text('step_id')
      .notNull()
      .references(() => steps.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    attempts: integer('attempts').notNull().default(1),
    startedAt: integer('started_at').notNull(),
    finishedAt: integer('finished_at'),
    finalScript: text('final_script'),
  },
  (t) => ({
    suiteRunIdIdx: index('step_runs_suite_run_id_idx').on(t.suiteRunId),
  }),
);

export type StepRunRow = typeof stepRuns.$inferSelect;
export type NewStepRunRow = typeof stepRuns.$inferInsert;
