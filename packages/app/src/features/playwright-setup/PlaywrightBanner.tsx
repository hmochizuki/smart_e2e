import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { checkPlaywright, installPlaywright } from '../../ipc/commands.js';
import type {
  PlaywrightInstallDoneEventWire,
  PlaywrightInstallLineEventWire,
  PlaywrightStatusWire,
} from '../../ipc/types.js';
import { Button, Spinner } from '../../ui/index.js';
import styles from './PlaywrightBanner.module.css';

const playwrightStatusKey = ['playwright-status'] as const;

export const PlaywrightBanner = (): JSX.Element | null => {
  const qc = useQueryClient();
  const status = useQuery<PlaywrightStatusWire, Error>({
    queryKey: playwrightStatusKey,
    queryFn: () => checkPlaywright(),
    staleTime: 60_000,
    retry: false,
  });

  const [lines, setLines] = useState<string[]>([]);
  const [installError, setInstallError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  const install = useMutation<void, Error>({
    mutationFn: () => installPlaywright(),
    onMutate: () => {
      setLines([]);
      setInstallError(null);
    },
    onError: (e) => {
      setInstallError(e instanceof Error ? e.message : String(e));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: playwrightStatusKey });
    },
  });

  useEffect(() => {
    if (!install.isPending) return;
    let unlistenLine: UnlistenFn | null = null;
    let unlistenDone: UnlistenFn | null = null;
    let mounted = true;
    void (async () => {
      unlistenLine = await listen<PlaywrightInstallLineEventWire>(
        'playwright:install:line',
        (e) => {
          if (!mounted) return;
          setLines((prev) => [...prev, e.payload.line].slice(-200));
          requestAnimationFrame(() => {
            const el = logRef.current;
            if (el) el.scrollTop = el.scrollHeight;
          });
        },
      );
      unlistenDone = await listen<PlaywrightInstallDoneEventWire>('playwright:install:done', () => {
        if (!mounted) return;
        void qc.invalidateQueries({ queryKey: playwrightStatusKey });
      });
    })();
    return () => {
      mounted = false;
      unlistenLine?.();
      unlistenDone?.();
    };
  }, [install.isPending, qc]);

  if (status.isPending && !status.data) return null;
  if (status.data?.ready === true && !install.isPending) return null;
  if (status.isError && !install.isPending) {
    return (
      <div className={styles['banner']} role="status">
        <span className={styles['warning']}>⚠</span>
        <span>
          Playwright のチェックに失敗しました: {status.error.message}。npx が PATH
          に通っているか確認してください。
        </span>
      </div>
    );
  }

  return (
    <div className={styles['banner']} role="status" aria-live="polite">
      <div className={styles['head']}>
        <span className={styles['warning']}>⚠</span>
        <span className={styles['title']}>
          録画機能を使うには Playwright のブラウザのインストールが必要です。
        </span>
        {!install.isPending && (
          <Button variant="primary" onClick={() => install.mutate()} disabled={install.isPending}>
            今すぐインストール
          </Button>
        )}
        {install.isPending && (
          <span className={styles['progress-label']}>
            <Spinner /> インストール中...
          </span>
        )}
      </div>
      {install.isPending && (
        <div className={styles['log']} ref={logRef}>
          {lines.length === 0 ? <span className={styles['muted']}>起動中...</span> : null}
          {lines.map((line, i) => (
            <div key={i} className={styles['log-line']}>
              {line}
            </div>
          ))}
        </div>
      )}
      {installError !== null && (
        <div className={styles['error']} role="alert">
          インストール失敗: {installError}
        </div>
      )}
      {status.data?.ready === false &&
        status.data.missingPaths.length > 0 &&
        !install.isPending && (
          <details className={styles['details']}>
            <summary>不足しているブラウザ ({status.data.missingPaths.length}件)</summary>
            <ul className={styles['paths']}>
              {status.data.missingPaths.map((p) => (
                <li key={p}>
                  <code>{p}</code>
                </li>
              ))}
            </ul>
          </details>
        )}
    </div>
  );
};
