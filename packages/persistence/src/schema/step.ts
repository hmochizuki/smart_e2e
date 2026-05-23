import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { suites } from './suite.js';

export const steps = sqliteTable(
  'steps',
  {
    id: text('id').primaryKey(),
    suiteId: text('suite_id')
      .notNull()
      .references(() => suites.id, { onDelete: 'cascade' }),
    order: integer('order').notNull(),
    name: text('name').notNull(),
    script: text('script').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => ({
    suiteOrderUnique: uniqueIndex('steps_suite_id_order_unique').on(t.suiteId, t.order),
    suiteIdIdx: index('steps_suite_id_idx').on(t.suiteId),
  }),
);

export type StepRow = typeof steps.$inferSelect;
export type NewStepRow = typeof steps.$inferInsert;
