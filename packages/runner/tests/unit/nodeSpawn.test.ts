import { describe, expect, it } from 'vitest';
import { nodeSpawnFn } from '../../src/playwright/spawn.js';

describe('nodeSpawnFn', () => {
  it('exit 0 のコマンドは exitCode 0 で解決する', async () => {
    const result = await nodeSpawnFn({
      command: process.execPath,
      args: ['-e', 'console.log("hello node spawn")'],
      cwd: process.cwd(),
      env: {},
      timeoutMs: 10_000,
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello node spawn');
    expect(result.timedOut).toBe(false);
  });

  it('exit 1 が伝搬する', async () => {
    const result = await nodeSpawnFn({
      command: process.execPath,
      args: ['-e', 'process.exit(1)'],
      cwd: process.cwd(),
      env: {},
      timeoutMs: 10_000,
    });
    expect(result.exitCode).toBe(1);
    expect(result.timedOut).toBe(false);
  });

  it('timeoutMs 超過で SIGTERM が送られ、ハンドル可能な子プロセスは exit する', async () => {
    // SIGTERM を受けて即 exit する子プロセスを起動。
    // SIGTERM が届けば 5 秒の grace を待たずに完了するため SIGKILL までは観測しない。
    const script = `
      process.on('SIGTERM', () => process.exit(143));
      setTimeout(() => {}, 60_000);
    `;
    const started = Date.now();
    const result = await nodeSpawnFn({
      command: process.execPath,
      args: ['-e', script],
      cwd: process.cwd(),
      env: {},
      timeoutMs: 200,
    });
    const elapsed = Date.now() - started;
    expect(result.timedOut).toBe(true);
    // SIGTERM で素直に終わるので grace(5s) より十分早く完了するはず。
    expect(elapsed).toBeLessThan(4_000);
  }, 10_000);
});
