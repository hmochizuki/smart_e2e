import { QueryClient } from '@tanstack/react-query';

export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 30,
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
