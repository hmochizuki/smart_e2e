import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDockerSpawnFn } from '../../src/playwright/dockerSpawn.js';

// 実 docker コマンドが必要なため、明示的に opt-in したときだけ実行する。
// CI など docker が無い環境ではスキップ。
const enabled = process.env['RUNNER_INTEGRATION_DOCKER'] === 'true';

describe.skipIf(!enabled)('createDockerSpawnFn (integration)', () => {
  it('smart-e2e-runner イメージで簡易コマンドを exit 0 で実行できる', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'runner-docker-int-'));
    const spawnFn = createDockerSpawnFn({
      imageTag: 'smart-e2e-runner:0.1.0',
    });
    const result = await spawnFn({
      command: 'node',
      args: ['-e', 'console.log("hello from container")'],
      cwd: dir,
      env: {},
      timeoutMs: 60_000,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello from container');
  }, 120_000);

  it('exit 1 の child は exitCode 1 で伝搬する', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'runner-docker-int-'));
    const spawnFn = createDockerSpawnFn({
      imageTag: 'smart-e2e-runner:0.1.0',
    });
    const result = await spawnFn({
      command: 'node',
      args: ['-e', 'process.exit(1)'],
      cwd: dir,
      env: {},
      timeoutMs: 60_000,
    });
    expect(result.exitCode).toBe(1);
  }, 120_000);
});
