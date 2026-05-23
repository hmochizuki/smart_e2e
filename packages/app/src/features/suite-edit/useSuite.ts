import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  createStep,
  deleteStep,
  getSuite,
  listSteps,
  listSuiteRuns,
  updateStep,
  updateSuite,
} from '../../ipc/commands.js';
import type {
  NewStepInputWire,
  StepPatchWire,
  StepWire,
  SuitePatchWire,
  SuiteRunWire,
  SuiteWire,
} from '../../ipc/types.js';

export const suiteKey = (id: string): readonly [string, string] => ['suite', id];
export const stepsKey = (suiteId: string): readonly [string, string, string] => [
  'steps',
  'by-suite',
  suiteId,
];
export const suiteRunsKey = (suiteId: string): readonly [string, string, string] => [
  'suite-runs',
  'by-suite',
  suiteId,
];

export const useSuite = (id: string): UseQueryResult<SuiteWire, Error> =>
  useQuery({
    queryKey: suiteKey(id),
    queryFn: () => getSuite(id),
    enabled: id.length > 0,
  });

export const useSteps = (suiteId: string): UseQueryResult<StepWire[], Error> =>
  useQuery({
    queryKey: stepsKey(suiteId),
    queryFn: () => listSteps(suiteId),
    enabled: suiteId.length > 0,
  });

export const useSuiteRuns = (suiteId: string): UseQueryResult<SuiteRunWire[], Error> =>
  useQuery({
    queryKey: suiteRunsKey(suiteId),
    queryFn: () => listSuiteRuns(suiteId),
    enabled: suiteId.length > 0,
  });

export const useUpdateSuite = (
  suiteId: string,
): {
  readonly mutateAsync: (patch: SuitePatchWire) => Promise<SuiteWire>;
  readonly isPending: boolean;
} => {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (patch: SuitePatchWire) => updateSuite(suiteId, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: suiteKey(suiteId) });
      void qc.invalidateQueries({ queryKey: ['suites'] });
    },
  });
  return { mutateAsync: m.mutateAsync, isPending: m.isPending };
};

export const useCreateStep = (
  suiteId: string,
): {
  readonly mutateAsync: (input: NewStepInputWire) => Promise<StepWire>;
  readonly isPending: boolean;
} => {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (input: NewStepInputWire) => createStep(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: stepsKey(suiteId) });
    },
  });
  return { mutateAsync: m.mutateAsync, isPending: m.isPending };
};

export const useUpdateStep = (
  suiteId: string,
): {
  readonly mutateAsync: (vars: {
    readonly id: string;
    readonly patch: StepPatchWire;
  }) => Promise<StepWire>;
  readonly isPending: boolean;
} => {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, patch }: { readonly id: string; readonly patch: StepPatchWire }) =>
      updateStep(id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: stepsKey(suiteId) });
    },
  });
  return { mutateAsync: m.mutateAsync, isPending: m.isPending };
};

export const useDeleteStep = (
  suiteId: string,
): {
  readonly mutateAsync: (id: string) => Promise<void>;
  readonly isPending: boolean;
} => {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (id: string) => deleteStep(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: stepsKey(suiteId) });
    },
  });
  return { mutateAsync: m.mutateAsync, isPending: m.isPending };
};
