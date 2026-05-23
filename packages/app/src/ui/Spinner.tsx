import styles from './Spinner.module.css';

interface SpinnerProps {
  readonly label?: string;
}

export const Spinner = ({ label }: SpinnerProps): JSX.Element => (
  <div className={styles['wrap']} role="status" aria-live="polite">
    <span className={styles['dot']} aria-hidden="true" />
    {label !== undefined && <span className={styles['label']}>{label}</span>}
  </div>
);
