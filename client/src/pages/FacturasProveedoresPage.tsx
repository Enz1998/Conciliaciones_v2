import React, { useEffect, useState } from 'react';
import { syncProveedores, getProveedoresCount } from '../api';
import { useToast } from '../components/ui/Toast';

export function FacturasProveedoresPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isDrag, setIsDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const { toast } = useToast();

  const refreshCount = () => {
    getProveedoresCount().then(r => setCount(r.count)).catch(() => {});
  };

  useEffect(() => { refreshCount(); }, []);

  const handleSync = async () => {
    if (!file) { toast('Seleccioná el archivo del maestro de proveedores.', 'warning'); return; }
    setLoading(true);
    try {
      const result = await syncProveedores(file);
      toast(`Maestro sincronizado: ${result.count} proveedores.`, 'success');
      setFile(null);
      refreshCount();
    } catch (e: any) {
      toast(e.message || 'Error al sincronizar el maestro.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-20 animate-fade-in">
      <div>
        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Maestro de Proveedores</h3>
        <p className="text-xs text-slate-500 mt-1">
          Se usa para resolver el CUIT de cada factura del ERP y matchearla contra AFIP. Subilo una vez y volvé a sincronizar solo cuando cambien tus proveedores — no hace falta en cada conciliación.
        </p>
      </div>

      <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Estado de sincronización</span>
        </div>
        {count === null ? (
          <div className="h-8 w-40 skeleton rounded-lg mt-2" />
        ) : count === 0 ? (
          <div className="flex items-center gap-2 mt-2 text-xs font-medium text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200/60">
            <span className="material-symbols-outlined text-[18px]">warning</span>
            Todavía no sincronizaste ningún proveedor en el sistema.
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-2 text-xs font-semibold text-emerald-800 bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/60">
            <span className="material-symbols-outlined text-[18px] text-emerald-600">verified</span>
            <span><span className="font-bold font-mono-num">{count}</span> proveedores cargados y activos.</span>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">Subir nuevo archivo maestro</h4>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          Archivo exportado del ERP con columnas <span className="font-medium text-slate-700">Nombre</span>, <span className="font-medium text-slate-700">Tipo de Identificación</span> y <span className="font-medium text-slate-700">Número de Identificación</span>. Reemplaza el maestro existente.
        </p>

        <div
          className={`rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer border-2 border-dashed transition-all duration-200 min-h-[160px] p-6 group ${
            file
              ? 'border-emerald-300 bg-emerald-50/20'
              : isDrag
                ? 'border-indigo-400 bg-indigo-50/30 scale-[1.01]'
                : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setIsDrag(true); }}
          onDragLeave={() => setIsDrag(false)}
          onDrop={(e) => { e.preventDefault(); setIsDrag(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
          onClick={() => document.getElementById('file-proveedores')?.click()}
        >
          <input id="file-proveedores" type="file" accept=".xlsx,.xls" hidden onChange={e => setFile(e.target.files?.[0] || null)} />
          {file ? (
            <>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center mb-2.5">
                <span className="material-symbols-outlined text-[20px] font-bold">check</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-xs text-slate-700 font-mono-num max-w-[220px] truncate">{file.name}</span>
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
                <span className="material-symbols-outlined text-[20px]">groups</span>
              </div>
              <p className="text-xs font-semibold text-slate-900">Maestro de proveedores</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-[220px]">Planilla Excel (.xlsx, .xls)</p>
              <div className="mt-3.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-600 shadow-2xs group-hover:bg-slate-50 transition-colors">
                Seleccionar archivo
              </div>
            </>
          )}
        </div>

        <button
          onClick={handleSync}
          disabled={loading || !file}
          className="mt-4 w-full px-5 py-2.5 bg-slate-900 text-white rounded-xl font-semibold text-xs flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-98 transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading
            ? <><span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span> Sincronizando...</>
            : <>Sincronizar maestro <span className="material-symbols-outlined text-[16px]">sync</span></>
          }
        </button>
      </div>
    </div>
  );
}
