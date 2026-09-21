import React, { useEffect, useMemo, useState } from 'react';
import { getFacturasConciliacion, createFacturaManualMatch, deleteFacturaMatch, deleteFacturaComprobantes, rematchFacturas, setProveedorConcepto } from '../api';
import { NormalizedComprobante, ComprobanteMatchResult, FacturasConciliacionSummary } from '../types';
import { Modal, ConfirmModal, AlertModal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { useToast } from '../components/ui/Toast';

interface Props { id: string; onBack: () => void; }
type Tab = 'pendientes' | 'conciliados' | 'resumen';
type SortKey = 'fecha' | 'monto' | 'proveedor';
type SortDir = 'asc' | 'desc';
type TipoFilter = 'ALL' | 'FACTURA' | 'NOTA_CREDITO' | 'NOTA_DEBITO';

const TIPO_LABEL: Record<string, string> = { FACTURA: 'Factura', NOTA_CREDITO: 'Nota de Crédito', NOTA_DEBITO: 'Nota de Débito' };
const TIPO_FILTERS: [TipoFilter, string][] = [['ALL', 'Todos'], ['FACTURA', 'Facturas'], ['NOTA_CREDITO', 'Notas de Crédito'], ['NOTA_DEBITO', 'Notas de Débito']];

function comprobanteLabel(c: NormalizedComprobante) {
  return `${c.letra}-${String(c.puntoVenta).padStart(5, '0')}-${String(c.numero).padStart(8, '0')}`;
}

function groupIds(m: ComprobanteMatchResult): string[] {
  if (m.group_members && m.group_members.length > 0) return m.group_members;
  return [m.afip_id, m.erp_id].filter((x): x is string => !!x);
}

const formatMonto = (n: number) => (n < 0 ? '−' : '') + '$ ' + Math.abs(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatFecha = (dStr: string) => { if (!dStr) return '—'; const d = new Date(dStr + 'T00:00:00'); return isNaN(d.getTime()) ? dStr : d.toLocaleDateString('es-AR'); };

export function FacturasConciliacionPage({ id, onBack }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rematching, setRematching] = useState(false);
  const [tab, setTab] = useState<Tab>('pendientes');
  const [selAfip, setSelAfip] = useState<Set<string>>(new Set());
  const [selErp, setSelErp] = useState<Set<string>>(new Set());
  const [detalle, setDetalle] = useState<NormalizedComprobante | null>(null);
  const [searchAfip, setSearchAfip] = useState('');
  const [searchErp, setSearchErp] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('fecha');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>('ALL');
  const [soloConDiferencia, setSoloConDiferencia] = useState(false);
  const [showRematchConfirm, setShowRematchConfirm] = useState(false);
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ title: string; message: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    getFacturasConciliacion(id).then(setData).catch(() => toast('Error al cargar.', 'error')).finally(() => setLoading(false));
  }, [id]);

  const refresh = async () => { const d = await getFacturasConciliacion(id); setData(d); setSelAfip(new Set()); setSelErp(new Set()); };

  const afipComps: NormalizedComprobante[] = data?.afipComps || [];
  const erpComps: NormalizedComprobante[] = data?.erpComps || [];
  const matches: ComprobanteMatchResult[] = data?.matches || [];
  const summary: FacturasConciliacionSummary = data?.summary || {};

  const toggleSort = (k: SortKey) => { if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(k); setSortDir('asc'); } };

  const sortComps = (comps: NormalizedComprobante[]) => {
    const sorted = [...comps].sort((a, b) => {
      let av: any, bv: any;
      if (sortKey === 'monto') { av = a.importeTotalLocal; bv = b.importeTotalLocal; }
      else if (sortKey === 'proveedor') { av = a.emisor.toLowerCase(); bv = b.emisor.toLowerCase(); }
      else { av = a.fecha; bv = b.fecha; }
      return (av < bv ? -1 : av > bv ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
    });
    return sorted;
  };

  const applyFilters = (comps: NormalizedComprobante[], term: string) => {
    let r = comps;
    if (tipoFilter !== 'ALL') r = r.filter(c => c.tipoComprobante === tipoFilter);
    if (term) {
      const t = term.toLowerCase();
      r = r.filter(c => comprobanteLabel(c).toLowerCase().includes(t) || (c.emisor || '').toLowerCase().includes(t) || String(c.importeTotalLocal).includes(t));
    }
    return sortComps(r);
  };

  const unmatchedAfip = useMemo(() => afipComps.filter(c => c.match_type === 'UNMATCHED'), [afipComps]);
  const unmatchedErp = useMemo(() => erpComps.filter(c => c.match_type === 'UNMATCHED'), [erpComps]);
  const filteredAfip = useMemo(() => applyFilters(unmatchedAfip, searchAfip), [unmatchedAfip, searchAfip, tipoFilter, sortKey, sortDir]);
  const filteredErp = useMemo(() => applyFilters(unmatchedErp, searchErp), [unmatchedErp, searchErp, tipoFilter, sortKey, sortDir]);

  const matchedPairs = useMemo(() => {
    let pairs = matches.map(m => {
      const ids = new Set(groupIds(m));
      return {
        match: m,
        afips: afipComps.filter(c => ids.has(c.id)),
        erps: erpComps.filter(c => ids.has(c.id)),
      };
    });
    if (tipoFilter !== 'ALL') pairs = pairs.filter(p => [...p.afips, ...p.erps].some(c => c.tipoComprobante === tipoFilter));
    if (soloConDiferencia) pairs = pairs.filter(p => p.match.difference > 0);
    pairs.sort((a, b) => {
      let av: any, bv: any;
      if (sortKey === 'monto') { av = a.match.difference; bv = b.match.difference; }
      else if (sortKey === 'proveedor') { av = (a.afips[0] || a.erps[0])?.emisor.toLowerCase() || ''; bv = (b.afips[0] || b.erps[0])?.emisor.toLowerCase() || ''; }
      else { av = (a.afips[0] || a.erps[0])?.fecha || ''; bv = (b.afips[0] || b.erps[0])?.fecha || ''; }
      return (av < bv ? -1 : av > bv ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
    });
    return pairs;
  }, [matches, afipComps, erpComps, tipoFilter, soloConDiferencia, sortKey, sortDir]);

  const toggleOne = (set: Set<string>, setFn: (s: Set<string>) => void, cid: string) => {
    const n = new Set(set);
    n.has(cid) ? n.delete(cid) : n.add(cid);
    setFn(n);
  };
  const toggleAll = (comps: NormalizedComprobante[], set: Set<string>, setFn: (s: Set<string>) => void) => {
    const allSelected = comps.length > 0 && comps.every(c => set.has(c.id));
    const n = new Set(set);
    if (allSelected) comps.forEach(c => n.delete(c.id));
    else comps.forEach(c => n.add(c.id));
    setFn(n);
  };

  const { selAfipSum, selErpSum } = useMemo(() => {
    let a = 0, e = 0;
    afipComps.forEach(c => { if (selAfip.has(c.id)) a += c.importeTotalLocal; });
    erpComps.forEach(c => { if (selErp.has(c.id)) e += c.importeTotalLocal; });
    return { selAfipSum: a, selErpSum: e };
  }, [selAfip, selErp, afipComps, erpComps]);
  const selDiff = Math.abs(selAfipSum - selErpSum);
  const selCount = selAfip.size + selErp.size;

  const handleManualMatch = async () => {
    if (selCount === 0) { setAlertMsg({ title: 'Selección incompleta', message: 'Seleccioná al menos un comprobante.' }); return; }
    try {
      await createFacturaManualMatch(id, [...selAfip], [...selErp]);
      toast('Match creado.', 'success');
      await refresh();
    } catch (e: any) { toast(e.message || 'Error al crear el match.', 'error'); }
  };

  const handleDeleteSelected = async () => {
    setDeleting(true);
    try {
      const ids = [...selAfip, ...selErp];
      const result = await deleteFacturaComprobantes(id, ids);
      toast(`${result.deleted} comprobante(s) eliminado(s).`, 'success');
      await refresh();
    } catch (e: any) { toast(e.message || 'Error al eliminar.', 'error'); }
    finally { setDeleting(false); setShowDeleteConfirm(false); }
  };

  const handleSaveConcepto = async (concepto: string) => {
    if (!detalle) return;
    try {
      await setProveedorConcepto(detalle.emisor, concepto);
      const patch = (arr: NormalizedComprobante[]) => arr.map(c => c.emisor_normalizado === detalle.emisor_normalizado ? { ...c, concepto } : c);
      setData((prev: any) => prev ? { ...prev, afipComps: patch(prev.afipComps), erpComps: patch(prev.erpComps) } : prev);
      setDetalle(d => d ? { ...d, concepto } : d);
      toast('Concepto guardado — se aplica a todas las facturas de este proveedor.', 'success');
    } catch (e: any) { toast(e.message || 'Error al guardar el concepto.', 'error'); }
  };

  const handleUnmatch = async (matchId: string) => {
    try { await deleteFacturaMatch(id, matchId); toast('Match deshecho.', 'info'); await refresh(); }
    catch (e: any) { toast(e.message || 'Error.', 'error'); }
    finally { setShowUnmatchConfirm(null); }
  };

  const handleRematch = async () => {
    setRematching(true);
    try { await rematchFacturas(id); toast('Auto-match re-ejecutado.', 'success'); await refresh(); }
    catch (e: any) { toast(e.message || 'Error.', 'error'); }
    finally { setRematching(false); setShowRematchConfirm(false); }
  };

  const exportarPendientesCSV = () => {
    const rows = [
      ['Fuente', 'Fecha', 'Tipo', 'Comprobante', 'Proveedor', 'Total'],
      ...unmatchedAfip.map(c => ['AFIP', c.fecha, TIPO_LABEL[c.tipoComprobante] || c.tipoComprobante, comprobanteLabel(c), c.emisor, c.importeTotalLocal.toFixed(2)]),
      ...unmatchedErp.map(c => ['ERP', c.fecha, TIPO_LABEL[c.tipoComprobante] || c.tipoComprobante, comprobanteLabel(c), c.emisor, c.importeTotalLocal.toFixed(2)]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pendientes-${data?.nombre || id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const matchRate = (() => {
    const total = unmatchedAfip.length + unmatchedErp.length + matches.length * 2;
    return total ? Math.round((matches.length * 2 / total) * 100) : 0;
  })();

  if (loading) {
    return (
      <div className="flex flex-col gap-5 animate-fade-in">
        <div className="h-8 skeleton rounded-xl w-56" />
        <div className="glass-card rounded-2xl h-64" />
      </div>
    );
  }
  if (!data) return <EmptyState icon="search_off" title="No encontrada" />;

  const SortButtons = () => (
    <div className="flex items-center gap-1">
      {(['fecha', 'monto', 'proveedor'] as SortKey[]).map(k => (
        <button key={k} onClick={() => toggleSort(k)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all capitalize shadow-2xs ${
            sortKey === k
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          {k}
          {sortKey === k && <span className="material-symbols-outlined text-[13px]">{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
        </button>
      ))}
    </div>
  );

  const TipoFilterChips = () => (
    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
      {TIPO_FILTERS.map(([f, label]) => (
        <button key={f} onClick={() => setTipoFilter(f)}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
            tipoFilter === f ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <ConfirmModal isOpen={showRematchConfirm} onClose={() => setShowRematchConfirm(false)} onConfirm={handleRematch} loading={rematching}
        title="Re-ejecutar auto-match" message="Se perderán los matches automáticos actuales. Los manuales se conservan." confirmLabel="Re-ejecutar" confirmVariant="danger" />
      <ConfirmModal isOpen={!!showUnmatchConfirm} onClose={() => setShowUnmatchConfirm(null)} onConfirm={() => showUnmatchConfirm && handleUnmatch(showUnmatchConfirm)}
        title="Deshacer match" message="Los comprobantes volverán a quedar pendientes." confirmLabel="Deshacer" confirmVariant="danger" />
      <ConfirmModal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} onConfirm={handleDeleteSelected} loading={deleting}
        title="Eliminar comprobantes" message={`Se eliminarán ${selAfip.size + selErp.size} comprobante(s) seleccionados. Esta acción no se puede deshacer.`} confirmLabel="Eliminar" confirmVariant="danger" />
      {alertMsg && <AlertModal isOpen={!!alertMsg} onClose={() => setAlertMsg(null)} title={alertMsg.title} message={alertMsg.message} />}
      {detalle && <DetalleComprobanteModal comp={detalle} onClose={() => setDetalle(null)} onSaveConcepto={handleSaveConcepto} />}

      <div className="flex flex-col gap-5">
        {/* Top bar */}
        <div className="flex items-center gap-3 flex-wrap bg-white border border-slate-200/90 p-4 rounded-2xl shadow-xs">
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors text-slate-600 hover:text-slate-900 shadow-2xs"
            title="Volver"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-slate-900 truncate">{data.nombre}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs font-semibold text-slate-700 font-mono-num">{matchRate}% conciliado</span>
              <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${matchRate}%` }} />
              </div>
              {(data.omitidos_afip > 0 || data.omitidos_erp > 0) && (
                <span className="text-[11px] text-slate-400">· {data.omitidos_afip} AFIP y {data.omitidos_erp} ERP fuera de alcance</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
            {([
              ['pendientes', 'Pendientes', unmatchedAfip.length + unmatchedErp.length],
              ['conciliados', 'Conciliados', matches.length],
              ['resumen', 'Resumen', 0],
            ] as [Tab, string, number][]).map(([t, label, count]) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  tab === t ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono-num font-semibold ${
                    tab === t ? 'bg-slate-100 text-slate-900' : 'bg-slate-200/70 text-slate-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <button onClick={() => setShowRematchConfirm(true)} disabled={rematching}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-xs"
          >
            <span className={`material-symbols-outlined text-[16px] ${rematching ? 'animate-spin' : ''}`}>refresh</span>
            {rematching ? 'Procesando...' : 'Re-ejecutar'}
          </button>
        </div>

        {/* Pendientes */}
        {tab === 'pendientes' && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <TipoFilterChips />
              <SortButtons />
              <button onClick={() => { setSelAfip(new Set()); setSelErp(new Set()); }} disabled={selCount === 0}
                className="text-xs font-medium px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-40 transition-colors flex items-center gap-1 shadow-xs"
              >
                <span className="material-symbols-outlined text-[15px]">deselect</span>
                Limpiar ({selCount})
              </button>
              <button onClick={() => setShowDeleteConfirm(true)} disabled={selCount === 0}
                className="text-xs font-medium px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 disabled:opacity-40 transition-colors flex items-center gap-1 shadow-xs"
              >
                <span className="material-symbols-outlined text-[15px]">delete</span>
                Eliminar seleccionados
              </button>
              <button onClick={exportarPendientesCSV} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold hover:bg-slate-50 transition-colors text-slate-700 shadow-xs">
                <span className="material-symbols-outlined text-[15px]">download</span>
                Exportar CSV
              </button>
            </div>

            <div className={`flex gap-4 ${selCount > 0 ? 'pb-28' : ''}`}>
              <PanelComprobantes
                title="AFIP — Sin cargar en ERP" comps={filteredAfip} search={searchAfip} onSearch={setSearchAfip}
                selected={selAfip} onToggle={(cid) => toggleOne(selAfip, setSelAfip, cid)}
                onToggleAll={() => toggleAll(filteredAfip, selAfip, setSelAfip)}
                onDetalle={setDetalle}
              />
              <PanelComprobantes
                title="ERP — No registrado en AFIP" comps={filteredErp} search={searchErp} onSearch={setSearchErp}
                selected={selErp} onToggle={(cid) => toggleOne(selErp, setSelErp, cid)}
                onToggleAll={() => toggleAll(filteredErp, selErp, setSelErp)}
                onDetalle={setDetalle}
              />
            </div>

            {/* Bottom floating dock */}
            {selCount > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                <div className="pointer-events-auto bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-800 px-6 py-4 flex items-center gap-6 animate-slide-up min-w-[540px]">
                  <div className="flex items-center gap-5">
                    <AmountCol label={`AFIP (${selAfip.size})`} value={formatMonto(selAfipSum)} />
                    <div className="h-7 w-px bg-slate-700" />
                    <AmountCol label={`ERP (${selErp.size})`} value={formatMonto(selErpSum)} />
                    <div className="h-7 w-px bg-slate-700" />
                    <AmountCol label="Diferencia" value={formatMonto(selDiff)} highlight={selDiff < 1 ? 'ok' : 'warn'} />
                  </div>
                  <div className="flex-1" />
                  <button onClick={handleManualMatch}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold text-xs hover:bg-emerald-500 active:scale-98 transition-all shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">link</span>
                    Vincular manualmente
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Conciliados */}
        {tab === 'conciliados' && (
          <div className="flex flex-col gap-3 pb-12">
            <div className="flex flex-wrap items-center gap-2">
              <TipoFilterChips />
              <SortButtons />
              <button onClick={() => setSoloConDiferencia(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shadow-2xs ${
                  soloConDiferencia
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">warning</span>
                Solo con diferencia
              </button>
            </div>

            {matchedPairs.length === 0
              ? <EmptyState icon="link_off" title="Sin resultados" description="No hay comprobantes conciliados que coincidan con los filtros." />
              : matchedPairs.map(({ match, afips, erps }) => (
                <MatchedPairCard key={match.id} match={match} afips={afips} erps={erps}
                  onUnmatch={() => setShowUnmatchConfirm(match.id)}
                  onDetalle={setDetalle}
                />
              ))
            }
          </div>
        )}

        {/* Resumen */}
        {tab === 'resumen' && (
          <div className="flex flex-col gap-5 pb-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard label="Total AFIP" value={formatMonto(summary.total_afip || 0)} />
              <KpiCard label="Total ERP" value={formatMonto(summary.total_erp || 0)} />
              <KpiCard label="Diferencia Neta" value={formatMonto(summary.diferencia || 0)} highlight={Math.abs(summary.diferencia || 0) < 1} />
              <KpiCard label="Conciliados" value={String(summary.matched_count || 0)} />
            </div>
            <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-3">Comprobantes fuera de alcance</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Se omitieron <span className="font-semibold text-slate-900 font-mono-num">{data.omitidos_afip}</span> comprobantes de AFIP (Recibos, Tiques, Liquidaciones) y{' '}
                <span className="font-semibold text-slate-900 font-mono-num">{data.omitidos_erp}</span> filas del ERP (Recibos, Extracto Bancario, Otros Comprobantes) — no forman parte de esta conciliación.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ── Sub-components ── */

function PanelComprobantes({ title, comps, search, onSearch, selected, onToggle, onToggleAll, onDetalle }: {
  title: string; comps: NormalizedComprobante[]; search: string; onSearch: (v: string) => void;
  selected: Set<string>; onToggle: (id: string) => void; onToggleAll: () => void; onDetalle: (c: NormalizedComprobante) => void;
}) {
  const total = comps.reduce((s, c) => s + c.importeTotalLocal, 0);
  const allSel = comps.length > 0 && comps.every(c => selected.has(c.id));
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 bg-slate-50/75 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-slate-800">{title}</h2>
          <span className="text-[10px] font-mono-num font-semibold px-2 py-0.5 bg-slate-200/70 text-slate-700 rounded-full">{comps.length}</span>
        </div>
        <button onClick={onToggleAll} disabled={comps.length === 0} className="text-xs font-medium px-2.5 py-1 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-600 transition-colors disabled:opacity-40 shadow-2xs">
          {allSel ? 'Deseleccionar' : 'Seleccionar'} todos
        </button>
      </div>
      <div className="px-3 py-2.5 border-b border-slate-100 bg-white shrink-0">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400" style={{ fontSize: 16 }}>search</span>
          <input type="text" placeholder="Buscar por comprobante, proveedor o monto..." value={search} onChange={e => onSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono-num text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all" />
        </div>
      </div>
      <div className="flex-1 min-h-0 max-h-[520px] overflow-y-auto custom-scrollbar">
        {comps.length === 0
          ? <EmptyState icon={search ? 'search_off' : 'check_circle'} title={search ? 'Sin resultados' : 'Todo conciliado'} />
          : (
            <table className="w-full">
              <tbody>
                {comps.map(c => {
                  const isSelected = selected.has(c.id);
                  return (
                    <tr key={c.id} onClick={() => onDetalle(c)} title="Ver detalle"
                      className={`border-b border-slate-100 last:border-0 cursor-pointer transition-colors group ${
                        isSelected ? 'bg-indigo-50/40' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="px-3 py-2.5 w-6" onClick={(e) => { e.stopPropagation(); onToggle(c.id); }} title="Seleccionar">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-slate-900 border-slate-900' : 'border-slate-300 group-hover:border-slate-400 bg-white'
                        }`}>
                          {isSelected && <span className="material-symbols-outlined text-white text-[12px] font-bold">check</span>}
                        </div>
                      </td>
                      <td className="px-2 py-2.5">
                        <p className="text-xs font-semibold text-slate-900 font-mono-num">{comprobanteLabel(c)}</p>
                        <p className="text-[11px] text-slate-400 font-mono-num">{formatFecha(c.fecha)} · {TIPO_LABEL[c.tipoComprobante] || c.tipoComprobante}</p>
                      </td>
                      <td className="px-2 py-2.5 max-w-[160px]">
                        <p className="text-xs font-medium text-slate-700 truncate">{c.emisor}</p>
                        {c.concepto && <p className="text-[10px] text-slate-400 italic truncate">{c.concepto}</p>}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <p className="text-xs font-semibold font-mono-num text-slate-900">{formatMonto(c.importeTotalLocal)}</p>
                      </td>
                      <td className="px-1 py-2.5 w-6">
                        <span className="material-symbols-outlined text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontSize: 16 }}>chevron_right</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        }
      </div>
      <div className="px-4 py-2.5 border-t border-slate-200/80 flex justify-between items-center shrink-0 bg-slate-50/75">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total</span>
        <span className="text-xs font-bold font-mono-num text-slate-900">{formatMonto(total)}</span>
      </div>
    </div>
  );
}

function MatchedPairCard({ match, afips, erps, onUnmatch, onDetalle }: {
  match: ComprobanteMatchResult; afips: NormalizedComprobante[]; erps: NormalizedComprobante[];
  onUnmatch: () => void; onDetalle: (c: NormalizedComprobante) => void;
}) {
  const hasDiff = match.difference > 0;
  return (
    <div className={`bg-white rounded-2xl p-4 border transition-all duration-200 shadow-xs hover:shadow-card ${
      hasDiff ? 'border-rose-200/80 bg-rose-50/10' : 'border-slate-200/80'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Badge variant={match.match_type === 'MANUAL' ? 'manual' : 'matched'} label={match.match_type === 'MANUAL' ? 'Manual' : `Auto ${Math.round(match.confidence * 100)}%`} size="sm" />
          {hasDiff && <Badge variant="unmatched" label={`Diferencia ${formatMonto(match.difference)}`} size="sm" />}
        </div>
        <button onClick={onUnmatch} className="text-xs font-medium text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1">
          <span className="material-symbols-outlined text-[15px]">link_off</span>
          Deshacer
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MiniCardGroup label="AFIP" comps={afips} onDetalle={onDetalle} />
        <MiniCardGroup label="ERP" comps={erps} onDetalle={onDetalle} highlight={hasDiff} />
      </div>
    </div>
  );
}

function MiniCardGroup({ label, comps, onDetalle, highlight }: { label: string; comps: NormalizedComprobante[]; onDetalle: (c: NormalizedComprobante) => void; highlight?: boolean }) {
  if (comps.length === 0) return <div className="p-3 rounded-xl bg-slate-50 text-xs text-slate-400 border border-slate-200/50">Sin {label}</div>;
  const total = comps.reduce((s, c) => s + c.importeTotalLocal, 0);
  return (
    <div className="p-3 rounded-xl bg-slate-50/75 border border-slate-200/60 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}{comps.length > 1 ? ` (${comps.length})` : ''}</p>
        {comps.length > 1 && <p className={`text-xs font-bold font-mono-num ${highlight ? 'text-rose-600' : 'text-slate-900'}`}>{formatMonto(total)}</p>}
      </div>
      {comps.map(comp => (
        <div key={comp.id} onClick={() => onDetalle(comp)} className="cursor-pointer hover:bg-white p-2 rounded-lg border border-transparent hover:border-slate-200 shadow-none hover:shadow-2xs transition-all">
          <p className="text-xs font-semibold text-slate-900 font-mono-num">{comprobanteLabel(comp)}</p>
          <p className="text-xs text-slate-600 truncate">{comp.emisor}</p>
          {comp.concepto && <p className="text-[10px] text-slate-400 italic truncate">{comp.concepto}</p>}
          {comps.length === 1 && <p className={`text-xs font-bold font-mono-num mt-1 ${highlight ? 'text-rose-600' : 'text-slate-900'}`}>{formatMonto(comp.importeTotalLocal)}</p>}
        </div>
      ))}
    </div>
  );
}

function AmountCol({ label, value, highlight }: { label: string; value: string; highlight?: 'ok' | 'warn' }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-0.5">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`text-base font-bold font-mono-num ${
          highlight === 'warn' ? 'text-rose-400' : highlight === 'ok' ? 'text-emerald-400' : 'text-white'
        }`}>{value}</span>
        {highlight === 'ok' && <span className="material-symbols-outlined text-emerald-400 text-[14px]">check</span>}
        {highlight === 'warn' && <span className="material-symbols-outlined text-rose-400 text-[14px]">warning</span>}
      </div>
    </div>
  );
}

function KpiCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`bg-white p-5 rounded-2xl border shadow-xs text-center ${
      highlight === false ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200/90'
    }`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">{label}</p>
      <span className={`text-xl font-bold font-mono-num ${highlight === false ? 'text-rose-600' : 'text-slate-900'}`}>{value}</span>
    </div>
  );
}

// Desglose de IVA por alícuota (columnas del export de AFIP), en una mini-tabla
// vertical que filtra las alícuotas vacías. Ver plan_modulo_facturas.md, Sección 5.
const ALICUOTA_KEYS = ['IVA 2,5%', 'Neto Grav. IVA 2,5%', 'IVA 5%', 'Neto Grav. IVA 5%', 'IVA 10,5%', 'Neto Grav. IVA 10,5%', 'IVA 21%', 'Neto Grav. IVA 21%', 'IVA 27%', 'Neto Grav. IVA 27%', 'Neto Grav. IVA 0%'];
const TOTALES_KEYS = ['Neto Gravado Total', 'Neto No Gravado', 'Op. Exentas', 'Otros Tributos', 'Total IVA'];
const CORE_META_KEYS = new Set([...ALICUOTA_KEYS, ...TOTALES_KEYS]);
const HIDDEN_META_KEYS = [
  'Fecha', 'Tipo', 'TipoDocEmisor', 'TipoDocReceptor', 'DenominacionEmisor', 'NroDocEmisor', 'Moneda', 'TipoCambio', 'ImpTotal', 'NumeroHasta',
  'importeBruto', 'impuestos', 'comprobanteOriginal',
];

function DetalleComprobanteModal({ comp, onClose, onSaveConcepto }: { comp: NormalizedComprobante; onClose: () => void; onSaveConcepto: (concepto: string) => Promise<void> }) {
  const meta = comp.metadata || {};
  const isNumeric = (v: unknown) => v !== null && v !== undefined && v !== '' && !isNaN(Number(v));

  const alicuotaRows = ALICUOTA_KEYS.filter(k => isNumeric(meta[k]) && Number(meta[k]) !== 0).map(k => [k, meta[k]] as const);
  const totalesRows = TOTALES_KEYS.filter(k => isNumeric(meta[k]) && Number(meta[k]) !== 0).map(k => [k, meta[k]] as const);
  const otrosRows = Object.entries(meta).filter(([k, v]) => !CORE_META_KEYS.has(k) && !HIDDEN_META_KEYS.includes(k) && v !== null && v !== undefined && v !== '');

  // Metadata del ERP: importeBruto (neto) + impuestos, no viene desglosado por alícuota como AFIP.
  const erpNeto = comp.source === 'ERP' ? Number(meta.importeBruto) : null;
  const erpImpuestos = comp.source === 'ERP' ? Number(meta.impuestos) : null;

  const [concepto, setConcepto] = useState(comp.concepto || '');
  const [saving, setSaving] = useState(false);
  const dirty = concepto !== (comp.concepto || '');

  const handleSave = async () => {
    setSaving(true);
    try { await onSaveConcepto(concepto.trim()); }
    finally { setSaving(false); }
  };

  return (
    <Modal isOpen onClose={onClose} title={`${comprobanteLabel(comp)} — ${comp.source}`} size="lg">
      <div className="space-y-5">
        <Section title="Comprobante">
          <Field label="Tipo" value={TIPO_LABEL[comp.tipoComprobante] || comp.tipoComprobante} />
          <Field label="Fecha" value={formatFecha(comp.fecha)} />
          <Field label="Moneda" value={comp.moneda} />
          {comp.cotizacion !== 1 && <Field label="Cotización" value={String(comp.cotizacion)} />}
        </Section>

        <Section title="Emisor">
          <Field label="Razón social" value={comp.emisor} />
          <Field label="CUIT" value={comp.cuitEmisor || 'No resuelto'} />
        </Section>

        <Section title="Concepto">
          <p className="text-[11px] text-outline mb-2 -mt-0.5">Se guarda por proveedor: se va a mostrar en todas sus facturas, pasadas y futuras.</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={concepto}
              onChange={e => setConcepto(e.target.value)}
              placeholder="Ej: Hosting, Alquiler oficina, Honorarios contables..."
              className="flex-1 bg-white border border-black/[0.08] rounded-lg px-2.5 py-1.5 text-[12px] text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-black/20"
            />
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-on-surface text-white hover:bg-black/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
            >
              {saving && <span className="material-symbols-outlined animate-spin" style={{ fontSize: 13 }}>progress_activity</span>}
              Guardar
            </button>
          </div>
        </Section>

        {alicuotaRows.length > 0 && (
          <Section title="IVA por alícuota">
            {alicuotaRows.map(([k, v]) => <Field key={k} label={k} value={formatMonto(Number(v))} />)}
          </Section>
        )}

        <Section title="Importes">
          {comp.source === 'AFIP' ? (
            totalesRows.length > 0
              ? totalesRows.map(([k, v]) => <Field key={k} label={k} value={formatMonto(Number(v))} />)
              : <Field label="Neto gravado total" value={formatMonto(comp.importeTotal)} />
          ) : (
            <>
              {erpNeto !== null && !isNaN(erpNeto) && <Field label="Importe neto" value={formatMonto(erpNeto)} />}
              {erpImpuestos !== null && !isNaN(erpImpuestos) && <Field label="Impuestos" value={formatMonto(erpImpuestos)} />}
            </>
          )}
          <Field label="Importe total" value={formatMonto(comp.importeTotal)} bold />
          {comp.importeTotalLocal !== comp.importeTotal && <Field label="Importe total (moneda local)" value={formatMonto(comp.importeTotalLocal)} bold />}
        </Section>

        {otrosRows.length > 0 && (
          <Section title="Otros datos originales">
            {otrosRows.map(([k, v]) => <Field key={k} label={k} value={String(v)} />)}
          </Section>
        )}
      </div>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-outline mb-2 pb-1.5 border-b border-black/[0.05]">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Field({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[12px] text-on-surface-variant">{label}</span>
      <span className={`text-[12px] tabular-nums text-right ${bold ? 'font-semibold text-on-surface' : 'text-on-surface'}`}>{value}</span>
    </div>
  );
}
