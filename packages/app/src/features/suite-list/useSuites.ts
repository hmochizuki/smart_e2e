import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { createSuite, deleteSuite, listSuites } from '../../ipc/commands.js';
import type { NewSuiteInputWire, SuiteWire } from '../../ipc/types.js';

export const suitesKey = ['suites'] as const;

export const useSuites = (): UseQueryResult<SuiteWire[], Error> =>
  useQuery({
    queryKey: suitesKey,
    queryFn: () => listSuites(),
  });

export const useCreateSuite = (): {
  readonly mutateAsync: (input: NewSuiteInputWire) => Promise<SuiteWire>;
  readonly isPending: boolean;
} => {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (input: NewSuiteInputWire) => createSuite(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: suitesKey });
    },
  });
  return { mutateAsync: m.mutateAsync, isPending: m.isPending };
};

export const useDeleteSuite = (): {
  readonly mutateAsync: (id: string) => Promise<void>;
  readonly isPending: boolean;
} => {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (id: string) => deleteSuite(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: suitesKey });
    },
  });
  return { mutateAsync: m.mutateAsync, isPending: m.isPending };
};
