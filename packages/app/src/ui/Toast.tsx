import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import styles from './Toast.module.css';

interface ToastItem {
  readonly id: number;
  readonly message: string;
  readonly tone: 'info' | 'success' | 'error';
}

interface ToastApi {
  readonly show: (message: string, tone?: ToastItem['tone']) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

interface ToastProviderProps {
  readonly children: ReactNode;
}

export const ToastProvider = ({ children }: ToastProviderProps): JSX.Element => {
  const [items, setItems] = useState<readonly ToastItem[]>([]);
  const idRef = useRef<number>(0);

  const show = useCallback((message: string, tone: ToastItem['tone'] = 'info'): void => {
    idRef.current += 1;
    const id = idRef.current;
    const item: ToastItem = { id, message, tone };
    setItems((prev) => [...prev, item]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const api = useMemo<ToastApi>(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles['stack']} aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={[styles['toast'], styles[t.tone]].join(' ')}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastApi => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
};
