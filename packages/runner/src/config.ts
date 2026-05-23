import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import {
  DEFAULT_STEP_TIMEOUT_MS,
  MAX_REPAIR_ATTEMPTS,
  ok,
  err,
  type Result,
} from '@smart-e2e/shared';
import { ConfigError } from './errors.js';

export type RunnerConfig = {
  anthropicApiKey: string;
  anthropicModel: string;
  workDir: string;
  maxRepairAttempts: number;
  stepTimeoutMs: number;
  useFakeLLM: boolean;
  useDocker: boolean;
  dockerImage: string | null;
};

const defaultWorkDir = (): string => join(tmpdir(), 'smart_e2e_runner');

const truthy = (raw: string | undefined): boolean => raw === '1' || raw?.toLowerCase() === 'true';

// process.env と同じ shape を受け取って RunnerConfig を返す。
// 純粋関数にして、テストから env を注入できるようにしている。
const RawEnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  ANTHROPIC_MODEL: z.string().min(1).optional(),
  RUNNER_WORK_DIR: z.string().min(1).optional(),
  RUNNER_MAX_REPAIR_ATTEMPTS: z
    .string()
    .regex(/^\d+$/, 'RUNNER_MAX_REPAIR_ATTEMPTS must be a positive integer')
    .optional(),
  RUNNER_STEP_TIMEOUT_MS: z
    .string()
    .regex(/^\d+$/, 'RUNNER_STEP_TIMEOUT_MS must be a positive integer')
    .optional(),
  RUNNER_USE_FAKE_LLM: z.string().optional(),
  RUNNER_USE_DOCKER: z.string().optional(),
  RUNNER_DOCKER_IMAGE: z.string().min(1).optional(),
});

const DEFAULT_MODEL = 'claude-opus-4-5';

export const loadConfig = (
  env: Readonly<Record<string, string | undefined>>,
): Result<RunnerConfig, ConfigError> => {
  const parsed = RawEnvSchema.safeParse(env);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return err(new ConfigError(message));
  }
  const data = parsed.data;
  const maxRepairAttempts =
    data.RUNNER_MAX_REPAIR_ATTEMPTS !== undefined
      ? Number.parseInt(data.RUNNER_MAX_REPAIR_ATTEMPTS, 10)
      : MAX_REPAIR_ATTEMPTS;
  if (maxRepairAttempts < 1) {
    return err(new ConfigError('RUNNER_MAX_REPAIR_ATTEMPTS must be >= 1'));
  }
  const stepTimeoutMs =
    data.RUNNER_STEP_TIMEOUT_MS !== undefined
      ? Number.parseInt(data.RUNNER_STEP_TIMEOUT_MS, 10)
      : DEFAULT_STEP_TIMEOUT_MS;
  if (stepTimeoutMs < 1) {
    return err(new ConfigError('RUNNER_STEP_TIMEOUT_MS must be >= 1'));
  }

  return ok({
    anthropicApiKey: data.ANTHROPIC_API_KEY,
    anthropicModel: data.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
    workDir: data.RUNNER_WORK_DIR ?? defaultWorkDir(),
    maxRepairAttempts,
    stepTimeoutMs,
    useFakeLLM: truthy(data.RUNNER_USE_FAKE_LLM),
    useDocker: truthy(data.RUNNER_USE_DOCKER),
    dockerImage: data.RUNNER_DOCKER_IMAGE ?? null,
  });
};
