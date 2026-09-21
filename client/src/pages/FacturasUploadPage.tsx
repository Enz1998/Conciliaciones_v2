import React, { useEffect, useState } from 'react';
import { uploadFacturas, getProveedoresCount } from '../api';
import { useToast } from '../components/ui/Toast';

interface Props {
  onComplete: (id: string) => void;
  onGoToProveedores: () => void;
}

export function FacturasUploadPage({ onComplete, onGoToProveedores }: Props) {
  const [afipFile, setAfipFile] = useState<File | null>(null);
  const [erpFile, setErpFile] = useState<File | null>(null);
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [proveedoresCount, setProveedoresCount] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    getProveedoresCount().then(r => setProveedoresCount(r.count)).catch(() => setProveedoresCount(0));
  }, []);

  const bothReady = !!afipFile && !!erpFile;
  const proveedoresListos = (proveedoresCount ?? 0) > 0;

  const handleUpload = async () => {
    if (!afipFile || !erpFile) { toast('Seleccioná ambos archivos para continuar.', 'warning'); return; }
    setLoading(true);
    try {
      const result = await uploadFacturas(
        afipFile, erpFile,
        nombre || `Facturas — ${new Date().toLocaleDateString('es-AR')}`
      );
      toast('Conciliación de facturas procesada correctamente.', 'success');
      onComplete(result.id);
    } catch (e: any) {
      toast(e.message || 'Error al procesar los archivos.', 'error');
    } finally { setLoading(false); }
  };

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

      <div>
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Nueva conciliación de facturas</h3>
        <p className="text-xs text-slate-500 mt-1">Cargá "Mis Comprobantes Recibidos" de AFIP y el libro de facturas del ERP del mismo período.</p>
      </div>

      {proveedoresCount !== null && !proveedoresListos && (
        <div className="bg-amber-50/70 border border-amber-200/80 p-4 rounded-2xl flex items-center gap-3 shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px]">warning</span>
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-amber-950">Falta sincronizar el maestro de proveedores</p>
            <p className="text-[11px] text-amber-800/90 mt-0.5">Es necesario para resolver el CUIT de las facturas del ERP antes de conciliar.</p>
          </div>
          <button onClick={onGoToProveedores} className="px-3 py-1.5 rounded-xl bg-amber-900 text-white text-xs font-semibold hover:bg-amber-800 transition-colors shrink-0 shadow-2xs">
            Sincronizar
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs">
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Nombre identificador</label>
        <input
          type="text"
          placeholder={`Facturas — ${new Date().toLocaleDateString('es-AR')}`}
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          className={inputCls}
        />
      </div>

      <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">Archivos para cruzar</h4>
          <span className="text-[11px] font-mono-num font-medium text-slate-400 uppercase tracking-wide">XLSX · XLS</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DropZone title="Mis Comprobantes (AFIP)" subtitle="Export de comprobantes recibidos." file={afipFile} setFile={setAfipFile} id="file-afip" icon="account_balance" accept=".xlsx,.xls" />
          <DropZone title="Facturas ERP" subtitle="Libro de facturas del sistema contable." file={erpFile} setFile={setErpFile} id="file-erp" icon="receipt_long" accept=".xlsx,.xls" />
        </div>
      </div>

      <div className="flex items-center justify-between bg-white border border-slate-200/90 px-5 py-4 rounded-2xl shadow-xs">
        <p className="text-xs text-slate-500">
          {bothReady ? 'Archivos listos para conciliar.' : 'Cargá los dos archivos para continuar.'}
        </p>
        <button
          onClick={handleUpload}
          disabled={loading || !bothReady || !proveedoresListos}
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
