import type { ReactNode } from 'react';
import styles from './Table.module.css';

interface TableProps {
  readonly children: ReactNode;
}

export const Table = ({ children }: TableProps): JSX.Element => (
  <table className={styles['table']}>{children}</table>
);
