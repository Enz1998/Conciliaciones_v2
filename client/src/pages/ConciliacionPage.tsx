import React, { useEffect, useState, useMemo } from 'react';
import { getConciliacion, createManualMatch, deleteMatch, rematchConciliacion, updateConciliacionSaldos } from '../api';
import { NormalizedMovement, MatchResult, ConciliacionSummary } from '../types';
import { MovementRow } from '../components/MovementRow';
import { MatchedPairTable } from '../components/MatchedPairCard';
import { ErpSummaryPanel } from '../components/ErpSummaryPanel';
import { ConfirmModal, AlertModal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonMovementRow } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';

interface Props { id: string; onBack: () => void; }
type Tab = 'summary' | 'unmatched' | 'matched' | 'bank_charges';
type SortKey = 'fecha' | 'monto' | 'descripcion' | 'contraparte';
type SortDir = 'asc' | 'desc';

export function ConciliacionPage({ id, onBack }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rematching, setRematching] = useState(false);
  const [tab, setTab] = useState<Tab>('unmatched');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const [showRematchConfirm, setShowRematchConfirm] = useState(false);
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState<string | null>(null);
  const [alertMsg, setAlertMsg] = useState<{ title: string; message: string } | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>('fecha');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterType, setFilterType] = useState<'ALL' | 'CREDITO' | 'DEBITO'>('ALL');
  const [searchExt, setSearchExt] = useState('');
  const [searchMay, setSearchMay] = useState('');
  const [searchMatched, setSearchMatched] = useState('');
  const [matchedTypeFilter, setMatchedTypeFilter] = useState<'ALL' | 'AUTO' | 'MANUAL' | 'GROUPED'>('ALL');
  const [matchedDiffFilter, setMatchedDiffFilter] = useState<'ALL' | 'EXACT' | 'DIFF'>('ALL');
  const [summarySearch, setSummarySearch] = useState('');
  const [summaryFilterSide, setSummaryFilterSide] = useState<'ALL' | 'EXT' | 'MAY'>('ALL');
  const [isPendingListOpen, setIsPendingListOpen] = useState(false);
  const [isCedulaOpen, setIsCedulaOpen] = useState(false);

  const [isEditingSaldos, setIsEditingSaldos] = useState(false);
  const [editSaldos, setEditSaldos] = useState({ saldo_inicial_extracto: '', saldo_final_extracto: '', saldo_inicial_mayor: '', saldo_final_mayor: '' });

  useEffect(() => {
    if (data) {
      const netoExt = Number(data.summary?.total_extracto || 0);
      const netoMay = Number(data.summary?.total_mayor || 0);
      const sfe = data.saldo_final_extracto || '';
      const sfm = data.saldo_final_mayor || '';
      let sie = data.saldo_inicial_extracto || '';
      if (!sie && sfe) {
        sie = String(Number(sfe) - netoExt);
      }
      let sim = data.saldo_inicial_mayor || '';
      if (!sim && sfm) {
        sim = String(Number(sfm) - netoMay);
      }
      setEditSaldos({
        saldo_inicial_extracto: sie,
        saldo_final_extracto: sfe,
        saldo_inicial_mayor: sim,
        saldo_final_mayor: sfm
      });
    }
  }, [data]);

  useEffect(() => {
    getConciliacion(id).then(setData).catch(() => toast('Error al cargar.', 'error')).finally(() => setLoading(false));
  }, [id]);

  const refresh = async () => { const d = await getConciliacion(id); setData(d); setSelected(new Set()); };

  const formatMonto = (n: number) => '$' + Math.abs(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatFecha = (dStr: string) => { if (!dStr) return '—'; const d = new Date(dStr); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR'); };
  const toggleSelect = (id: string) => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n); };

  const matchedPairs = useMemo(() => {
    if (!data) return [];
    const pairs: { match: MatchResult; extMovs: NormalizedMovement[]; mayMovs: NormalizedMovement[] }[] = [];
    const matches = data.matches || [], extractoMovs = data.extractoMovs || [], mayorMovs = data.mayorMovs || [];

    const extById = new Map<string, NormalizedMovement>();
    const mayById = new Map<string, NormalizedMovement>();
    const extByGroup = new Map<string, NormalizedMovement[]>();
    const mayByGroup = new Map<string, NormalizedMovement[]>();

    for (const em of extractoMovs) {
      if (!em) continue;
      extById.set(em.id, em);
      if (em.match_group_id) {
        if (!extByGroup.has(em.match_group_id)) extByGroup.set(em.match_group_id, []);
        extByGroup.get(em.match_group_id)!.push(em);
      }
    }

    for (const mm of mayorMovs) {
      if (!mm) continue;
      mayById.set(mm.id, mm);
      if (mm.match_group_id) {
        if (!mayByGroup.has(mm.match_group_id)) mayByGroup.set(mm.match_group_id, []);
        mayByGroup.get(mm.match_group_id)!.push(mm);
      }
    }

    for (const m of matches) {
      if (!m) continue;
      const extIds = new Set<string>(), mayIds = new Set<string>();
      if (m.extracto_id) extIds.add(m.extracto_id);
      if (m.mayor_id) mayIds.add(m.mayor_id);

      const members: any[] = (() => {
        if (!m.group_members) return [];
        if (Array.isArray(m.group_members)) return m.group_members;
        if (typeof m.group_members === 'object') return Object.values(m.group_members);
        try { const p = JSON.parse(m.group_members); return Array.isArray(p) ? p : Object.values(p); } catch { return []; }
      })();

      for (const mid of members) {
        if (typeof mid === 'string') {
          if (extById.has(mid)) extIds.add(mid);
          else if (mayById.has(mid)) mayIds.add(mid);
        }
      }

      const linkedExt = extByGroup.get(m.id) || [];
      for (const em of linkedExt) extIds.add(em.id);

      const linkedMay = mayByGroup.get(m.id) || [];
      for (const mm of linkedMay) mayIds.add(mm.id);

      pairs.push({
        match: m,
        extMovs: Array.from(extIds).map(xid => extById.get(xid)).filter(Boolean) as NormalizedMovement[],
        mayMovs: Array.from(mayIds).map(xid => mayById.get(xid)).filter(Boolean) as NormalizedMovement[],
      });
    }
    return pairs;
  }, [data]);

  const matchedStats = useMemo(() => {
    let totalExt = 0;
    let totalMay = 0;
    let exactCount = 0;
    let diffCount = 0;

    for (const { match, extMovs, mayMovs } of matchedPairs) {
      for (const m of extMovs) {
        totalExt += m.tipo === 'CREDITO' ? +m.monto : -+m.monto;
      }
      for (const m of mayMovs) {
        totalMay += m.tipo === 'CREDITO' ? +m.monto : -+m.monto;
      }
      if (Math.abs(match.difference || 0) < 0.01) {
        exactCount++;
      } else {
        diffCount++;
      }
    }

    return {
      pairsCount: matchedPairs.length,
      totalExt,
      totalMay,
      exactCount,
      diffCount,
      totalDiff: Math.abs(totalExt - totalMay),
    };
  }, [matchedPairs]);

  const filteredMatchedPairs = useMemo(() => {
    return matchedPairs.filter(({ match, extMovs, mayMovs }) => {
      if (matchedTypeFilter !== 'ALL' && match.match_type !== matchedTypeFilter) {
        return false;
      }
      const diff = Math.abs(match.difference || 0);
      if (matchedDiffFilter === 'EXACT' && diff >= 0.01) return false;
      if (matchedDiffFilter === 'DIFF' && diff < 0.01) return false;

      if (!searchMatched.trim()) return true;
      const q = searchMatched.toLowerCase().trim();
      const qAmount = searchMatched.replace(/\s/g, '').replace(',', '.');

      const matchMov = (m: NormalizedMovement) => {
        return (
          (m.descripcion || '').toLowerCase().includes(q) ||
          (m.contraparte || '').toLowerCase().includes(q) ||
          (m.referencia || '').toLowerCase().includes(q) ||
          (m.categoria || '').toLowerCase().includes(q) ||
          String(Math.abs(Number(m.monto || 0))).includes(qAmount)
        );
      };

      return extMovs.some(matchMov) || mayMovs.some(matchMov);
    });
  }, [matchedPairs, matchedTypeFilter, matchedDiffFilter, searchMatched]);

  const summaryPendingData = useMemo(() => {
    if (!data) return {
      rawUnmatchedExt: [],
      rawUnmatchedMay: [],
      pendingExtDebits: [],
      pendingExtCredits: [],
      pendingMayDebits: [],
      pendingMayCredits: [],
      totalExtDebits: 0,
      totalExtCredits: 0,
      totalMayDebits: 0,
      totalMayCredits: 0,
      netExtPending: 0,
      netMayPending: 0,
      totalMatchDiff: 0,
      saldoFinExt: 0,
      saldoFinMay: 0,
      saldoDiff: 0,
      saldoConciliadoTeorico: 0,
      unexplainedDiff: 0,
      hasSaldosConfigured: false,
      isReconciled: true,
      movsTheorDiff: 0,
      movsRealDiff: 0,
      unexplainedMovsDiff: 0,
    };

    const extractoMovs: NormalizedMovement[] = data.extractoMovs || [];
    const mayorMovs: NormalizedMovement[] = data.mayorMovs || [];

    const rawUnmatchedExt = extractoMovs.filter(m => m && m.match_type === 'UNMATCHED');
    const rawUnmatchedMay = mayorMovs.filter(m => m && m.match_type === 'UNMATCHED');

    const pendingExtDebits = rawUnmatchedExt.filter(m => m.tipo === 'DEBITO');
    const pendingExtCredits = rawUnmatchedExt.filter(m => m.tipo === 'CREDITO');

    const pendingMayDebits = rawUnmatchedMay.filter(m => m.tipo === 'DEBITO');
    const pendingMayCredits = rawUnmatchedMay.filter(m => m.tipo === 'CREDITO');

    const totalExtDebits = pendingExtDebits.reduce((s, m) => s + Number(m.monto || 0), 0);
    const totalExtCredits = pendingExtCredits.reduce((s, m) => s + Number(m.monto || 0), 0);
    const totalMayDebits = pendingMayDebits.reduce((s, m) => s + Number(m.monto || 0), 0);
    const totalMayCredits = pendingMayCredits.reduce((s, m) => s + Number(m.monto || 0), 0);

    const netExtPending = totalExtCredits - totalExtDebits;
    const netMayPending = totalMayCredits - totalMayDebits;

    const totalMatchDiff = (data.matches || []).reduce((s: number, m: any) => s + Number(m.difference || m.diferencia || 0), 0);

    const saldoFinExt = Number(data.saldo_final_extracto || 0);
    const saldoFinMay = Number(data.saldo_final_mayor || 0);
    const saldoDiff = saldoFinExt - saldoFinMay;

    const saldoConciliadoTeorico = saldoFinExt + totalMayCredits - totalMayDebits + totalExtDebits - totalExtCredits;
    const unexplainedDiff = Math.abs(saldoFinMay - saldoConciliadoTeorico);
    const hasSaldosConfigured = saldoFinExt !== 0 || saldoFinMay !== 0;

    const movsTheorDiff = netExtPending - netMayPending;
    const movsRealDiff = Number(data.summary?.diferencia || 0);
    const unexplainedMovsDiff = Math.abs(movsRealDiff - movsTheorDiff);

    return {
      rawUnmatchedExt,
      rawUnmatchedMay,
      pendingExtDebits,
      pendingExtCredits,
      pendingMayDebits,
      pendingMayCredits,
      totalExtDebits,
      totalExtCredits,
      totalMayDebits,
      totalMayCredits,
      netExtPending,
      netMayPending,
      totalMatchDiff,
      saldoFinExt,
      saldoFinMay,
      saldoDiff,
      saldoConciliadoTeorico,
      unexplainedDiff,
      hasSaldosConfigured,
      isReconciled: hasSaldosConfigured ? unexplainedDiff < 0.01 : unexplainedMovsDiff < 0.01,
      movsTheorDiff,
      movsRealDiff,
      unexplainedMovsDiff,
    };
  }, [data]);

  const filteredSummaryExt = useMemo(() => {
    if (!summarySearch.trim()) return summaryPendingData.rawUnmatchedExt;
    const q = summarySearch.toLowerCase().trim();
    const qa = summarySearch.replace(/\s/g, '').replace(',', '.');
    return summaryPendingData.rawUnmatchedExt.filter(m =>
      (m.descripcion || '').toLowerCase().includes(q) ||
      (m.contraparte || '').toLowerCase().includes(q) ||
      (m.referencia || '').toLowerCase().includes(q) ||
      (m.categoria || '').toLowerCase().includes(q) ||
      String(Math.abs(Number(m.monto || 0))).includes(qa)
    );
  }, [summaryPendingData.rawUnmatchedExt, summarySearch]);

  const filteredSummaryMay = useMemo(() => {
    if (!summarySearch.trim()) return summaryPendingData.rawUnmatchedMay;
    const q = summarySearch.toLowerCase().trim();
    const qa = summarySearch.replace(/\s/g, '').replace(',', '.');
    return summaryPendingData.rawUnmatchedMay.filter(m =>
      (m.descripcion || '').toLowerCase().includes(q) ||
      (m.contraparte || '').toLowerCase().includes(q) ||
      (m.referencia || '').toLowerCase().includes(q) ||
      (m.categoria || '').toLowerCase().includes(q) ||
      String(Math.abs(Number(m.monto || 0))).includes(qa)
    );
  }, [summaryPendingData.rawUnmatchedMay, summarySearch]);

  const processMovs = (movs: NormalizedMovement[]) => {
    if (!movs || !Array.isArray(movs)) return [];
    let r = movs.filter(m => m && m.match_type === 'UNMATCHED');
    if (filterType !== 'ALL') r = r.filter(m => m && m.tipo === filterType);
    return r.sort((a, b) => {
      let av: any = a[sortKey], bv: any = b[sortKey];
      if (sortKey === 'monto') { av = Number(av); bv = Number(bv); } else { av = String(av || '').toLowerCase(); bv = String(bv || '').toLowerCase(); }
      return (av < bv ? -1 : av > bv ? 1 : 0) * (sortDir === 'asc' ? 1 : -1);
    });
  };

  const extUnmatched = data ? processMovs(data.extractoMovs) : [];
  const mayUnmatched = data ? processMovs(data.mayorMovs) : [];
  const bankCats = ['IMPUESTO', 'COMISION', 'INTERES'];
  const regularExt = extUnmatched.filter((m: any) => m && !bankCats.includes(m.categoria));
  const bankCharges = extUnmatched.filter((m: any) => m && bankCats.includes(m.categoria));

  const applySearch = (movs: NormalizedMovement[], term: string) => {
    if (!term) return movs;
    const t = term.toLowerCase(), ta = term.replace(/\s/g, '').replace(',', '.');
    return movs.filter(m => m && ((m.descripcion || '').toLowerCase().includes(t) || (m.categoria || '').toLowerCase().includes(t) || (m.contraparte || '').toLowerCase().includes(t) || String(Math.abs(Number(m.monto || 0))).includes(ta)));
  };

  const filteredRegularExt = applySearch(regularExt, searchExt);
  const filteredBankCharges = applySearch(bankCharges, searchExt);
  const filteredMayUnmatched = applySearch(mayUnmatched, searchMay);

  const erpSummary = useMemo(() => {
    let gastosMant = 0, gastosIva = 0, gastosInt = 0, impDebCred = 0, impInterno = 0, perIva = 0, perIIBB = 0;
    for (const m of bankCharges || []) {
      if (!m) continue;
      const d = (m.descripcion || '').toUpperCase();
      const val = m.tipo === 'CREDITO' ? -Number(m.monto || 0) : Number(m.monto || 0);
      if (/\bIVA\b/.test(d) && !/PERCEP/.test(d)) gastosIva += val;
      else if (/PERCEP\.?\s*IVA/.test(d)) perIva += val;
      else if (/ING\.\s*BRUTOS|SIRCREB/.test(d)) perIIBB += val;
      else if (/IMP\.\s*DEB\.|IMP\.\s*CRE\.|LEY 25413/.test(d)) impDebCred += val;
      else if (/SELLOS/.test(d)) impInterno += val;
      else if (/INTERES/.test(d)) gastosInt += val;
      else gastosMant += val;
    }
    let ivaInt = 0, ivaMant = 0, gastosMant21 = 0, gastosMantExento = 0;
    if (gastosIva > 0) {
      ivaInt = Number((gastosInt * 0.105).toFixed(2));
      ivaMant = Number((gastosIva - ivaInt).toFixed(2));
      gastosMant21 = ivaMant > 0 ? Math.min(Number((ivaMant / 0.21).toFixed(2)), gastosMant) : 0;
      gastosMantExento = Number((gastosMant - gastosMant21).toFixed(2));
    } else { gastosMantExento = gastosMant; }
    return { gastosMant21, gastosMantExento, ivaMant, gastosInt, ivaInt, gastosIva, impDebCred, impInterno, perIva, perIIBB };
  }, [bankCharges]);

  const { selExtSum, selMaySum } = useMemo(() => {
    let ext = 0, may = 0;
    extUnmatched.forEach((m: any) => { if (m && selected.has(m.id)) ext += m.tipo === 'CREDITO' ? +m.monto : -m.monto; });
    mayUnmatched.forEach((m: any) => { if (m && selected.has(m.id)) may += m.tipo === 'CREDITO' ? +m.monto : -m.monto; });
    return { selExtSum: ext, selMaySum: may };
  }, [selected, extUnmatched, mayUnmatched]);
  const selDiff = Math.abs(selExtSum - selMaySum);

  const handleManualMatch = async () => {
    const sel = [...selected];
    if (sel.length < 2) { setAlertMsg({ title: 'Selección incompleta', message: 'Seleccioná al menos un movimiento de cada lado.' }); return; }
    const extIds = sel.filter(sid => data.extractoMovs?.find((m: any) => m.id === sid));
    const mayIds = sel.filter(sid => data.mayorMovs?.find((m: any) => m.id === sid));
    if (!extIds.length || !mayIds.length) { setAlertMsg({ title: 'Selección incompleta', message: 'Necesitás al menos uno de cada lado (Banco y ERP).' }); return; }
    try { await createManualMatch(id, extIds, mayIds); toast('Match creado.', 'success'); await refresh(); }
    catch (e: any) { toast(e.message || 'Error al crear el match.', 'error'); }
  };

  const handleUnmatch = async (matchId: string) => {
    try { await deleteMatch(id, matchId); toast('Match deshecho.', 'info'); await refresh(); }
    catch (e: any) { toast(e.message || 'Error.', 'error'); }
    finally { setShowUnmatchConfirm(null); }
  };

  const handleRematch = async () => {
    setRematching(true);
    try { await rematchConciliacion(id); toast('Auto-match re-ejecutado.', 'success'); await refresh(); }
    catch (e: any) { toast(e.message || 'Error.', 'error'); }
    finally { setRematching(false); setShowRematchConfirm(false); }
  };

  const handleSaveSaldos = async () => {
    try { await updateConciliacionSaldos(id, editSaldos); setIsEditingSaldos(false); toast('Saldos guardados.', 'success'); await refresh(); }
    catch (e: any) { toast(e.message || 'Error.', 'error'); }
  };

  const toggleSort = (k: SortKey) => { if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(k); setSortDir('asc'); } };
  const calcTotal = (movs: NormalizedMovement[]) => movs.reduce((s, m) => s + (m.tipo === 'CREDITO' ? +m.monto : -+m.monto), 0);
  const formatTotal = (v: number) => (v < 0 ? '−' : '') + formatMonto(Math.abs(v));

  const matchRate = (() => {
    const total = extUnmatched.length + mayUnmatched.length + (data?.matches?.length || 0) * 2;
    return total ? Math.round(((data?.matches?.length || 0) * 2 / total) * 100) : 0;
  })();

  const toggleSelectAll = (movs: NormalizedMovement[]) => {
    const n = new Set(selected);
    const all = movs.every(m => n.has(m.id));
    if (all) movs.forEach(m => n.delete(m.id)); else movs.forEach(m => n.add(m.id));
    setSelected(n);
  };

  const inputCls = "w-full pl-8 pr-3 py-1.5 bg-black/[0.02] border border-black/[0.07] rounded-lg text-[12px] text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-black/20";

  if (loading) {
    return (
      <div className="flex flex-col gap-5 animate-fade-in">
        <div className="h-8 skeleton rounded-xl w-56" />
        <div className="glass-card rounded-2xl overflow-hidden">
          <table className="w-full"><tbody>{Array.from({ length: 8 }).map((_, i) => <SkeletonMovementRow key={i} />)}</tbody></table>
        </div>
      </div>
    );
  }

  if (!data) return <EmptyState icon="search_off" title="No encontrada" />;

  const summary: ConciliacionSummary = data.summary || {};
  const currentExtMovs = tab === 'unmatched' ? filteredRegularExt : filteredBankCharges;

  return (
    <>
      <ConfirmModal isOpen={showRematchConfirm} onClose={() => setShowRematchConfirm(false)} onConfirm={handleRematch} loading={rematching}
        title="Re-ejecutar auto-match" message="Se perderán los matches automáticos actuales. Los manuales se conservan." confirmLabel="Re-ejecutar" confirmVariant="danger" />
      <ConfirmModal isOpen={!!showUnmatchConfirm} onClose={() => setShowUnmatchConfirm(null)} onConfirm={() => showUnmatchConfirm && handleUnmatch(showUnmatchConfirm)}
        title="Deshacer match" message="Los movimientos volverán a quedar pendientes." confirmLabel="Deshacer" confirmVariant="danger" />
      {alertMsg && <AlertModal isOpen={!!alertMsg} onClose={() => setAlertMsg(null)} title={alertMsg.title} message={alertMsg.message} />}

      <div className="flex flex-col h-[calc(100vh-130px)] relative">

        {/* Top bar */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors shadow-xs">
            <span className="material-symbols-outlined text-[17px]">arrow_back</span>
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-[17px] font-semibold text-slate-950 truncate tracking-tight">{data.nombre}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-slate-600 font-medium font-mono-num">{formatFecha(data.created_at)}</span>
              <span className="text-[11px] text-slate-400">·</span>
              <span className="text-[11px] font-bold text-emerald-800">{matchRate}% conciliado</span>
              <div className="w-24 h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600 rounded-full transition-all duration-700" style={{ width: `${matchRate}%` }} />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-100/90 border border-slate-200/80 p-1 rounded-xl shadow-2xs">
            {([
              ['unmatched', 'Pendientes', regularExt.length + mayUnmatched.length],
              ['bank_charges', 'Impuestos', bankCharges.length],
              ['matched', 'Conciliados', data.matches?.length || 0],
              ['summary', 'Resumen', 0],
            ] as [Tab, string, number][]).map(([t, label, count]) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  tab === t
                    ? 'bg-slate-900 text-white shadow-xs font-semibold'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/70 font-semibold'
                }`}
              >
                <span>{label}</span>
                {count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold font-mono-num ${
                    tab === t
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-200 text-slate-800 font-bold'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <button onClick={() => setShowRematchConfirm(true)} disabled={rematching}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-800 hover:text-slate-950 hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-2xs"
          >
            <span className={`material-symbols-outlined text-[15px] text-emerald-600 ${rematching ? 'animate-spin' : ''}`}>refresh</span>
            {rematching ? 'Procesando...' : 'Re-ejecutar'}
          </button>
        </div>

        {/* Pending tab */}
        {tab === 'unmatched' && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Toolbar: Refactored with Dock Palette on Selected Items */}
            <div className="bg-white rounded-xl px-3.5 py-2 border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3 mb-3 shrink-0">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Filtro de Tipo */}
                <div className="flex items-center gap-0.5 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60">
                  <span className="text-[10px] uppercase font-bold text-slate-700 px-2 select-none tracking-wider">
                    Ver
                  </span>
                  {(['ALL', 'CREDITO', 'DEBITO'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilterType(f)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                        filterType === f
                          ? 'bg-slate-900 text-white font-semibold shadow-xs'
                          : 'text-slate-700 hover:text-slate-950 font-medium hover:bg-white/60'
                      }`}
                    >
                      {f === 'ALL' ? 'Todos' : f === 'CREDITO' ? 'Créditos (+)' : 'Débitos (−)'}
                    </button>
                  ))}
                </div>

                <div className="h-5 w-px bg-slate-200 hidden sm:block" />

                {/* Ordenamiento */}
                <div className="flex items-center gap-0.5 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60">
                  <span className="text-[10px] uppercase font-bold text-slate-700 px-2 select-none tracking-wider">
                    Ordenar
                  </span>
                  {(['fecha', 'monto', 'descripcion'] as SortKey[]).map(k => (
                    <button
                      key={k}
                      onClick={() => toggleSort(k)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all capitalize ${
                        sortKey === k
                          ? 'bg-slate-900 text-white font-semibold shadow-xs'
                          : 'text-slate-700 hover:text-slate-950 font-medium hover:bg-white/60'
                      }`}
                    >
                      <span>{k}</span>
                      {sortKey === k && (
                        <span className="material-symbols-outlined text-[13px] text-emerald-400 font-bold">
                          {sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lado derecho: Estado de selección y deselección */}
              {selected.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-800 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {selected.size} seleccionados
                  </span>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="text-[11px] text-slate-700 hover:text-rose-600 font-medium flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-rose-200 hover:bg-rose-50 transition-colors shadow-2xs"
                    title="Deseleccionar todos los movimientos marcados"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                    <span>Limpiar</span>
                  </button>
                </div>
              )}
            </div>

            {/* Two-panel split view */}
            <div className={`flex gap-4 flex-1 min-h-0 overflow-hidden ${selected.size > 0 ? 'pb-24' : 'pb-2'}`}>
              <PanelTable
                title="Extracto Bancario"
                count={regularExt.length}
                movs={filteredRegularExt}
                side="EXT"
                search={searchExt}
                onSearch={setSearchExt}
                selected={selected}
                onToggleAll={() => toggleSelectAll(filteredRegularExt)}
                onToggle={toggleSelect}
                formatMonto={formatMonto}
                formatFecha={formatFecha}
                total={formatTotal(calcTotal(filteredRegularExt))}
                inputCls={inputCls}
              />
              <PanelTable
                title="Registros ERP"
                count={mayUnmatched.length}
                movs={filteredMayUnmatched}
                side="MAY"
                search={searchMay}
                onSearch={setSearchMay}
                selected={selected}
                onToggleAll={() => toggleSelectAll(filteredMayUnmatched)}
                onToggle={toggleSelect}
                formatMonto={formatMonto}
                formatFecha={formatFecha}
                total={formatTotal(calcTotal(filteredMayUnmatched))}
                inputCls={inputCls}
              />
            </div>
          </div>
        )}

        {/* Bank charges tab (Impuestos) */}
        {tab === 'bank_charges' && (
          <div className={`overflow-y-auto scrollbar-thin flex flex-col gap-3.5 flex-1 min-h-0 ${selected.size > 0 ? 'pb-28' : 'pb-8'}`}>
            <ErpSummaryPanel summary={erpSummary} formatMonto={formatMonto} />

            {/* Toolbar: Refactored with Dock Palette on Selected Items */}
            <div className="bg-white rounded-xl px-3.5 py-2 border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Filtro de Tipo */}
                <div className="flex items-center gap-0.5 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60">
                  <span className="text-[10px] uppercase font-bold text-slate-700 px-2 select-none tracking-wider">
                    Ver
                  </span>
                  {(['ALL', 'CREDITO', 'DEBITO'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilterType(f)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                        filterType === f
                          ? 'bg-slate-900 text-white font-semibold shadow-xs'
                          : 'text-slate-700 hover:text-slate-950 font-medium hover:bg-white/60'
                      }`}
                    >
                      {f === 'ALL' ? 'Todos' : f === 'CREDITO' ? 'Créditos (+)' : 'Débitos (−)'}
                    </button>
                  ))}
                </div>

                <div className="h-5 w-px bg-slate-200 hidden sm:block" />

                {/* Ordenamiento */}
                <div className="flex items-center gap-0.5 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60">
                  <span className="text-[10px] uppercase font-bold text-slate-700 px-2 select-none tracking-wider">
                    Ordenar
                  </span>
                  {(['fecha', 'monto', 'descripcion'] as SortKey[]).map(k => (
                    <button
                      key={k}
                      onClick={() => toggleSort(k)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all capitalize ${
                        sortKey === k
                          ? 'bg-slate-900 text-white font-semibold shadow-xs'
                          : 'text-slate-700 hover:text-slate-950 font-medium hover:bg-white/60'
                      }`}
                    >
                      <span>{k}</span>
                      {sortKey === k && (
                        <span className="material-symbols-outlined text-[13px] text-emerald-400 font-bold">
                          {sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lado derecho: Estado de selección y deselección */}
              {selected.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-800 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {selected.size} seleccionados
                  </span>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="text-[11px] text-slate-700 hover:text-rose-600 font-medium flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-rose-200 hover:bg-rose-50 transition-colors shadow-2xs"
                    title="Deseleccionar todos los movimientos marcados"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                    <span>Limpiar</span>
                  </button>
                </div>
              )}
            </div>

            {/* Two-panel for bank charges */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PanelTable
                title="Impuestos y Comisiones"
                count={bankCharges.length}
                movs={filteredBankCharges}
                side="EXT"
                search={searchExt}
                onSearch={setSearchExt}
                selected={selected}
                onToggleAll={() => toggleSelectAll(filteredBankCharges)}
                onToggle={toggleSelect}
                formatMonto={formatMonto}
                formatFecha={formatFecha}
                total={formatTotal(calcTotal(filteredBankCharges))}
                inputCls={inputCls}
                className="h-[480px]"
              />
              <PanelTable
                title="Registros ERP"
                count={mayUnmatched.length}
                movs={filteredMayUnmatched}
                side="MAY"
                search={searchMay}
                onSearch={setSearchMay}
                selected={selected}
                onToggleAll={() => toggleSelectAll(filteredMayUnmatched)}
                onToggle={toggleSelect}
                formatMonto={formatMonto}
                formatFecha={formatFecha}
                total={formatTotal(calcTotal(filteredMayUnmatched))}
                inputCls={inputCls}
                className="h-[480px]"
              />
            </div>
          </div>
        )}

        {/* Floating match dock (visible in unmatched and bank_charges) */}
        {(tab === 'unmatched' || tab === 'bank_charges') && selected.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
            <div className="pointer-events-auto bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-800 px-6 py-3.5 flex items-center gap-6 animate-slide-up min-w-[580px]">
              <div className="flex items-center gap-6 shrink-0">
                <AmountCol label="Banco" value={formatMonto(selExtSum)} />
                <div className="h-6 w-px bg-slate-700 shrink-0" />
                <AmountCol label="ERP" value={formatMonto(selMaySum)} />
                <div className="h-6 w-px bg-slate-700 shrink-0" />
                <AmountCol
                  label="Diferencia"
                  value={formatMonto(selDiff)}
                  highlight={selDiff < 0.01 ? 'ok' : 'warn'}
                />
              </div>
              <div className="flex-1 min-w-[16px]" />
              <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap shrink-0">{selected.size} seleccionados</span>
              <button onClick={handleManualMatch}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-slate-950 rounded-xl font-semibold text-[13px] hover:bg-emerald-400 active:scale-95 transition-all shadow-sm whitespace-nowrap shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">link</span>
                Conciliar
              </button>
            </div>
          </div>
        )}

        {/* Matched tab */}
        {tab === 'matched' && (
          <div className="overflow-y-auto scrollbar-thin pb-12 flex flex-col gap-4">
            {/* KPI Summary Bar for Reconciled */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Pares Conciliados</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-bold font-mono-num text-slate-950">{matchedStats.pairsCount}</span>
                  <span className="text-[11px] text-emerald-800 font-semibold font-mono-num">({matchedStats.exactCount} exactos)</span>
                </div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Total Banco Conciliado</span>
                <div className="mt-1">
                  <span className="text-base font-bold font-mono-num text-slate-950">{formatTotal(matchedStats.totalExt)}</span>
                </div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Total ERP Conciliado</span>
                <div className="mt-1">
                  <span className="text-base font-bold font-mono-num text-slate-950">{formatTotal(matchedStats.totalMay)}</span>
                </div>
              </div>
              <div className={`p-3.5 rounded-xl border shadow-2xs ${matchedStats.totalDiff < 0.01 ? 'bg-white border-slate-200' : 'bg-rose-50/50 border-rose-200'}`}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Diferencia Neta</span>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className={`text-base font-bold font-mono-num ${matchedStats.totalDiff < 0.01 ? 'text-slate-950' : 'text-rose-700'}`}>
                    {formatMonto(matchedStats.totalDiff)}
                  </span>
                  {matchedStats.totalDiff < 0.01 && (
                    <span className="material-symbols-outlined text-emerald-600 text-[16px]">check_circle</span>
                  )}
                </div>
              </div>
            </div>

            {/* Toolbar: Search and Filters on Clean Light Surface */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-[17px]">
                  search
                </span>
                <input
                  type="text"
                  value={searchMatched}
                  onChange={(e) => setSearchMatched(e.target.value)}
                  placeholder="Buscar por descripción, contraparte, referencia o monto..."
                  className="w-full pl-8 pr-8 py-1.5 bg-slate-50/80 border border-slate-200 rounded-lg text-[12px] text-slate-900 placeholder:text-slate-500 focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
                />
                {searchMatched && (
                  <button
                    onClick={() => setSearchMatched('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                  </button>
                )}
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Match Type Pills */}
                <div className="flex items-center gap-0.5 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60">
                  {([
                    ['ALL', 'Todos'],
                    ['AUTO', 'Automáticos'],
                    ['MANUAL', 'Manuales'],
                    ['GROUPED', 'Agrupados'],
                  ] as const).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setMatchedTypeFilter(val)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        matchedTypeFilter === val
                          ? 'bg-slate-900 text-white shadow-xs font-semibold'
                          : 'text-slate-700 hover:text-slate-950 font-medium hover:bg-white/60'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Diff filter */}
                <div className="flex items-center gap-0.5 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60">
                  {([
                    ['ALL', 'Todas las dif.'],
                    ['EXACT', 'Exactos ($0)'],
                    ['DIFF', 'Con dif.'],
                  ] as const).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setMatchedDiffFilter(val)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        matchedDiffFilter === val
                          ? 'bg-slate-900 text-white shadow-xs font-semibold'
                          : 'text-slate-700 hover:text-slate-950 font-medium hover:bg-white/60'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Counter */}
                <span className="text-[11px] text-slate-700 font-semibold font-mono-num ml-1">
                  Mostrando {filteredMatchedPairs.length} de {matchedPairs.length}
                </span>
              </div>
            </div>

            {/* List of Matched Cards */}
            {matchedPairs.length === 0 ? (
              <EmptyState
                icon="link_off"
                title="Sin movimientos conciliados"
                description="Aún no hay movimientos conciliados en este período. Podés usar 'Re-ejecutar' o conciliar manualmente desde la pestaña 'Pendientes'."
              />
            ) : filteredMatchedPairs.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center flex flex-col items-center justify-center">
                <span className="material-symbols-outlined text-slate-300 text-[36px] mb-2">search_off</span>
                <p className="text-[13px] font-semibold text-slate-800">No se encontraron movimientos conciliados</p>
                <p className="text-[12px] text-slate-400 mt-1 max-w-sm">
                  Ningún movimiento coincide con el criterio de búsqueda "{searchMatched}" o los filtros seleccionados.
                </p>
                <button
                  onClick={() => {
                    setSearchMatched('');
                    setMatchedTypeFilter('ALL');
                    setMatchedDiffFilter('ALL');
                  }}
                  className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-medium rounded-lg transition-colors"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <MatchedPairTable
                pairs={filteredMatchedPairs}
                formatMonto={formatMonto}
                formatFecha={formatFecha}
                onUnmatch={(mid) => setShowUnmatchConfirm(mid)}
              />
            )}
          </div>
        )}

        {/* Summary tab */}
        {tab === 'summary' && (() => {
          const extractoMovs: NormalizedMovement[] = data?.extractoMovs || [];
          const mayorMovs: NormalizedMovement[] = data?.mayorMovs || [];

          const totalExtCreditos = extractoMovs.filter(m => m.tipo === 'CREDITO').reduce((s, m) => s + Number(m.monto || 0), 0);
          const totalExtDebitos = extractoMovs.filter(m => m.tipo === 'DEBITO').reduce((s, m) => s + Number(m.monto || 0), 0);
          const netoExt = Number(summary.total_extracto != null ? summary.total_extracto : (totalExtCreditos - totalExtDebitos));

          const totalMayCreditos = mayorMovs.filter(m => m.tipo === 'CREDITO').reduce((s, m) => s + Number(m.monto || 0), 0);
          const totalMayDebitos = mayorMovs.filter(m => m.tipo === 'DEBITO').reduce((s, m) => s + Number(m.monto || 0), 0);
          const netoMay = Number(summary.total_mayor != null ? summary.total_mayor : (totalMayCreditos - totalMayDebitos));

          const rawIniExt = data?.saldo_inicial_extracto;
          const rawFinExt = data?.saldo_final_extracto;
          const rawIniMay = data?.saldo_inicial_mayor;
          const rawFinMay = data?.saldo_final_mayor;

          const saldoFinExt = rawFinExt != null && rawFinExt !== '' ? Number(rawFinExt) : (rawIniExt != null ? Number(rawIniExt) + netoExt : netoExt);
          const saldoIniExt = rawIniExt != null && rawIniExt !== '' ? Number(rawIniExt) : (rawFinExt != null ? Number(rawFinExt) - netoExt : 0);

          const saldoFinMay = rawFinMay != null && rawFinMay !== '' ? Number(rawFinMay) : (rawIniMay != null ? Number(rawIniMay) + netoMay : netoMay);
          const saldoIniMay = rawIniMay != null && rawIniMay !== '' ? Number(rawIniMay) : (rawFinMay != null ? Number(rawFinMay) - netoMay : 0);

          const calcFinExt = saldoIniExt + netoExt;
          const calcFinMay = saldoIniMay + netoMay;

          const diffSaldoIni = saldoIniExt - saldoIniMay;
          const diffCreditos = totalExtCreditos - totalMayCreditos;
          const diffDebitos = totalExtDebitos - totalMayDebitos;
          const diffNeto = netoExt - netoMay;
          const diffSaldoFin = saldoFinExt - saldoFinMay;
          const diffCalcFin = calcFinExt - calcFinMay;

          const totalPendingCount = summaryPendingData.rawUnmatchedExt.length + summaryPendingData.rawUnmatchedMay.length;
          const netExtPending = summaryPendingData.totalExtCredits - summaryPendingData.totalExtDebits;
          const netMayPending = summaryPendingData.totalMayCredits - summaryPendingData.totalMayDebits;
          const pendingImpact = netExtPending - netMayPending;

          // Unexplained discrepancy
          const descuadreResidual = Math.abs(diffSaldoFin - pendingImpact);
          const isPerfectCuadre = descuadreResidual < 0.01;

          return (
            <div className="overflow-y-auto scrollbar-thin pb-16 flex flex-col gap-6">
              {/* 1. KPIs Superiores */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard label="Extracto Bancario" value={formatTotal(netoExt)} subtext="Flujo neto del período" />
                <KpiCard label="Libro Mayor (ERP)" value={formatTotal(netoMay)} subtext="Flujo neto del período" />
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-center flex flex-col justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Conciliados
                  </p>
                  <div className="flex items-center justify-center gap-1.5 my-0.5">
                    <span className="text-[20px] font-bold font-mono-num text-slate-950">
                      {matchedPairs.length} pares
                    </span>
                    <span className="material-symbols-outlined text-emerald-600 text-[18px]">
                      link
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 font-semibold font-mono-num">
                    {matchRate}% procesado
                  </p>
                </div>
                <div className={`p-4 rounded-xl border shadow-xs text-center flex flex-col justify-between ${
                  totalPendingCount > 0 ? 'bg-amber-50/30 border-amber-200' : 'bg-emerald-50/30 border-emerald-200'
                }`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Pendientes
                  </p>
                  <div className="flex items-center justify-center gap-1.5 my-0.5">
                    <span className={`text-[20px] font-bold font-mono-num ${
                      totalPendingCount > 0 ? 'text-amber-900' : 'text-emerald-900'
                    }`}>
                      {totalPendingCount}
                    </span>
                    <span className="material-symbols-outlined text-[18px]">
                      {totalPendingCount > 0 ? 'pending_actions' : 'check_circle'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-700 font-medium">
                    {summaryPendingData.rawUnmatchedExt.length} Banco · {summaryPendingData.rawUnmatchedMay.length} ERP
                  </p>
                </div>
              </div>

              {/* 2. Tablero Ejecutivo de Conciliación de Saldos */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
                <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-100 gap-3">
                  <div>
                    <h2 className="text-[15px] font-bold text-slate-950 tracking-tight flex items-center gap-2">
                      <span className="material-symbols-outlined text-slate-800 text-[20px]">account_balance_wallet</span>
                      Conciliación de Saldos
                    </h2>
                    <p className="text-[12px] text-slate-600 font-medium mt-0.5">
                      Comparativa de saldos al cierre del período
                    </p>
                  </div>
                  {isEditingSaldos ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsEditingSaldos(false)}
                        className="px-3 py-1.5 rounded-xl text-[12px] font-semibold border border-slate-200 text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSaveSaldos}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold bg-slate-900 text-white hover:bg-slate-800 shadow-xs transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">save</span>
                        Guardar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsEditingSaldos(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border border-slate-200 text-slate-800 hover:bg-slate-100 transition-colors shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[14px]">edit</span>
                      Editar saldos
                    </button>
                  )}
                </div>

                {/* Comparativa en 3 Columnas Ejecutivas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-5">
                  {/* Columna 1: Banco */}
                  <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-200/80 flex flex-col justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-slate-700">account_balance</span>
                      Saldo Banco
                    </span>
                    <div className="mt-2.5">
                      <span className="text-[22px] font-bold font-mono-num text-slate-950">
                        {formatMonto(saldoFinExt)}
                      </span>
                      <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                        Extracto bancario
                      </p>
                    </div>
                  </div>

                  {/* Columna 2: ERP */}
                  <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-200/80 flex flex-col justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-slate-700">menu_book</span>
                      Saldo ERP
                    </span>
                    <div className="mt-2.5">
                      <span className="text-[22px] font-bold font-mono-num text-slate-950">
                        {formatMonto(saldoFinMay)}
                      </span>
                      <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                        Libro mayor
                      </p>
                    </div>
                  </div>

                  {/* Columna 3: Diferencia */}
                  <div className={`rounded-xl p-4 border flex flex-col justify-between ${
                    Math.abs(diffSaldoFin) < 0.01 ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/60 border-amber-200'
                  }`}>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-indigo-700">difference</span>
                      Diferencia
                    </span>
                    <div className="mt-2.5">
                      <span className="text-[22px] font-bold font-mono-num text-slate-950">
                        {formatMonto(Math.abs(diffSaldoFin))}
                      </span>
                      <p className="text-[11px] text-slate-700 font-medium mt-0.5">
                        {diffSaldoFin > 0.01 ? 'Banco supera a ERP' : diffSaldoFin < -0.01 ? 'ERP supera a Banco' : 'Saldos iguales'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Barra de Cuadre y Estado de Explicación */}
                <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs ${
                  isPerfectCuadre
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50/70 border-amber-200 text-amber-950'
                }`}>
                  <div className="flex items-start sm:items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${
                      isPerfectCuadre ? 'bg-emerald-100/80 text-emerald-700 border border-emerald-200' : 'bg-amber-100/80 text-amber-700 border border-amber-200'
                    }`}>
                      <span className="material-symbols-outlined text-[19px]">
                        {isPerfectCuadre ? 'check_circle' : 'warning'}
                      </span>
                    </div>
                    <div>
                      <p className="text-[13px] font-bold tracking-tight">
                        {isPerfectCuadre ? 'Conciliación Cuadrada' : 'Descuadre Pendiente'}
                      </p>
                      <p className={`text-[11.5px] mt-0.5 ${isPerfectCuadre ? 'text-emerald-950' : 'text-amber-950'}`}>
                        {isPerfectCuadre
                          ? `La diferencia de ${formatMonto(Math.abs(diffSaldoFin))} queda explicada al 100% por los movimientos pendientes.`
                          : `Las partidas pendientes justifican ${formatMonto(Math.abs(pendingImpact))}. Resta conciliar ${formatMonto(descuadreResidual)}.`}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[11px] font-mono-num font-semibold px-3 py-1 rounded-lg border shrink-0 ${
                    isPerfectCuadre
                      ? 'bg-white/90 border-emerald-300 text-emerald-900'
                      : 'bg-white/90 border-amber-300 text-amber-900'
                  }`}>
                    {isPerfectCuadre ? 'Sin descuadre ($ 0,00)' : `Descuadre: ${formatMonto(descuadreResidual)}`}
                  </span>
                </div>
              </div>

              {/* 3. Verificación de Saldos */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
                  <div>
                    <h3 className="text-[14px] font-bold text-slate-950 tracking-tight flex items-center gap-2">
                      <span className="material-symbols-outlined text-slate-800 text-[18px]">fact_check</span>
                      Verificación de Saldos
                    </h3>
                    <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                      Validación de saldo inicial, movimientos del período y saldo final
                    </p>
                  </div>
                  <button
                    onClick={() => isEditingSaldos ? handleSaveSaldos() : setIsEditingSaldos(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-colors ${
                      isEditingSaldos ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 shadow-2xs'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">{isEditingSaldos ? 'save' : 'edit'}</span>
                    {isEditingSaldos ? 'Guardar' : 'Editar saldos'}
                  </button>
                </div>

                {/* Tabla Comparativa Banco vs ERP */}
                <div className="overflow-x-auto">
                  <table className="w-full text-[12.5px] font-mono-num">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-sans uppercase tracking-wider text-slate-700">
                        <th className="py-3 px-6 text-left font-bold">Concepto</th>
                        <th className="py-3 px-6 text-right font-bold">Extracto Bancario</th>
                        <th className="py-3 px-6 text-right font-bold">Libro Mayor (ERP)</th>
                        <th className="py-3 px-6 text-right font-bold">Diferencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {/* Saldo Inicial */}
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-6 text-slate-950 font-semibold flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-slate-500" />
                          Saldo Inicial
                        </td>
                        <td className="py-3 px-6 text-right font-mono-num text-slate-950 font-medium">
                          {isEditingSaldos ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editSaldos.saldo_inicial_extracto}
                              onChange={(e) => setEditSaldos(s => ({ ...s, saldo_inicial_extracto: e.target.value }))}
                              className="w-36 px-2.5 py-1 text-right bg-white border border-slate-300 rounded-lg text-[12px] font-mono-num font-semibold focus:ring-2 focus:ring-slate-900 focus:outline-none"
                            />
                          ) : (
                            formatMonto(saldoIniExt)
                          )}
                        </td>
                        <td className="py-3 px-6 text-right font-mono-num text-slate-950 font-medium">
                          {isEditingSaldos ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editSaldos.saldo_inicial_mayor}
                              onChange={(e) => setEditSaldos(s => ({ ...s, saldo_inicial_mayor: e.target.value }))}
                              className="w-36 px-2.5 py-1 text-right bg-white border border-slate-300 rounded-lg text-[12px] font-mono-num font-semibold focus:ring-2 focus:ring-slate-900 focus:outline-none"
                            />
                          ) : (
                            formatMonto(saldoIniMay)
                          )}
                        </td>
                        <td className="py-3 px-6 text-right font-mono-num text-slate-800 font-semibold">
                          {formatMonto(Math.abs(diffSaldoIni))}
                        </td>
                      </tr>

                      {/* (+) Ingresos */}
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-6 text-slate-800 font-medium pl-8">
                          (+) Ingresos del período
                        </td>
                        <td className="py-3 px-6 text-right font-mono-num text-emerald-800 font-semibold">
                          + {formatMonto(totalExtCreditos)}
                        </td>
                        <td className="py-3 px-6 text-right font-mono-num text-emerald-800 font-semibold">
                          + {formatMonto(totalMayCreditos)}
                        </td>
                        <td className="py-3 px-6 text-right font-mono-num text-slate-800 font-semibold">
                          {diffCreditos >= 0 ? '+' : '−'} {formatMonto(Math.abs(diffCreditos))}
                        </td>
                      </tr>

                      {/* (−) Egresos */}
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-6 text-slate-800 font-medium pl-8">
                          (−) Egresos del período
                        </td>
                        <td className="py-3 px-6 text-right font-mono-num text-slate-900 font-semibold">
                          − {formatMonto(totalExtDebitos)}
                        </td>
                        <td className="py-3 px-6 text-right font-mono-num text-slate-900 font-semibold">
                          − {formatMonto(totalMayDebitos)}
                        </td>
                        <td className="py-3 px-6 text-right font-mono-num text-slate-800 font-semibold">
                          {diffDebitos >= 0 ? '+' : '−'} {formatMonto(Math.abs(diffDebitos))}
                        </td>
                      </tr>

                      {/* (=) Movimiento Neto */}
                      <tr className="bg-slate-50/70 border-t border-b border-slate-200/80 font-semibold">
                        <td className="py-3 px-6 text-slate-950 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-slate-700" />
                          (=) Movimiento Neto
                        </td>
                        <td className="py-3 px-6 text-right font-mono-num text-slate-950 font-bold">
                          {formatTotal(netoExt)}
                        </td>
                        <td className="py-3 px-6 text-right font-mono-num text-slate-950 font-bold">
                          {formatTotal(netoMay)}
                        </td>
                        <td className="py-3 px-6 text-right font-mono-num text-slate-950 font-bold">
                          {formatTotal(diffNeto)}
                        </td>
                      </tr>

                      {/* (=) Saldo Final Calculado */}
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-6 text-slate-950 font-semibold pl-8">
                          (=) Saldo Calculado
                        </td>
                        <td className="py-3 px-6 text-right font-mono-num text-slate-950 font-bold">
                          {formatMonto(calcFinExt)}
                        </td>
                        <td className="py-3 px-6 text-right font-mono-num text-slate-950 font-bold">
                          {formatMonto(calcFinMay)}
                        </td>
                        <td className="py-3 px-6 text-right font-mono-num text-slate-800 font-bold">
                          {formatMonto(Math.abs(diffCalcFin))}
                        </td>
                      </tr>

                      {/* Saldo Final Declarado / Cierre */}
                      <tr className="bg-slate-900 text-white font-semibold">
                        <td className="py-3.5 px-6 flex items-center gap-2 font-sans">
                          <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
                          Saldo de Cierre Declarado
                        </td>
                        <td className="py-3.5 px-6 text-right font-mono-num text-white font-bold text-[14px]">
                          {isEditingSaldos ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editSaldos.saldo_final_extracto}
                              onChange={(e) => setEditSaldos(s => ({ ...s, saldo_final_extracto: e.target.value }))}
                              className="w-36 px-2.5 py-1 text-right bg-slate-800 border border-slate-700 text-white rounded-lg text-[13px] font-mono-num font-bold focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                            />
                          ) : (
                            formatMonto(saldoFinExt)
                          )}
                        </td>
                        <td className="py-3.5 px-6 text-right font-mono-num text-white font-bold text-[14px]">
                          {isEditingSaldos ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editSaldos.saldo_final_mayor}
                              onChange={(e) => setEditSaldos(s => ({ ...s, saldo_final_mayor: e.target.value }))}
                              className="w-36 px-2.5 py-1 text-right bg-slate-800 border border-slate-700 text-white rounded-lg text-[13px] font-mono-num font-bold focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                            />
                          ) : (
                            formatMonto(saldoFinMay)
                          )}
                        </td>
                        <td className="py-3.5 px-6 text-right font-mono-num text-amber-300 font-bold text-[14px]">
                          {formatMonto(Math.abs(diffSaldoFin))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Movimientos Pendientes */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
                <div className="flex flex-wrap items-center justify-between mb-4 pb-3.5 border-b border-slate-100 gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-slate-800 text-[18px]">pending_actions</span>
                      <h3 className="text-[14px] font-bold text-slate-950 tracking-tight">
                        Movimientos Pendientes
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-800 rounded-full font-bold border border-slate-200">
                        {totalPendingCount}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                      Explican la diferencia de {formatMonto(Math.abs(diffSaldoFin))} entre Banco y ERP
                    </p>
                  </div>
                </div>

                {/* Toolbar: Refactored with Dock Palette on Selected Items */}
                <div className="bg-white rounded-xl px-3.5 py-2 border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3 mb-4">
                  {/* Selector de Lado */}
                  <div className="flex items-center gap-0.5 bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/60">
                    <span className="text-[10px] uppercase font-bold text-slate-700 px-2 select-none tracking-wider">
                      Ver
                    </span>
                    {([
                      ['ALL', `Todas (${totalPendingCount})`],
                      ['EXT', `Banco (${summaryPendingData.rawUnmatchedExt.length})`],
                      ['MAY', `ERP (${summaryPendingData.rawUnmatchedMay.length})`],
                    ] as const).map(([side, label]) => (
                      <button
                        key={side}
                        onClick={() => setSummaryFilterSide(side)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                          summaryFilterSide === side
                            ? 'bg-slate-900 text-white font-semibold shadow-xs'
                            : 'text-slate-700 hover:text-slate-950 font-medium hover:bg-white/60'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Buscador unificado */}
                  <div className="relative min-w-[220px] flex-1 max-w-sm">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500 text-[15px]">
                      search
                    </span>
                    <input
                      type="text"
                      value={summarySearch}
                      onChange={(e) => setSummarySearch(e.target.value)}
                      placeholder="Buscar por importe, detalle o concepto..."
                      className="w-full pl-8 pr-7 py-1.5 bg-slate-50/80 border border-slate-200 rounded-lg text-[11px] text-slate-900 placeholder:text-slate-500 focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
                    />
                    {summarySearch && (
                      <button
                        onClick={() => setSummarySearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                      >
                        <span className="material-symbols-outlined text-[13px]">close</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Tablas lado a lado de pendientes */}
                {totalPendingCount === 0 ? (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center flex flex-col items-center justify-center">
                    <span className="material-symbols-outlined text-emerald-600 text-[36px] mb-2">check_circle</span>
                    <p className="text-[13px] font-bold text-slate-900">No hay movimientos pendientes</p>
                    <p className="text-[12px] text-slate-600 mt-1 max-w-sm">
                      Todos los movimientos del período han sido conciliados con éxito.
                    </p>
                  </div>
                ) : filteredSummaryExt.length === 0 && filteredSummaryMay.length === 0 ? (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-8 text-center flex flex-col items-center justify-center">
                    <span className="material-symbols-outlined text-slate-400 text-[36px] mb-2">search_off</span>
                    <p className="text-[13px] font-bold text-slate-900">Sin resultados</p>
                    <p className="text-[12px] text-slate-600 mt-1 max-w-sm">
                      Ningún movimiento pendiente coincide con "{summarySearch}".
                    </p>
                    <button
                      onClick={() => setSummarySearch('')}
                      className="mt-3 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 text-[12px] font-semibold rounded-lg border border-slate-200 transition-colors"
                    >
                      Limpiar búsqueda
                    </button>
                  </div>
                ) : (
                  <div className={`grid gap-5 ${summaryFilterSide === 'ALL' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                    {/* Panel Banco */}
                    {(summaryFilterSide === 'ALL' || summaryFilterSide === 'EXT') && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs flex flex-col">
                        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-700 text-[17px]">account_balance</span>
                            <span className="text-[12px] font-bold text-slate-950">Extracto Bancario</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-white text-slate-800 rounded-full border border-slate-200">
                              {filteredSummaryExt.length}
                            </span>
                            <span className={`text-[11px] font-mono-num font-semibold ml-1 ${
                              netExtPending >= 0 ? 'text-emerald-800' : 'text-slate-900'
                            }`}>
                              {netExtPending >= 0 ? '+' : ''}{formatMonto(netExtPending)}
                            </span>
                          </div>
                          <button
                            onClick={() => setTab('unmatched')}
                            className="text-[11px] font-semibold text-slate-700 hover:text-slate-950 flex items-center gap-1 transition-colors"
                          >
                            <span>Ir a Pendientes</span>
                            <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                          </button>
                        </div>

                        <div className="max-h-96 overflow-y-auto scrollbar-thin bg-white">
                          {filteredSummaryExt.length === 0 ? (
                            <p className="text-[11px] text-slate-500 italic text-center py-6">Sin movimientos pendientes</p>
                          ) : (
                            <table className="w-full">
                              <tbody>
                                {filteredSummaryExt.map((m) => (
                                  <SummaryPendingRow
                                    key={m.id}
                                    m={m}
                                    side="EXT"
                                    formatMonto={formatMonto}
                                    formatFecha={formatFecha}
                                    onGoToTab={() => {
                                      const bankCats = ['IMPUESTO', 'COMISION', 'INTERES'];
                                      if (bankCats.includes(m.categoria)) setTab('bank_charges');
                                      else setTab('unmatched');
                                    }}
                                  />
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Panel ERP */}
                    {(summaryFilterSide === 'ALL' || summaryFilterSide === 'MAY') && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs flex flex-col">
                        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-700 text-[17px]">menu_book</span>
                            <span className="text-[12px] font-bold text-slate-950">Libro Mayor (ERP)</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-white text-slate-800 rounded-full border border-slate-200">
                              {filteredSummaryMay.length}
                            </span>
                            <span className={`text-[11px] font-mono-num font-semibold ml-1 ${
                              netMayPending >= 0 ? 'text-emerald-800' : 'text-slate-900'
                            }`}>
                              {netMayPending >= 0 ? '+' : ''}{formatMonto(netMayPending)}
                            </span>
                          </div>
                          <button
                            onClick={() => setTab('unmatched')}
                            className="text-[11px] font-semibold text-slate-700 hover:text-slate-950 flex items-center gap-1 transition-colors"
                          >
                            <span>Ir a Pendientes</span>
                            <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                          </button>
                        </div>

                        <div className="max-h-96 overflow-y-auto scrollbar-thin bg-white">
                          {filteredSummaryMay.length === 0 ? (
                            <p className="text-[11px] text-slate-500 italic text-center py-6">Sin movimientos pendientes</p>
                          ) : (
                            <table className="w-full">
                              <tbody>
                                {filteredSummaryMay.map((m) => (
                                  <SummaryPendingRow
                                    key={m.id}
                                    m={m}
                                    side="MAY"
                                    formatMonto={formatMonto}
                                    formatFecha={formatFecha}
                                    onGoToTab={() => setTab('unmatched')}
                                  />
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 5. Cédula de Conciliación Bancaria para Auditoría (Colapsable) */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsCedulaOpen(prev => !prev)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50/70 transition-colors text-left"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-slate-700 text-[20px]">balance</span>
                    <div>
                      <h3 className="text-[14px] font-bold text-slate-950 tracking-tight">
                        Cédula de Conciliación Bancaria (Auditoría Contable)
                      </h3>
                      <p className="text-[11px] text-slate-600 font-medium">
                        Demostración matemática formal del puente contable entre el saldo de banco y el saldo ERP
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-indigo-700">
                      {isCedulaOpen ? 'Plegar cédula' : 'Ver cédula contable'}
                    </span>
                    <span className={`material-symbols-outlined text-slate-500 transition-transform ${isCedulaOpen ? 'rotate-180 text-indigo-700' : ''}`}>
                      expand_more
                    </span>
                  </div>
                </button>

                {isCedulaOpen && (
                  <div className="px-6 pb-6 pt-2 border-t border-slate-100">
                    <div className="flex justify-end mb-4">
                      <button
                        onClick={() => window.print()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-colors bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 shadow-2xs"
                        title="Imprimir o guardar cédula de conciliación en PDF"
                      >
                        <span className="material-symbols-outlined text-[15px]">print</span>
                        Imprimir Cédula
                      </button>
                    </div>

                    <div className="space-y-2.5 font-mono-num text-[12.5px]">
                      {/* 1. Saldo Final según Extracto */}
                      <div className="flex items-center justify-between py-2 px-3.5 bg-slate-50 rounded-lg border border-slate-200/70">
                        <div className="flex items-center gap-2 font-sans font-bold text-slate-950">
                          <span className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center text-slate-700 text-[11px] font-mono font-bold">1</span>
                          <span>Saldo Final según Extracto Bancario</span>
                        </div>
                        <span className="font-bold text-slate-950 text-[14px]">{formatMonto(saldoFinExt)}</span>
                      </div>

                      {/* 2. Más Cobranzas / Depósitos en tránsito en ERP */}
                      <div className="flex items-center justify-between py-2 px-3.5 hover:bg-slate-50/60 rounded-lg border border-transparent transition-colors">
                        <div className="flex items-center gap-2 font-sans text-slate-900 font-semibold pl-2">
                          <span className="font-bold text-emerald-700 font-mono">(+)</span>
                          <span>Depósitos y Cobranzas en tránsito</span>
                          <span className="text-[11px] text-slate-600 font-medium">
                            (Contabilizados en ERP, pendientes de acreditar en Banco · {summaryPendingData.pendingMayCredits.length} mov.)
                          </span>
                        </div>
                        <span className="font-bold text-emerald-800">+ {formatMonto(summaryPendingData.totalMayCredits)}</span>
                      </div>

                      {/* 3. Menos Cheques / Pagos en tránsito en ERP */}
                      <div className="flex items-center justify-between py-2 px-3.5 hover:bg-slate-50/60 rounded-lg border border-transparent transition-colors">
                        <div className="flex items-center gap-2 font-sans text-slate-900 font-semibold pl-2">
                          <span className="font-bold text-rose-700 font-mono">(−)</span>
                          <span>Cheques emitidos y Pagos en tránsito</span>
                          <span className="text-[11px] text-slate-600 font-medium">
                            (Contabilizados en ERP, pendientes de débito en Banco · {summaryPendingData.pendingMayDebits.length} mov.)
                          </span>
                        </div>
                        <span className="font-bold text-slate-950">− {formatMonto(summaryPendingData.totalMayDebits)}</span>
                      </div>

                      {/* 4. Más Débitos bancarios no registrados en ERP */}
                      <div className="flex items-center justify-between py-2 px-3.5 hover:bg-slate-50/60 rounded-lg border border-transparent transition-colors">
                        <div className="flex items-center gap-2 font-sans text-slate-900 font-semibold pl-2">
                          <span className="font-bold text-emerald-700 font-mono">(+)</span>
                          <span>Débitos e Impuestos bancarios no contabilizados</span>
                          <span className="text-[11px] text-slate-600 font-medium">
                            (Comisiones, IIBB, IVA debitados en Banco no registrados aún en ERP · {summaryPendingData.pendingExtDebits.length} mov.)
                          </span>
                        </div>
                        <span className="font-bold text-emerald-800">+ {formatMonto(summaryPendingData.totalExtDebits)}</span>
                      </div>

                      {/* 5. Menos Créditos bancarios no registrados en ERP */}
                      <div className="flex items-center justify-between py-2 px-3.5 hover:bg-slate-50/60 rounded-lg border border-transparent transition-colors">
                        <div className="flex items-center gap-2 font-sans text-slate-900 font-semibold pl-2">
                          <span className="font-bold text-rose-700 font-mono">(−)</span>
                          <span>Créditos y Acreditaciones no contabilizadas</span>
                          <span className="text-[11px] text-slate-600 font-medium">
                            (Transferencias recibidas o intereses en Banco pendientes de imputar en ERP · {summaryPendingData.pendingExtCredits.length} mov.)
                          </span>
                        </div>
                        <span className="font-bold text-slate-950">− {formatMonto(summaryPendingData.totalExtCredits)}</span>
                      </div>

                      {/* Saldo Teórico Conciliado */}
                      <div className="pt-2 border-t border-slate-200">
                        <div className="flex items-center justify-between py-2.5 px-3.5 bg-slate-900 text-white rounded-xl shadow-xs">
                          <div className="flex items-center gap-2 font-sans font-semibold">
                            <span className="w-6 h-6 rounded-md bg-slate-800 flex items-center justify-center text-slate-300 text-[11px] font-mono">=</span>
                            <span>Saldo Conciliado Teórico (Libro Mayor ERP)</span>
                          </div>
                          <span className="font-bold text-[15px] text-white">
                            {formatMonto(saldoFinExt + summaryPendingData.totalMayCredits - summaryPendingData.totalMayDebits + summaryPendingData.totalExtDebits - summaryPendingData.totalExtCredits)}
                          </span>
                        </div>
                      </div>

                      {/* Comparación con Saldo Real ERP */}
                      <div className="flex items-center justify-between py-2 px-3.5 mt-1 text-slate-800 font-sans text-[12px]">
                        <span className="font-medium">Saldo Real en Libro Mayor ERP ingresado:</span>
                        <span className="font-mono-num font-bold text-slate-950 text-[13px]">{formatMonto(saldoFinMay)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </>
  );
}

/* ── Sub-components ── */
function PanelTable({ title, count, movs, side, search, onSearch, selected, onToggleAll, onToggle, formatMonto, formatFecha, total, inputCls, className }: any) {
  const allSel = movs.length > 0 && movs.every((m: any) => selected.has(m.id));
  return (
    <div className={`flex-1 flex flex-col min-h-[360px] bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden ${className || ''}`}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-[12px] font-bold text-slate-950">{title}</h2>
          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 text-slate-800 rounded-full">{count}</span>
        </div>
        <button onClick={onToggleAll} className="text-[11px] font-semibold px-2 py-1 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 transition-colors shadow-xs">
          {allSel ? 'Desel.' : 'Sel.'} visibles
        </button>
      </div>
      <div className="px-3 py-2 border-b border-slate-100 shrink-0 bg-white">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-500" style={{ fontSize: 14 }}>search</span>
          <input
            type="text"
            placeholder="Buscar por importe, detalle o concepto..."
            value={search}
            onChange={e => onSearch(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-slate-50/70 border border-slate-200 rounded-lg text-[12px] text-slate-900 placeholder:text-slate-500 focus:outline-none focus:bg-white focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors"
          />
          {search && (
            <button
              onClick={() => onSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              title="Limpiar búsqueda"
            >
              <span className="material-symbols-outlined text-[13px]">close</span>
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-[220px] overflow-y-auto scrollbar-thin">
        {movs.length === 0
          ? <EmptyState icon={search ? 'search_off' : 'check_circle'} title={search ? 'Sin resultados' : 'Todo conciliado'} />
          : <table className="w-full"><tbody>{movs.map((m: NormalizedMovement) => <MovementRow key={m.id} m={m} side={side} selected={selected.has(m.id)} onToggle={onToggle} formatMonto={formatMonto} formatFecha={formatFecha} />)}</tbody></table>
        }
      </div>
      <div className="px-4 py-2 border-t border-slate-100 flex justify-between items-center shrink-0 bg-slate-50/50">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Total visible</span>
        <span className="text-[12px] font-bold font-mono-num text-slate-950">{total}</span>
      </div>
    </div>
  );
}

function AmountCol({ label, value, highlight }: { label: string; value: string; highlight?: 'ok' | 'warn' }) {
  return (
    <div className="flex flex-col whitespace-nowrap shrink-0">
      <span className="text-[10px] uppercase tracking-wider text-slate-300 font-bold mb-0.5">{label}</span>
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <span className={`text-[16px] font-semibold font-mono-num whitespace-nowrap ${highlight === 'ok' ? 'text-emerald-400' : highlight === 'warn' ? 'text-rose-400' : 'text-white'}`}>{value}</span>
        {highlight === 'ok' && <span className="material-symbols-outlined text-emerald-400 shrink-0" style={{ fontSize: 16 }}>check_circle</span>}
        {highlight === 'warn' && <span className="material-symbols-outlined text-rose-400 shrink-0" style={{ fontSize: 16 }}>warning</span>}
      </div>
    </div>
  );
}

function KpiCard({ label, value, subtext, highlight }: { label: string; value: string; subtext?: string; highlight?: boolean }) {
  return (
    <div className={`bg-white p-4 rounded-xl border border-slate-200 shadow-xs text-center flex flex-col justify-between ${highlight === false ? 'border-rose-200 bg-rose-50/20' : ''}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">{label}</p>
      <span className={`text-[20px] font-bold font-mono-num ${highlight === false ? 'text-rose-700' : 'text-slate-950'}`}>{value}</span>
      {subtext && <p className="text-[11px] text-slate-600 font-medium mt-0.5">{subtext}</p>}
    </div>
  );
}

function SaldoColumn({ title, rows }: { title: string; rows: any[] }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-3 pb-2 border-b border-slate-100">{title}</p>
      {rows.map((r, i) => (
        <div key={i} className={`flex items-center justify-between py-2.5 ${r.highlight ? 'mt-2 bg-slate-50 border border-slate-100 px-3 rounded-lg' : 'border-b border-slate-100'}`}>
          <span className={`text-[12px] ${r.bold ? 'font-bold text-slate-950' : 'text-slate-700 font-medium'}`}>{r.label}</span>
          {r.editing && r.onEdit ? (
            <input type="number" step="0.01" value={r.inputVal} onChange={e => r.onEdit(e.target.value)}
              className="w-32 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-[12px] text-right font-mono-num focus:outline-none focus:ring-1 focus:ring-slate-900" />
          ) : (
            <span className={`text-[12px] font-mono-num ${r.bold ? 'font-bold text-slate-950' : 'text-slate-700 font-medium'}`}>{r.value}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function SummaryPendingRow({
  m,
  side,
  formatMonto,
  formatFecha,
  onGoToTab,
}: {
  m: NormalizedMovement;
  side: 'EXT' | 'MAY';
  formatMonto: (n: number) => string;
  formatFecha: (s: string) => string;
  onGoToTab: () => void;
}) {
  const isCredit = m.tipo === 'CREDITO';
  const rawRef = m.referencia?.trim();
  const isJunkRef = !rawRef || ['0', '00', '000', '-', '—', 'null', 'undefined'].includes(rawRef.toLowerCase());
  const cleanRef = !isJunkRef ? rawRef.replace(/^(Ref\.?:?|Pago\s*N[°º]?)\s*/i, '').trim() : null;
  const isSpecialCat = ['IMPUESTO', 'COMISION', 'INTERES', 'GASTO_BANCARIO'].includes(m.categoria);

  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors group">
      {/* Fecha */}
      <td className="py-2.5 pl-4 pr-2 text-[11px] font-mono-num text-slate-700 font-medium whitespace-nowrap align-top w-20">
        {formatFecha(m.fecha)}
      </td>

      {/* Descripción y metadatos limpios */}
      <td className="py-2.5 px-2 align-top">
        <p className="text-[12px] font-semibold text-slate-950 leading-snug break-words" title={m.descripcion}>
          {m.descripcion}
        </p>
        {(m.contraparte || cleanRef || isSpecialCat) && (
          <p className="text-[11px] text-slate-600 font-medium mt-0.5 flex flex-wrap items-center gap-1.5 leading-none">
            {m.contraparte && <span className="font-semibold text-slate-800">{m.contraparte}</span>}
            {m.contraparte && cleanRef && <span className="text-slate-400">·</span>}
            {cleanRef && <span className="font-mono-num text-slate-600 font-medium">Ref. {cleanRef}</span>}
            {isSpecialCat && (
              <>
                {(m.contraparte || cleanRef) && <span className="text-slate-400">·</span>}
                <span className="text-[10px] uppercase font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60">
                  {m.categoria.replace(/_/g, ' ')}
                </span>
              </>
            )}
          </p>
        )}
      </td>

      {/* Monto tabular */}
      <td className="py-2.5 pl-2 pr-4 text-right whitespace-nowrap align-top">
        <span
          className={`text-[12.5px] font-mono-num font-bold ${
            isCredit ? 'text-emerald-800' : 'text-slate-950'
          }`}
        >
          {isCredit ? '+' : '−'} {formatMonto(m.monto)}
        </span>
        <div className="mt-0.5">
          <button
            onClick={onGoToTab}
            className="opacity-0 group-hover:opacity-100 text-[10.5px] font-bold text-indigo-700 hover:text-indigo-900 transition-opacity inline-flex items-center gap-0.5"
            title="Ir a conciliar este movimiento"
          >
            <span>Conciliar</span>
            <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
          </button>
        </div>
      </td>
    </tr>
  );
}

