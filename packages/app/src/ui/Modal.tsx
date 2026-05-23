import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly size?: 'sm' | 'md' | 'lg';
  readonly disableClose?: boolean;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const Modal = ({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  disableClose = false,
}: ModalProps): JSX.Element | null => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !disableClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, disableClose]);

  useEffect(() => {
    if (!open) return;
    const node = dialogRef.current;
    if (!node) return;

    const focusables = (): HTMLElement[] =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    const initial = focusables();
    if (initial.length > 0) {
      initial[0]?.focus();
    }

    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return;
      const els = focusables();
      if (els.length === 0) {
        e.preventDefault();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    node.addEventListener('keydown', onKey);
    return () => node.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) {
    return null;
  }

  const handleBackdropClick = (): void => {
    if (!disableClose) {
      onClose();
    }
  };

  return (
    <div className={styles['backdrop']} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className={styles['backdrop-click']} onClick={handleBackdropClick} aria-hidden="true" />
      <div ref={dialogRef} className={[styles['dialog'], styles[size]].filter(Boolean).join(' ')}>
        <header className={styles['header']}>
          <h2 id={titleId} className={styles['title']}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={styles['close']}
            aria-label="閉じる"
            disabled={disableClose}
          >
            ×
          </button>
        </header>
        <div className={styles['body']}>{children}</div>
        {footer !== undefined && <footer className={styles['footer']}>{footer}</footer>}
      </div>
    </div>
  );
};
