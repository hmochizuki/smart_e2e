import { describe, expect, it } from 'vitest';
import { generateRepair } from '../../src/repair/generate.js';
import { emptyArtifacts } from '../../src/playwright/artifacts.js';
import { createFakeLLMClient } from '../helpers/fakeLLMClient.js';

const baseScript =
  "import { test } from '@playwright/test';\ntest('x', async ({ page }) => { await page.goto('/old'); });\n";

const baseInput = (classification: 'precondition' | 'ui_change') => ({
  script: baseScript,
  artifacts: emptyArtifacts(),
  classification,
});

describe('generateRepair', () => {
  it('ui_change で新スクリプトと diff を返す', async () => {
    const newScript =
      "import { test } from '@playwright/test';\ntest('x', async ({ page }) => { await page.goto('/new'); });\n";
    const { client } = createFakeLLMClient([JSON.stringify({ script: newScript })]);
    const result = await generateRepair(baseInput('ui_change'), { client });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.newScript).toBe(newScript);
      expect(result.value.diff).toContain('-');
      expect(result.value.diff).toContain('+');
    }
  });

  it('precondition でも同様に動く', async () => {
    const newScript = baseScript.replace('/old', '/conditional');
    const { client } = createFakeLLMClient([JSON.stringify({ script: newScript })]);
    const result = await generateRepair(baseInput('precondition'), { client });
    expect(result.ok).toBe(true);
  });

  it('LLM が JSON でない応答を返した場合 err', async () => {
    const { client } = createFakeLLMClient(['not json at all']);
    const result = await generateRepair(baseInput('ui_change'), { client });
    expect(result.ok).toBe(false);
  });

  it('LLM が throw した場合は LLMInvocationError で err、cause.message が保持される', async () => {
    const { client } = createFakeLLMClient([new Error('boom')]);
    const result = await generateRepair(baseInput('ui_change'), { client });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('RUNNER_LLM_INVOCATION');
      expect(result.error.message).toContain('boom');
    }
  });

  it('空 script は err', async () => {
    const { client } = createFakeLLMClient([JSON.stringify({ script: '' })]);
    const result = await generateRepair(baseInput('ui_change'), { client });
    expect(result.ok).toBe(false);
  });
});
