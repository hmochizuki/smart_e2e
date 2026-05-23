import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import { byteLength, formatBytes, formatDateTime } from '../../lib/format.js';
import type { StepWire } from '../../ipc/types.js';
import {
  Button,
  ConfirmDialog,
  Input,
  Modal,
  Spinner,
  Textarea,
  useToast,
} from '../../ui/index.js';
import { CodegenDialog } from './CodegenDialog.js';
import { StepEditModal, type StepEditValues } from './StepEditModal.js';
import {
  useCreateStep,
  useDeleteStep,
  useSteps,
  useSuite,
  useUpdateStep,
  useUpdateSuite,
} from './useSuite.js';
import styles from './SuiteEditPage.module.css';

const suiteFormSchema = z.object({
  name: z.string().min(1, '必須').max(100, '100文字以内'),
  description: z.string().max(500, '500文字以内').optional(),
});
type SuiteFormValues = z.infer<typeof suiteFormSchema>;

interface StepEditTarget {
  readonly mode: 'create' | 'update';
  readonly step?: StepWire;
  readonly initialScript?: string;
}

export const SuiteEditPage = (): JSX.Element => {
  const params = useParams<{ readonly id: string }>();
  const suiteId = params.id ?? '';
  const suiteQ = useSuite(suiteId);
  const stepsQ = useSteps(suiteId);
  const updateSuiteMut = useUpdateSuite(suiteId);
  const createStepMut = useCreateStep(suiteId);
  const updateStepMut = useUpdateStep(suiteId);
  const deleteStepMut = useDeleteStep(suiteId);
  const toast = useToast();

  const [stepTarget, setStepTarget] = useState<StepEditTarget | null>(null);
  const [codegenOpen, setCodegenOpen] = useState<boolean>(false);
  const [pendingStepDelete, setPendingStepDelete] = useState<StepWire | null>(null);
  const [scriptViewer, setScriptViewer] = useState<StepWire | null>(null);

  const suiteForm = useForm<SuiteFormValues>({
    resolver: zodResolver(suiteFormSchema),
    defaultValues: { name: '', description: '' },
  });
  const { reset: resetSuiteForm } = suiteForm;

  useEffect(() => {
    if (suiteQ.data) {
      resetSuiteForm({
        name: suiteQ.data.name,
        description: suiteQ.data.description ?? '',
      });
    }
  }, [suiteQ.data, resetSuiteForm]);

  const handleSuiteSave = suiteForm.handleSubmit(async (values: SuiteFormValues): Promise<void> => {
    try {
      const desc = values.description?.trim();
      await updateSuiteMut.mutateAsync({
        name: values.name.trim(),
        description: desc && desc.length > 0 ? desc : null,
      });
      toast.show('Suite を更新しました', 'success');
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '更新に失敗しました', 'error');
    }
  });

  const handleStepSubmit = async (values: StepEditValues): Promise<void> => {
    if (!stepTarget) return;
    try {
      if (stepTarget.mode === 'create') {
        const order = stepsQ.data?.length ?? 0;
        await createStepMut.mutateAsync({
          suiteId,
          order,
          name: values.name,
          script: values.script,
        });
        toast.show('Step を追加しました', 'success');
      } else if (stepTarget.step) {
        await updateStepMut.mutateAsync({
          id: stepTarget.step.id,
          patch: { name: values.name, script: values.script },
        });
        toast.show('Step を更新しました', 'success');
      }
      setStepTarget(null);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '保存に失敗しました', 'error');
    }
  };

  const handleStepDelete = async (): Promise<void> => {
    if (!pendingStepDelete) return;
    try {
      await deleteStepMut.mutateAsync(pendingStepDelete.id);
      toast.show('Step を削除しました', 'success');
      setPendingStepDelete(null);
    } catch (err) {
      toast.show(err instanceof Error ? err.message : '削除に失敗しました', 'error');
    }
  };

  if (suiteQ.isLoading) {
    return (
      <div className={styles['state']}>
        <Spinner label="Suite を読み込み中..." />
      </div>
    );
  }

  if (suiteQ.error || !suiteQ.data) {
    return (
      <div className={styles['state']} role="alert">
        Suite を取得できませんでした: {suiteQ.error?.message ?? 'unknown'}
      </div>
    );
  }

  const suite = suiteQ.data;
  const steps = stepsQ.data ?? [];

  return (
    <div className={styles['container']}>
      <div className={styles['breadcrumbs']}>
        <Link to="/">Suite 一覧</Link>
        <span aria-hidden="true">/</span>
        <span>{suite.name}</span>
      </div>

      <section className={styles['section']}>
        <div className={styles['section-header']}>
          <h2 className={styles['section-title']}>Suite 情報</h2>
          <Link to={`/suites/${suiteId}/runs/latest`}>
            <Button>実行ビュー</Button>
          </Link>
        </div>
        <form
          className={styles['form']}
          onSubmit={(e) => {
            e.preventDefault();
            void handleSuiteSave();
          }}
        >
          <div className={styles['field']}>
            <label htmlFor="suite-name" className={styles['label']}>
              名前
            </label>
            <Input
              id="suite-name"
              invalid={Boolean(suiteForm.formState.errors.name)}
              {...suiteForm.register('name')}
            />
            {suiteForm.formState.errors.name && (
              <span className={styles['error']}>{suiteForm.formState.errors.name.message}</span>
            )}
          </div>
          <div className={styles['field']}>
            <label htmlFor="suite-description" className={styles['label']}>
              説明 (任意)
            </label>
            <Textarea id="suite-description" rows={3} {...suiteForm.register('description')} />
          </div>
          <div className={styles['actions-right']}>
            <Button variant="primary" type="submit" disabled={updateSuiteMut.isPending}>
              {updateSuiteMut.isPending ? '保存中...' : 'Suite を保存'}
            </Button>
          </div>
        </form>
      </section>

      <section className={styles['section']}>
        <div className={styles['section-header']}>
          <h2 className={styles['section-title']}>Step 一覧 ({steps.length})</h2>
          <div className={styles['header-actions']}>
            <Button onClick={() => setCodegenOpen(true)}>録画から Step を作成</Button>
            <Button variant="primary" onClick={() => setStepTarget({ mode: 'create' })}>
              新規 Step
            </Button>
          </div>
        </div>

        {stepsQ.isLoading ? (
          <Spinner label="Step を読み込み中..." />
        ) : steps.length === 0 ? (
          <div className={styles['empty']}>
            Step がまだありません。「新規 Step」または「録画から Step を作成」してください。
          </div>
        ) : (
          <ol className={styles['step-list']}>
            {steps.map((step) => (
              <li key={step.id} className={styles['step-item']}>
                <div className={styles['step-main']}>
                  <span className={styles['step-order']}>#{step.order + 1}</span>
                  <div className={styles['step-meta']}>
                    <div className={styles['step-name']}>{step.name}</div>
                    <div className={styles['step-sub']}>
                      <button
                        type="button"
                        className={styles['link-button']}
                        onClick={() => setScriptViewer(step)}
                      >
                        スクリプトを表示 ({formatBytes(byteLength(step.script))})
                      </button>
                      <span>更新: {formatDateTime(step.updatedAt)}</span>
                    </div>
                  </div>
                </div>
                <div className={styles['step-actions']}>
                  <Button onClick={() => setStepTarget({ mode: 'update', step })}>編集</Button>
                  <Button variant="danger" onClick={() => setPendingStepDelete(step)}>
                    削除
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <StepEditModal
        open={stepTarget !== null}
        initial={
          stepTarget?.mode === 'update'
            ? stepTarget.step
            : stepTarget?.initialScript !== undefined
              ? { name: '', script: stepTarget.initialScript }
              : undefined
        }
        title={stepTarget?.mode === 'update' ? 'Step を編集' : '新規 Step'}
        onClose={() => setStepTarget(null)}
        onSubmit={handleStepSubmit}
        isSubmitting={createStepMut.isPending || updateStepMut.isPending}
      />

      <CodegenDialog
        open={codegenOpen}
        onClose={() => setCodegenOpen(false)}
        onResult={(result) => {
          setCodegenOpen(false);
          setStepTarget({ mode: 'create', initialScript: result.script });
        }}
      />

      <ConfirmDialog
        open={pendingStepDelete !== null}
        title="Step を削除"
        message={pendingStepDelete ? `「${pendingStepDelete.name}」を削除しますか？` : ''}
        confirmLabel="削除する"
        destructive
        onCancel={() => setPendingStepDelete(null)}
        onConfirm={() => void handleStepDelete()}
      />

      <Modal
        open={scriptViewer !== null}
        onClose={() => setScriptViewer(null)}
        title={scriptViewer ? `スクリプト: ${scriptViewer.name}` : 'スクリプト'}
        size="lg"
      >
        {scriptViewer && <pre className={styles['script-block']}>{scriptViewer.script}</pre>}
      </Modal>
    </div>
  );
};
