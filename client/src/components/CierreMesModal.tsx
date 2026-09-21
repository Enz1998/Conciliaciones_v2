import React, { useState } from 'react';
import { cerrarPeriodo, reabrirPeriodo } from '../api';
import { useToast } from './ui/Toast';
import { Modal } from './ui/Modal';

interface Props {
  period: any;
  onClose: () => void;
  onRefresh: () => void;
}

export function CierreMesModal({ period, onClose, onRefresh }: Props) {
  const [saldoFinExt, setSaldoFinExt] = useState(period.saldo_final_extracto || '');
  const [saldoFinMay, setSaldoFinMay] = useState(period.saldo_final_mayor || '');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const isCerrado = period.estado === 'CERRADO';

  const handleCerrar = async () => {
    if (!saldoFinExt || !saldoFinMay) {
      toast('Debes ingresar ambos saldos finales para cerrar el período.', 'warning');
      return;
    }
    setLoading(true);
    try {
      await cerrarPeriodo(period.id, {
        saldo_final_extracto: saldoFinExt,
        saldo_final_mayor: saldoFinMay,
      });
      toast('Período cerrado exitosamente.', 'success');
      onRefresh();
      onClose();
    } catch (e: any) {
      toast(e.message || 'Error al cerrar el período.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReabrir = async () => {
    setLoading(true);
    try {
      await reabrirPeriodo(period.id);
      toast('Período reabierto correctamente.', 'info');
      onRefresh();
      onClose();
    } catch (e: any) {
      toast(e.message || 'Error al reabrir el período.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono-num text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all placeholder:text-slate-400";

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isCerrado ? 'Reabrir Período Contable' : 'Cierre Mensual de Período'}
      size="md"
    >
      <div className="space-y-4">
        <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-500 text-[18px]">calendar_month</span>
            <span className="text-xs font-semibold text-slate-800 font-mono-num">
              Período {String(period.mes).padStart(2, '0')}/{period.anio}
            </span>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
            isCerrado ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {isCerrado ? 'Cerrado' : 'Abierto'}
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          {isCerrado
            ? 'Al reabrir el período, se permitirá agregar o desvincular movimientos nuevamente.'
            : 'Al confirmar el cierre, los saldos finales quedarán fijados como saldos iniciales del siguiente período contable.'}
        </p>

        <div className="space-y-3 pt-1">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Saldo Final Extracto Bancario
            </label>
            <input
              type="number"
              step="0.01"
              value={saldoFinExt}
              onChange={e => setSaldoFinExt(e.target.value)}
              disabled={isCerrado}
              placeholder="0.00"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
              Saldo Final Libro Mayor (ERP)
            </label>
            <input
              type="number"
              step="0.01"
              value={saldoFinMay}
              onChange={e => setSaldoFinMay(e.target.value)}
              disabled={isCerrado}
              placeholder="0.00"
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            Cancelar
          </button>
          {isCerrado ? (
            <button
              onClick={handleReabrir}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-500 active:scale-98 transition-all shadow-xs disabled:opacity-50"
            >
              {loading ? 'Reabriendo...' : 'Reabrir Período'}
            </button>
          ) : (
            <button
              onClick={handleCerrar}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 active:scale-98 transition-all shadow-xs disabled:opacity-50"
            >
              {loading ? 'Confirmando...' : 'Confirmar Cierre'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
