import { devMockHandlers, devSubscribeRunnerEvent, isDevMockCommand } from './devMock.js';
import type { CodegenInputWire, RunnerEventWire } from './types.js';

interface TauriShim {
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  transformCallback: (callback: (response: unknown) => void, once: boolean) => number;
  unregisterCallback: (id: number) => void;
  convertFileSrc: (filePath: string, protocol?: string) => string;
}

const dispatch = (cmd: string, args?: Record<string, unknown>): unknown => {
  if (!isDevMockCommand(cmd)) {
    throw new Error(`devMock: unknown command ${cmd}`);
  }
  switch (cmd) {
    case 'list_suites':
      return devMockHandlers.list_suites();
    case 'create_suite': {
      const input = args?.['input'];
      if (!input || typeof input !== 'object') {
        throw new Error('devMock: missing input');
      }
      return devMockHandlers.create_suite(toNewSuiteInput(input));
    }
    case 'get_suite':
      return devMockHandlers.get_suite(requireString(args, 'id'));
    case 'update_suite':
      return devMockHandlers.update_suite(requireString(args, 'id'), toSuitePatch(args?.['patch']));
    case 'delete_suite':
      return devMockHandlers.delete_suite(requireString(args, 'id'));
    case 'list_steps':
      return devMockHandlers.list_steps(requireString(args, 'suiteId'));
    case 'create_step': {
      const input = args?.['input'];
      if (!input || typeof input !== 'object') {
        throw new Error('devMock: missing input');
      }
      return devMockHandlers.create_step(toNewStepInput(input));
    }
    case 'update_step':
      return devMockHandlers.update_step(requireString(args, 'id'), toStepPatch(args?.['patch']));
    case 'delete_step':
      return devMockHandlers.delete_step(requireString(args, 'id'));
    case 'list_suite_runs':
      return devMockHandlers.list_suite_runs(requireString(args, 'suiteId'));
    case 'start_codegen': {
      const url = requireString(args, 'url');
      const target = optionalCodegenTarget(args?.['target']);
      const input: CodegenInputWire = target === undefined ? { url } : { url, target };
      return devMockHandlers.start_codegen(input);
    }
    case 'start_run':
      return devMockHandlers.start_run(requireString(args, 'suiteId'));
    case 'cancel_run':
      return devMockHandlers.cancel_run(requireString(args, 'runId'));
    case 'check_playwright':
      return devMockHandlers.check_playwright();
    case 'install_playwright':
      return devMockHandlers.install_playwright();
    default: {
      const exhaustive: never = cmd;
      throw new Error(`devMock: unhandled command ${String(exhaustive)}`);
    }
  }
};

const requireString = (args: Record<string, unknown> | undefined, key: string): string => {
  const v = args?.[key];
  if (typeof v !== 'string') {
    throw new Error(`devMock: missing string arg ${key}`);
  }
  return v;
};

const optionalCodegenTarget = (v: unknown): 'playwright-test' | 'javascript' | undefined => {
  if (v === 'playwright-test' || v === 'javascript') {
    return v;
  }
  return undefined;
};

const toNewSuiteInput = (
  obj: object,
): { readonly name: string; readonly description?: string | null } => {
  const o: Record<string, unknown> = { ...obj };
  const name = o['name'];
  if (typeof name !== 'string') {
    throw new Error('devMock: invalid name');
  }
  const description = o['description'];
  if (description === undefined) {
    return { name };
  }
  if (description === null || typeof description === 'string') {
    return { name, description };
  }
  throw new Error('devMock: invalid description');
};

const toSuitePatch = (
  v: unknown,
): { readonly name?: string; readonly description?: string | null } => {
  if (!v || typeof v !== 'object') {
    return {};
  }
  const o: Record<string, unknown> = { ...v };
  const result: { name?: string; description?: string | null } = {};
  if (typeof o['name'] === 'string') {
    result.name = o['name'];
  }
  if (o['description'] === null || typeof o['description'] === 'string') {
    result.description = o['description'];
  }
  return result;
};

const toNewStepInput = (
  obj: object,
): {
  readonly suiteId: string;
  readonly order: number;
  readonly name: string;
  readonly script: string;
} => {
  const o: Record<string, unknown> = { ...obj };
  const suiteId = o['suiteId'];
  const order = o['order'];
  const name = o['name'];
  const script = o['script'];
  if (
    typeof suiteId !== 'string' ||
    typeof order !== 'number' ||
    typeof name !== 'string' ||
    typeof script !== 'string'
  ) {
    throw new Error('devMock: invalid step input');
  }
  return { suiteId, order, name, script };
};

const toStepPatch = (
  v: unknown,
): {
  readonly name?: string;
  readonly script?: string;
  readonly order?: number;
  readonly suiteId?: string;
} => {
  if (!v || typeof v !== 'object') {
    return {};
  }
  const o: Record<string, unknown> = { ...v };
  const result: { name?: string; script?: string; order?: number; suiteId?: string } = {};
  if (typeof o['name'] === 'string') {
    result.name = o['name'];
  }
  if (typeof o['script'] === 'string') {
    result.script = o['script'];
  }
  if (typeof o['order'] === 'number') {
    result.order = o['order'];
  }
  if (typeof o['suiteId'] === 'string') {
    result.suiteId = o['suiteId'];
  }
  return result;
};

declare global {
  interface Window {
    __TAURI_INTERNALS__?: TauriShim;
  }
}

interface EventCallback {
  readonly callback: (response: unknown) => void;
  readonly once: boolean;
}

export const installDevMockIfNeeded = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  if (window.__TAURI_INTERNALS__) {
    return;
  }

  // 各 transformCallback で登録された callback を id で管理する。
  let nextCallbackId = 1;
  const callbacks = new Map<number, EventCallback>();

  // event listener id -> { eventName, callbackId } を覚えておく。
  let nextEventId = 1;
  const eventListeners = new Map<number, { eventName: string; callbackId: number }>();
  const devEventUnsubscribers = new Map<string, () => void>();

  const handleEventListen = (args?: Record<string, unknown>): number => {
    const eventName = typeof args?.['event'] === 'string' ? args['event'] : '';
    const handlerId = typeof args?.['handler'] === 'number' ? args['handler'] : 0;
    const eventId = nextEventId;
    nextEventId += 1;
    eventListeners.set(eventId, { eventName, callbackId: handlerId });
    if (eventName === 'runner:event') {
      const off = devSubscribeRunnerEvent((ev: RunnerEventWire) => {
        const cb = callbacks.get(handlerId);
        if (!cb) return;
        // tauri event payload shape: { event, id, payload }
        cb.callback({ event: eventName, id: eventId, payload: ev });
      });
      devEventUnsubscribers.set(`${String(eventId)}`, off);
    }
    return eventId;
  };

  const handleEventUnlisten = (args?: Record<string, unknown>): null => {
    const eventId = typeof args?.['eventId'] === 'number' ? args['eventId'] : 0;
    const key = String(eventId);
    const off = devEventUnsubscribers.get(key);
    if (off) {
      off();
      devEventUnsubscribers.delete(key);
    }
    eventListeners.delete(eventId);
    return null;
  };

  const shim: TauriShim = {
    invoke: (cmd, args) => {
      try {
        if (cmd === 'plugin:event|listen') {
          return Promise.resolve(handleEventListen(args));
        }
        if (cmd === 'plugin:event|unlisten') {
          return Promise.resolve(handleEventUnlisten(args));
        }
        const result = dispatch(cmd, args);
        return Promise.resolve(result);
      } catch (err) {
        return Promise.reject(err instanceof Error ? err : new Error(String(err)));
      }
    },
    transformCallback: (callback, once) => {
      const id = nextCallbackId;
      nextCallbackId += 1;
      callbacks.set(id, { callback, once });
      return id;
    },
    unregisterCallback: (id) => {
      callbacks.delete(id);
    },
    convertFileSrc: (filePath) => filePath,
  };
  window.__TAURI_INTERNALS__ = shim;
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    unregisterListener: (_event, eventId) => {
      const key = String(eventId);
      const off = devEventUnsubscribers.get(key);
      if (off) {
        off();
        devEventUnsubscribers.delete(key);
      }
      eventListeners.delete(eventId);
    },
  };
};
