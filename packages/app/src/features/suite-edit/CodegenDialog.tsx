import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { startCodegen } from '../../ipc/commands.js';
import type { CodegenTarget } from '../../ipc/types.js';
import { Button, Input, Modal, Spinner } from '../../ui/index.js';
import styles from './CodegenDialog.module.css';

const formSchema = z.object({
  url: z.string().min(1, '必須').url('URLとして無効'),
  target: z.union([z.literal('playwright-test'), z.literal('javascript')]).optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onResult: (result: { readonly script: string }) => void;
}

export const CodegenDialog = ({ open, onClose, onResult }: Props): JSX.Element => {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { url: 'https://', target: 'playwright-test' },
  });

  useEffect(() => {
    if (!open) {
      reset({ url: 'https://', target: 'playwright-test' });
      setError(null);
      setSubmitting(false);
    }
  }, [open, reset]);

  const submit = handleSubmit(async (values: FormValues): Promise<void> => {
    setSubmitting(true);
    setError(null);
    try {
      const target: CodegenTarget = values.target ?? 'playwright-test';
      const result = await startCodegen({ url: values.url, target });
      onResult({ script: result.script });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      // Rust 側 CommandError::PlaywrightBrowsersMissing は to_string() で
      // 「Playwright のブラウザがインストールされていません...」を返すのでそのまま表示する。
      // それ以外のサブプロセスエラーで stderr に既知のシグネチャがあれば同様の案内に置換する。
      const browsersMissing =
        raw.includes('Playwright のブラウザがインストールされていません') ||
        raw.includes("Executable doesn't exist") ||
        raw.includes('Looks like Playwright was just installed') ||
        raw.includes('pnpm exec playwright install');
      setError(
        browsersMissing
          ? 'Playwright のブラウザがインストールされていません。リポジトリルートで `pnpm exec playwright install` を実行してから再度お試しください。'
          : raw,
      );
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="録画から Step を作成"
      size="sm"
      disableClose={submitting}
      footer={
        <>
          <Button onClick={onClose} disabled={submitting}>
            キャンセル
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={submitting}>
            {submitting ? '起動中...' : '録画を開始'}
          </Button>
        </>
      }
    >
      {submitting ? (
        <div className={styles['waiting']} role="status" aria-live="polite">
          <Spinner />
          <p>Playwright Codegen が起動しました。</p>
          <p>ブラウザで操作を行ったあと、ブラウザウィンドウまたは Inspector を閉じてください。</p>
          <p className={styles['note']}>codegen が終了するまで待っています...（キャンセル不可）</p>
        </div>
      ) : (
        <form
          className={styles['form']}
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className={styles['field']}>
            <label htmlFor="codegen-url" className={styles['label']}>
              録画開始 URL
            </label>
            <Input
              id="codegen-url"
              autoFocus
              placeholder="https://example.com"
              invalid={Boolean(errors.url)}
              {...register('url')}
            />
            {errors.url && <span className={styles['error']}>{errors.url.message}</span>}
          </div>
          <div className={styles['field']}>
            <label htmlFor="codegen-target" className={styles['label']}>
              生成形式
            </label>
            <select id="codegen-target" className={styles['select']} {...register('target')}>
              <option value="playwright-test">playwright-test</option>
              <option value="javascript">javascript</option>
            </select>
          </div>
          {error !== null && (
            <div className={styles['error-banner']} role="alert">
              {error}
            </div>
          )}
          <p className={styles['hint']}>
            Playwright Codegen を起動します。ブラウザを閉じると操作が録画されたスクリプトが Step
            編集モーダルに展開されます。
          </p>
        </form>
      )}
    </Modal>
  );
};
