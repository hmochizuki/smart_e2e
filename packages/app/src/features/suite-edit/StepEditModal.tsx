import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { SCRIPT_MAX_CHARS } from '@smart-e2e/shared';
import { byteLength, formatBytes } from '../../lib/format.js';
import { Button, Input, Modal, Textarea } from '../../ui/index.js';
import type { StepWire } from '../../ipc/types.js';
import styles from './StepEditModal.module.css';

const formSchema = z.object({
  name: z.string().min(1, '必須').max(100, '100文字以内'),
  script: z.string().min(1, '必須').max(SCRIPT_MAX_CHARS, `${SCRIPT_MAX_CHARS}文字以内`),
});

type FormValues = z.infer<typeof formSchema>;

export interface StepEditValues {
  readonly name: string;
  readonly script: string;
}

interface Props {
  readonly open: boolean;
  readonly initial?: Pick<StepWire, 'name' | 'script'> | undefined;
  readonly title: string;
  readonly onClose: () => void;
  readonly onSubmit: (values: StepEditValues) => Promise<void> | void;
  readonly isSubmitting?: boolean;
}

export const StepEditModal = ({
  open,
  initial,
  title,
  onClose,
  onSubmit,
  isSubmitting,
}: Props): JSX.Element => {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: initial?.name ?? '', script: initial?.script ?? '' },
  });

  useEffect(() => {
    if (open) {
      reset({ name: initial?.name ?? '', script: initial?.script ?? '' });
    }
  }, [open, initial, reset]);

  const scriptValue = watch('script');
  const scriptBytes = byteLength(scriptValue);

  const submit = handleSubmit(async (values: FormValues): Promise<void> => {
    await onSubmit({ name: values.name.trim(), script: values.script });
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      footer={
        <>
          <Button onClick={onClose} disabled={isSubmitting}>
            キャンセル
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={isSubmitting}>
            {isSubmitting ? '保存中...' : '保存'}
          </Button>
        </>
      }
    >
      <form
        className={styles['form']}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className={styles['field']}>
          <label htmlFor="step-name" className={styles['label']}>
            Step 名
          </label>
          <Input id="step-name" autoFocus invalid={Boolean(errors.name)} {...register('name')} />
          {errors.name && <span className={styles['error']}>{errors.name.message}</span>}
        </div>
        <div className={styles['field']}>
          <div className={styles['script-header']}>
            <label htmlFor="step-script" className={styles['label']}>
              スクリプト
            </label>
            <span className={styles['bytes']}>{formatBytes(scriptBytes)}</span>
          </div>
          <Textarea
            id="step-script"
            monospace
            rows={14}
            invalid={Boolean(errors.script)}
            spellCheck={false}
            {...register('script')}
          />
          {errors.script && <span className={styles['error']}>{errors.script.message}</span>}
        </div>
      </form>
    </Modal>
  );
};
