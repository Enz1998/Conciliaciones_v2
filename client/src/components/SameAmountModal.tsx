import React from 'react';
import { NormalizedMovement, MatchResult } from '../types';
import { Modal } from './ui/Modal';

export interface SameAmountPair {
  match: MatchResult;
  extMovs: NormalizedMovement[];
  mayMovs: NormalizedMovement[];
}

interface SameAmountModalProps {
  target: NormalizedMovement | null;
  extractoMovs: NormalizedMovement[];
  mayorMovs: NormalizedMovement[];
  pairs: SameAmountPair[];
  onClose: () => void;
  onUnmatch: (matchId: string) => void;
  formatMonto: (n: number) => string;
  formatFecha: (s: string) => string;
}

const sameAmount = (a: NormalizedMovement, b: NormalizedMovement) =>
  Math.abs(Math.abs(Number(a.monto || 0)) - Math.abs(Number(b.monto || 0))) < 0.01;

/**
 * Muestra todos los movimientos (pendientes y conciliados) de ambos lados
 * con el mismo monto que el movimiento elegido, para detectar matches mal hechos.
 */
export function SameAmountModal({ target, extractoMovs, mayorMovs, pairs, onClose, onUnmatch, formatMonto, formatFecha }: SameAmountModalProps) {
  if (!target) return null;

  const pairByMovId = new Map<string, SameAmountPair>();
  for (const p of pairs) {
    for (const m of p.extMovs) pairByMovId.set(m.id, p);
    for (const m of p.mayMovs) pairByMovId.set(m.id, p);
  }

  const byFecha = (a: NormalizedMovement, b: NormalizedMovement) => String(a.fecha).localeCompare(String(b.fecha));
  const ext = extractoMovs.filter(m => m && sameAmount(m, target)).sort(byFecha);
  const may = mayorMovs.filter(m => m && sameAmount(m, target)).sort(byFecha);

  return (
    <Modal isOpen onClose={onClose} title={`Movimientos de ${formatMonto(target.monto)}`} size="xl">
      <p className="text-[12px] text-slate-600 mb-4">
        Todos los movimientos con este monto en ambos lados, conciliados o no. Revisá si alguno quedó matcheado con el movimiento equivocado.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
        <SameAmountColumn title="Extracto Bancario" movs={ext} counterpartSide="MAY" target={target} pairByMovId={pairByMovId} onUnmatch={onUnmatch} formatMonto={formatMonto} formatFecha={formatFecha} />
        <SameAmountColumn title="Registros ERP" movs={may} counterpartSide="EXT" target={target} pairByMovId={pairByMovId} onUnmatch={onUnmatch} formatMonto={formatMonto} formatFecha={formatFecha} />
      </div>
    </Modal>
  );
}

function SameAmountColumn({ title, movs, counterpartSide, target, pairByMovId, onUnmatch, formatMonto, formatFecha }: {
  title: string;
  movs: NormalizedMovement[];
  counterpartSide: 'EXT' | 'MAY';
  target: NormalizedMovement;
  pairByMovId: Map<string, SameAmountPair>;
  onUnmatch: (matchId: string) => void;
  formatMonto: (n: number) => string;
  formatFecha: (s: string) => string;
}) {
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100">
        {title} <span className="text-slate-500 font-mono-num">({movs.length})</span>
      </p>
      {movs.length === 0 && <p className="text-[12px] text-slate-500 py-3">No hay movimientos con este monto.</p>}
      {movs.map(m => {
        const pair = m.match_type === 'UNMATCHED' ? undefined : pairByMovId.get(m.id);
        const counterparts = pair ? (counterpartSide === 'MAY' ? pair.mayMovs : pair.extMovs) : [];
        const isCredit = m.tipo === 'CREDITO';
        const isTarget = m.id === target.id;
        const ref = /^[0\s-]*$/.test(m.referencia || '') ? '' : m.referencia;

        return (
          <div key={m.id} className={`rounded-xl border px-3 py-2.5 ${isTarget ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200'} ${pair ? 'bg-white' : 'bg-amber-50/40'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-mono-num text-slate-600 font-medium">{formatFecha(m.fecha)}</p>
                <p className="text-[12px] font-semibold text-slate-950 break-words" title={m.descripcion}>{m.descripcion}</p>
                {(m.contraparte || ref) && (
                  <p className="text-[11px] text-slate-600 font-medium truncate">{[m.contraparte, ref].filter(Boolean).join(' · ')}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className={`font-mono-num text-[12px] font-semibold ${isCredit ? 'text-emerald-800' : 'text-slate-950'}`}>
                  {isCredit ? '+' : '−'} {formatMonto(m.monto)}
                </span>
                <div className="mt-1">
                  {pair ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border uppercase bg-emerald-50 text-emerald-800 border-emerald-300">
                      Conciliado · {pair.match.match_type}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md border uppercase bg-amber-50 text-amber-800 border-amber-300">
                      Pendiente
                    </span>
                  )}
                </div>
              </div>
            </div>

            {pair && (
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-0.5">Matcheado con</p>
                  {counterparts.length === 0 && <p className="text-[11px] text-slate-500">—</p>}
                  {counterparts.map(c => (
                    <p key={c.id} className="text-[11px] text-slate-800 font-medium truncate" title={c.descripcion}>
                      <span className="font-mono-num text-slate-600">{formatFecha(c.fecha)}</span> · {c.descripcion} · <span className="font-mono-num">{c.tipo === 'CREDITO' ? '+' : '−'} {formatMonto(c.monto)}</span>
                    </p>
                  ))}
                </div>
                <button
                  onClick={() => onUnmatch(pair.match.id)}
                  className="shrink-0 text-[11px] font-semibold text-rose-700 hover:text-rose-900 px-2 py-1 rounded-lg border border-rose-200 hover:bg-rose-50 transition-colors"
                >
                  Deshacer
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
