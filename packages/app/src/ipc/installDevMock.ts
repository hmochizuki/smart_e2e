import { devMockHandlers, isDevMockCommand } from './devMock.js';
import type { CodegenInputWire } from './types.js';

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

export const installDevMockIfNeeded = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  if (window.__TAURI_INTERNALS__) {
    return;
  }
  const shim: TauriShim = {
    invoke: (cmd, args) => {
      try {
        const result = dispatch(cmd, args);
        return Promise.resolve(result);
      } catch (err) {
        return Promise.reject(err instanceof Error ? err : new Error(String(err)));
      }
    },
    transformCallback: () => 0,
    unregisterCallback: () => {},
    convertFileSrc: (filePath) => filePath,
  };
  window.__TAURI_INTERNALS__ = shim;
};
