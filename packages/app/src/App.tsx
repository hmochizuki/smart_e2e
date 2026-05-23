import { useEffect, useState } from 'react';
import { listSuites } from './ipc/commands.js';
import type { SuiteWire } from './ipc/types.js';

export const App = (): JSX.Element => {
  const [suites, setSuites] = useState<readonly SuiteWire[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    listSuites()
      .then((items) => {
        if (!cancelled) {
          setSuites(items);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main>
      <h1>smart_e2e</h1>
      {loading ? (
        <p>読み込み中...</p>
      ) : error !== null ? (
        <p role="alert">エラー: {error}</p>
      ) : suites.length === 0 ? (
        <p>Suite はまだありません</p>
      ) : (
        <ul>
          {suites.map((suite) => (
            <li key={suite.id}>{suite.name}</li>
          ))}
        </ul>
      )}
    </main>
  );
};
