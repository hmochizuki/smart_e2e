import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaywrightBanner } from '../../src/features/playwright-setup/PlaywrightBanner.js';
import { renderWithProviders } from '../testUtils.js';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: unknown): Promise<unknown> => Promise.resolve(invokeMock(cmd, args)),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => undefined),
}));

describe('PlaywrightBanner', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('ready=true なら何も表示しない', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'check_playwright') {
        return { ready: true, missingPaths: [], allPaths: ['/x/chromium-1'] };
      }
      return null;
    });

    renderWithProviders(<PlaywrightBanner />);
    // バナーは表示されないので、何も text が出ない
    await waitFor(() => {
      expect(screen.queryByText(/録画機能を使うには/)).toBeNull();
    });
  });

  it('ready=false なら警告バナーとインストールボタンを表示する', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'check_playwright') {
        return {
          ready: false,
          missingPaths: ['/x/chromium-1223'],
          allPaths: ['/x/chromium-1223', '/x/firefox-1522'],
        };
      }
      return null;
    });

    renderWithProviders(<PlaywrightBanner />);

    expect(await screen.findByText(/録画機能を使うには/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '今すぐインストール' })).toBeTruthy();
  });

  it('インストールボタンを押すと install_playwright が呼ばれる', async () => {
    let installCalled = false;
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'check_playwright') {
        return { ready: false, missingPaths: ['/x/chromium-1223'], allPaths: ['/x/chromium-1223'] };
      }
      if (cmd === 'install_playwright') {
        installCalled = true;
        return null;
      }
      return null;
    });

    renderWithProviders(<PlaywrightBanner />);

    fireEvent.click(await screen.findByRole('button', { name: '今すぐインストール' }));

    await waitFor(() => {
      expect(installCalled).toBe(true);
    });
  });

  it('check_playwright がエラーになったらエラー表示する', async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === 'check_playwright') {
        throw new Error('npx not found');
      }
      return null;
    });

    renderWithProviders(<PlaywrightBanner />);

    expect(await screen.findByText(/Playwright のチェックに失敗しました/)).toBeTruthy();
  });
});
