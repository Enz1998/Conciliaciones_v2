import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  exiting?: boolean;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

// All toasts are neutral — only error gets a red indicator
const LEFT_BORDER: Record<ToastVariant, string> = {
  success: 'border-l-on-surface',
  error:   'border-l-error',
  info:    'border-l-on-surface',
  warning: 'border-l-outline',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 250);
  }, []);

  const toast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev, { id, message, variant }]);
    const timer = window.setTimeout(() => dismiss(id), 4000);
    timers.current.set(id, timer);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-5 right-5 z-[300] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`glass-card-strong rounded-xl shadow-glass-lg border-l-[3px] px-4 py-3 flex items-center gap-3 min-w-[260px] max-w-[340px] pointer-events-auto ${LEFT_BORDER[t.variant]} ${t.exiting ? 'animate-toast-out' : 'animate-toast-in'}`}
          >
            <p className="text-[13px] text-on-surface leading-snug flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="text-outline hover:text-on-surface transition-colors shrink-0">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
