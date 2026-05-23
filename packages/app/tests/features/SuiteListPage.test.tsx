import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../testUtils.js';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: unknown): Promise<unknown> => Promise.resolve(invokeMock(cmd, args)),
}));

import { SuiteListPage } from '../../src/features/suite-list/SuiteListPage.js';

beforeEach(() => {
  invokeMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('SuiteListPage', () => {
  it('Suite 一覧をテーブル形式で表示する', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'list_suites') {
        return [
          {
            id: 'suite-1',
            name: 'ログインテスト',
            description: 'ログイン画面のスモークテスト',
            createdAt: '2026-05-22T00:00:00.000Z',
            updatedAt: '2026-05-22T00:00:00.000Z',
          },
          {
            id: 'suite-2',
            name: 'チェックアウト',
            description: null,
            createdAt: '2026-05-22T00:00:00.000Z',
            updatedAt: '2026-05-22T00:00:00.000Z',
          },
        ];
      }
      return null;
    });

    renderWithProviders(<SuiteListPage />);

    expect(await screen.findByText('ログインテスト')).toBeTruthy();
    expect(screen.getByText('チェックアウト')).toBeTruthy();
  });

  it('空の場合は空状態メッセージを表示する', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'list_suites') {
        return [];
      }
      return null;
    });

    renderWithProviders(<SuiteListPage />);

    expect(await screen.findByText(/Suite はまだありません/)).toBeTruthy();
  });

  it('削除ボタンを押すと確認ダイアログが出る', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'list_suites') {
        return [
          {
            id: 'suite-1',
            name: 'ログインテスト',
            description: null,
            createdAt: '2026-05-22T00:00:00.000Z',
            updatedAt: '2026-05-22T00:00:00.000Z',
          },
        ];
      }
      return null;
    });

    renderWithProviders(<SuiteListPage />);

    const deleteButton = await screen.findByRole('button', { name: '削除' });
    fireEvent.click(deleteButton);

    expect(await screen.findByText(/このSuiteを削除しますか/)).toBeTruthy();
  });

  it('確認ダイアログでOKを押すと delete_suite が呼ばれる', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'list_suites') {
        return [
          {
            id: 'suite-1',
            name: 'ログインテスト',
            description: null,
            createdAt: '2026-05-22T00:00:00.000Z',
            updatedAt: '2026-05-22T00:00:00.000Z',
          },
        ];
      }
      if (cmd === 'delete_suite') {
        return null;
      }
      return null;
    });

    renderWithProviders(<SuiteListPage />);

    fireEvent.click(await screen.findByRole('button', { name: '削除' }));
    fireEvent.click(await screen.findByRole('button', { name: '削除する' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('delete_suite', { id: 'suite-1' });
    });
  });

  it('新規 Suite ボタンを押すと作成モーダルが開く', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'list_suites') {
        return [];
      }
      return null;
    });

    renderWithProviders(<SuiteListPage />);

    await screen.findByText(/Suite はまだありません/);
    fireEvent.click(screen.getByRole('button', { name: '新規 Suite' }));

    expect(await screen.findByLabelText('名前')).toBeTruthy();
  });
});
