import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { parseStep, parseSuite, type RunnerEvent, type Step, type Suite } from '@smart-e2e/shared';
import { loadConfig } from './config.js';
import { createRunnerEmitter } from './events/emitter.js';
import { runSuite } from './loop/runSuite.js';
import { realFileSystem } from './playwright/runStep.js';
import { nodeSpawnFn, type SpawnFn, type SpawnResult } from './playwright/spawn.js';
import { createAnthropicLLMClient } from './repair/anthropicClient.js';
import type { LLMClient } from './repair/llmClient.js';

export type CliWritable = {
  write: (chunk: string) => boolean;
};

export type CliInput = {
  argv: ReadonlyArray<string>;
  env: Readonly<Record<string, string | undefined>>;
  stdout: CliWritable;
  stderr: CliWritable;
};

const USAGE = `Usage: smart-e2e-runner --suite <path-to-suite-json>\n`;

const SuiteFileSchema = z.object({
  suite: z.unknown(),
  steps: z.array(z.unknown()),
});

const parseArgs = (argv: ReadonlyArray<string>): { suitePath: string | null } => {
  let suitePath: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--suite') {
      const next = argv[i + 1];
      if (next !== undefined) suitePath = next;
      i += 1;
    }
  }
  return { suitePath };
};

const serializeEvent = (ev: RunnerEvent): string => {
  // Date を ISO 文字列にしてシリアライズ。
  const replacer = (_key: string, value: unknown): unknown => {
    if (value instanceof Date) return value.toISOString();
    return value;
  };
  return JSON.stringify(ev, replacer);
};

const reviveDates = (input: unknown): unknown => {
  // suite.createdAt 等の ISO 文字列を Date に戻す。
  if (typeof input === 'string') {
    const m = /^\d{4}-\d{2}-\d{2}T/.exec(input);
    if (m !== null) {
      const d = new Date(input);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return input;
  }
  if (Array.isArray(input)) return input.map(reviveDates);
  if (typeof input === 'object' && input !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      result[k] = reviveDates(v);
    }
    return result;
  }
  return input;
};

const readSuiteFile = async (
  path: string,
): Promise<{ suite: Suite; steps: ReadonlyArray<Step> } | string> => {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (e) {
    return `failed to read suite file: ${String(e)}`;
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (e) {
    return `invalid JSON: ${String(e)}`;
  }
  const file = SuiteFileSchema.safeParse(parsedJson);
  if (!file.success) {
    return `invalid suite file shape: ${file.error.message}`;
  }
  const revivedSuite = reviveDates(file.data.suite);
  const suiteParse = parseSuite(revivedSuite);
  if (!suiteParse.ok) {
    return `invalid suite: ${suiteParse.error.message}`;
  }
  const steps: Step[] = [];
  for (const s of file.data.steps) {
    const revived = reviveDates(s);
    const r = parseStep(revived);
    if (!r.ok) return `invalid step: ${r.error.message}`;
    steps.push(r.value);
  }
  return { suite: suiteParse.value, steps };
};

// 開発/E2E 用 Fake LLM。Anthropic API を叩かずに分類と修復を固定で返す。
const createFakeLLMClientFromEnv = (
  env: Readonly<Record<string, string | undefined>>,
): LLMClient => {
  const classification = env['RUNNER_FAKE_LLM_CLASSIFICATION'] ?? 'transient';
  return {
    complete: (_messages, options) => {
      const sys = options?.system ?? '';
      if (sys.includes('修復')) {
        return Promise.resolve(
          JSON.stringify({
            script: "import { test } from '@playwright/test';\ntest('repaired', async () => {});\n",
          }),
        );
      }
      return Promise.resolve(JSON.stringify({ classification, rationale: 'fake' }));
    },
  };
};

const createFakeSpawnFromEnv = (env: Readonly<Record<string, string | undefined>>): SpawnFn => {
  const exitStr = env['RUNNER_FAKE_SPAWN_EXIT'] ?? '0';
  const exit = Number.parseInt(exitStr, 10);
  return (): Promise<SpawnResult> =>
    Promise.resolve({
      exitCode: Number.isNaN(exit) ? 0 : exit,
      stdout: '',
      stderr: exit === 0 ? '' : 'Error: simulated failure',
      timedOut: false,
      durationMs: 1,
    });
};

export const runCli = async (input: CliInput): Promise<number> => {
  const args = parseArgs(input.argv);
  if (args.suitePath === null) {
    input.stderr.write(USAGE);
    return 2;
  }

  const configResult = loadConfig(input.env);
  if (!configResult.ok) {
    input.stderr.write(`config error: ${configResult.error.message}\n`);
    return 2;
  }
  const config = configResult.value;

  const fileResult = await readSuiteFile(args.suitePath);
  if (typeof fileResult === 'string') {
    input.stderr.write(`${fileResult}\n`);
    return 2;
  }

  const emitter = createRunnerEmitter();
  emitter.on((ev) => {
    input.stdout.write(`${serializeEvent(ev)}\n`);
  });

  const llmClient = config.useFakeLLM
    ? createFakeLLMClientFromEnv(input.env)
    : createAnthropicLLMClient({
        apiKey: config.anthropicApiKey,
        model: config.anthropicModel,
      });
  const spawnFn = config.useFakeLLM ? createFakeSpawnFromEnv(input.env) : nodeSpawnFn;

  const result = await runSuite(
    { suite: fileResult.suite, steps: fileResult.steps },
    {
      spawnFn,
      fs: realFileSystem,
      llmClient,
      emitter,
      workDir: config.workDir,
      stepTimeoutMs: config.stepTimeoutMs,
      maxAttempts: config.maxRepairAttempts,
      suiteRunId: randomUUID(),
    },
  );

  // runSuite は Result<_, never> なので error 側は理論上ない。
  // 型 narrowing のために ok チェックを残しつつ、status で exit code を決める。
  if (!result.ok) return 1;
  return result.value.status === 'succeeded' ? 0 : 1;
};

// Node エントリポイント。`node dist/cli.js --suite suite.json` で実行可能。
// import.meta.url (file://...) と process.argv[1] (絶対パス) を fileURLToPath で揃えて比較する。
// Windows / 相対パス渡しでも誤判定しない。
const isDirectInvocation = (): boolean => {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return fileURLToPath(import.meta.url) === entry;
  } catch {
    return false;
  }
};

if (isDirectInvocation()) {
  void runCli({
    argv: process.argv.slice(2),
    env: process.env,
    stdout: process.stdout,
    stderr: process.stderr,
  }).then((code) => {
    process.exit(code);
  });
}
