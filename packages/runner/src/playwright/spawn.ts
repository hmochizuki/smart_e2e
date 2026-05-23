import { spawn } from 'node:child_process';

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
};

export type SpawnFn = (input: SpawnInput) => Promise<SpawnResult>;

// Node の child_process.spawn を SpawnFn にラップ。
// Promise 化と timeout のハンドリングをまとめ、SDK 利用箇所は内部実装を意識しない。
export const nodeSpawnFn: SpawnFn = (input) =>
  new Promise<SpawnResult>((resolve, reject) => {
    const started = Date.now();
    let timedOut = false;
    const child = spawn(input.command, [...input.args], {
      cwd: input.cwd,
      env: { ...process.env, ...input.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, input.timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({
        exitCode,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        timedOut,
        durationMs: Date.now() - started,
      });
    });
  });
