import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { Database as BetterSqlite3Database } from 'better-sqlite3';
import { openDatabase, type AppDatabase } from '../../src/db.js';
import { runMigrations } from '../../src/migrate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATIONS_FOLDER = resolve(__dirname, '../../drizzle');

export interface TmpDb {
  readonly db: AppDatabase;
  readonly raw: BetterSqlite3Database;
  readonly close: () => void;
}

export const createTmpDb = (): TmpDb => {
  const opened = openDatabase({ path: ':memory:' });
  runMigrations(opened.db, { migrationsFolder: MIGRATIONS_FOLDER });
  return {
    db: opened.db,
    raw: opened.raw,
    close: opened.close,
  };
};
