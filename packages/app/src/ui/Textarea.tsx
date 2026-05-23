import { forwardRef, type TextareaHTMLAttributes } from 'react';
import styles from './Textarea.module.css';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly invalid?: boolean;
  readonly monospace?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, monospace, ...rest }, ref): JSX.Element => {
    const cls = [
      styles['textarea'],
      invalid ? styles['invalid'] : null,
      monospace ? styles['mono'] : null,
      className,
    ]
      .filter(Boolean)
      .join(' ');
    return <textarea ref={ref} className={cls} {...rest} />;
  },
);
Textarea.displayName = 'Textarea';
