import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import type { NewSuiteInputWire } from '../../ipc/types.js';
import { Button, Input, Modal, Textarea } from '../../ui/index.js';
import formStyles from './SuiteForm.module.css';

const formSchema = z.object({
  name: z.string().min(1, '必須').max(100, '100文字以内'),
  description: z.string().max(500, '500文字以内').optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (input: NewSuiteInputWire) => Promise<void> | void;
  readonly isSubmitting?: boolean;
}

export const CreateSuiteDialog = ({
  open,
  onClose,
  onSubmit,
  isSubmitting,
}: Props): JSX.Element => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', description: '' },
  });

  useEffect(() => {
    if (!open) {
      reset({ name: '', description: '' });
    }
  }, [open, reset]);

  const submit = handleSubmit(async (values: FormValues): Promise<void> => {
    const trimmedDesc = values.description?.trim();
    const input: NewSuiteInputWire =
      trimmedDesc && trimmedDesc.length > 0
        ? { name: values.name.trim(), description: trimmedDesc }
        : { name: values.name.trim() };
    await onSubmit(input);
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="新規 Suite を作成"
      size="sm"
      footer={
        <>
          <Button onClick={onClose} disabled={isSubmitting}>
            キャンセル
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={isSubmitting}>
            {isSubmitting ? '作成中...' : '作成'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className={formStyles['form']}
      >
        <div className={formStyles['field']}>
          <label htmlFor="suite-name" className={formStyles['label']}>
            名前
          </label>
          <Input id="suite-name" autoFocus invalid={Boolean(errors.name)} {...register('name')} />
          {errors.name && <span className={formStyles['error']}>{errors.name.message}</span>}
        </div>
        <div className={formStyles['field']}>
          <label htmlFor="suite-description" className={formStyles['label']}>
            説明 (任意)
          </label>
          <Textarea
            id="suite-description"
            invalid={Boolean(errors.description)}
            rows={3}
            {...register('description')}
          />
          {errors.description && (
            <span className={formStyles['error']}>{errors.description.message}</span>
          )}
        </div>
      </form>
    </Modal>
  );
};
