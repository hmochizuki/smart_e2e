import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../testUtils.js';
import type { RunnerEventWire } from '../../src/ipc/types.js';

const invokeMock = vi.fn();

let pushEvent: ((ev: RunnerEventWire) => void) | null = null;
const listeners = new Set<(ev: RunnerEventWire) => void>();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: unknown): Promise<unknown> => Promise.resolve(invokeMock(cmd, args)),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: <T,>(
    _event: string,
    handler: (ev: { event: string; id: number; payload: T }) => void,
  ) => {
    const wrapped = (payload: unknown): void => {
      handler({ event: 'runner:event', id: 1, payload: payload as T });
    };
    const cast = wrapped as (ev: RunnerEventWire) => void;
    listeners.add(cast);
    return Promise.resolve(() => {
      listeners.delete(cast);
    });
  },
}));

import { RunViewerPage } from '../../src/features/run-viewer/RunViewerPage.js';

const SUITE_RUN_ID = '00000000-0000-0000-0000-0000000000aa';
const STEP_RUN_ID_1 = '00000000-0000-0000-0000-0000000000a1';
const STEP_RUN_ID_2 = '00000000-0000-0000-0000-0000000000a2';
const STEP_ID_1 = '00000000-0000-0000-0000-0000000000b1';
const STEP_ID_2 = '00000000-0000-0000-0000-0000000000b2';
const SUITE_ID = '00000000-0000-0000-0000-0000000000c1';

const baseSuite = {
  id: SUITE_ID,
  name: 'ログインテスト',
  description: null,
  createdAt: '2026-05-22T00:00:00.000Z',
  updatedAt: '2026-05-22T00:00:00.000Z',
};

beforeEach(() => {
  invokeMock.mockReset();
  listeners.clear();
  pushEvent = (ev: RunnerEventWire): void => {
    for (const l of listeners) l(ev);
  };
  invokeMock.mockImplementation((cmd: string) => {
    switch (cmd) {
      case 'get_suite':
        return baseSuite;
      case 'list_steps':
        return [];
      case 'list_suite_runs':
        return [];
      default:
        return null;
    }
  });
});

afterEach(() => {
  cleanup();
  listeners.clear();
  pushEvent = null;
});

const renderRunViewer = (): ReturnType<typeof renderWithProviders> =>
  renderWithProviders(
    <Routes>
      <Route path="/suites/:id/runs/:runId" element={<RunViewerPage />} />
    </Routes>,
    { initialEntries: [`/suites/${SUITE_ID}/runs/${SUITE_RUN_ID}`] },
  );

describe('RunViewerPage', () => {
  it('Suite 名を表示し、初期状態は「実行開始を待っています」と「待機中」を表示', async () => {
    renderRunViewer();
    expect(await screen.findByText(/ログインテスト 実行ビュー/)).toBeTruthy();
    expect(screen.getByText(/実行開始を待っています/)).toBeTruthy();
    expect(screen.getByText(/待機中/)).toBeTruthy();
  });

  it('suite_started → step_started で「実行中」と step 名を表示', async () => {
    renderRunViewer();
    await screen.findByText(/ログインテスト 実行ビュー/);
    await waitFor(() => expect(listeners.size).toBeGreaterThan(0));

    act(() => {
      pushEvent?.({
        type: 'suite_started',
        suiteRunId: SUITE_RUN_ID,
        suiteId: SUITE_ID,
        startedAt: '2026-05-22T01:00:00.000Z',
      });
      pushEvent?.({
        type: 'step_started',
        stepRunId: STEP_RUN_ID_1,
        stepId: STEP_ID_1,
        order: 0,
        name: 'トップを開く',
      });
    });

    expect(await screen.findByText('トップを開く')).toBeTruthy();
    expect(screen.getAllByText(/実行中/).length).toBeGreaterThan(0);
  });

  it('step_attempt で試行回数が更新される', async () => {
    renderRunViewer();
    await screen.findByText(/ログインテスト 実行ビュー/);
    await waitFor(() => expect(listeners.size).toBeGreaterThan(0));

    act(() => {
      pushEvent?.({
        type: 'step_started',
        stepRunId: STEP_RUN_ID_1,
        stepId: STEP_ID_1,
        order: 0,
        name: 'step A',
      });
      pushEvent?.({
        type: 'step_attempt',
        stepRunId: STEP_RUN_ID_1,
        attempt: 2,
        script: "import { test } from '@playwright/test';\ntest('s', async () => {});",
      });
    });

    expect(await screen.findByText(/試行: 2/)).toBeTruthy();
  });

  it('repair_classified で分類バッジ表示', async () => {
    renderRunViewer();
    await screen.findByText(/ログインテスト 実行ビュー/);
    await waitFor(() => expect(listeners.size).toBeGreaterThan(0));

    act(() => {
      pushEvent?.({
        type: 'step_started',
        stepRunId: STEP_RUN_ID_1,
        stepId: STEP_ID_1,
        order: 0,
        name: 'step A',
      });
      pushEvent?.({
        type: 'repair_classified',
        stepRunId: STEP_RUN_ID_1,
        attempt: 1,
        classification: 'ui_change',
        errorLog: 'selector not found',
      });
    });

    expect(await screen.findByText(/分類: ui_change/)).toBeTruthy();
  });

  it('step_skipped で skip 状態と理由を表示', async () => {
    renderRunViewer();
    await screen.findByText(/ログインテスト 実行ビュー/);
    await waitFor(() => expect(listeners.size).toBeGreaterThan(0));

    act(() => {
      pushEvent?.({
        type: 'step_started',
        stepRunId: STEP_RUN_ID_2,
        stepId: STEP_ID_2,
        order: 1,
        name: 'skip対象',
      });
      pushEvent?.({
        type: 'step_skipped',
        stepRunId: STEP_RUN_ID_2,
        reason: 'previous step failed',
      });
    });

    expect(await screen.findByText(/理由: previous step failed/)).toBeTruthy();
    expect(screen.getAllByText(/スキップ/).length).toBeGreaterThan(0);
  });

  it('suite_finished で最終ステータスを表示', async () => {
    renderRunViewer();
    await screen.findByText(/ログインテスト 実行ビュー/);
    await waitFor(() => expect(listeners.size).toBeGreaterThan(0));

    act(() => {
      pushEvent?.({
        type: 'suite_finished',
        suiteRunId: SUITE_RUN_ID,
        status: 'succeeded',
        finishedAt: '2026-05-22T01:01:00.000Z',
      });
    });

    expect(await screen.findByText(/^成功$/)).toBeTruthy();
  });

  it('他の suiteRunId の event は無視される', async () => {
    renderRunViewer();
    await screen.findByText(/ログインテスト 実行ビュー/);
    await waitFor(() => expect(listeners.size).toBeGreaterThan(0));

    act(() => {
      pushEvent?.({
        type: 'suite_started',
        suiteRunId: '11111111-1111-1111-1111-111111111111',
        suiteId: SUITE_ID,
        startedAt: '2026-05-22T01:00:00.000Z',
      });
    });

    // 自分の run は依然として実行待ち
    expect(await screen.findByText(/実行開始を待っています/)).toBeTruthy();
  });
});
