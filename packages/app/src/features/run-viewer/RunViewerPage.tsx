import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatDateTime } from '../../lib/format.js';
import type { StepRunStatus } from '@smart-e2e/shared';
import { Button, Spinner, useToast } from '../../ui/index.js';
import { useSteps, useSuite, useSuiteRuns } from '../suite-edit/useSuite.js';
import styles from './RunViewerPage.module.css';

const statusLabel: Readonly<Record<StepRunStatus, string>> = {
  pending: '待機中',
  running: '実行中',
  succeeded: '成功',
  failed: '失敗',
  skipped: 'スキップ',
};

const statusClass: Readonly<Record<StepRunStatus, string>> = {
  pending: 'pending',
  running: 'running',
  succeeded: 'succeeded',
  failed: 'failed',
  skipped: 'skipped',
};

interface MockStepProgress {
  readonly stepId: string;
  readonly stepName: string;
  readonly status: StepRunStatus;
  readonly attempts: number;
  readonly log: string;
}

export const RunViewerPage = (): JSX.Element => {
  const params = useParams<{ readonly id: string; readonly runId: string }>();
  const suiteId = params.id ?? '';
  const runIdParam = params.runId ?? 'latest';

  const suiteQ = useSuite(suiteId);
  const stepsQ = useSteps(suiteId);
  const runsQ = useSuiteRuns(suiteId);
  const toast = useToast();

  const [selectedRunId, setSelectedRunId] = useState<string>(runIdParam);

  const mockProgress = useMemo<readonly MockStepProgress[]>(() => {
    const steps = stepsQ.data ?? [];
    return steps.map<MockStepProgress>((step, idx) => ({
      stepId: step.id,
      stepName: step.name,
      status: idx === 0 ? 'running' : 'pending',
      attempts: 1,
      log:
        idx === 0
          ? `[mock] running step "${step.name}"...\n[mock] navigating to target URL...`
          : '',
    }));
  }, [stepsQ.data]);

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
        <Button
          variant="primary"
          onClick={() => toast.show('Run 実行は次タスク(#5b startRun)で実装予定です', 'info')}
        >
          新規実行
        </Button>
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
                  <button
                    type="button"
                    className={[
                      styles['run-button'],
                      selectedRunId === run.id ? styles['run-button-active'] : null,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => setSelectedRunId(run.id)}
                  >
                    <span className={[styles['badge'], styles[run.status]].join(' ')}>
                      {run.status}
                    </span>
                    <span className={styles['run-date']}>{formatDateTime(run.startedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <main className={styles['detail']}>
          <div className={styles['mock-banner']}>
            これはモック表示です。実 Run の進行表示は次タスクで実装されます。
          </div>

          <section className={styles['detail-section']}>
            <h2 className={styles['detail-title']}>ステップ進行</h2>
            {mockProgress.length === 0 ? (
              <div className={styles['empty']}>表示するステップがありません</div>
            ) : (
              <ol className={styles['progress-list']}>
                {mockProgress.map((p, idx) => (
                  <li key={p.stepId} className={styles['progress-item']}>
                    <span
                      className={[styles['status'], styles[statusClass[p.status]]].join(' ')}
                      aria-label={statusLabel[p.status]}
                    >
                      {idx + 1}
                    </span>
                    <div className={styles['progress-main']}>
                      <div className={styles['progress-name']}>{p.stepName}</div>
                      <div className={styles['progress-sub']}>
                        状態: {statusLabel[p.status]} / 試行: {p.attempts}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className={styles['detail-section']}>
            <h2 className={styles['detail-title']}>スクリーンショット (プレースホルダ)</h2>
            <div className={styles['screenshot']}>
              <span>screenshot preview</span>
            </div>
          </section>

          <section className={styles['detail-section']}>
            <h2 className={styles['detail-title']}>実行ログ (mock)</h2>
            <pre className={styles['log']}>
              {mockProgress
                .map((p) => p.log)
                .filter(Boolean)
                .join('\n') || '[mock] まだログがありません'}
            </pre>
          </section>
        </main>
      </div>
    </div>
  );
};
