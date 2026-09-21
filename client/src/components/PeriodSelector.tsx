import React, { useState, useEffect, useRef } from 'react';
import { getPeriodos, createPeriodo } from '../api';
import { Modal } from './ui/Modal';
import { useToast } from './ui/Toast';

export function PeriodSelector({ activePeriod, setActivePeriod }: any) {
  const [periodos, setPeriodos] = useState<any[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newMes, setNewMes] = useState(String(new Date().getMonth() + 1));
  const [newAnio, setNewAnio] = useState(String(new Date().getFullYear()));
  const [creating, setCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPeriodos();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchPeriodos = () => {
    getPeriodos('galicia').then(data => {
      setPeriodos(data);
      if (data.length > 0) {
        if (!activePeriod || !data.find((p: any) => p.id === activePeriod.id)) setActivePeriod(data[0]);
        else setActivePeriod(data.find((p: any) => p.id === activePeriod.id));
      } else { setActivePeriod(null); }
    }).catch(console.error);
  };

  const handleCreate = async () => {
    const mes = parseInt(newMes);
    const anio = parseInt(newAnio);
    if (!mes || !anio || mes < 1 || mes > 12 || anio < 2000) { toast('Ingresá un mes (1–12) y año válido.', 'warning'); return; }
    setCreating(true);
    try {
      const nuevo = await createPeriodo({ banco: 'galicia', mes, anio });
      await fetchPeriodos();
      setActivePeriod(nuevo);
      setShowNewModal(false);
      toast(`Período ${mes}/${anio} creado.`, 'success');
    } catch (e: any) {
      toast(e.message || 'Error al crear el período.', 'error');
    } finally { setCreating(false); }
  };

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const formatPeriod = (p: any) => `${MESES[(p.mes ?? 1) - 1]} ${p.anio}${p.estado === 'CERRADO' ? ' · Cerrado' : ''}`;

  return (
    <>
      <div className="flex items-center gap-3">

        {/* Period dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(v => !v)}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-900 min-w-[180px] hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <span className="material-symbols-outlined text-slate-600 text-[16px]">calendar_month</span>
            <span className="flex-1 text-left truncate font-mono-num font-semibold">
              {activePeriod ? formatPeriod(activePeriod) : 'Seleccionar período'}
            </span>
            <span className={`material-symbols-outlined text-slate-500 transition-transform duration-200 text-[16px] ${isDropdownOpen ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full mt-1.5 left-0 w-full min-w-[210px] bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden py-1 animate-scale-in">
              {periodos.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate-500">Sin períodos registrados</p>
              ) : (
                periodos.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setActivePeriod(p); setIsDropdownOpen(false); }}
                    className={`w-full text-left px-3.5 py-2 text-xs transition-colors flex items-center justify-between font-mono-num ${
                      activePeriod?.id === p.id
                        ? 'bg-slate-50 text-slate-950 font-bold'
                        : 'hover:bg-slate-50 text-slate-700 hover:text-slate-950 font-medium'
                    }`}
                  >
                    <span>{formatPeriod(p)}</span>
                    {activePeriod?.id === p.id && (
                      <span className="material-symbols-outlined text-emerald-600 text-[15px]">check</span>
                    )}
                  </button>
                ))
              )}
              <div className="border-t border-slate-100 mt-1 pt-1 px-1.5 pb-1">
                <button
                  onClick={() => { setIsDropdownOpen(false); setShowNewModal(true); }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 hover:text-slate-950 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined text-slate-600 text-[16px]">add</span>
                  Nuevo período
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Status dot */}
        {activePeriod && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-xl text-[11px] font-semibold text-slate-800 shadow-2xs">
            <span className={`w-1.5 h-1.5 rounded-full ${activePeriod.estado === 'CERRADO' ? 'bg-slate-500' : 'bg-emerald-500'}`} />
            <span>{activePeriod.estado === 'CERRADO' ? 'Cerrado' : 'Abierto'}</span>
          </div>
        )}
      </div>

      {/* New Period Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Abrir Nuevo Período"
        size="sm"
        actions={
          <>
            <button
              onClick={() => setShowNewModal(false)}
              disabled={creating}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-2xs"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-xs"
            >
              {creating && <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>}
              Crear período
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-3.5">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">Mes contable</label>
            <select
              value={newMes}
              onChange={e => setNewMes(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono-num font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all cursor-pointer"
            >
              {MESES.map((m, i) => (
                <option key={i + 1} value={String(i + 1)}>{m} ({String(i + 1).padStart(2, '0')})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">Año</label>
            <input
              type="number"
              value={newAnio}
              onChange={e => setNewAnio(e.target.value)}
              min={2020}
              max={2099}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono-num font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
