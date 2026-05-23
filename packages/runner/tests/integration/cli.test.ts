import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../../src/cli.js';

const SUITE_ID = 'a1b2c3d4-1234-4abc-8def-1234567890ab';
const STEP_ID = 'b2c3d4e5-2345-4bcd-9eef-234567890abc';

const sampleSuiteJson = () => ({
  suite: {
    id: SUITE_ID,
    name: 'demo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  steps: [
    {
      id: STEP_ID,
      suiteId: SUITE_ID,
      order: 0,
      name: 'first',
      script: "import { test } from '@playwright/test';\ntest('x', async () => {});",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
});

const collectStdout = (): {
  write: (s: string) => boolean;
  text: () => string;
} => {
  const chunks: string[] = [];
  return {
    write: (s) => {
      chunks.push(s);
      return true;
    },
    text: () => chunks.join(''),
  };
};

describe('runCli', () => {
  it('--suite が無い場合、終了コード 2 で usage を stderr に出す', async () => {
    const out = collectStdout();
    const errOut = collectStdout();
    const exit = await runCli({
      argv: [],
      env: { ANTHROPIC_API_KEY: 'x' },
      stdout: out,
      stderr: errOut,
    });
    expect(exit).toBe(2);
    expect(errOut.text()).toMatch(/--suite/);
  });

  it('FakeLLM モードで Suite を実行し JSON Lines を出力 (成功)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'runner-cli-'));
    await mkdir(dir, { recursive: true });
    const suitePath = join(dir, 'suite.json');
    await writeFile(suitePath, JSON.stringify(sampleSuiteJson()), 'utf8');

    const out = collectStdout();
    const errOut = collectStdout();
    const exit = await runCli({
      argv: ['--suite', suitePath],
      env: {
        ANTHROPIC_API_KEY: 'unused',
        RUNNER_USE_FAKE_LLM: 'true',
        RUNNER_FAKE_SPAWN_EXIT: '0',
        RUNNER_WORK_DIR: dir,
      },
      stdout: out,
      stderr: errOut,
    });
    if (exit !== 0) {
      throw new Error(`expected exit 0; got ${String(exit)}, stderr=${errOut.text()}`);
    }
    const lines = out
      .text()
      .trim()
      .split('\n')
      .filter((l) => l.length > 0);
    expect(lines.length).toBeGreaterThan(0);
    const parsed = lines.map((l): unknown => JSON.parse(l));
    const types = parsed.map((p) => {
      if (typeof p === 'object' && p !== null && 'type' in p) {
        const t: unknown = Reflect.get(p, 'type');
        return typeof t === 'string' ? t : '';
      }
      return '';
    });
    expect(types[0]).toBe('suite_started');
    expect(types[types.length - 1]).toBe('suite_finished');
  });

  it('FakeLLM モード spawn 失敗時は exit 1', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'runner-cli-'));
    await mkdir(dir, { recursive: true });
    const suitePath = join(dir, 'suite.json');
    await writeFile(suitePath, JSON.stringify(sampleSuiteJson()), 'utf8');

    const out = collectStdout();
    const errOut = collectStdout();
    const exit = await runCli({
      argv: ['--suite', suitePath],
      env: {
        ANTHROPIC_API_KEY: 'unused',
        RUNNER_USE_FAKE_LLM: 'true',
        RUNNER_FAKE_SPAWN_EXIT: '1',
        RUNNER_FAKE_LLM_CLASSIFICATION: 'incident',
        RUNNER_WORK_DIR: dir,
      },
      stdout: out,
      stderr: errOut,
    });
    expect(exit).toBe(1);
  });
});
