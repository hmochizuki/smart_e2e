import { useEffect, type ReactNode } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly size?: 'sm' | 'md' | 'lg';
}

export const Modal = ({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: ModalProps): JSX.Element | null => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className={styles['backdrop']} role="dialog" aria-modal="true" aria-label={title}>
      <div className={styles['backdrop-click']} onClick={onClose} aria-hidden="true" />
      <div className={[styles['dialog'], styles[size]].filter(Boolean).join(' ')}>
        <header className={styles['header']}>
          <h2 className={styles['title']}>{title}</h2>
          <button type="button" onClick={onClose} className={styles['close']} aria-label="閉じる">
            ×
          </button>
        </header>
        <div className={styles['body']}>{children}</div>
        {footer !== undefined && <footer className={styles['footer']}>{footer}</footer>}
      </div>
    </div>
  );
};
