import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

describe('loadConfig', () => {
  it('必須環境変数 ANTHROPIC_API_KEY が未設定なら err を返す', () => {
    const result = loadConfig({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('RUNNER_CONFIG_INVALID');
      expect(result.error.message).toMatch(/ANTHROPIC_API_KEY/);
    }
  });

  it('ANTHROPIC_API_KEY のみ指定で他はデフォルトが入る', () => {
    const result = loadConfig({ ANTHROPIC_API_KEY: 'sk-test' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.anthropicApiKey).toBe('sk-test');
      expect(result.value.anthropicModel).toMatch(/^claude/);
      expect(result.value.maxRepairAttempts).toBe(3);
      expect(result.value.stepTimeoutMs).toBe(60_000);
      expect(result.value.workDir).toMatch(/smart_e2e_runner/);
      expect(result.value.useFakeLLM).toBe(false);
      expect(result.value.useDocker).toBe(false);
      expect(result.value.dockerImage).toBeNull();
    }
  });

  it('RUNNER_USE_DOCKER=true で useDocker が true になる', () => {
    const result = loadConfig({
      ANTHROPIC_API_KEY: 'sk-test',
      RUNNER_USE_DOCKER: 'true',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.useDocker).toBe(true);
    }
  });

  it('RUNNER_DOCKER_IMAGE で dockerImage を指定できる', () => {
    const result = loadConfig({
      ANTHROPIC_API_KEY: 'sk-test',
      RUNNER_DOCKER_IMAGE: 'custom-image:1.2.3',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.dockerImage).toBe('custom-image:1.2.3');
    }
  });

  it('すべて明示指定すると上書きされる', () => {
    const result = loadConfig({
      ANTHROPIC_API_KEY: 'sk-test',
      ANTHROPIC_MODEL: 'claude-custom',
      RUNNER_WORK_DIR: '/tmp/custom',
      RUNNER_MAX_REPAIR_ATTEMPTS: '5',
      RUNNER_STEP_TIMEOUT_MS: '15000',
      RUNNER_USE_FAKE_LLM: 'true',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.anthropicModel).toBe('claude-custom');
      expect(result.value.workDir).toBe('/tmp/custom');
      expect(result.value.maxRepairAttempts).toBe(5);
      expect(result.value.stepTimeoutMs).toBe(15000);
      expect(result.value.useFakeLLM).toBe(true);
    }
  });

  it('数値が不正な場合は err', () => {
    const result = loadConfig({
      ANTHROPIC_API_KEY: 'sk-test',
      RUNNER_MAX_REPAIR_ATTEMPTS: 'abc',
    });
    expect(result.ok).toBe(false);
  });

  it('attempts が 1 未満は err', () => {
    const result = loadConfig({
      ANTHROPIC_API_KEY: 'sk-test',
      RUNNER_MAX_REPAIR_ATTEMPTS: '0',
    });
    expect(result.ok).toBe(false);
  });
});
