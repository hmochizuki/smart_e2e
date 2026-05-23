import { spawn as nodeChildSpawn } from 'node:child_process';
import type { SpawnFn, SpawnInput, SpawnResult } from './spawn.js';
import { SIGKILL_GRACE_MS } from './spawnKill.js';

export type DockerSpawnSignal = 'SIGTERM' | 'SIGKILL';

export type DockerSpawnChildListeners = {
  onStdout: (listener: (chunk: Buffer) => void) => void;
  onStderr: (listener: (chunk: Buffer) => void) => void;
  onError: (listener: (err: Error) => void) => void;
  onClose: (listener: (code: number | null) => void) => void;
};

export type DockerSpawnChild = DockerSpawnChildListeners & {
  kill: (signal: DockerSpawnSignal) => boolean;
};

// Docker spawn の child process 抽象。Node 標準 spawn 互換のサブセットのみを表現する。
// テストで差し替えられるよう named export する。
export type DockerSpawnAdapter = (command: string, args: ReadonlyArray<string>) => DockerSpawnChild;

export type DockerSpawnFnOptions = {
  imageTag?: string;
  network?: 'host' | 'bridge' | 'none';
  extraDockerArgs?: ReadonlyArray<string>;
  dockerCommand?: string;
  spawn?: DockerSpawnAdapter;
};

const DEFAULT_IMAGE_TAG = 'smart-e2e-runner:0.1.0';
const DEFAULT_NETWORK = 'bridge';
const DEFAULT_DOCKER_COMMAND = 'docker';
const CONTAINER_WORK_DIR = '/work';

const defaultAdapter: DockerSpawnAdapter = (command, args) => {
  const child = nodeChildSpawn(command, [...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const wrapped: DockerSpawnChild = {
    onStdout: (listener) => {
      child.stdout.on('data', listener);
    },
    onStderr: (listener) => {
      child.stderr.on('data', listener);
    },
    onError: (listener) => {
      child.on('error', listener);
    },
    onClose: (listener) => {
      child.on('close', (code) => {
        listener(code);
      });
    },
    kill: (signal) => child.kill(signal),
  };
  return wrapped;
};

const buildEnvArgs = (env: Readonly<Record<string, string | undefined>>): string[] => {
  const args: string[] = [];
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue;
    args.push('-e', `${key}=${value}`);
  }
  return args;
};

const buildDockerArgs = (
  input: SpawnInput,
  options: {
    imageTag: string;
    network: 'host' | 'bridge' | 'none';
    extraDockerArgs: ReadonlyArray<string>;
  },
): string[] => {
  const args: string[] = ['run', '--rm'];
  args.push('-v', `${input.cwd}:${CONTAINER_WORK_DIR}`);
  args.push('-w', CONTAINER_WORK_DIR);
  args.push('--network', options.network);
  args.push(...buildEnvArgs(input.env));
  args.push(...options.extraDockerArgs);
  args.push(options.imageTag);
  args.push(input.command, ...input.args);
  return args;
};

export const createDockerSpawnFn = (options: DockerSpawnFnOptions = {}): SpawnFn => {
  const imageTag = options.imageTag ?? DEFAULT_IMAGE_TAG;
  const network = options.network ?? DEFAULT_NETWORK;
  const extraDockerArgs = options.extraDockerArgs ?? [];
  const dockerCommand = options.dockerCommand ?? DEFAULT_DOCKER_COMMAND;
  const adapter = options.spawn ?? defaultAdapter;

  return (input: SpawnInput): Promise<SpawnResult> => {
    if (input.cwd.includes(':')) {
      const result: SpawnResult = {
        exitCode: null,
        timedOut: false,
        stdout: '',
        stderr: '',
        durationMs: 0,
        errorMessage: `cwd "${input.cwd}" にコロンが含まれています。docker volume mount と互換性がありません`,
      };
      return Promise.resolve(result);
    }
    return new Promise<SpawnResult>((resolve, reject) => {
      const started = Date.now();
      const dockerArgs = buildDockerArgs(input, { imageTag, network, extraDockerArgs });
      let timedOut = false;
      let settled = false;

      const child = adapter(dockerCommand, dockerArgs);
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      child.onStdout((chunk) => stdoutChunks.push(chunk));
      child.onStderr((chunk) => stderrChunks.push(chunk));

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

      child.onError((err) => {
        if (settled) return;
        settled = true;
        cleanupTimers();
        reject(err);
      });
      child.onClose((exitCode) => {
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
  };
};
