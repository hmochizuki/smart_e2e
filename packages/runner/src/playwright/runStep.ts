import { join } from 'node:path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { err, ok, type Result } from '@smart-e2e/shared';
import { StepRunInvocationError } from '../errors.js';
import { emptyArtifacts, type Artifacts } from './artifacts.js';
import type { SpawnFn } from './spawn.js';

export type FileSystem = {
  mkdir: (path: string) => Promise<void>;
  writeFile: (path: string, contents: string) => Promise<void>;
  readFileMaybe: (path: string) => Promise<string | null>;
};

// 本番用 FS。テストでは fakeFs を差し替える。
export const realFileSystem: FileSystem = {
  mkdir: async (path) => {
    await mkdir(path, { recursive: true });
  },
  writeFile: async (path, contents) => {
    await writeFile(path, contents, 'utf8');
  },
  readFileMaybe: async (path) => {
    try {
      return await readFile(path, 'utf8');
    } catch {
      return null;
    }
  },
};

export type RunStepInput = {
  script: string;
  workDir: string;
  timeoutMs: number;
};

export type RunStepDeps = {
  spawnFn: SpawnFn;
  fs: FileSystem;
  // テストで Date.now / uuid を制御したいケース用 (省略可)
  now?: () => number;
  uuid?: () => string;
  command?: string;
  extraArgs?: ReadonlyArray<string>;
};

export type StepRunResult = {
  status: 'succeeded' | 'failed';
  durationMs: number;
  artifacts: Artifacts;
};

const DEFAULT_COMMAND = 'npx';
const DEFAULT_BASE_ARGS = ['playwright', 'test'];

const extractErrorMessage = (
  stderr: string,
  stdout: string,
  timedOut: boolean,
): { message: string; stack: string | null } => {
  if (timedOut) {
    return { message: 'timeout: step exceeded the configured timeoutMs', stack: null };
  }
  // 簡易抽出。stderr 優先、なければ stdout 末尾。
  const haystack = stderr.length > 0 ? stderr : stdout;
  const lines = haystack.split('\n').filter((l) => l.trim().length > 0);
  const last = lines[lines.length - 1] ?? '(no output)';
  // スタックっぽい行 (at xxx) があれば末尾10行を stack として返す。
  const stackish = lines.filter((l) => /^\s*at\s/.test(l));
  const stack = stackish.length > 0 ? stackish.slice(-10).join('\n') : null;
  return { message: last, stack };
};

export const runStep = async (
  input: RunStepInput,
  deps: RunStepDeps,
): Promise<Result<StepRunResult, StepRunInvocationError>> => {
  const uuid = deps.uuid ?? randomUUID;
  const id = uuid();
  const specPath = join(input.workDir, `${id}.spec.ts`);
  const screenshotPath = join(input.workDir, `${id}.png`);

  try {
    await deps.fs.mkdir(input.workDir);
    await deps.fs.writeFile(specPath, input.script);
  } catch (cause) {
    return err(new StepRunInvocationError('failed to write spec file', { cause }));
  }

  const command = deps.command ?? DEFAULT_COMMAND;
  const args = [...DEFAULT_BASE_ARGS, specPath, ...(deps.extraArgs ?? [])];

  let spawnResult;
  try {
    spawnResult = await deps.spawnFn({
      command,
      args,
      cwd: input.workDir,
      env: {
        SMART_E2E_RUNNER_SCREENSHOT_PATH: screenshotPath,
      },
      timeoutMs: input.timeoutMs,
    });
  } catch (cause) {
    return err(new StepRunInvocationError('failed to spawn playwright', { cause }));
  }

  if (spawnResult.exitCode === 0) {
    return ok({
      status: 'succeeded',
      durationMs: spawnResult.durationMs,
      artifacts: emptyArtifacts(),
    });
  }

  const { message, stack } = extractErrorMessage(
    spawnResult.stderr,
    spawnResult.stdout,
    spawnResult.timedOut,
  );
  // screenshot は今は spawn 側 spec が出した場合のみ。
  // 実 Playwright trace 解析は別タスクで対応する想定。
  const screenshotExists = (await deps.fs.readFileMaybe(screenshotPath)) !== null;
  const artifacts: Artifacts = {
    screenshotPath: screenshotExists ? screenshotPath : null,
    domSnapshot: null,
    consoleMessages: [],
    errorMessage: message,
    errorStack: stack,
  };
  return ok({
    status: 'failed',
    durationMs: spawnResult.durationMs,
    artifacts,
  });
};
