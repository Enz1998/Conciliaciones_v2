import React, { useEffect, useState } from 'react';
import { listConciliaciones, deleteConciliacion } from '../api';
import { CierreMesModal } from '../components/CierreMesModal';
import { ConfirmModal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonRow, SkeletonMetricCard } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';

interface Props {
  onSelect: (id: string) => void;
  onNew?: () => void;
  activePeriod?: any;
  setActivePeriod?: (p: any) => void;
}

export function ListPage({ onSelect, onNew, activePeriod, setActivePeriod }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCierreModal, setShowCierreModal] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTargets, setDeleteTargets] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const formatFecha = (dStr: string) => {
    if (!dStr) return '—';
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const fetchItems = () => {
    setLoading(true);
    listConciliaciones()
      .then(setItems)
      .catch(() => toast('Error al cargar las conciliaciones.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchItems(); }, []);

  const toggleOne = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };
  const allSelected = items.length > 0 && items.every(i => selected.has(i.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map(i => i.id)));

  const handleDeleteConfirm = async () => {
    if (!deleteTargets || deleteTargets.length === 0) return;
    setDeleting(true);
    try {
      await Promise.all(deleteTargets.map(tid => deleteConciliacion(tid)));
      toast(deleteTargets.length > 1 ? `${deleteTargets.length} conciliaciones eliminadas.` : 'Conciliación eliminada.', 'success');
      setSelected(new Set());
      fetchItems();
    } catch (error: any) {
      toast(error.message || 'Error al eliminar.', 'error');
    } finally {
      setDeleting(false);
      setDeleteTargets(null);
    }
  };

  const completadas = items.filter(i => i.estado === 'COMPLETADA').length;
  const pendientes = items.length - completadas;
  const tasa = items.length ? Math.round((completadas / items.length) * 100) : 0;

  return (
    <>
      {showCierreModal && activePeriod && (
        <CierreMesModal period={activePeriod} onClose={() => setShowCierreModal(false)} onRefresh={() => window.location.reload()} />
      )}

      <ConfirmModal
        isOpen={!!deleteTargets}
        onClose={() => setDeleteTargets(null)}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
        title={deleteTargets && deleteTargets.length > 1 ? `Eliminar ${deleteTargets.length} conciliaciones` : 'Eliminar conciliación'}
        message="¿Estás seguro? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        confirmVariant="danger"
      />

      {/* Hero */}
      <section className="mb-6 flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1 tracking-tight">Panel de Conciliación</h2>
          <p className="text-xs text-slate-500 max-w-xl">
            Estado de libros contables, extractos bancarios y conciliaciones del período activo.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {activePeriod && (
            <button
              onClick={() => setShowCierreModal(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">
                {activePeriod.estado === 'CERRADO' ? 'lock_open' : 'lock'}
              </span>
              {activePeriod.estado === 'CERRADO' ? 'Reabrir mes' : 'Cerrar mes'}
            </button>
          )}
          {onNew && (
            <button
              onClick={onNew}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-xs flex items-center gap-1.5 active:scale-98"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Nueva Conciliación
            </button>
          )}
        </div>
      </section>

      {/* Metrics */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {loading ? (
          <><SkeletonMetricCard /><SkeletonMetricCard /><SkeletonMetricCard /></>
        ) : (
          <>
            <MetricCard
              label="Pendientes"
              value={pendientes.toString().padStart(2, '0')}
              sub="Requieren atención"
              icon="pending_actions"
              accent="amber"
            />
            <MetricCard
              label="Tasa de Conciliación"
              value={`${tasa}%`}
              sub={`${completadas} de ${items.length} conciliadas`}
              icon="verified"
              accent="emerald"
              progress={tasa}
            />
            <MetricCard
              label="Total Período"
              value={items.length.toString().padStart(2, '0')}
              sub="Conciliaciones registradas"
              icon="folder_open"
              accent="slate"
            />
          </>
        )}
      </section>

      {/* Table */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Historial de conciliaciones</h3>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono-num">
              {items.length}
            </span>
          </div>
          <div className="flex gap-2">
            {selected.size > 0 && (
              <>
                <span className="self-center text-xs font-medium text-slate-500 font-mono-num">
                  {selected.size} seleccionada(s)
                </span>
                <button
                  onClick={() => setSelected(new Set())}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-medium hover:bg-slate-50 transition-colors text-slate-600 shadow-xs"
                >
                  Limpiar
                </button>
                <button
                  onClick={() => setDeleteTargets([...selected])}
                  className="px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium hover:bg-rose-100 transition-colors flex items-center gap-1.5 text-rose-700 shadow-xs"
                >
                  <span className="material-symbols-outlined text-[15px]">delete</span>
                  Eliminar seleccionadas
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
          {loading ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/75">
                  {['Nombre', 'Fecha', 'Archivos', 'Progreso', 'Estado', ''].map((h, i) => (
                    <th key={i} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody><SkeletonRow /><SkeletonRow /><SkeletonRow /></tbody>
            </table>
          ) : items.length === 0 ? (
            <EmptyState icon="inbox" title="Sin conciliaciones" description='Creá tu primera desde "Nueva Conciliación".' />
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/75">
                  <th className="pl-5 pr-2 py-3 w-8">
                    <div
                      onClick={toggleAll}
                      className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                        allSelected ? 'bg-slate-900 border-slate-900' : 'border-slate-300 hover:border-slate-400 bg-white'
                      }`}
                    >
                      {allSelected && <span className="material-symbols-outlined text-white text-[12px] font-bold">check</span>}
                    </div>
                  </th>
                  {['Nombre', 'Fecha', 'Archivos asociados', 'Progreso', 'Estado', ''].map((h, i) => (
                    <th key={i} className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const isSelected = selected.has(item.id);
                  const isDone = item.estado === 'COMPLETADA';
                  return (
                    <tr
                      key={item.id}
                      onClick={() => onSelect(item.id)}
                      className={`transition-colors group cursor-pointer ${
                        isSelected ? 'bg-indigo-50/40' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="pl-5 pr-2 py-3.5" onClick={(e) => { e.stopPropagation(); toggleOne(item.id); }}>
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-slate-900 border-slate-900' : 'border-slate-300 group-hover:border-slate-400 bg-white'
                          }`}
                        >
                          {isSelected && <span className="material-symbols-outlined text-white text-[12px] font-bold">check</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/70 flex items-center justify-center shrink-0 text-slate-600 group-hover:text-slate-900 transition-colors">
                            <span className="material-symbols-outlined text-[17px]">account_balance</span>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-slate-900 group-hover:text-primary transition-colors">
                              {item.nombre}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap font-mono-num">
                        {formatFecha(item.created_at)}
                      </td>
                      <td className="px-5 py-3.5 max-w-[200px]">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 truncate font-mono-num">
                          <span className="material-symbols-outlined text-[14px] text-slate-400 shrink-0">table_chart</span>
                          <span className="truncate">{item.extracto_filename || '—'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate font-mono-num mt-0.5">
                          <span className="material-symbols-outlined text-[14px] text-slate-300 shrink-0">menu_book</span>
                          <span className="truncate">{item.mayor_filename || '—'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5 w-28">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                            <div
                              className={`h-full rounded-full transition-all ${isDone ? 'bg-emerald-500' : 'bg-amber-400'}`}
                              style={{ width: `${isDone ? 100 : 0}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono-num font-medium text-slate-500">
                            {isDone ? '100%' : '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={isDone ? 'completed' : 'pending'}
                          label={isDone ? 'Completada' : 'Pendiente'}
                          size="sm"
                        />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTargets([item.id]); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50"
                          title="Eliminar"
                        >
                          <span className="material-symbols-outlined text-[17px]">delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && items.length > 0 && (
          <p className="mt-2.5 text-[11px] font-medium text-slate-400 text-right font-mono-num">
            {items.length} registro{items.length > 1 ? 's' : ''} en total
          </p>
        )}
      </section>
    </>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon,
  accent,
  progress,
}: {
  label: string;
  value: string;
  sub: string;
  icon: string;
  accent: 'emerald' | 'amber' | 'slate';
  progress?: number;
}) {
  const accentClasses = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
    amber: 'bg-amber-50 text-amber-700 border-amber-200/60',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs transition-all duration-200 hover:shadow-card">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${accentClasses[accent]}`}>
          <span className="material-symbols-outlined text-[17px]">{icon}</span>
        </div>
      </div>
      <p className="text-3xl font-bold text-slate-900 tracking-tight font-mono-num leading-none mb-1.5">{value}</p>
      {progress !== undefined && (
        <div className="w-full h-1.5 bg-slate-100 rounded-full mb-2.5 mt-3 overflow-hidden border border-slate-200/40">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      <p className="text-xs text-slate-500">{sub}</p>
    </div>
  );
}
