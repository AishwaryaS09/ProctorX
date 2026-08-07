import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon } from '../components/common/icons.jsx';

const ToastContext = createContext(null);

const STYLES = {
  success: { icon: <CheckCircleIcon className="h-5 w-5 text-emerald-400" />, ring: 'ring-emerald-500/20' },
  error: { icon: <XCircleIcon className="h-5 w-5 text-red-400" />, ring: 'ring-red-500/20' },
  warning: { icon: <ExclamationTriangleIcon className="h-5 w-5 text-amber-400" />, ring: 'ring-amber-500/20' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type, message) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  const toast = useCallback(
    (type, message) => {
      push(type, message);
    },
    [push]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => {
          const s = STYLES[t.type] || STYLES.info;
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg ring-1 ${s.ring}`}
            >
              {s.icon}
              <div className="flex-1">{t.message}</div>
              <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-white">
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
