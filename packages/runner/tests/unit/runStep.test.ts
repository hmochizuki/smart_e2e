import { describe, expect, it, vi } from 'vitest';
import type { SpawnFn, SpawnInput, SpawnResult } from '../../src/playwright/spawn.js';
import { runStep } from '../../src/playwright/runStep.js';
import { createFakeFileSystem } from '../helpers/fakeFs.js';

const okSpawn =
  (overrides: Partial<SpawnResult> = {}): SpawnFn =>
  () =>
    Promise.resolve({
      exitCode: 0,
      stdout: 'ok',
      stderr: '',
      timedOut: false,
      durationMs: 100,
      ...overrides,
    });

const failSpawn =
  (overrides: Partial<SpawnResult> = {}): SpawnFn =>
  () =>
    Promise.resolve({
      exitCode: 1,
      stdout: '',
      stderr: 'TimeoutError: locator not found',
      timedOut: false,
      durationMs: 100,
      ...overrides,
    });

const baseInput = () => ({
  script:
    "import { test } from '@playwright/test';\ntest('x', async ({ page }) => { await page.goto('/'); });",
  workDir: '/tmp/runner-test',
  timeoutMs: 60_000,
});

describe('runStep', () => {
  it('exitCode 0 なら status succeeded', async () => {
    const { fs } = createFakeFileSystem();
    const spawnFn = vi.fn(okSpawn());
    const result = await runStep(baseInput(), { spawnFn, fs });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('succeeded');
      expect(result.value.durationMs).toBeGreaterThanOrEqual(0);
    }
    expect(spawnFn).toHaveBeenCalledOnce();
  });

  it('spec.ts を workDir に書き出してから spawn する', async () => {
    const { fs, files } = createFakeFileSystem();
    let observedSpawn: SpawnInput | undefined;
    const spawnFn: SpawnFn = (input) => {
      observedSpawn = input;
      // spawn 時点でファイルが書かれているはず
      const written = Array.from(files.keys()).find((k) => k.endsWith('.spec.ts'));
      expect(written).toBeDefined();
      return Promise.resolve({
        exitCode: 0,
        stdout: '',
        stderr: '',
        timedOut: false,
        durationMs: 1,
      });
    };
    await runStep(baseInput(), { spawnFn, fs });
    expect(observedSpawn).toBeDefined();
    if (observedSpawn !== undefined) {
      expect(observedSpawn.args.some((a) => a.endsWith('.spec.ts'))).toBe(true);
    }
  });

  it('exitCode != 0 なら status failed と errorMessage を返す', async () => {
    const { fs } = createFakeFileSystem();
    const result = await runStep(baseInput(), {
      spawnFn: failSpawn(),
      fs,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('failed');
      expect(result.value.artifacts.errorMessage).toContain('TimeoutError');
    }
  });

  it('timedOut なら failed かつ errorMessage に timeout が含まれる', async () => {
    const { fs } = createFakeFileSystem();
    const result = await runStep(baseInput(), {
      spawnFn: okSpawn({ exitCode: null, timedOut: true }),
      fs,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe('failed');
      expect(result.value.artifacts.errorMessage).toMatch(/timeout/i);
    }
  });

  it('spawnFn が throw したら err を返す', async () => {
    const { fs } = createFakeFileSystem();
    const spawnFn: SpawnFn = () => Promise.reject(new Error('spawn failed'));
    const result = await runStep(baseInput(), { spawnFn, fs });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('RUNNER_STEP_INVOCATION');
    }
  });
});
