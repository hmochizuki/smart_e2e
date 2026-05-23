import { useEffect, useReducer, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';
import type { StepRunStatus, RunStatus } from '@smart-e2e/shared';
import { Button, Spinner, useToast } from '../../ui/index.js';
import { useSuite, useSuiteRuns, suiteRunsKey } from '../suite-edit/useSuite.js';
import { cancelRun } from '../../ipc/commands.js';
import type { RunnerEventWire } from '../../ipc/types.js';
import { initialRunViewerState, runViewerReducer, type StepProgress } from './runViewerReducer.js';
import styles from './RunViewerPage.module.css';

const stepStatusLabel: Readonly<Record<StepRunStatus, string>> = {
  pending: '待機中',
  running: '実行中',
  succeeded: '成功',
  failed: '失敗',
  skipped: 'スキップ',
};

const suiteStatusLabel: Readonly<Record<RunStatus, string>> = {
  pending: '待機中',
  running: '実行中',
  succeeded: '成功',
  failed: '失敗',
  aborted: '中断',
};

const StepRow = ({
  step,
  index,
}: {
  readonly step: StepProgress;
  readonly index: number;
}): JSX.Element => {
  const [open, setOpen] = useState<boolean>(false);
  const hasDetails =
    step.classification !== null ||
    step.errorLog.length > 0 ||
    step.diff !== null ||
    step.skippedReason !== null ||
    (step.finalScript !== null && step.finalScript.length > 0);

  return (
    <li className={styles['progress-item']}>
      <span
        className={[styles['status'], styles[step.status]].join(' ')}
        aria-label={stepStatusLabel[step.status]}
      >
        {index + 1}
      </span>
      <div className={styles['progress-main']}>
        <div className={styles['progress-name']}>{step.name}</div>
        <div className={styles['progress-sub']}>
          状態: {stepStatusLabel[step.status]} / 試行: {step.attempts}
          {step.classification !== null ? ` / 分類: ${step.classification}` : ''}
          {step.exhausted ? ' / 修復上限到達' : ''}
          {step.skippedReason !== null ? ` / 理由: ${step.skippedReason}` : ''}
        </div>
        {hasDetails ? (
          <button
            type="button"
            className={styles['detail-toggle']}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? '詳細を閉じる' : '詳細を表示'}
          </button>
        ) : null}
        {open ? (
          <div className={styles['details']}>
            {step.errorLog.length > 0 ? (
              <details className={styles['details-row']}>
                <summary>エラーログ</summary>
                <pre className={styles['code']}>{step.errorLog}</pre>
              </details>
            ) : null}
            {step.diff !== null ? (
              <details className={styles['details-row']}>
                <summary>修復 diff</summary>
                <pre className={styles['code']}>{step.diff}</pre>
              </details>
            ) : null}
            {step.finalScript !== null && step.finalScript.length > 0 ? (
              <details className={styles['details-row']}>
                <summary>最終スクリプト</summary>
                <pre className={styles['code']}>{step.finalScript}</pre>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
};

export const RunViewerPage = (): JSX.Element => {
  const params = useParams<{ readonly id: string; readonly runId: string }>();
  const suiteId = params.id ?? '';
  const runId = params.runId ?? '';

  const suiteQ = useSuite(suiteId);
  const runsQ = useSuiteRuns(suiteId);
  const toast = useToast();
  const queryClient = useQueryClient();

  const [state, dispatch] = useReducer(runViewerReducer, initialRunViewerState);
  const [cancelling, setCancelling] = useState<boolean>(false);

  useEffect(() => {
    if (runId === '' || runId === 'latest') {
      return;
    }
    let unlisten: UnlistenFn | null = null;
    let cancelled = false;
    const subscribe = async (): Promise<void> => {
      try {
        const off = await listen<RunnerEventWire>('runner:event', (msg) => {
          const ev = msg.payload;
          // suiteRunId が現在の Run と合致するか判定可能なものは絞り込み。
          if ('suiteRunId' in ev && ev.suiteRunId !== runId) {
            return;
          }
          dispatch(ev);
          if (ev.type === 'suite_finished') {
            void queryClient.invalidateQueries({ queryKey: suiteRunsKey(suiteId) });
          }
        });
        if (cancelled) {
          off();
          return;
        }
        unlisten = off;
      } catch (e) {
        toast.show(
          `イベント購読に失敗しました: ${e instanceof Error ? e.message : String(e)}`,
          'error',
        );
      }
    };
    void subscribe();
    return () => {
      cancelled = true;
      if (unlisten) {
        unlisten();
      }
    };
  }, [runId, suiteId, queryClient, toast]);

  const handleCancel = async (): Promise<void> => {
    if (cancelling) return;
    setCancelling(true);
    try {
      await cancelRun(runId);
      toast.show('実行を中断しました', 'info');
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '中断に失敗しました', 'error');
    } finally {
      setCancelling(false);
    }
  };

  if (suiteQ.isLoading) {
    return (
      <div className={styles['state']}>
        <Spinner label="読み込み中..." />
      </div>
    );
  }

  if (!suiteQ.data) {
    return (
      <div className={styles['state']} role="alert">
        Suite を取得できませんでした
      </div>
    );
  }

  const isRunning = state.suiteStatus === 'running' || state.suiteStatus === null;
  const runs = runsQ.data ?? [];

  return (
    <div className={styles['container']}>
      <div className={styles['breadcrumbs']}>
        <Link to="/">Suite 一覧</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/suites/${suiteId}`}>{suiteQ.data.name}</Link>
        <span aria-hidden="true">/</span>
        <span>実行ビュー</span>
      </div>

      <header className={styles['header']}>
        <h1 className={styles['title']}>{suiteQ.data.name} 実行ビュー</h1>
        <div className={styles['header-actions']}>
          <span className={styles['suite-status']} aria-live="polite">
            {state.suiteStatus ? suiteStatusLabel[state.suiteStatus] : '待機中'}
          </span>
          {isRunning && runId !== '' && runId !== 'latest' ? (
            <Button variant="danger" onClick={() => void handleCancel()} disabled={cancelling}>
              {cancelling ? '中断中...' : '中断'}
            </Button>
          ) : null}
        </div>
      </header>

      <div className={styles['layout']}>
        <aside className={styles['runs']}>
          <div className={styles['runs-header']}>過去の実行 ({runs.length})</div>
          {runsQ.isLoading ? (
            <Spinner label="読み込み中..." />
          ) : runs.length === 0 ? (
            <div className={styles['runs-empty']}>まだ実行履歴がありません</div>
          ) : (
            <ul className={styles['runs-list']}>
              {runs.map((run) => (
                <li key={run.id}>
                  <Link
                    to={`/suites/${suiteId}/runs/${run.id}`}
                    className={[
                      styles['run-button'],
                      run.id === runId ? styles['run-button-active'] : null,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className={[styles['badge'], styles[run.status]].join(' ')}>
                      {run.status}
                    </span>
                    <span className={styles['run-date']}>
                      {new Date(run.startedAt).toLocaleString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className={styles['detail']}>
          <section className={styles['detail-section']}>
            <h2 className={styles['detail-title']}>ステップ進行</h2>
            {state.steps.length === 0 ? (
              <div className={styles['empty']}>
                {isRunning ? (
                  <Spinner label="実行開始を待っています..." />
                ) : (
                  '表示するステップがありません'
                )}
              </div>
            ) : (
              <ol className={styles['progress-list']}>
                {state.steps.map((step, idx) => (
                  <StepRow key={step.stepRunId} step={step} index={idx} />
                ))}
              </ol>
            )}
          </section>

          <section className={styles['detail-section']}>
            <h2 className={styles['detail-title']}>ログ</h2>
            <pre className={styles['log']}>
              {state.logs.length === 0 ? 'ログはまだありません' : state.logs.join('\n')}
            </pre>
          </section>
        </main>
      </div>
    </div>
  );
};
