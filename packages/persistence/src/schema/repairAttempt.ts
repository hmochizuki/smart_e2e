import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { stepRuns } from './stepRun.js';

export const repairAttempts = sqliteTable(
  'repair_attempts',
  {
    id: text('id').primaryKey(),
    stepRunId: text('step_run_id')
      .notNull()
      .references(() => stepRuns.id, { onDelete: 'cascade' }),
    n: integer('n').notNull(),
    classification: text('classification').notNull(),
    errorLog: text('error_log').notNull(),
    screenshotPath: text('screenshot_path'),
    domSnapshot: text('dom_snapshot'),
    llmInputScript: text('llm_input_script').notNull(),
    llmOutputScript: text('llm_output_script'),
    result: text('result').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    stepRunIdIdx: index('repair_attempts_step_run_id_idx').on(t.stepRunId),
    stepRunIdNUnique: uniqueIndex('repair_attempts_step_run_id_n_unique').on(t.stepRunId, t.n),
  }),
);

export type RepairAttemptRow = typeof repairAttempts.$inferSelect;
export type NewRepairAttemptRow = typeof repairAttempts.$inferInsert;
