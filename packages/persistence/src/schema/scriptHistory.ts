import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { steps } from './step.js';
import { repairAttempts } from './repairAttempt.js';

export const scriptHistories = sqliteTable(
  'script_histories',
  {
    id: text('id').primaryKey(),
    stepId: text('step_id')
      .notNull()
      .references(() => steps.id, { onDelete: 'cascade' }),
    script: text('script').notNull(),
    source: text('source').notNull(),
    sourceRepairAttemptId: text('source_repair_attempt_id').references(() => repairAttempts.id, {
      onDelete: 'cascade',
    }),
    createdAt: integer('created_at').notNull(),
  },
  (t) => ({
    stepIdIdx: index('script_histories_step_id_idx').on(t.stepId),
    createdAtIdx: index('script_histories_created_at_idx').on(t.createdAt),
  }),
);

export type ScriptHistoryRow = typeof scriptHistories.$inferSelect;
export type NewScriptHistoryRow = typeof scriptHistories.$inferInsert;
