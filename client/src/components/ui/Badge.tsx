import React from 'react';

type BadgeVariant = 'pending' | 'completed' | 'closed' | 'matched' | 'unmatched' | 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'manual';

interface BadgeProps {
  variant: BadgeVariant;
  label?: string;
  size?: 'sm' | 'md';
  dot?: boolean;
}

const CONFIG: Record<BadgeVariant, { bg: string; text: string; border: string; dotColor: string; defaultLabel: string }> = {
  pending:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200/80',   dotColor: 'bg-amber-500',   defaultLabel: 'Pendiente' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200/80', dotColor: 'bg-emerald-500', defaultLabel: 'Completada' },
  closed:    { bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200',      dotColor: 'bg-slate-400',   defaultLabel: 'Cerrado' },
  matched:   { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200/80', dotColor: 'bg-emerald-500', defaultLabel: 'Conciliado' },
  unmatched: { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200/80',   dotColor: 'bg-amber-500',   defaultLabel: 'Pendiente' },
  neutral:   { bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200',      dotColor: 'bg-slate-400',   defaultLabel: '' },
  success:   { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200/80', dotColor: 'bg-emerald-500', defaultLabel: 'Éxito' },
  warning:   { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200/80',   dotColor: 'bg-amber-500',   defaultLabel: 'Atención' },
  error:     { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200/80',    dotColor: 'bg-rose-500',    defaultLabel: 'Diferencia' },
  info:      { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200/80',    dotColor: 'bg-blue-500',    defaultLabel: 'Info' },
  manual:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200/80',    dotColor: 'bg-blue-500',    defaultLabel: 'Manual' },
};

export function Badge({ variant, label, size = 'md', dot = false }: BadgeProps) {
  const cfg = CONFIG[variant] || CONFIG.neutral;
  const displayLabel = label ?? cfg.defaultLabel;
  const sizeClass = size === 'sm'
    ? 'px-2 py-0.5 text-[10px] gap-1'
    : 'px-2.5 py-0.5 text-[11px] gap-1.5';

  return (
    <span className={`inline-flex items-center font-medium rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border} ${sizeClass}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor} shrink-0`} />}
      <span>{displayLabel}</span>
    </span>
  );
}
