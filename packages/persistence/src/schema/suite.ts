import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const suites = sqliteTable('suites', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type SuiteRow = typeof suites.$inferSelect;
export type NewSuiteRow = typeof suites.$inferInsert;
