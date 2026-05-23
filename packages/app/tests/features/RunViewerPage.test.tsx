import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../testUtils.js';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: unknown): Promise<unknown> => Promise.resolve(invokeMock(cmd, args)),
}));

import { RunViewerPage } from '../../src/features/run-viewer/RunViewerPage.js';

const baseSuite = {
  id: 'suite-1',
  name: 'ログインテスト',
  description: null,
  createdAt: '2026-05-22T00:00:00.000Z',
  updatedAt: '2026-05-22T00:00:00.000Z',
};

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockImplementation((cmd: string) => {
    switch (cmd) {
      case 'get_suite':
        return baseSuite;
      case 'list_steps':
        return [
          {
            id: 'step-1',
            suiteId: 'suite-1',
            order: 0,
            name: 'トップを開く',
            script: 'await page.goto("https://example.com")',
            createdAt: '2026-05-22T00:00:00.000Z',
            updatedAt: '2026-05-22T00:00:00.000Z',
          },
        ];
      case 'list_suite_runs':
        return [];
      default:
        return null;
    }
  });
});

afterEach(() => {
  cleanup();
});

describe('RunViewerPage', () => {
  it('Suite 名と モックバナーを表示する', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/suites/:id/runs/:runId" element={<RunViewerPage />} />
      </Routes>,
      { initialEntries: ['/suites/suite-1/runs/latest'] },
    );

    expect(await screen.findByText(/ログインテスト 実行ビュー/)).toBeTruthy();
    expect(screen.getByText(/モック表示/)).toBeTruthy();
  });

  it('新規実行ボタンを押すと toast に「次タスクで実装」と表示される', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/suites/:id/runs/:runId" element={<RunViewerPage />} />
      </Routes>,
      { initialEntries: ['/suites/suite-1/runs/latest'] },
    );

    fireEvent.click(await screen.findByRole('button', { name: '新規実行' }));
    expect(await screen.findByText(/Run 実行は次タスク/)).toBeTruthy();
  });
});
