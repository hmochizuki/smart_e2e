import type { LLMClient, LLMCompleteOptions, LLMMessage } from '../../src/repair/llmClient.js';

export type FakeLLMCall = {
  messages: ReadonlyArray<LLMMessage>;
  options: LLMCompleteOptions | undefined;
};

// 固定レスポンスを順に返す簡易 FakeLLMClient。
// 配列を使い切ったあとはエラーを返し、テストの取りこぼしに気付けるようにする。
export const createFakeLLMClient = (
  responses: ReadonlyArray<string | (() => string | Promise<string>) | Error>,
): { client: LLMClient; calls: FakeLLMCall[] } => {
  const calls: FakeLLMCall[] = [];
  let i = 0;
  const client: LLMClient = {
    complete: async (messages, options) => {
      calls.push({ messages, options });
      if (i >= responses.length) {
        throw new Error('FakeLLMClient: no more responses');
      }
      const r = responses[i];
      i += 1;
      if (r instanceof Error) {
        throw r;
      }
      if (typeof r === 'function') {
        return r();
      }
      return r ?? '';
    },
  };
  return { client, calls };
};
