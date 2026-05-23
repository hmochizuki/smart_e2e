import { describe, expect, it, vi } from 'vitest';
import type { RunnerEvent } from '@smart-e2e/shared';
import { createRunnerEmitter } from '../../src/events/emitter.js';

const sampleSuiteStartedEvent = (): RunnerEvent => ({
  type: 'suite_started',
  suiteRunId: '00000000-0000-0000-0000-000000000001',
  suiteId: '00000000-0000-0000-0000-000000000002',
  startedAt: new Date('2026-01-01T00:00:00Z'),
});

describe('createRunnerEmitter', () => {
  it('subscribe したリスナーに emit したイベントを配送する', () => {
    const emitter = createRunnerEmitter();
    const fn = vi.fn<(ev: RunnerEvent) => void>();
    const off = emitter.on(fn);
    const ev = sampleSuiteStartedEvent();
    emitter.emit(ev);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(ev);
    off();
  });

  it('off() で購読解除できる', () => {
    const emitter = createRunnerEmitter();
    const fn = vi.fn<(ev: RunnerEvent) => void>();
    const off = emitter.on(fn);
    off();
    emitter.emit(sampleSuiteStartedEvent());
    expect(fn).not.toHaveBeenCalled();
  });

  it('複数 subscribe を許す', () => {
    const emitter = createRunnerEmitter();
    const fn1 = vi.fn<(ev: RunnerEvent) => void>();
    const fn2 = vi.fn<(ev: RunnerEvent) => void>();
    emitter.on(fn1);
    emitter.on(fn2);
    emitter.emit(sampleSuiteStartedEvent());
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it('リスナー内例外は他リスナーに影響しない', () => {
    const emitter = createRunnerEmitter();
    const fn1 = vi.fn<(ev: RunnerEvent) => void>(() => {
      throw new Error('boom');
    });
    const fn2 = vi.fn<(ev: RunnerEvent) => void>();
    emitter.on(fn1);
    emitter.on(fn2);
    emitter.emit(sampleSuiteStartedEvent());
    expect(fn2).toHaveBeenCalledTimes(1);
  });
});
