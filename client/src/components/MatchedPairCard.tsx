import React, { useState } from 'react';
import { MatchResult, NormalizedMovement } from '../types';

export interface MatchedPairItem {
  match: MatchResult;
  extMovs: NormalizedMovement[];
  mayMovs: NormalizedMovement[];
}

interface RowProps {
  match: MatchResult;
  extMovs: NormalizedMovement[];
  mayMovs: NormalizedMovement[];
  formatMonto: (n: number) => string;
  formatFecha: (s: string) => string;
  onUnmatch: (matchId: string) => void;
}

export function MatchedPairRow({
  match,
  extMovs,
  mayMovs,
  formatMonto,
  formatFecha,
  onUnmatch,
}: RowProps) {
  const [expanded, setExpanded] = useState(false);
  const difference = Number(match.difference || 0);
  const isExact = Math.abs(difference) < 0.01;
  const confidence = Math.round((Number(match.confidence) || 1) * 100);

  // Totales
  const extTotal = extMovs.reduce((acc, m) => acc + (m.tipo === 'CREDITO' ? +m.monto : -+m.monto), 0);
  const mayTotal = mayMovs.reduce((acc, m) => acc + (m.tipo === 'CREDITO' ? +m.monto : -+m.monto), 0);

  // Fecha primaria
  const dateStr = extMovs[0]?.fecha || mayMovs[0]?.fecha || '';

  // Configuración del badge de tipo
  const getBadge = (type: string) => {
    switch (type) {
      case 'AUTO':
        return { label: 'Auto', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', title: `Coincidencia automática (${confidence}%)` };
      case 'MANUAL':
        return { label: 'Manual', badge: 'bg-blue-50 text-blue-700 border-blue-200/80', title: 'Vinculado manualmente' };
      case 'GROUPED':
        return { label: 'Agrupado', badge: 'bg-amber-50 text-amber-700 border-amber-200/80', title: 'Conciliación N a 1' };
      case 'TAX_CHILD':
        return { label: 'Impuesto', badge: 'bg-purple-50 text-purple-700 border-purple-200/80', title: 'Impuesto / Retención asociada' };
      default:
        return { label: type, badge: 'bg-slate-100 text-slate-700 border-slate-200', title: type };
    }
  };
  const badgeConfig = getBadge(match.match_type);

  // Sanitización de referencia
  const cleanRef = (r?: string) => {
    if (!r) return null;
    const trimmed = r.trim();
    if (['0', '00', '000', '-', '—', 'null', 'undefined'].includes(trimmed.toLowerCase())) return null;
    return trimmed.replace(/^(Ref\.?:?|Pago\s*N[°º]?)\s*/i, '').trim();
  };

  const hasExtra = extMovs.some(m => m.metadata && Object.keys(m.metadata).length > 0) ||
                   mayMovs.some(m => m.metadata && Object.keys(m.metadata).length > 0);

  return (
    <>
      <tr className={`border-b border-slate-100 hover:bg-slate-50/70 transition-colors group text-[12px] ${expanded ? 'bg-slate-50/50' : ''}`}>
        {/* 1. Fecha */}
        <td className="py-2.5 pl-4 pr-2 whitespace-nowrap text-[11px] font-mono-num text-slate-700 font-medium align-top w-24">
          <div className="flex items-center gap-1.5">
            {hasExtra ? (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-slate-500 hover:text-slate-900 transition-transform p-0.5"
                title={expanded ? 'Ocultar detalles' : 'Ver detalles técnicos'}
              >
                <span className={`material-symbols-outlined text-[15px] transition-transform ${expanded ? 'rotate-90' : ''}`}>
                  chevron_right
                </span>
              </button>
            ) : (
              <span className="w-4" />
            )}
            <span>{formatFecha(dateStr)}</span>
          </div>
        </td>

        {/* 2. Movimiento Banco */}
        <td className="py-2.5 px-3 align-top max-w-[280px]">
          {extMovs.length === 0 ? (
            <span className="text-slate-500 italic text-[11px]">Sin extracto</span>
          ) : extMovs.length === 1 ? (
            <div>
              <p className="font-semibold text-slate-950 leading-snug truncate" title={extMovs[0].descripcion}>
                {extMovs[0].descripcion}
              </p>
              {extMovs[0].contraparte && (
                <p className="text-[11px] text-slate-700 font-medium truncate mt-0.5">
                  {extMovs[0].contraparte}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {extMovs.map((m) => (
                <div key={m.id} className="flex items-baseline justify-between gap-1 text-[11px]">
                  <span className="font-semibold text-slate-900 truncate" title={m.descripcion}>{m.descripcion}</span>
                  <span className="font-mono-num text-slate-900 font-medium shrink-0">{formatMonto(m.monto)}</span>
                </div>
              ))}
            </div>
          )}
        </td>

        {/* 3. Monto Banco */}
        <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono-num font-semibold align-top w-28">
          {extMovs.length > 0 && (
            <span className={extTotal >= 0 ? 'text-emerald-800' : 'text-slate-950'}>
              {extTotal >= 0 ? '+' : '−'} {formatMonto(Math.abs(extTotal))}
            </span>
          )}
        </td>

        {/* 4. Link icon */}
        <td className="py-2.5 px-1.5 text-center text-slate-400 group-hover:text-emerald-600 transition-colors align-top w-7">
          <span className="material-symbols-outlined text-[15px]">link</span>
        </td>

        {/* 5. Movimiento ERP */}
        <td className="py-2.5 px-3 align-top max-w-[280px]">
          {mayMovs.length === 0 ? (
            <span className="text-slate-500 italic text-[11px]">Sin ERP</span>
          ) : mayMovs.length === 1 ? (
            <div>
              <p className="font-semibold text-slate-950 leading-snug truncate" title={mayMovs[0].descripcion}>
                {mayMovs[0].descripcion}
              </p>
              <div className="text-[11px] text-slate-700 font-medium truncate mt-0.5 flex items-center gap-1.5">
                {mayMovs[0].contraparte && <span>{mayMovs[0].contraparte}</span>}
                {mayMovs[0].contraparte && cleanRef(mayMovs[0].referencia) && <span className="text-slate-400">·</span>}
                {cleanRef(mayMovs[0].referencia) && (
                  <span className="font-mono-num text-slate-600 font-semibold">Ref. {cleanRef(mayMovs[0].referencia)}</span>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {mayMovs.map((m) => (
                <div key={m.id} className="flex items-baseline justify-between gap-1 text-[11px]">
                  <span className="font-semibold text-slate-900 truncate" title={m.descripcion}>{m.descripcion}</span>
                  <span className="font-mono-num text-slate-900 font-medium shrink-0">{formatMonto(m.monto)}</span>
                </div>
              ))}
            </div>
          )}
        </td>

        {/* 6. Monto ERP */}
        <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono-num font-semibold align-top w-28">
          {mayMovs.length > 0 && (
            <span className={mayTotal >= 0 ? 'text-emerald-800' : 'text-slate-950'}>
              {mayTotal >= 0 ? '+' : '−'} {formatMonto(Math.abs(mayTotal))}
            </span>
          )}
        </td>

        {/* 7. Tipo Match */}
        <td className="py-2.5 px-2.5 text-center whitespace-nowrap align-top w-20">
          <span
            className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border ${badgeConfig.badge}`}
            title={badgeConfig.title}
          >
            {badgeConfig.label}
          </span>
        </td>

        {/* 8. Diferencia */}
        <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono-num align-top w-24">
          {isExact ? (
            <span className="text-[11px] text-slate-700 font-medium">$ 0,00</span>
          ) : (
            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
              Dif: {formatMonto(Math.abs(difference))}
            </span>
          )}
        </td>

        {/* 9. Deshacer */}
        <td className="py-2.5 pl-2 pr-4 text-right whitespace-nowrap align-top w-12">
          <button
            onClick={() => onUnmatch(match.id)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all"
            title="Deshacer match"
          >
            <span className="material-symbols-outlined text-[16px]">link_off</span>
          </button>
        </td>
      </tr>

      {/* Fila expandible con metadatos técnicos si se solicita */}
      {expanded && (
        <tr className="bg-slate-50/60 border-b border-slate-100 text-[11px] text-slate-600">
          <td colSpan={9} className="px-6 py-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <div>
                <p className="font-semibold text-slate-800 uppercase tracking-wider text-[10px] mb-1.5 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-slate-500 text-[14px]">account_balance</span>
                  Detalle Extracto Bancario
                </p>
                {extMovs.map(m => (
                  <div key={m.id} className="space-y-1 text-slate-600">
                    <p><span className="text-slate-400">Descripción:</span> {m.descripcion}</p>
                    {m.contraparte && <p><span className="text-slate-400">Contraparte:</span> {m.contraparte}</p>}
                    {m.metadata && Object.entries(m.metadata).map(([k, v]) => v != null && v !== '' ? (
                      <p key={k}><span className="text-slate-400 capitalize">{k}:</span> {String(v)}</p>
                    ) : null)}
                  </div>
                ))}
              </div>
              <div>
                <p className="font-semibold text-slate-800 uppercase tracking-wider text-[10px] mb-1.5 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-slate-500 text-[14px]">menu_book</span>
                  Detalle Libro Mayor (ERP)
                </p>
                {mayMovs.map(m => (
                  <div key={m.id} className="space-y-1 text-slate-600">
                    <p><span className="text-slate-400">Descripción:</span> {m.descripcion}</p>
                    {m.referencia && <p><span className="text-slate-400">Referencia:</span> {m.referencia}</p>}
                    {m.metadata && Object.entries(m.metadata).map(([k, v]) => v != null && v !== '' ? (
                      <p key={k}><span className="text-slate-400 capitalize">{k}:</span> {String(v)}</p>
                    ) : null)}
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function MatchedPairTable({
  pairs,
  formatMonto,
  formatFecha,
  onUnmatch,
}: {
  pairs: MatchedPairItem[];
  formatMonto: (n: number) => string;
  formatFecha: (s: string) => string;
  onUnmatch: (matchId: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-sans font-bold text-slate-700 uppercase tracking-wider">
              <th className="py-2.5 pl-4 pr-2 w-24">Fecha</th>
              <th className="py-2.5 px-3 min-w-[200px]">Extracto Bancario</th>
              <th className="py-2.5 px-3 text-right w-28">Monto Banco</th>
              <th className="py-2.5 px-1.5 w-7"></th>
              <th className="py-2.5 px-3 min-w-[200px]">Libro Mayor (ERP)</th>
              <th className="py-2.5 px-3 text-right w-28">Monto ERP</th>
              <th className="py-2.5 px-2.5 text-center w-20">Tipo</th>
              <th className="py-2.5 px-3 text-right w-24">Diferencia</th>
              <th className="py-2.5 pl-2 pr-4 text-right w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pairs.map(({ match, extMovs, mayMovs }) => (
              <MatchedPairRow
                key={match.id}
                match={match}
                extMovs={extMovs}
                mayMovs={mayMovs}
                formatMonto={formatMonto}
                formatFecha={formatFecha}
                onUnmatch={onUnmatch}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Alias de retrocompatibilidad
export const MatchedPairCard = MatchedPairRow;
