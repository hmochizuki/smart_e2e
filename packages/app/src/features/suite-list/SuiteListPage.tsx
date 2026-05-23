import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDateTime } from '../../lib/format.js';
import { Button, ConfirmDialog, Spinner, Table, useToast } from '../../ui/index.js';
import type { NewSuiteInputWire, SuiteWire } from '../../ipc/types.js';
import { CreateSuiteDialog } from './CreateSuiteDialog.js';
import { useCreateSuite, useDeleteSuite, useSuites } from './useSuites.js';
import styles from './SuiteListPage.module.css';

export const SuiteListPage = (): JSX.Element => {
  const { data, isLoading, error } = useSuites();
  const createMut = useCreateSuite();
  const deleteMut = useDeleteSuite();
  const toast = useToast();

  const [createOpen, setCreateOpen] = useState<boolean>(false);
  const [pendingDelete, setPendingDelete] = useState<SuiteWire | null>(null);

  const handleCreate = async (input: NewSuiteInputWire): Promise<void> => {
    try {
      await createMut.mutateAsync(input);
      toast.show('Suite を作成しました', 'success');
      setCreateOpen(false);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '作成に失敗しました', 'error');
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!pendingDelete) {
      return;
    }
    try {
      await deleteMut.mutateAsync(pendingDelete.id);
      toast.show('Suite を削除しました', 'success');
      setPendingDelete(null);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '削除に失敗しました', 'error');
    }
  };

  return (
    <div className={styles['container']}>
      <header className={styles['header']}>
        <h1 className={styles['title']}>Suite 一覧</h1>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          新規 Suite
        </Button>
      </header>

      {isLoading ? (
        <div className={styles['state']}>
          <Spinner label="読み込み中..." />
        </div>
      ) : error ? (
        <div className={styles['state']} role="alert">
          エラー: {error.message}
        </div>
      ) : !data || data.length === 0 ? (
        <div className={styles['state']}>
          <p>Suite はまだありません。「新規 Suite」から作成してください。</p>
        </div>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>名前</th>
              <th>説明</th>
              <th>更新日時</th>
              <th aria-label="操作" />
            </tr>
          </thead>
          <tbody>
            {data.map((suite) => (
              <tr key={suite.id}>
                <td>
                  <Link to={`/suites/${suite.id}`} className={styles['name-link']}>
                    {suite.name}
                  </Link>
                </td>
                <td className={styles['desc']}>{suite.description ?? ''}</td>
                <td className={styles['date']}>{formatDateTime(suite.updatedAt)}</td>
                <td className={styles['actions']}>
                  <Link to={`/suites/${suite.id}`}>
                    <Button>編集</Button>
                  </Link>
                  <Link to={`/suites/${suite.id}/runs/latest`}>
                    <Button>実行</Button>
                  </Link>
                  <Button variant="danger" onClick={() => setPendingDelete(suite)}>
                    削除
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <CreateSuiteDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={createMut.isPending}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="削除の確認"
        message={
          pendingDelete
            ? `このSuiteを削除しますか？「${pendingDelete.name}」 (紐づくStepも全て削除されます)`
            : ''
        }
        confirmLabel="削除する"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
};
