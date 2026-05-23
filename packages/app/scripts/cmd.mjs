#!/usr/bin/env node
// Tauri shell から呼び出される CLI ヘルパー。
// 引数: <command_name> [json_args]
// 出力: JSON (stdout) または エラー終了コード (stderr に詳細)
import {
  openDatabase,
  runMigrations,
  SuiteRepository,
  StepRepository,
  RunRepository,
} from '@smart-e2e/persistence';

const [cmd, jsonArg] = process.argv.slice(2);
if (!cmd) {
  process.stderr.write('usage: cmd.mjs <command> [json]\n');
  process.exit(2);
}

let args;
try {
  args = jsonArg ? JSON.parse(jsonArg) : {};
} catch (e) {
  process.stderr.write(`invalid json: ${String(e)}\n`);
  process.exit(2);
}

const dbPath = process.env.SMART_E2E_DB_PATH;
const migrationsFolder = process.env.SMART_E2E_MIGRATIONS_FOLDER;
if (!dbPath) {
  process.stderr.write('SMART_E2E_DB_PATH must be set\n');
  process.exit(2);
}
if (!migrationsFolder) {
  process.stderr.write('SMART_E2E_MIGRATIONS_FOLDER must be set\n');
  process.exit(2);
}

const { db, close } = openDatabase({ path: dbPath });
try {
  runMigrations(db, { migrationsFolder });

  const suiteRepo = new SuiteRepository(db);
  const stepRepo = new StepRepository(db);
  const runRepo = new RunRepository(db);

  const out = await dispatch(cmd, args, { suiteRepo, stepRepo, runRepo });
  process.stdout.write(JSON.stringify(out ?? null));
  process.exit(0);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${cmd} failed: ${message}\n`);
  process.exit(1);
} finally {
  close();
}

async function dispatch(name, payload, repos) {
  const { suiteRepo, stepRepo, runRepo } = repos;
  switch (name) {
    case 'list_suites':
      return await suiteRepo.list();
    case 'create_suite':
      return await suiteRepo.create(payload.input);
    case 'get_suite':
      return await suiteRepo.findByIdOrThrow(payload.id);
    case 'update_suite':
      return await suiteRepo.update(payload.id, stripNulls(payload.patch));
    case 'delete_suite':
      await suiteRepo.delete(payload.id);
      return null;
    case 'list_steps':
      return await stepRepo.listBySuite(payload.suiteId);
    case 'create_step':
      return await stepRepo.create(payload.input);
    case 'update_step':
      return await stepRepo.update(payload.id, stripNulls(payload.patch));
    case 'delete_step':
      await stepRepo.delete(payload.id);
      return null;
    case 'list_suite_runs':
      return await runRepo.listSuiteRunsBySuiteId(payload.suiteId);
    default:
      throw new Error(`unknown command: ${name}`);
  }
}

function stripNulls(patch) {
  if (patch === null || patch === undefined || typeof patch !== 'object') {
    return patch;
  }
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== null));
}
