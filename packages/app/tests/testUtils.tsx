import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../src/ui/Toast.js';

export const createTestQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

interface WrapperOptions {
  readonly initialEntries?: readonly string[];
  readonly queryClient?: QueryClient;
}

export const renderWithProviders = (
  ui: ReactElement,
  options: WrapperOptions = {},
  renderOptions?: Omit<RenderOptions, 'wrapper'>,
): RenderResult & { readonly queryClient: QueryClient } => {
  const qc = options.queryClient ?? createTestQueryClient();
  const entries = options.initialEntries ?? ['/'];
  const Wrapper = ({ children }: { readonly children: ReactNode }): JSX.Element => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[...entries]}>
        <ToastProvider>{children}</ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  const result = render(ui, { wrapper: Wrapper, ...renderOptions });
  return { ...result, queryClient: qc };
};
