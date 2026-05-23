import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: unknown): Promise<unknown> => Promise.resolve(invokeMock(cmd, args)),
}));

import {
  cancelRun,
  checkPlaywright,
  createStep,
  createSuite,
  deleteStep,
  deleteSuite,
  getSuite,
  installPlaywright,
  listSteps,
  listSuiteRuns,
  listSuites,
  startCodegen,
  startRun,
  updateStep,
  updateSuite,
} from '../../src/ipc/commands.js';
import type { CodegenResultWire } from '../../src/ipc/types.js';

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue([]);
});

describe('listSuites', () => {
  it('calls invoke with list_suites and no args', async () => {
    await listSuites();
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith('list_suites', undefined);
  });
});

describe('createSuite', () => {
  it('passes input under `input` key', async () => {
    invokeMock.mockResolvedValueOnce({ id: 'x' });
    await createSuite({ name: 'sample' });
    expect(invokeMock).toHaveBeenCalledWith('create_suite', { input: { name: 'sample' } });
  });
});

describe('getSuite', () => {
  it('passes id', async () => {
    invokeMock.mockResolvedValueOnce({ id: 'abc' });
    await getSuite('abc');
    expect(invokeMock).toHaveBeenCalledWith('get_suite', { id: 'abc' });
  });
});

describe('updateSuite', () => {
  it('passes id and patch', async () => {
    invokeMock.mockResolvedValueOnce({ id: 'abc' });
    await updateSuite('abc', { name: 'new' });
    expect(invokeMock).toHaveBeenCalledWith('update_suite', {
      id: 'abc',
      patch: { name: 'new' },
    });
  });
});

describe('deleteSuite', () => {
  it('passes id', async () => {
    invokeMock.mockResolvedValueOnce(null);
    await deleteSuite('abc');
    expect(invokeMock).toHaveBeenCalledWith('delete_suite', { id: 'abc' });
  });
});

describe('listSteps', () => {
  it('passes suiteId', async () => {
    await listSteps('suite-1');
    expect(invokeMock).toHaveBeenCalledWith('list_steps', { suiteId: 'suite-1' });
  });
});

describe('createStep', () => {
  it('passes input under `input`', async () => {
    invokeMock.mockResolvedValueOnce({ id: 's' });
    await createStep({
      suiteId: 'suite-1',
      order: 0,
      name: 'click',
      script: 'await page.click("body")',
    });
    expect(invokeMock).toHaveBeenCalledWith('create_step', {
      input: {
        suiteId: 'suite-1',
        order: 0,
        name: 'click',
        script: 'await page.click("body")',
      },
    });
  });
});

describe('updateStep', () => {
  it('passes id and patch', async () => {
    invokeMock.mockResolvedValueOnce({ id: 's' });
    await updateStep('step-1', { name: 'renamed' });
    expect(invokeMock).toHaveBeenCalledWith('update_step', {
      id: 'step-1',
      patch: { name: 'renamed' },
    });
  });
});

describe('deleteStep', () => {
  it('passes id', async () => {
    invokeMock.mockResolvedValueOnce(null);
    await deleteStep('step-1');
    expect(invokeMock).toHaveBeenCalledWith('delete_step', { id: 'step-1' });
  });
});

describe('listSuiteRuns', () => {
  it('passes suiteId', async () => {
    await listSuiteRuns('suite-1');
    expect(invokeMock).toHaveBeenCalledWith('list_suite_runs', { suiteId: 'suite-1' });
  });
});

describe('startCodegen', () => {
  it('passes url and target', async () => {
    invokeMock.mockResolvedValueOnce({
      script: "import { test } from '@playwright/test';",
      targetUrl: 'https://example.com',
    });
    await startCodegen({ url: 'https://example.com', target: 'playwright-test' });
    expect(invokeMock).toHaveBeenCalledWith('start_codegen', {
      url: 'https://example.com',
      target: 'playwright-test',
    });
  });

  it('passes url with undefined target when omitted', async () => {
    invokeMock.mockResolvedValueOnce({ script: 'x', targetUrl: 'https://example.com' });
    await startCodegen({ url: 'https://example.com' });
    expect(invokeMock).toHaveBeenCalledWith('start_codegen', {
      url: 'https://example.com',
      target: undefined,
    });
  });

  it('returns CodegenResultWire shape', async () => {
    const wire: CodegenResultWire = {
      script: "import { test } from '@playwright/test';",
      targetUrl: 'https://example.com',
    };
    invokeMock.mockResolvedValueOnce(wire);
    const result: CodegenResultWire = await startCodegen({ url: 'https://example.com' });
    expect(result.script).toBe(wire.script);
    expect(result.targetUrl).toBe(wire.targetUrl);
  });
});

describe('startRun', () => {
  it('passes suiteId', async () => {
    invokeMock.mockResolvedValueOnce({ runId: 'run-1' });
    await startRun('suite-1');
    expect(invokeMock).toHaveBeenCalledWith('start_run', { suiteId: 'suite-1' });
  });

  it('returns runId from response', async () => {
    invokeMock.mockResolvedValueOnce({ runId: 'run-xyz' });
    const result = await startRun('suite-1');
    expect(result.runId).toBe('run-xyz');
  });
});

describe('cancelRun', () => {
  it('passes runId', async () => {
    invokeMock.mockResolvedValueOnce(null);
    await cancelRun('run-1');
    expect(invokeMock).toHaveBeenCalledWith('cancel_run', { runId: 'run-1' });
  });
});

describe('checkPlaywright', () => {
  it('invokes check_playwright with no args', async () => {
    invokeMock.mockResolvedValueOnce({
      ready: true,
      missingPaths: [],
      allPaths: ['/x/chromium-1'],
    });
    const result = await checkPlaywright();
    expect(invokeMock).toHaveBeenCalledWith('check_playwright', undefined);
    expect(result.ready).toBe(true);
  });
});

describe('installPlaywright', () => {
  it('invokes install_playwright with no args', async () => {
    invokeMock.mockResolvedValueOnce(null);
    await installPlaywright();
    expect(invokeMock).toHaveBeenCalledWith('install_playwright', undefined);
  });
});
