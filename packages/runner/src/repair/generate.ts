import { z } from 'zod';
import {
  err,
  ok,
  SCRIPT_MAX_CHARS,
  type ErrorClassification,
  type Result,
} from '@smart-e2e/shared';
import type { Artifacts } from '../playwright/artifacts.js';
import { LLMInvocationError, LLMResponseInvalidError } from '../errors.js';
import type { LLMClient } from './llmClient.js';
import { tryParseJson } from './jsonExtract.js';
import { simpleUnifiedDiff } from './diff.js';
import { REPAIR_SYSTEM_PROMPT, buildRepairUserPrompt } from './prompts/repair.js';

const RepairResponseSchema = z.object({
  script: z.string().min(1).max(SCRIPT_MAX_CHARS),
});

export type GenerateInput = {
  script: string;
  artifacts: Artifacts;
  classification: ErrorClassification;
};

export type GenerateOutput = {
  newScript: string;
  diff: string;
};

export type GenerateDeps = {
  client: LLMClient;
  model?: string;
};

export type GenerateError = LLMInvocationError | LLMResponseInvalidError;

export const generateRepair = async (
  input: GenerateInput,
  deps: GenerateDeps,
): Promise<Result<GenerateOutput, GenerateError>> => {
  // 分類が transient / incident のときは呼び出さないこと (loop 側でガード)。
  const userPrompt = buildRepairUserPrompt({
    classification: input.classification,
    script: input.script,
    errorMessage: input.artifacts.errorMessage,
    errorStack: input.artifacts.errorStack,
    domSnapshot: input.artifacts.domSnapshot,
    consoleMessages: input.artifacts.consoleMessages,
  });

  let raw: string;
  try {
    raw = await deps.client.complete([{ role: 'user', content: userPrompt }], {
      system: REPAIR_SYSTEM_PROMPT,
      maxTokens: 4096,
      temperature: 0.1,
    });
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return err(
      new LLMInvocationError(`LLM invocation failed during repair generation: ${detail}`, {
        cause,
      }),
    );
  }

  const parsed: unknown = tryParseJson(raw);
  if (parsed === undefined) return err(new LLMResponseInvalidError(raw));
  const safe = RepairResponseSchema.safeParse(parsed);
  if (!safe.success) {
    return err(new LLMResponseInvalidError(raw, { cause: safe.error }));
  }
  return ok({
    newScript: safe.data.script,
    diff: simpleUnifiedDiff(input.script, safe.data.script),
  });
};
