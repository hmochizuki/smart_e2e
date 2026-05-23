import { z } from 'zod';
import {
  ErrorClassificationSchema,
  err,
  ok,
  type ErrorClassification,
  type Result,
} from '@smart-e2e/shared';
import type { Artifacts } from '../playwright/artifacts.js';
import { LLMInvocationError, LLMResponseInvalidError } from '../errors.js';
import type { LLMClient } from './llmClient.js';
import { tryParseJson } from './jsonExtract.js';
import { CLASSIFY_SYSTEM_PROMPT, buildClassifyUserPrompt } from './prompts/classify.js';

const ClassificationResponseSchema = z.object({
  classification: ErrorClassificationSchema,
  rationale: z.string().min(1).max(2000),
});

export type ClassifyInput = {
  script: string;
  artifacts: Artifacts;
};

export type ClassifyOutput = {
  classification: ErrorClassification;
  rationale: string;
};

export type ClassifyDeps = {
  client: LLMClient;
  model?: string;
};

export type ClassifyError = LLMInvocationError | LLMResponseInvalidError;

export const classifyError = async (
  input: ClassifyInput,
  deps: ClassifyDeps,
): Promise<Result<ClassifyOutput, ClassifyError>> => {
  const userPrompt = buildClassifyUserPrompt({
    script: input.script,
    errorMessage: input.artifacts.errorMessage,
    errorStack: input.artifacts.errorStack,
    domSnapshot: input.artifacts.domSnapshot,
    consoleMessages: input.artifacts.consoleMessages,
  });

  let raw: string;
  try {
    raw = await deps.client.complete([{ role: 'user', content: userPrompt }], {
      system: CLASSIFY_SYSTEM_PROMPT,
      maxTokens: 512,
      temperature: 0,
    });
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return err(
      new LLMInvocationError(`LLM invocation failed during classify: ${detail}`, { cause }),
    );
  }

  const parsed: unknown = tryParseJson(raw);
  if (parsed === undefined) {
    return err(new LLMResponseInvalidError(raw));
  }
  const safe = ClassificationResponseSchema.safeParse(parsed);
  if (!safe.success) {
    return err(new LLMResponseInvalidError(raw, { cause: safe.error }));
  }
  return ok({
    classification: safe.data.classification,
    rationale: safe.data.rationale,
  });
};
