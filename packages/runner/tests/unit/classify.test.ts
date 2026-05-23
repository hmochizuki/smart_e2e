import { describe, expect, it } from 'vitest';
import { classifyError } from '../../src/repair/classify.js';
import { emptyArtifacts } from '../../src/playwright/artifacts.js';
import { createFakeLLMClient } from '../helpers/fakeLLMClient.js';

const baseInput = () => ({
  script:
    "import { test } from '@playwright/test';\ntest('x', async ({ page }) => { await page.goto('/'); });",
  artifacts: {
    ...emptyArtifacts(),
    errorMessage: 'TimeoutError: locator not found',
  },
});

describe('classifyError', () => {
  it('LLM が transient を返したら transient を返す', async () => {
    const { client } = createFakeLLMClient([
      JSON.stringify({ classification: 'transient', rationale: 'timeout' }),
    ]);
    const result = await classifyError(baseInput(), { client });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.classification).toBe('transient');
      expect(result.value.rationale).toBe('timeout');
    }
  });

  it('precondition を返す', async () => {
    const { client } = createFakeLLMClient([
      JSON.stringify({
        classification: 'precondition',
        rationale: 'existing data',
      }),
    ]);
    const result = await classifyError(baseInput(), { client });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.classification).toBe('precondition');
  });

  it('ui_change を返す', async () => {
    const { client } = createFakeLLMClient([
      JSON.stringify({ classification: 'ui_change', rationale: 'selector' }),
    ]);
    const result = await classifyError(baseInput(), { client });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.classification).toBe('ui_change');
  });

  it('incident を返す', async () => {
    const { client } = createFakeLLMClient([
      JSON.stringify({ classification: 'incident', rationale: '500' }),
    ]);
    const result = await classifyError(baseInput(), { client });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.classification).toBe('incident');
  });

  it('JSON 以外のテキストでもコードフェンス付きを抽出できる', async () => {
    const { client } = createFakeLLMClient([
      '```json\n{"classification":"ui_change","rationale":"selector"}\n```',
    ]);
    const result = await classifyError(baseInput(), { client });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.classification).toBe('ui_change');
  });

  it('未知の分類値は LLMResponseInvalidError', async () => {
    const { client } = createFakeLLMClient([
      JSON.stringify({ classification: 'unknown', rationale: 'x' }),
    ]);
    const result = await classifyError(baseInput(), { client });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('RUNNER_LLM_RESPONSE_INVALID');
  });

  it('全くの非JSON は err', async () => {
    const { client } = createFakeLLMClient(['I am Claude, hi']);
    const result = await classifyError(baseInput(), { client });
    expect(result.ok).toBe(false);
  });

  it('LLM が throw した場合は LLMInvocationError で err、cause.message が保持される', async () => {
    const { client } = createFakeLLMClient([new Error('network down')]);
    const result = await classifyError(baseInput(), { client });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('RUNNER_LLM_INVOCATION');
      expect(result.error.message).toContain('network down');
      expect(result.error.cause).toBeInstanceOf(Error);
    }
  });
});
