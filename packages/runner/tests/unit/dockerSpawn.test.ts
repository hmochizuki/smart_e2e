import { describe, expect, it, vi } from 'vitest';
import {
  createDockerSpawnFn,
  type DockerSpawnFnOptions,
  type DockerSpawnAdapter,
  type DockerSpawnSignal,
} from '../../src/playwright/dockerSpawn.js';
import type { SpawnInput } from '../../src/playwright/spawn.js';

type Recorded = {
  command: string;
  args: ReadonlyArray<string>;
};

type FakeChildOptions = {
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  emitError?: Error;
  delayMs?: number;
};

const createFakeChild = (
  recorded: Recorded[],
  options: FakeChildOptions,
): {
  spawn: DockerSpawnAdapter;
  killed: { signals: DockerSpawnSignal[] };
} => {
  const killed = { signals: [] as DockerSpawnSignal[] };
  const spawn: DockerSpawnAdapter = (command, args) => {
    recorded.push({ command, args: [...args] });
    const stdoutListeners: Array<(chunk: Buffer) => void> = [];
    const stderrListeners: Array<(chunk: Buffer) => void> = [];
    const errorListeners: Array<(err: Error) => void> = [];
    const closeListeners: Array<(code: number | null) => void> = [];
    const child = {
      onStdout: (listener: (chunk: Buffer) => void): void => {
        stdoutListeners.push(listener);
      },
      onStderr: (listener: (chunk: Buffer) => void): void => {
        stderrListeners.push(listener);
      },
      onError: (listener: (err: Error) => void): void => {
        errorListeners.push(listener);
      },
      onClose: (listener: (code: number | null) => void): void => {
        closeListeners.push(listener);
      },
      kill: (signal: DockerSpawnSignal): boolean => {
        killed.signals.push(signal);
        return true;
      },
    };
    const fire = (): void => {
      if (options.emitError !== undefined) {
        for (const l of errorListeners) l(options.emitError);
        return;
      }
      if (options.stdout !== undefined) {
        for (const l of stdoutListeners) l(Buffer.from(options.stdout));
      }
      if (options.stderr !== undefined) {
        for (const l of stderrListeners) l(Buffer.from(options.stderr));
      }
      const code = options.exitCode ?? 0;
      for (const l of closeListeners) l(code);
    };
    if (options.delayMs !== undefined && options.delayMs > 0) {
      setTimeout(fire, options.delayMs);
    } else {
      queueMicrotask(fire);
    }
    return child;
  };
  return { spawn, killed };
};

const baseInput = (): SpawnInput => ({
  command: 'npx',
  args: ['playwright', 'test', '/work/abc.spec.ts'],
  cwd: '/host/work',
  env: { SMART_E2E_RUNNER_SCREENSHOT_PATH: '/host/work/abc.png' },
  timeoutMs: 60_000,
});

describe('createDockerSpawnFn', () => {
  it('docker run のコマンドと引数を正しく組み立てる', async () => {
    const recorded: Recorded[] = [];
    const { spawn } = createFakeChild(recorded, {
      exitCode: 0,
      stdout: 'ok',
    });
    const opts: DockerSpawnFnOptions = {
      dockerCommand: 'docker',
      imageTag: 'smart-e2e-runner:0.1.0',
      network: 'bridge',
      spawn,
    };
    const spawnFn = createDockerSpawnFn(opts);
    const result = await spawnFn(baseInput());
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('ok');
    expect(recorded).toHaveLength(1);
    const call = recorded[0];
    expect(call).toBeDefined();
    if (call === undefined) return;
    expect(call.command).toBe('docker');
    expect(call.args[0]).toBe('run');
    expect(call.args).toContain('--rm');
    const vIdx = call.args.indexOf('-v');
    expect(vIdx).toBeGreaterThanOrEqual(0);
    expect(call.args[vIdx + 1]).toBe('/host/work:/work');
    const wIdx = call.args.indexOf('-w');
    expect(call.args[wIdx + 1]).toBe('/work');
    const nIdx = call.args.indexOf('--network');
    expect(call.args[nIdx + 1]).toBe('bridge');
    expect(call.args).toContain('smart-e2e-runner:0.1.0');
    const imageIdx = call.args.indexOf('smart-e2e-runner:0.1.0');
    expect(call.args.slice(imageIdx + 1)).toEqual([
      'npx',
      'playwright',
      'test',
      '/work/abc.spec.ts',
    ]);
  });

  it('imageTag のデフォルトは smart-e2e-runner:0.1.0', async () => {
    const recorded: Recorded[] = [];
    const { spawn } = createFakeChild(recorded, { exitCode: 0 });
    const spawnFn = createDockerSpawnFn({ spawn });
    await spawnFn(baseInput());
    const call = recorded[0];
    expect(call).toBeDefined();
    if (call === undefined) return;
    expect(call.args).toContain('smart-e2e-runner:0.1.0');
  });

  it('dockerCommand のデフォルトは docker', async () => {
    const recorded: Recorded[] = [];
    const { spawn } = createFakeChild(recorded, { exitCode: 0 });
    const spawnFn = createDockerSpawnFn({ spawn });
    await spawnFn(baseInput());
    const call = recorded[0];
    expect(call).toBeDefined();
    if (call === undefined) return;
    expect(call.command).toBe('docker');
  });

  it('network のデフォルトは bridge', async () => {
    const recorded: Recorded[] = [];
    const { spawn } = createFakeChild(recorded, { exitCode: 0 });
    const spawnFn = createDockerSpawnFn({ spawn });
    await spawnFn(baseInput());
    const call = recorded[0];
    expect(call).toBeDefined();
    if (call === undefined) return;
    const nIdx = call.args.indexOf('--network');
    expect(call.args[nIdx + 1]).toBe('bridge');
  });

  it('extraDockerArgs はイメージ名より前に挿入される', async () => {
    const recorded: Recorded[] = [];
    const { spawn } = createFakeChild(recorded, { exitCode: 0 });
    const spawnFn = createDockerSpawnFn({
      spawn,
      extraDockerArgs: ['--memory', '512m'],
    });
    await spawnFn(baseInput());
    const call = recorded[0];
    expect(call).toBeDefined();
    if (call === undefined) return;
    const imageIdx = call.args.indexOf('smart-e2e-runner:0.1.0');
    const memIdx = call.args.indexOf('--memory');
    expect(memIdx).toBeGreaterThanOrEqual(0);
    expect(memIdx).toBeLessThan(imageIdx);
    expect(call.args[memIdx + 1]).toBe('512m');
  });

  it('env を docker run -e KEY=VALUE で渡す', async () => {
    const recorded: Recorded[] = [];
    const { spawn } = createFakeChild(recorded, { exitCode: 0 });
    const spawnFn = createDockerSpawnFn({ spawn });
    await spawnFn({
      ...baseInput(),
      env: { FOO: 'bar', BAZ: 'qux' },
    });
    const call = recorded[0];
    expect(call).toBeDefined();
    if (call === undefined) return;
    const args = call.args;
    expect(args).toContain('-e');
    const fooIdx = args.findIndex((a, i) => a === '-e' && args[i + 1] === 'FOO=bar');
    expect(fooIdx).toBeGreaterThanOrEqual(0);
    const bazIdx = args.findIndex((a, i) => a === '-e' && args[i + 1] === 'BAZ=qux');
    expect(bazIdx).toBeGreaterThanOrEqual(0);
  });

  it('env が undefined の値はスキップする', async () => {
    const recorded: Recorded[] = [];
    const { spawn } = createFakeChild(recorded, { exitCode: 0 });
    const spawnFn = createDockerSpawnFn({ spawn });
    await spawnFn({
      ...baseInput(),
      env: { FOO: 'bar', SKIP_ME: undefined },
    });
    const call = recorded[0];
    expect(call).toBeDefined();
    if (call === undefined) return;
    const joined = call.args.join(' ');
    expect(joined).not.toContain('SKIP_ME');
  });

  it('exitCode 非0 が伝搬する', async () => {
    const recorded: Recorded[] = [];
    const { spawn } = createFakeChild(recorded, {
      exitCode: 1,
      stderr: 'simulated docker failure',
    });
    const spawnFn = createDockerSpawnFn({ spawn });
    const result = await spawnFn(baseInput());
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('simulated docker failure');
    expect(result.timedOut).toBe(false);
  });

  it('child process が error を emit したら reject する', async () => {
    const recorded: Recorded[] = [];
    const { spawn } = createFakeChild(recorded, {
      emitError: new Error('docker not found'),
    });
    const spawnFn = createDockerSpawnFn({ spawn });
    await expect(spawnFn(baseInput())).rejects.toThrow(/docker not found/);
  });

  it('timeoutMs を超過すると kill されて timedOut が true になる', async () => {
    vi.useFakeTimers();
    try {
      const recorded: Recorded[] = [];
      const { spawn, killed } = createFakeChild(recorded, {
        exitCode: null,
        delayMs: 10_000,
      });
      const spawnFn = createDockerSpawnFn({ spawn });
      const promise = spawnFn({ ...baseInput(), timeoutMs: 100 });
      await vi.advanceTimersByTimeAsync(150);
      // SIGKILL までは段階的: SIGTERM が先、5秒後 SIGKILL → close 発火
      await vi.advanceTimersByTimeAsync(6_000);
      // 最終的に child は exit する想定だが、テストでは close を強制で呼んでないので
      // kill 後に close を発火する fake が必要。代わりに kill 呼び出しを観測する。
      // ここでは Promise の解決は close emit に依存するので別解: fire を経由する。
      // delayMs 後に close が発火する設計のため、advanceTimersByTime で 10秒進める。
      await vi.advanceTimersByTimeAsync(10_000);
      const result = await promise;
      expect(result.timedOut).toBe(true);
      expect(killed.signals.length).toBeGreaterThan(0);
      expect(killed.signals[0]).toBe('SIGTERM');
    } finally {
      vi.useRealTimers();
    }
  });

  it('SIGTERM の 5秒後に SIGKILL を送る', async () => {
    vi.useFakeTimers();
    try {
      const recorded: Recorded[] = [];
      const { spawn, killed } = createFakeChild(recorded, {
        exitCode: null,
        delayMs: 60_000,
      });
      const spawnFn = createDockerSpawnFn({ spawn });
      const promise = spawnFn({ ...baseInput(), timeoutMs: 100 });
      await vi.advanceTimersByTimeAsync(200);
      expect(killed.signals).toContain('SIGTERM');
      await vi.advanceTimersByTimeAsync(5_500);
      expect(killed.signals).toContain('SIGKILL');
      await vi.advanceTimersByTimeAsync(60_000);
      const result = await promise;
      expect(result.timedOut).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cwd にコロンが含まれる場合は errorMessage を含む SpawnResult を返す', async () => {
    const recorded: Recorded[] = [];
    const { spawn } = createFakeChild(recorded, { exitCode: 0 });
    const spawnFn = createDockerSpawnFn({ spawn });
    const result = await spawnFn({
      ...baseInput(),
      cwd: 'C:\\Users\\foo',
    });
    expect(result.exitCode).toBeNull();
    expect(result.timedOut).toBe(false);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
    expect(result.errorMessage).toBeDefined();
    expect(result.errorMessage).toContain('コロン');
    expect(recorded).toHaveLength(0);
  });

  it('durationMs は 0 以上の数値', async () => {
    const recorded: Recorded[] = [];
    const { spawn } = createFakeChild(recorded, { exitCode: 0 });
    const spawnFn = createDockerSpawnFn({ spawn });
    const result = await spawnFn(baseInput());
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
