import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ isOpen, onClose, title, children, actions, size = 'md' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClass = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }[size];

  const modalContent = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={panelRef} className={`bg-white rounded-2xl border border-slate-200 shadow-2xl w-full ${sizeClass} flex flex-col animate-scale-in`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 text-[13px] text-slate-600 leading-relaxed">
          {children}
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex items-center justify-end gap-2.5 px-6 pb-5 pt-3 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
            {actions}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

/* ── Confirm Modal ── */
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  loading?: boolean;
}

export function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', confirmVariant = 'primary', loading = false }: ConfirmModalProps) {
  const btnClass = confirmVariant === 'danger'
    ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm'
    : 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm"
      actions={
        <>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-[13px] font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-colors disabled:opacity-50 flex items-center gap-2 ${btnClass}`}
          >
            {loading && <span className="material-symbols-outlined animate-spin text-[15px]">progress_activity</span>}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}

/* ── Alert Modal ── */
interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  variant?: 'info' | 'error' | 'success';
}

export function AlertModal({ isOpen, onClose, title, message }: AlertModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm"
      actions={
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-[13px] font-medium bg-on-surface text-white hover:bg-black/80 transition-colors"
        >
          Entendido
        </button>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}
