import type {
  CodegenInputWire,
  CodegenResultWire,
  NewStepInputWire,
  NewSuiteInputWire,
  StepPatchWire,
  StepWire,
  SuitePatchWire,
  SuiteRunWire,
  SuiteWire,
} from './types.js';

const nowIso = (): string => new Date().toISOString();

const uid = (): string => {
  const chars = '0123456789abcdef';
  const segments = [8, 4, 4, 4, 12];
  return segments
    .map((len) => {
      let s = '';
      for (let i = 0; i < len; i += 1) {
        s += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return s;
    })
    .join('-');
};

interface DevState {
  suites: SuiteWire[];
  steps: StepWire[];
  runs: SuiteRunWire[];
}

const STORAGE_KEY = 'smart_e2e_dev_state_v1';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const toSuiteArray = (v: unknown): SuiteWire[] => {
  if (!Array.isArray(v)) return [];
  const result: SuiteWire[] = [];
  for (const item of v) {
    if (!isObject(item)) continue;
    const id = item['id'];
    const name = item['name'];
    const createdAt = item['createdAt'];
    const updatedAt = item['updatedAt'];
    if (
      typeof id !== 'string' ||
      typeof name !== 'string' ||
      typeof createdAt !== 'string' ||
      typeof updatedAt !== 'string'
    ) {
      continue;
    }
    const desc = item['description'];
    const description: string | null = typeof desc === 'string' ? desc : null;
    result.push({ id, name, description, createdAt, updatedAt });
  }
  return result;
};

const toStepArray = (v: unknown): StepWire[] => {
  if (!Array.isArray(v)) return [];
  const result: StepWire[] = [];
  for (const item of v) {
    if (!isObject(item)) continue;
    const id = item['id'];
    const suiteId = item['suiteId'];
    const order = item['order'];
    const name = item['name'];
    const script = item['script'];
    const createdAt = item['createdAt'];
    const updatedAt = item['updatedAt'];
    if (
      typeof id !== 'string' ||
      typeof suiteId !== 'string' ||
      typeof order !== 'number' ||
      typeof name !== 'string' ||
      typeof script !== 'string' ||
      typeof createdAt !== 'string' ||
      typeof updatedAt !== 'string'
    ) {
      continue;
    }
    result.push({ id, suiteId, order, name, script, createdAt, updatedAt });
  }
  return result;
};

const toRunArray = (v: unknown): SuiteRunWire[] => {
  if (!Array.isArray(v)) return [];
  return [];
};

const loadState = (): DevState => {
  if (typeof window === 'undefined') {
    return { suites: [], steps: [], runs: [] };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return defaultState();
    }
    const parsed: unknown = JSON.parse(raw);
    if (isObject(parsed)) {
      return {
        suites: toSuiteArray(parsed['suites']),
        steps: toStepArray(parsed['steps']),
        runs: toRunArray(parsed['runs']),
      };
    }
  } catch {
    // ignore
  }
  return defaultState();
};

const defaultState = (): DevState => {
  const suiteId = uid();
  const suite: SuiteWire = {
    id: suiteId,
    name: 'サンプル Suite',
    description: 'dev モードのサンプルデータ',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const step: StepWire = {
    id: uid(),
    suiteId,
    order: 0,
    name: 'トップページを開く',
    script: "await page.goto('https://example.com');",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  return { suites: [suite], steps: [step], runs: [] };
};

let state: DevState = loadState();

const persist = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
};

export const devMockHandlers = {
  list_suites: (): SuiteWire[] => [...state.suites],
  create_suite: (input: NewSuiteInputWire): SuiteWire => {
    const suite: SuiteWire = {
      id: uid(),
      name: input.name,
      description: input.description ?? null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state = { ...state, suites: [...state.suites, suite] };
    persist();
    return suite;
  },
  get_suite: (id: string): SuiteWire => {
    const found = state.suites.find((s) => s.id === id);
    if (!found) {
      throw new Error(`suite not found: ${id}`);
    }
    return found;
  },
  update_suite: (id: string, patch: SuitePatchWire): SuiteWire => {
    const idx = state.suites.findIndex((s) => s.id === id);
    if (idx < 0) {
      throw new Error(`suite not found: ${id}`);
    }
    const current = state.suites[idx];
    if (!current) {
      throw new Error(`suite not found: ${id}`);
    }
    const nextDescription: string | null =
      patch.description === undefined ? (current.description ?? null) : (patch.description ?? null);
    const updated: SuiteWire = {
      id: current.id,
      name: patch.name ?? current.name,
      description: nextDescription,
      createdAt: current.createdAt,
      updatedAt: nowIso(),
    };
    const next = [...state.suites];
    next[idx] = updated;
    state = { ...state, suites: next };
    persist();
    return updated;
  },
  delete_suite: (id: string): null => {
    state = {
      ...state,
      suites: state.suites.filter((s) => s.id !== id),
      steps: state.steps.filter((s) => s.suiteId !== id),
      runs: state.runs.filter((r) => r.suiteId !== id),
    };
    persist();
    return null;
  },
  list_steps: (suiteId: string): StepWire[] =>
    state.steps.filter((s) => s.suiteId === suiteId).sort((a, b) => a.order - b.order),
  create_step: (input: NewStepInputWire): StepWire => {
    const step: StepWire = {
      id: uid(),
      suiteId: input.suiteId,
      order: input.order,
      name: input.name,
      script: input.script,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    state = { ...state, steps: [...state.steps, step] };
    persist();
    return step;
  },
  update_step: (id: string, patch: StepPatchWire): StepWire => {
    const idx = state.steps.findIndex((s) => s.id === id);
    if (idx < 0) {
      throw new Error(`step not found: ${id}`);
    }
    const current = state.steps[idx];
    if (!current) {
      throw new Error(`step not found: ${id}`);
    }
    const updated: StepWire = {
      ...current,
      name: patch.name ?? current.name,
      script: patch.script ?? current.script,
      order: patch.order ?? current.order,
      updatedAt: nowIso(),
    };
    const next = [...state.steps];
    next[idx] = updated;
    state = { ...state, steps: next };
    persist();
    return updated;
  },
  delete_step: (id: string): null => {
    state = { ...state, steps: state.steps.filter((s) => s.id !== id) };
    persist();
    return null;
  },
  list_suite_runs: (suiteId: string): SuiteRunWire[] =>
    state.runs.filter((r) => r.suiteId === suiteId),
  start_codegen: (input: CodegenInputWire): CodegenResultWire => {
    const sample = `import { test, expect } from '@playwright/test';\n\ntest('codegen mock', async ({ page }) => {\n  await page.goto('${input.url}');\n  await expect(page).toHaveTitle(/.*/);\n});\n`;
    return { script: sample, targetUrl: input.url };
  },
};

export type DevMockCommand = keyof typeof devMockHandlers;

export const isDevMockCommand = (cmd: string): cmd is DevMockCommand =>
  Object.prototype.hasOwnProperty.call(devMockHandlers, cmd);
