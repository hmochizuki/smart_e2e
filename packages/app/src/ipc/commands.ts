import { invoke } from '@tauri-apps/api/core';
import type {
  SuiteWire,
  StepWire,
  SuiteRunWire,
  NewSuiteInputWire,
  NewStepInputWire,
  SuitePatchWire,
  StepPatchWire,
  CodegenInputWire,
  CodegenResultWire,
  StartRunResponseWire,
} from './types.js';

export const listSuites = (): Promise<SuiteWire[]> => invoke('list_suites');

export const createSuite = (input: NewSuiteInputWire): Promise<SuiteWire> =>
  invoke('create_suite', { input });

export const getSuite = (id: string): Promise<SuiteWire> => invoke('get_suite', { id });

export const updateSuite = (id: string, patch: SuitePatchWire): Promise<SuiteWire> =>
  invoke('update_suite', { id, patch });

export const deleteSuite = (id: string): Promise<void> => invoke('delete_suite', { id });

export const listSteps = (suiteId: string): Promise<StepWire[]> =>
  invoke('list_steps', { suiteId });

export const createStep = (input: NewStepInputWire): Promise<StepWire> =>
  invoke('create_step', { input });

export const updateStep = (id: string, patch: StepPatchWire): Promise<StepWire> =>
  invoke('update_step', { id, patch });

export const deleteStep = (id: string): Promise<void> => invoke('delete_step', { id });

export const listSuiteRuns = (suiteId: string): Promise<SuiteRunWire[]> =>
  invoke('list_suite_runs', { suiteId });

export const startCodegen = (input: CodegenInputWire): Promise<CodegenResultWire> =>
  invoke('start_codegen', { url: input.url, target: input.target });

export const startRun = (suiteId: string): Promise<StartRunResponseWire> =>
  invoke('start_run', { suiteId });

export const cancelRun = (runId: string): Promise<void> => invoke('cancel_run', { runId });
