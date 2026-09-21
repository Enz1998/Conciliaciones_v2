import React from 'react';
import { NormalizedMovement } from '../types';

interface MovementRowProps {
  m: NormalizedMovement;
  side: 'EXT' | 'MAY';
  selected: boolean;
  onToggle: (id: string) => void;
  formatMonto: (n: number) => string;
  formatFecha: (s: string) => string;
}

export function MovementRow({ m, side, selected, onToggle, formatMonto, formatFecha }: MovementRowProps) {
  const isCredit = m.tipo === 'CREDITO';

  return (
    <tr
      onClick={() => onToggle(m.id)}
      className={`movement-row group ${selected ? 'selected' : ''}`}
    >
      {/* Checkbox */}
      <td className="px-3 py-2.5 w-8 shrink-0">
        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
          selected
            ? 'bg-slate-900 border-slate-900 shadow-xs'
            : 'border-slate-300 bg-white group-hover:border-slate-400'
        }`}>
          {selected && <span className="material-symbols-outlined text-emerald-400 font-bold" style={{ fontSize: 13 }}>check</span>}
        </div>
      </td>

      {/* Fecha */}
      <td className="px-3 py-2.5 whitespace-nowrap w-24">
        <span className="text-[11px] text-slate-700 font-medium font-mono-num">
          {formatFecha(m.fecha)}
        </span>
      </td>

      {/* Descripción + contraparte */}
      <td className="px-3 py-2.5 max-w-[260px]">
        <p className="text-[12px] font-semibold text-slate-950 truncate" title={m.descripcion}>{m.descripcion}</p>
        {(m.contraparte || m.categoria) && (
          <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5">{m.contraparte || m.categoria}</p>
        )}
      </td>

      {/* Monto */}
      <td className="px-3 py-2.5 text-right whitespace-nowrap w-32">
        <span className={`font-mono-num text-[12px] tracking-tight font-semibold ${isCredit ? 'text-emerald-800' : 'text-slate-950'}`}>
          {isCredit ? '+' : '−'} {formatMonto(m.monto)}
        </span>
      </td>

      {/* Tipo */}
      <td className="px-3 py-2.5 w-16 text-right">
        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border uppercase ${
          isCredit
            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
            : 'bg-slate-100 text-slate-800 border-slate-300'
        }`}>
          {isCredit ? 'Créd' : 'Déb'}
        </span>
      </td>
    </tr>
  );
}
