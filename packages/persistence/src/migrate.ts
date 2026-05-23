import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { AppDatabase } from './db.js';

export interface RunMigrationsOptions {
  readonly migrationsFolder: string;
}

export const runMigrations = (db: AppDatabase, options: RunMigrationsOptions): void => {
  migrate(db, { migrationsFolder: options.migrationsFolder });
};
