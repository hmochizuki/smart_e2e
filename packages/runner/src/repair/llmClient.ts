export type LLMMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type LLMCompleteOptions = {
  system?: string;
  maxTokens?: number;
  temperature?: number;
};

export type LLMClient = {
  // 一回限りの推論呼び出し。stream は使わない。
  complete: (messages: ReadonlyArray<LLMMessage>, options?: LLMCompleteOptions) => Promise<string>;
};
