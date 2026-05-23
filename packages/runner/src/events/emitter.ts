import type { RunnerEvent } from '@smart-e2e/shared';

export type RunnerEventListener = (event: RunnerEvent) => void;

export type RunnerEmitter = {
  emit: (event: RunnerEvent) => void;
  on: (listener: RunnerEventListener) => () => void;
};

// Node の EventEmitter は any 混入の温床になりがちなので、
// シンプルな Set ベースの型付き emitter を自前で書く。
// リスナーの例外は他リスナーに影響させない (上位のオブザーバビリティに委ねる)。
export const createRunnerEmitter = (): RunnerEmitter => {
  const listeners = new Set<RunnerEventListener>();

  const emit = (event: RunnerEvent): void => {
    for (const l of listeners) {
      try {
        l(event);
      } catch {
        // 黙殺。emit パスでは例外を伝播させない。
      }
    }
  };

  const on = (listener: RunnerEventListener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return { emit, on };
};
