import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import { installDevMockIfNeeded } from './ipc/installDevMock.js';
import { createQueryClient } from './lib/queryClient.js';
import './styles/globals.css';
import { ToastProvider } from './ui/Toast.js';

if (import.meta.env.DEV) {
  installDevMockIfNeeded();
}

const container = document.getElementById('root');
if (!container) {
  throw new Error('root container not found');
}

const queryClient = createQueryClient();

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
