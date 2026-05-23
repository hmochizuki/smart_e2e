import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../testUtils.js';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: unknown): Promise<unknown> => Promise.resolve(invokeMock(cmd, args)),
}));

import { SuiteEditPage } from '../../src/features/suite-edit/SuiteEditPage.js';

const renderPage = (): void => {
  renderWithProviders(
    <Routes>
      <Route path="/suites/:id" element={<SuiteEditPage />} />
    </Routes>,
    { initialEntries: ['/suites/suite-1'] },
  );
};

const baseSuite = {
  id: 'suite-1',
  name: 'ログインテスト',
  description: 'メモ',
  createdAt: '2026-05-22T00:00:00.000Z',
  updatedAt: '2026-05-22T00:00:00.000Z',
};

const baseStep = {
  id: 'step-1',
  suiteId: 'suite-1',
  order: 0,
  name: 'トップを開く',
  script: 'await page.goto("https://example.com")',
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
        return [baseStep];
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

describe('SuiteEditPage', () => {
  it('Suite 名と Step 一覧を表示する', async () => {
    renderPage();

    expect(await screen.findByDisplayValue('ログインテスト')).toBeTruthy();
    expect(await screen.findByText('トップを開く')).toBeTruthy();
  });

  it('Suite 名を変更して保存ボタンを押すと update_suite が呼ばれる', async () => {
    renderPage();

    const nameInput = await screen.findByDisplayValue('ログインテスト');
    fireEvent.change(nameInput, { target: { value: 'リネーム済み' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suite を保存' }));

    await waitFor(() => {
      const updateCall = invokeMock.mock.calls.find((c) => c[0] === 'update_suite');
      expect(updateCall).toBeDefined();
    });
    const updateCall = invokeMock.mock.calls.find((c) => c[0] === 'update_suite');
    const args: unknown = updateCall ? updateCall[1] : null;
    if (typeof args !== 'object' || args === null) {
      throw new Error('update_suite args missing');
    }
    const argsObj: Record<string, unknown> = { ...args };
    expect(argsObj['id']).toBe('suite-1');
    const patch = argsObj['patch'];
    if (typeof patch !== 'object' || patch === null) {
      throw new Error('patch missing');
    }
    const patchObj: Record<string, unknown> = { ...patch };
    expect(patchObj['name']).toBe('リネーム済み');
  });

  it('新規Stepボタンを押すとStep編集モーダルが開く', async () => {
    renderPage();

    await screen.findByText('トップを開く');
    fireEvent.click(screen.getByRole('button', { name: '新規 Step' }));

    expect(await screen.findByLabelText('Step 名')).toBeTruthy();
    expect(screen.getByLabelText('スクリプト')).toBeTruthy();
  });

  it('Stepモーダルから保存すると create_step が呼ばれる', async () => {
    renderPage();

    await screen.findByText('トップを開く');
    fireEvent.click(screen.getByRole('button', { name: '新規 Step' }));

    fireEvent.change(await screen.findByLabelText('Step 名'), {
      target: { value: 'ボタンクリック' },
    });
    fireEvent.change(screen.getByLabelText('スクリプト'), {
      target: { value: 'await page.click("#go")' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith('create_step', {
        input: {
          suiteId: 'suite-1',
          order: 1,
          name: 'ボタンクリック',
          script: 'await page.click("#go")',
        },
      });
    });
  });

  describe('CodegenDialog 連携', () => {
    it('「録画から Step を作成」ボタンで CodegenDialog が開く', async () => {
      renderPage();

      await screen.findByText('トップを開く');
      fireEvent.click(screen.getByRole('button', { name: '録画から Step を作成' }));

      expect(await screen.findByLabelText('録画開始 URL')).toBeTruthy();
      expect(screen.getByLabelText('生成形式')).toBeTruthy();
    });

    it('URL 入力後に録画開始すると start_codegen が呼ばれる', async () => {
      invokeMock.mockImplementation((cmd: string) => {
        switch (cmd) {
          case 'get_suite':
            return baseSuite;
          case 'list_steps':
            return [baseStep];
          case 'list_suite_runs':
            return [];
          case 'start_codegen':
            return {
              script: 'await page.goto("https://recorded.example.com")',
              targetUrl: 'https://recorded.example.com',
            };
          default:
            return null;
        }
      });

      renderPage();

      await screen.findByText('トップを開く');
      fireEvent.click(screen.getByRole('button', { name: '録画から Step を作成' }));

      const urlInput = await screen.findByLabelText('録画開始 URL');
      fireEvent.change(urlInput, { target: { value: 'https://recorded.example.com' } });
      fireEvent.click(screen.getByRole('button', { name: '録画を開始' }));

      await waitFor(() => {
        expect(invokeMock).toHaveBeenCalledWith('start_codegen', {
          url: 'https://recorded.example.com',
          target: 'playwright-test',
        });
      });
    });

    it('codegen 完了で StepEditModal が録画スクリプトを初期値として開く', async () => {
      invokeMock.mockImplementation((cmd: string) => {
        switch (cmd) {
          case 'get_suite':
            return baseSuite;
          case 'list_steps':
            return [baseStep];
          case 'list_suite_runs':
            return [];
          case 'start_codegen':
            return {
              script: 'await page.goto("https://recorded.example.com")',
              targetUrl: 'https://recorded.example.com',
            };
          default:
            return null;
        }
      });

      renderPage();

      await screen.findByText('トップを開く');
      fireEvent.click(screen.getByRole('button', { name: '録画から Step を作成' }));
      fireEvent.change(await screen.findByLabelText('録画開始 URL'), {
        target: { value: 'https://recorded.example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: '録画を開始' }));

      const scriptArea = await screen.findByLabelText('スクリプト');
      await waitFor(() => {
        const value = (scriptArea as HTMLTextAreaElement).value;
        expect(value).toBe('await page.goto("https://recorded.example.com")');
      });
      expect(await screen.findByRole('heading', { name: '新規 Step' })).toBeTruthy();
    });

    it('start_codegen が失敗した場合エラーメッセージが表示される', async () => {
      invokeMock.mockImplementation((cmd: string) => {
        switch (cmd) {
          case 'get_suite':
            return baseSuite;
          case 'list_steps':
            return [baseStep];
          case 'list_suite_runs':
            return [];
          case 'start_codegen':
            throw new Error('codegen failed: npx not found');
          default:
            return null;
        }
      });

      renderPage();

      await screen.findByText('トップを開く');
      fireEvent.click(screen.getByRole('button', { name: '録画から Step を作成' }));
      fireEvent.change(await screen.findByLabelText('録画開始 URL'), {
        target: { value: 'https://recorded.example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: '録画を開始' }));

      expect(await screen.findByText(/codegen failed: npx not found/)).toBeTruthy();
    });
  });
});
