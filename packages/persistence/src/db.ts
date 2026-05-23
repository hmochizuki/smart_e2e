import Database from 'better-sqlite3';
import type { Database as BetterSqlite3Database } from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema/index.js';

export type DbSchema = typeof schema;

export type AppDatabase = BetterSQLite3Database<DbSchema>;

export interface OpenDatabaseOptions {
  readonly path: string;
  readonly readonly?: boolean;
}

export interface OpenedDatabase {
  readonly db: AppDatabase;
  readonly raw: BetterSqlite3Database;
  readonly close: () => void;
}

export const openDatabase = (options: OpenDatabaseOptions): OpenedDatabase => {
  const raw = new Database(options.path, {
    readonly: options.readonly ?? false,
  });
  if (options.path !== ':memory:') {
    raw.pragma('journal_mode = WAL');
  }
  raw.pragma('foreign_keys = ON');
  const db = drizzle(raw, { schema });
  return {
    db,
    raw,
    close: () => {
      raw.close();
    },
  };
};
