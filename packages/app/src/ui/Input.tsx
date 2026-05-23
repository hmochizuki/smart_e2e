import { forwardRef, type InputHTMLAttributes } from 'react';
import styles from './Input.module.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...rest }, ref): JSX.Element => {
    const cls = [styles['input'], invalid ? styles['invalid'] : null, className]
      .filter(Boolean)
      .join(' ');
    return <input ref={ref} className={cls} {...rest} />;
  },
);
Input.displayName = 'Input';
