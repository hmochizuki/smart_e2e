import { spawn } from 'node:child_process';
import { SIGKILL_GRACE_MS } from './spawnKill.js';

export type SpawnInput = {
  command: string;
  args: ReadonlyArray<string>;
  cwd: string;
  env: Readonly<Record<string, string | undefined>>;
  timeoutMs: number;
};

export type SpawnResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
  errorMessage?: string;
};

export type SpawnFn = (input: SpawnInput) => Promise<SpawnResult>;

// Node の child_process.spawn を SpawnFn にラップ。
// Promise 化と timeout のハンドリングをまとめ、SDK 利用箇所は内部実装を意識しない。
// timeout 時は SIGTERM → SIGKILL_GRACE_MS 後 SIGKILL の段階的 kill で dockerSpawnFn と挙動を揃える。
export const nodeSpawnFn: SpawnFn = (input) =>
  new Promise<SpawnResult>((resolve, reject) => {
    const started = Date.now();
    let timedOut = false;
    let settled = false;
    const child = spawn(input.command, [...input.args], {
      cwd: input.cwd,
      env: { ...process.env, ...input.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      killTimer = setTimeout(() => {
        child.kill('SIGKILL');
      }, SIGKILL_GRACE_MS);
    }, input.timeoutMs);

    const cleanupTimers = (): void => {
      clearTimeout(timeoutTimer);
      if (killTimer !== undefined) clearTimeout(killTimer);
    };

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      cleanupTimers();
      reject(err);
    });
    child.on('close', (exitCode) => {
      if (settled) return;
      settled = true;
      cleanupTimers();
      resolve({
        exitCode,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        timedOut,
        durationMs: Date.now() - started,
      });
    });
  });
