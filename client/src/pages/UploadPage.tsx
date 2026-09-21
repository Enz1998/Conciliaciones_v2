import React, { useState, useEffect } from 'react';
import { uploadConciliacion } from '../api';
import { useToast } from '../components/ui/Toast';

interface Props {
  onComplete: (id: string) => void;
  activeBank?: string | null;
  activePeriod?: any;
}

export function UploadPage({ onComplete, activePeriod }: Props) {
  const [extractoFile, setExtractoFile] = useState<File | null>(null);
  const [mayorFile, setMayorFile] = useState<File | null>(null);
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSaldos, setShowSaldos] = useState(false);
  const [saldoIniExt, setSaldoIniExt] = useState('');
  const [saldoFinExt, setSaldoFinExt] = useState('');
  const [saldoIniMay, setSaldoIniMay] = useState('');
  const [saldoFinMay, setSaldoFinMay] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (activePeriod) {
      setSaldoIniExt(activePeriod.saldo_inicial_extracto || '');
      setSaldoIniMay(activePeriod.saldo_inicial_mayor || '');
      setSaldoFinExt(activePeriod.saldo_final_extracto || '');
      setSaldoFinMay(activePeriod.saldo_final_mayor || '');
    }
  }, [activePeriod]);

  const handleUpload = async () => {
    if (!extractoFile || !mayorFile) { toast('Seleccioná ambos archivos para continuar.', 'warning'); return; }
    setLoading(true);
    try {
      const result = await uploadConciliacion(
        extractoFile, mayorFile,
        nombre || `Conciliación — ${new Date().toLocaleDateString('es-AR')}`,
        'galicia',
        { saldo_inicial_extracto: saldoIniExt, saldo_final_extracto: saldoFinExt, saldo_inicial_mayor: saldoIniMay, saldo_final_mayor: saldoFinMay },
        activePeriod?.id
      );
      toast('Conciliación procesada correctamente.', 'success');
      onComplete(result.id);
    } catch (e: any) {
      toast(e.message || 'Error al procesar los archivos.', 'error');
    } finally { setLoading(false); }
  };

  const acceptFormats = '.csv,.xlsx,.xls';
  const bothReady = !!extractoFile && !!mayorFile;

  const DropZone = ({ title, subtitle, file, setFile, id, icon, accept }: {
    title: string; subtitle: string; file: File | null; setFile: (f: File | null) => void;
    id: string; icon: string; accept: string;
  }) => {
    const [isDrag, setIsDrag] = useState(false);
    return (
      <div
        className={`rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer border-2 border-dashed transition-all duration-200 min-h-[175px] p-6 group ${
          file
            ? 'border-emerald-300 bg-emerald-50/20'
            : isDrag
              ? 'border-indigo-400 bg-indigo-50/30 scale-[1.01]'
              : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDrag(true); }}
        onDragLeave={() => setIsDrag(false)}
        onDrop={(e) => { e.preventDefault(); setIsDrag(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
        onClick={() => document.getElementById(id)?.click()}
      >
        <input id={id} type="file" accept={accept} hidden onChange={e => setFile(e.target.files?.[0] || null)} />

        {file ? (
          <>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center mb-2.5">
              <span className="material-symbols-outlined text-[20px] font-bold">check</span>
            </div>
            <p className="text-xs font-semibold text-slate-900">{title}</p>
            <div className="flex items-center gap-1.5 mt-2 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-700 font-mono-num max-w-[180px] truncate">{file.name}</span>
              <span className="text-[10px] text-slate-400 font-mono-num">({(file.size / 1024).toFixed(0)} KB)</span>
              <button
                onClick={e => { e.stopPropagation(); setFile(null); }}
                className="text-slate-400 hover:text-rose-600 transition-colors ml-1 p-0.5"
                title="Quitar archivo"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-500 flex items-center justify-center mb-2.5 group-hover:scale-105 group-hover:border-slate-300 group-hover:text-slate-800 transition-all shadow-2xs">
              <span className="material-symbols-outlined text-[20px]">{icon}</span>
            </div>
            <p className="text-xs font-semibold text-slate-900">{title}</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-[200px] leading-relaxed">{subtitle}</p>
            <div className="mt-3.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-600 shadow-2xs group-hover:bg-slate-50 transition-colors">
              Seleccionar archivo
            </div>
          </>
        )}
      </div>
    );
  };

  const inputCls = "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono-num text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all placeholder:text-slate-400";

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20 animate-fade-in">

      {/* Header */}
      <div>
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Nueva conciliación bancaria</h3>
        <p className="text-xs text-slate-500 mt-1">Cargá el extracto bancario oficial y el libro mayor correspondiente del ERP.</p>
      </div>

      {/* Step 1 */}
      <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs">
        <StepHeader n={1} label="Identificación" />
        <div className="mt-4">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Nombre de la conciliación (opcional)</label>
          <input
            type="text"
            placeholder={`Conciliación — ${new Date().toLocaleDateString('es-AR')}`}
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {/* Step 2 */}
      <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <StepHeader n={2} label="Cargar extracto y mayor" />
          <span className="text-[11px] font-medium font-mono-num text-slate-400 uppercase tracking-wide">CSV · XLSX</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DropZone title="Extracto Bancario" subtitle="Archivo mensual descargado del banco." file={extractoFile} setFile={setExtractoFile} id="file-extracto" icon="account_balance" accept={acceptFormats} />
          <DropZone title="Libro Mayor ERP" subtitle="Reporte exportado del sistema contable." file={mayorFile} setFile={setMayorFile} id="file-mayor" icon="menu_book" accept=".csv,.CSV,.xlsx,.XLSX,.xls,.XLS" />
        </div>
      </div>

      {/* Step 3 — Saldos */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <button
          onClick={() => setShowSaldos(v => !v)}
          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/75 transition-colors text-left"
        >
          <StepNumber n={3} inactive />
          <div className="flex-1">
            <span className="text-xs font-semibold text-slate-800">Saldos iniciales y finales</span>
            <span className="ml-2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Opcional</span>
          </div>
          <span className={`material-symbols-outlined text-slate-400 transition-transform duration-200 text-[18px] ${showSaldos ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </button>

        {showSaldos && (
          <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-slate-100 pt-4 bg-slate-50/30 animate-fade-in">
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2.5">Extracto bancario</p>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">Saldo inicial</label>
                  <input type="number" step="0.01" value={saldoIniExt} onChange={e => setSaldoIniExt(e.target.value)} placeholder="0.00" className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">Saldo final</label>
                  <input type="number" step="0.01" value={saldoFinExt} onChange={e => setSaldoFinExt(e.target.value)} placeholder="0.00" className={inputCls} />
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2.5">Libro Mayor ERP</p>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">Saldo inicial</label>
                  <input type="number" step="0.01" value={saldoIniMay} onChange={e => setSaldoIniMay(e.target.value)} placeholder="0.00" className={inputCls} />
                </div>
                <div>
                  <label className="block text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">Saldo final</label>
                  <input type="number" step="0.01" value={saldoFinMay} onChange={e => setSaldoFinMay(e.target.value)} placeholder="0.00" className={inputCls} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="flex items-center justify-between bg-white border border-slate-200/90 px-5 py-4 rounded-2xl shadow-xs">
        <p className="text-xs text-slate-500">
          {bothReady ? 'Archivos listos para conciliar.' : 'Cargá ambos archivos para habilitar el procesamiento.'}
        </p>
        <button
          onClick={handleUpload}
          disabled={loading || !bothReady}
          className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-xs flex items-center gap-2 hover:bg-slate-800 active:scale-98 transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading
            ? <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Procesando...</>
            : <>Procesar y conciliar <span className="material-symbols-outlined text-[16px]">arrow_forward</span></>
          }
        </button>
      </div>
    </div>
  );
}

function StepNumber({ n, inactive }: { n: number; inactive?: boolean }) {
  return (
    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
      inactive ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white'
    }`}>
      {n}
    </div>
  );
}

function StepHeader({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <StepNumber n={n} />
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">{label}</h4>
    </div>
  );
}
