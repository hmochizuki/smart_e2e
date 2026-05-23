import Anthropic from '@anthropic-ai/sdk';
import type { LLMClient, LLMCompleteOptions, LLMMessage } from './llmClient.js';

export type AnthropicLLMClientOptions = {
  apiKey: string;
  model: string;
  defaultMaxTokens?: number;
};

// Anthropic SDK の messages.create を LLMClient に適合させる薄いラッパー。
// テストで叩かれないよう、SDK 依存はこのファイルだけに閉じる。
export const createAnthropicLLMClient = (options: AnthropicLLMClientOptions): LLMClient => {
  const client = new Anthropic({ apiKey: options.apiKey });
  const defaultMaxTokens = options.defaultMaxTokens ?? 4096;

  const complete = async (
    messages: ReadonlyArray<LLMMessage>,
    callOptions?: LLMCompleteOptions,
  ): Promise<string> => {
    const params = {
      model: options.model,
      max_tokens: callOptions?.maxTokens ?? defaultMaxTokens,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...(callOptions?.system !== undefined ? { system: callOptions.system } : {}),
      ...(callOptions?.temperature !== undefined ? { temperature: callOptions.temperature } : {}),
    };
    const response = await client.messages.create(params);
    const textChunks: string[] = [];
    for (const block of response.content) {
      if (block.type === 'text') {
        textChunks.push(block.text);
      }
    }
    return textChunks.join('');
  };

  return { complete };
};
