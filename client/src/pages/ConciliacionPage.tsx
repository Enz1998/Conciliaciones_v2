import React, { useEffect, useState, useMemo } from 'react';
import { getConciliacion, createManualMatch, deleteMatch, rematchConciliacion } from '../api';
import { NormalizedMovement, MatchResult, ConciliacionSummary } from '../types';
import { ArrowLeft, RefreshCw, Link2, Building2, Database, CheckCircle2, AlertCircle, X, Layers, Check } from 'lucide-react';

interface Props {
  id: string;
  onBack: () => void;
}

type Tab = 'summary' | 'unmatched' | 'matched' | 'bank_charges';
type SortKey = 'fecha' | 'monto' | 'descripcion' | 'contraparte';
type SortDir = 'asc' | 'desc';

export function ConciliacionPage({ id, onBack }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rematching, setRematching] = useState(false);
  const [tab, setTab] = useState<Tab>('summary');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [extSort, setExtSort] = useState<{key: SortKey, dir: SortDir}>({key: 'fecha', dir: 'asc'});
  const [maySort, setMaySort] = useState<{key: SortKey, dir: SortDir}>({key: 'fecha', dir: 'asc'});

  useEffect(() => {
    getConciliacion(id)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const refresh = async () => {
    const d = await getConciliacion(id);
    setData(d);
    setSelected(new Set());
  };

  const sortMovs = (movs: NormalizedMovement[], sortState: {key: SortKey, dir: SortDir}) => {
    return [...movs].sort((a, b) => {
      let cmp = 0;
      if (sortState.key === 'fecha') cmp = a.fecha.localeCompare(b.fecha);
      else if (sortState.key === 'monto') {
        const valA = a.tipo === 'CREDITO' ? a.monto : -a.monto;
        const valB = b.tipo === 'CREDITO' ? b.monto : -b.monto;
        cmp = valA - valB;
      }
      else if (sortState.key === 'descripcion') cmp = a.descripcion.localeCompare(b.descripcion);
      else if (sortState.key === 'contraparte') cmp = (a.contraparte || '').localeCompare(b.contraparte || '');
      return sortState.dir === 'asc' ? cmp : -cmp;
    });
  };

  const formatMonto = (n: number) =>
    '$ ' + Math.abs(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtShort = (n: number) => {
    return formatMonto(n);
  };

  const toggleSelect = (movId: string) => {
    const next = new Set(selected);
    if (next.has(movId)) next.delete(movId);
    else next.add(movId);
    setSelected(next);
  };

  const matchedPairs = useMemo(() => {
    if (!data) return [];
    const pairs: { match: MatchResult; extMovs: NormalizedMovement[]; mayMovs: NormalizedMovement[] }[] = [];
    for (const m of data.matches || []) {
      const extIds = new Set<string>();
      const mayIds = new Set<string>();
      if (m.extracto_id) extIds.add(m.extracto_id);
      if (m.mayor_id) mayIds.add(m.mayor_id);
      if (m.group_members) {
        for (const mid of m.group_members) {
          if (data.extractoMovs?.find((x: NormalizedMovement) => x.id === mid)) extIds.add(mid);
          else mayIds.add(mid);
        }
      }
      pairs.push({
        match: m,
        extMovs: (data.extractoMovs || []).filter((x: NormalizedMovement) => extIds.has(x.id)),
        mayMovs: (data.mayorMovs || []).filter((x: NormalizedMovement) => mayIds.has(x.id)),
      });
    }
    return pairs;
  }, [data]);

  if (loading) return <div style={s.center}>Cargando...</div>;
  if (!data) return <div style={s.center}>No encontrado.</div>;

  const summary: ConciliacionSummary = data.summary || {};
  const extUnmatched: NormalizedMovement[] = sortMovs(
    (data.extractoMovs || []).filter((m: NormalizedMovement) => m.match_type === 'UNMATCHED'),
    extSort
  );
  const mayUnmatched: NormalizedMovement[] = sortMovs(
    (data.mayorMovs || []).filter((m: NormalizedMovement) => m.match_type === 'UNMATCHED'),
    maySort
  );

  let selExtSum = 0;
  let selMaySum = 0;
  extUnmatched.forEach(m => {
    if (selected.has(m.id)) selExtSum += (m.tipo === 'CREDITO' ? Number(m.monto) : -Number(m.monto));
  });
  mayUnmatched.forEach(m => {
    if (selected.has(m.id)) selMaySum += (m.tipo === 'CREDITO' ? Number(m.monto) : -Number(m.monto));
  });
  const selDiff = Math.abs(selExtSum - selMaySum);

  const matchTypeLabel = (t: string) => {
    const m: Record<string, string> = { AUTO: 'Auto', MANUAL: 'Manual', GROUPED: 'Agrupado', TAX_CHILD: 'Impuesto', UNMATCHED: '—' };
    return m[t] || t;
  };
  const matchTypeColor = (t: string) => {
    const m: Record<string, string> = { AUTO: '#e8f0fe', MANUAL: '#fff3e0', GROUPED: '#f3e5f5', TAX_CHILD: '#fffde7', UNMATCHED: 'transparent' };
    return m[t] || '#fafafa';
  };

  const SortTh = ({ label, sk, side }: { label: string; sk: SortKey; side: 'EXT' | 'MAY' }) => {
    const isExt = side === 'EXT';
    const currentKey = isExt ? extSort.key : maySort.key;
    const currentDir = isExt ? extSort.dir : maySort.dir;
    
    const handleSort = () => {
      if (isExt) {
        if (extSort.key === sk) setExtSort({ key: sk, dir: extSort.dir === 'asc' ? 'desc' : 'asc' });
        else setExtSort({ key: sk, dir: 'asc' });
      } else {
        if (maySort.key === sk) setMaySort({ key: sk, dir: maySort.dir === 'asc' ? 'desc' : 'asc' });
        else setMaySort({ key: sk, dir: 'asc' });
      }
    };

    const sortIcon = () => {
      if (currentKey !== sk) return ' ↕';
      return currentDir === 'asc' ? ' ↑' : ' ↓';
    };

    return (
      <th style={s.th} onClick={handleSort}>
        <span style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 2 }}>
          {label}<span style={{ fontSize: 10, color: '#aaa' }}>{sortIcon()}</span>
        </span>
      </th>
    );
  };

  const MovRow = ({ m }: { m: NormalizedMovement }) => {
    const sel = selected.has(m.id);
    const isTax = m.match_type === 'TAX_CHILD';
    return (
      <tr
        style={{
          ...s.tr,
          background: sel ? '#e8eaf6' : matchTypeColor(m.match_type),
          opacity: isTax ? 0.5 : 1,
        }}
        onClick={() => m.match_type === 'UNMATCHED' && toggleSelect(m.id)}
      >
        <td style={s.td}>
          <input type="checkbox" checked={sel} onChange={() => toggleSelect(m.id)} style={{ cursor: 'pointer' }} />
        </td>
        <td style={{ ...s.td, fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{m.fecha}</td>
        <td style={{ ...s.td, fontWeight: 600, color: m.tipo === 'CREDITO' ? '#15803d' : '#b91c1c', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
          {m.tipo === 'CREDITO' ? '+' : '−'} {fmtShort(m.monto)}
        </td>
        <td style={{ ...s.td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.descripcion}
        </td>
        <td style={{ ...s.td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.contraparte}>
          {m.contraparte || '—'}
        </td>
      </tr>
    );
  };

  const handleManualMatch = async () => {
    const sel = [...selected];
    if (sel.length < 2) { alert('Seleccioná al menos un movimiento de cada lado'); return; }
    const extIds = sel.filter((id) => data.extractoMovs?.find((m: NormalizedMovement) => m.id === id));
    const mayIds = sel.filter((id) => data.mayorMovs?.find((m: NormalizedMovement) => m.id === id));
    if (extIds.length === 0 || mayIds.length === 0) { alert('Seleccioná al menos uno de cada lado'); return; }
    try { await createManualMatch(id, extIds, mayIds); await refresh(); } catch (e: any) { alert(e.message); }
  };

  const handleUnmatch = async (matchId: string) => {
    try { await deleteMatch(id, matchId); await refresh(); } catch (e: any) { alert(e.message); }
  };

  const handleRematch = async () => {
    if (!window.confirm('¿Re-ejecutar el matcheo automático? Se perderán los matches automáticos actuales (los manuales se conservan).')) return;
    setRematching(true);
    try {
      await rematchConciliacion(id);
      await refresh();
      alert('Matcheo automático re-ejecutado con éxito.');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setRematching(false);
    }
  };

  // Group bank charges
  const bankCats = ['IMPUESTO', 'COMISION', 'INTERES'];
  const regularExt = extUnmatched.filter(m => !bankCats.includes(m.categoria));
  const bankCharges = extUnmatched.filter(m => bankCats.includes(m.categoria));

  const bankChargesTotal = bankCharges.reduce((acc, m) => acc + (m.tipo === 'CREDITO' ? Number(m.monto) : -Number(m.monto)), 0);
  
  const allBankChargesSelected = bankCharges.length > 0 && bankCharges.every(m => selected.has(m.id));
  const toggleBankCharges = () => {
    const next = new Set(selected);
    if (allBankChargesSelected) {
      bankCharges.forEach(m => next.delete(m.id));
    } else {
      bankCharges.forEach(m => next.add(m.id));
    }
    setSelected(next);
  };

  let totalMatchedExt = 0;
  let totalMatchedMay = 0;
  matchedPairs.forEach(({ extMovs, mayMovs }) => {
    extMovs.forEach(m => { totalMatchedExt += (m.tipo === 'CREDITO' ? Number(m.monto) : -Number(m.monto)); });
    mayMovs.forEach(m => { totalMatchedMay += (m.tipo === 'CREDITO' ? Number(m.monto) : -Number(m.monto)); });
  });

  return (
    <div>
        {/* Top bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 0 24px', borderBottom: '1px solid #e5e7eb', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onBack} style={{
            background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 8, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)', transition: 'all 0.2s ease',
          }}
          onMouseOver={(e) => { e.currentTarget.style.color = '#111'; e.currentTarget.style.borderColor = '#d1d5db'; }}
          onMouseOut={(e) => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: '0 0 4px', letterSpacing: '-0.5px' }}>{data.nombre}</h2>
            <div style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                background: data.estado === 'COMPLETADA' ? '#f0fdf4' : '#fff7ed',
                color: data.estado === 'COMPLETADA' ? '#166534' : '#c2410c',
                border: `1px solid ${data.estado === 'COMPLETADA' ? '#bbf7d0' : '#ffedd5'}`
              }}>
                {data.estado === 'COMPLETADA' ? 'Completada' : data.estado}
              </span>
              <span>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building2 size={12} /> {data.extracto_filename || '—'}</span>
              <span>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Database size={12} /> {data.mayor_filename || '—'}</span>
            </div>
          </div>
        </div>
        <button
          onClick={handleRematch} disabled={rematching}
          style={{
            padding: '10px 18px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff',
            cursor: rematching ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, color: '#374151',
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)', transition: 'all 0.2s ease',
          }}
          onMouseOver={(e) => { if(!rematching) { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; e.currentTarget.style.borderColor = '#d1d5db'; } }}
          onMouseOut={(e) => { if(!rematching) { e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.02)'; e.currentTarget.style.borderColor = '#e5e7eb'; } }}
        >
          <RefreshCw size={14} style={{ animation: rematching ? 'spin 1s linear infinite' : 'none' }} />
          {rematching ? 'Procesando...' : 'Re-ejecutar Auto-Match'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, padding: '4px', background: '#f4f5f7', borderRadius: 10, width: 'fit-content' }}>
        {([
          ['summary', `Resumen`],
          ['unmatched', `Sin match`],
          ['matched', `Matcheados`],
          ['bank_charges', `Cargos Bancarios`],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            style={{
              padding: '8px 16px', border: 'none', background: tab === t ? '#fff' : 'transparent',
              borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              color: tab === t ? '#111' : '#6b7280',
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
              transition: 'all 0.2s ease',
            }}
            onClick={() => setTab(t)}
          >
            {label}
            {t === 'unmatched' && <span style={{ marginLeft: 6, fontSize: 11, color: tab === t ? '#6b7280' : '#9ca3af' }}>({extUnmatched.length + mayUnmatched.length})</span>}
            {t === 'matched' && <span style={{ marginLeft: 6, fontSize: 11, color: tab === t ? '#6b7280' : '#9ca3af' }}>({data.matches?.length || 0})</span>}
            {t === 'bank_charges' && <span style={{ marginLeft: 6, fontSize: 11, color: tab === t ? '#6b7280' : '#9ca3af' }}>({bankCharges.length})</span>}
          </button>
        ))}
      </div>

      {/* ===== SUMMARY TAB ===== */}
      {tab === 'summary' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
            <StatCard label="Extracto" value={fmtShort(summary.total_extracto || 0)} color={summary.total_extracto >= 0 ? '#15803d' : '#b91c1c'} />
            <StatCard label="Mayor (ERP)" value={fmtShort(summary.total_mayor || 0)} color={summary.total_mayor >= 0 ? '#15803d' : '#b91c1c'} />
            <StatCard label="Diferencia" value={fmtShort(summary.diferencia || 0)} color={Math.abs(summary.diferencia || 0) < 1 ? '#666' : '#b91c1c'} />
            <StatCard label="Matches" value={String(summary.matched_count || 0)} color="#111" />
            <StatCard label="Sin match Extracto" value={String(summary.unmatched_extracto_count || 0)} color="#d97706" />
            <StatCard label="Sin match Mayor" value={String(summary.unmatched_mayor_count || 0)} color="#d97706" />
          </div>

          {/* Prueba de Conciliación */}
          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 20px' }}>Prueba de Conciliación</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
              {/* Columna Extracto */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1565c0', marginBottom: 16, borderBottom: '1px solid #eee', paddingBottom: 8 }}>BANCO (EXTRACTO)</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: '#666' }}>Saldo Inicial:</span>
                  <span style={{ fontWeight: 500 }}>{fmtShort(Number(data.saldo_inicial_extracto || 0))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: '#666' }}>+ Total Movimientos:</span>
                  <span style={{ fontWeight: 500 }}>{fmtShort(summary.total_extracto || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 13, paddingTop: 8, borderTop: '1px dashed #eee' }}>
                  <span style={{ color: '#111', fontWeight: 600 }}>Saldo Final Calculado:</span>
                  <span style={{ fontWeight: 600 }}>{fmtShort(Number(data.saldo_inicial_extracto || 0) + (summary.total_extracto || 0))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, background: '#f8f9fb', padding: '6px 8px', borderRadius: 6 }}>
                  <span style={{ color: '#111', fontWeight: 600 }}>Saldo Final Real (Ingresado):</span>
                  <span style={{ fontWeight: 600 }}>{fmtShort(Number(data.saldo_final_extracto || 0))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 12 }}>
                  <span style={{ color: '#666' }}>Diferencia Interna:</span>
                  <span style={{ fontWeight: 700, color: Math.abs(Number(data.saldo_final_extracto || 0) - (Number(data.saldo_inicial_extracto || 0) + (summary.total_extracto || 0))) < 0.01 ? '#15803d' : '#b91c1c' }}>
                    {fmtShort(Math.abs(Number(data.saldo_final_extracto || 0) - (Number(data.saldo_inicial_extracto || 0) + (summary.total_extracto || 0))))}
                  </span>
                </div>
              </div>

              {/* Columna Mayor */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e65100', marginBottom: 16, borderBottom: '1px solid #eee', paddingBottom: 8 }}>ERP (LIBRO MAYOR)</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: '#666' }}>Saldo Inicial:</span>
                  <span style={{ fontWeight: 500 }}>{fmtShort(Number(data.saldo_inicial_mayor || 0))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: '#666' }}>+ Total Movimientos:</span>
                  <span style={{ fontWeight: 500 }}>{fmtShort(summary.total_mayor || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 13, paddingTop: 8, borderTop: '1px dashed #eee' }}>
                  <span style={{ color: '#111', fontWeight: 600 }}>Saldo Final Calculado:</span>
                  <span style={{ fontWeight: 600 }}>{fmtShort(Number(data.saldo_inicial_mayor || 0) + (summary.total_mayor || 0))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, background: '#fff7ed', padding: '6px 8px', borderRadius: 6 }}>
                  <span style={{ color: '#111', fontWeight: 600 }}>Saldo Final Real (Ingresado):</span>
                  <span style={{ fontWeight: 600 }}>{fmtShort(Number(data.saldo_final_mayor || 0))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 12 }}>
                  <span style={{ color: '#666' }}>Diferencia Interna:</span>
                  <span style={{ fontWeight: 700, color: Math.abs(Number(data.saldo_final_mayor || 0) - (Number(data.saldo_inicial_mayor || 0) + (summary.total_mayor || 0))) < 0.01 ? '#15803d' : '#b91c1c' }}>
                    {fmtShort(Math.abs(Number(data.saldo_final_mayor || 0) - (Number(data.saldo_inicial_mayor || 0) + (summary.total_mayor || 0))))}
                  </span>
                </div>
              </div>
            </div>

            {/* Cruce de saldos finales */}
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fb', padding: '16px 20px', borderRadius: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>Diferencia Cruzada (Saldo Final Banco vs Saldo Final ERP)</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: Math.abs(Number(data.saldo_final_extracto || 0) - Number(data.saldo_final_mayor || 0)) < 0.01 ? '#15803d' : '#b91c1c' }}>
                {fmtShort(Math.abs(Number(data.saldo_final_extracto || 0) - Number(data.saldo_final_mayor || 0)))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== UNMATCHED TAB — two columns ===== */}
      {tab === 'unmatched' && (
        <div>
          {selected.size > 0 && (
            <div style={{
              position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 24,
              padding: '12px 20px', background: '#111', borderRadius: 100,
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
              zIndex: 100
            }}>
              <div style={{ display: 'flex', gap: 16, color: '#fff', fontSize: 13, alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{selected.size} seleccionados</span>
                <span style={{ opacity: 0.5 }}>|</span>
                <span>Banco: {fmtShort(selExtSum)}</span>
                <span>ERP: {fmtShort(selMaySum)}</span>
                <span style={{ opacity: 0.5 }}>|</span>
                <span style={{ fontWeight: 600, color: selDiff < 0.01 ? '#4ade80' : '#f87171' }}>
                  Dif: {fmtShort(selDiff)}
                </span>
              </div>
              <button style={{ ...s.matchBtn, background: '#fff', color: '#111', display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleManualMatch}>
                <Link2 size={16} /> Matchear
              </button>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Columna Extracto */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <div style={{ padding: '12px 16px', background: '#f8f9fb', borderBottom: '1px solid #e5e7eb', fontSize: 13, fontWeight: 600, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={16} /> {data.banco === 'mercadopago' ? 'Extracto MercadoPago' : 'Extracto Bancario'} — {extUnmatched.length} sin match
              </div>
              <div style={{ maxHeight: 'calc(100vh - 320px)', overflow: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>☐</th>
                      <SortTh label="Fecha" sk="fecha" side="EXT" />
                      <SortTh label="Monto" sk="monto" side="EXT" />
                      <SortTh label="Descripción" sk="descripcion" side="EXT" />
                      <SortTh label="Contraparte" sk="contraparte" side="EXT" />
                    </tr>
                  </thead>
                  <tbody>
                    {regularExt.map((m) => <MovRow key={m.id} m={m} />)}
                    {bankCharges.length > 0 && (
                      <tr
                        style={{
                          ...s.tr,
                          background: allBankChargesSelected ? '#e8eaf6' : '#fffde7',
                          borderTop: '2px solid #eee',
                        }}
                        onClick={toggleBankCharges}
                      >
                        <td style={s.td}>
                          <input type="checkbox" checked={allBankChargesSelected} onChange={toggleBankCharges} style={{ cursor: 'pointer' }} />
                        </td>
                        <td style={{ ...s.td, fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>Varios</td>
                        <td style={{ ...s.td, fontWeight: 600, color: bankChargesTotal >= 0 ? '#15803d' : '#b91c1c', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
                          {bankChargesTotal >= 0 ? '+' : '−'} {fmtShort(Math.abs(bankChargesTotal))}
                        </td>
                        <td style={{ ...s.td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Layers size={14} color="#d97706" /> Total Impuestos y Comisiones ({bankCharges.length} movs)
                          </div>
                        </td>
                        <td style={{ ...s.td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          —
                        </td>
                      </tr>
                    )}
                    {extUnmatched.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}><CheckCircle2 size={18} /> Todo matcheado</div>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Columna Mayor */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <div style={{ padding: '12px 16px', background: '#fef2f2', borderBottom: '1px solid #fee2e2', fontSize: 13, fontWeight: 600, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Database size={16} /> Libro Mayor (ERP) — {mayUnmatched.length} sin match
              </div>
              <div style={{ maxHeight: 'calc(100vh - 320px)', overflow: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>☐</th>
                      <SortTh label="Fecha" sk="fecha" side="MAY" />
                      <SortTh label="Monto" sk="monto" side="MAY" />
                      <SortTh label="Descripción" sk="descripcion" side="MAY" />
                      <SortTh label="Contraparte" sk="contraparte" side="MAY" />
                    </tr>
                  </thead>
                  <tbody>
                    {mayUnmatched.map((m) => <MovRow key={m.id} m={m} />)}
                    {mayUnmatched.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}><CheckCircle2 size={18} /> Todo matcheado</div>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== MATCHED TAB ===== */}
      {tab === 'matched' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: '16px 20px', background: '#f8f9fb', border: '1px solid #e5e7eb', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111', display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle2 size={18} color="#16a34a" /> Totales Matcheados ({matchedPairs.length} grupos)</span>
            <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
              <span>Extracto: <strong style={{ color: totalMatchedExt >= 0 ? '#15803d' : '#b91c1c' }}>{fmtShort(totalMatchedExt)}</strong></span>
              <span>ERP: <strong style={{ color: totalMatchedMay >= 0 ? '#15803d' : '#b91c1c' }}>{fmtShort(totalMatchedMay)}</strong></span>
              <span>Diferencia: <strong style={{ color: Math.abs(totalMatchedExt - totalMatchedMay) < 0.01 ? '#15803d' : '#b91c1c' }}>{fmtShort(Math.abs(totalMatchedExt - totalMatchedMay))}</strong></span>
            </div>
          </div>
          {matchedPairs.map(({ match, extMovs, mayMovs }) => (
            <div key={match.id} style={{ border: '1px solid #eee', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: '#fafafa', borderBottom: '1px solid #eee', fontSize: 12 }}>
                <span style={{
                  padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                  background: matchTypeColor(match.match_type),
                  color: match.match_type === 'AUTO' ? '#1565c0' : match.match_type === 'TAX_CHILD' ? '#f9a825' : '#555',
                }}>
                  {matchTypeLabel(match.match_type)}
                </span>
                <span style={{ color: '#888' }}>Confianza: {Math.round((match.confidence || 1) * 100)}%</span>
                {match.match_type !== 'TAX_CHILD' && (
                  <button onClick={() => handleUnmatch(match.id)} style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.2s ease' }} onMouseOver={(e) => { e.currentTarget.style.background = '#fef2f2'; }} onMouseOut={(e) => { e.currentTarget.style.background = '#fff'; }}>
                    <X size={14} /> Deshacer
                  </button>
                )}
              </div>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Origen</th>
                    <th style={s.th}>Fecha</th>
                    <th style={s.th}>Monto</th>
                    <th style={s.th}>Descripción</th>
                    <th style={s.th}>Contraparte</th>
                  </tr>
                </thead>
                <tbody>
                  {[...extMovs, ...mayMovs].map((m) => (
                    <tr key={m.id} style={{ background: matchTypeColor(m.match_type), opacity: 0.85 }}>
                      <td style={s.td}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                          background: m.source === 'EXTRACTO' ? '#e3f2fd' : '#fce4ec',
                          color: m.source === 'EXTRACTO' ? '#1565c0' : '#c62828',
                        }}>
                          {m.source === 'EXTRACTO' ? 'Banco' : 'ERP'}
                        </span>
                      </td>
                      <td style={{ ...s.td, fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{m.fecha}</td>
                      <td style={{ ...s.td, fontWeight: 600, color: m.tipo === 'CREDITO' ? '#15803d' : '#b91c1c', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>
                        {m.tipo === 'CREDITO' ? '+' : '−'} {fmtShort(m.monto)}
                      </td>
                      <td style={{ ...s.td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.descripcion}</td>
                      <td style={{ ...s.td, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.contraparte || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {matchedPairs.length === 0 && <div style={{ textAlign: 'center', padding: 60, color: '#888', fontSize: 14 }}>No hay matches.</div>}
        </div>
      )}

      {/* ===== BANK CHARGES TAB ===== */}
      {tab === 'bank_charges' && (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          <div style={{ padding: '16px 20px', background: '#fffbeb', borderBottom: '1px solid #fde68a', fontSize: 14, fontWeight: 600, color: '#d97706', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Layers size={18} /> Impuestos, Comisiones y Retenciones sin matchear ({bankCharges.length})</span>
            <span>Total agrupado: {bankChargesTotal >= 0 ? '+' : '−'}{fmtShort(Math.abs(bankChargesTotal))}</span>
          </div>
          <div style={{ maxHeight: 'calc(100vh - 280px)', overflow: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>☐</th>
                  <SortTh label="Fecha" sk="fecha" side="EXT" />
                  <SortTh label="Monto" sk="monto" side="EXT" />
                  <SortTh label="Descripción" sk="descripcion" side="EXT" />
                  <SortTh label="Contraparte" sk="contraparte" side="EXT" />
                </tr>
              </thead>
              <tbody>
                {bankCharges.map((m) => <MovRow key={m.id} m={m} />)}
                {bankCharges.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#aaa', fontSize: 13 }}>No hay cargos bancarios pendientes.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: '20px 24px', borderRadius: 12, background: '#fff', border: '1px solid #f0f0f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
      <div style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  center: { textAlign: 'center', padding: 60, color: '#888', fontSize: 14 },
  backBtn: {
    width: 36, height: 36, borderRadius: 8, border: '1px solid #e0e0e0',
    background: '#fff', cursor: 'pointer', fontSize: 16, fontWeight: 500,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  table: { width: '100%', borderCollapse: 'collapse' as any, fontSize: 12 },
  th: {
    padding: '8px 10px', textAlign: 'left' as any, borderBottom: '1px solid #eee',
    fontWeight: 600, color: '#888', fontSize: 11, textTransform: 'uppercase' as any, letterSpacing: 0.3,
    background: '#fafafa', position: 'sticky' as any, top: 0, zIndex: 1,
  },
  td: { padding: '7px 10px', borderBottom: '1px solid #f5f5f5', fontSize: 12 },
  tr: { transition: 'background 0.1s', cursor: 'pointer' },
  matchBtn: {
    padding: '7px 18px', borderRadius: 7, border: 'none',
    background: '#111', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
};
