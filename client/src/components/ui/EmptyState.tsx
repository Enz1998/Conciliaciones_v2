import React from 'react';

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center mb-3.5 text-slate-400">
        <span className="material-symbols-outlined" style={{ fontSize: 24 }}>{icon}</span>
      </div>
      <h3 className="font-semibold text-[14px] text-slate-900 mb-1">{title}</h3>
      {description && (
        <p className="text-[12px] text-slate-500 max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
