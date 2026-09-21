import React, { useState } from 'react';

interface ErpSummaryPanelProps {
  summary: {
    gastosMant21: number; gastosMantExento: number; ivaMant: number;
    gastosInt: number; ivaInt: number; gastosIva: number;
    impDebCred: number; impInterno: number; perIva: number; perIIBB: number;
  };
  formatMonto: (n: number) => string;
}

function Row({ label, sub, value, sub2 }: { label: string; sub?: string; value: string; sub2?: string }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-slate-100 last:border-0 gap-4">
      <div className="flex-1">
        <p className="text-[12px] font-semibold text-slate-950">{label}</p>
        {sub && <p className="text-[11px] text-slate-700 font-medium mt-0.5">{sub}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className="text-[12px] font-bold text-slate-950 font-mono-num">{value}</p>
        {sub2 && <p className="text-[10px] text-slate-700 font-mono-num mt-0.5">{sub2}</p>}
      </div>
    </div>
  );
}

export function ErpSummaryPanel({ summary, formatMonto }: ErpSummaryPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { gastosMant21, gastosMantExento, ivaMant, gastosInt, ivaInt, impDebCred, impInterno, perIva, perIIBB } = summary;

  const totalProdServ = gastosMant21 + gastosMantExento + impDebCred + impInterno + gastosInt;
  const totalRetPerc = perIva + perIIBB;
  const totalIva = ivaMant + ivaInt + perIva;

  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-700 text-[18px]">receipt_long</span>
          <h3 className="text-[13px] font-bold text-slate-950 tracking-tight">Resumen para carga en ERP</h3>
          {collapsed && (
            <div className="hidden sm:flex items-center gap-2 ml-3">
              <span className="bg-slate-100 text-slate-700 text-[11px] font-mono-num px-2.5 py-1 rounded-lg border border-slate-200">
                Gastos: <strong className="text-slate-950 font-bold">{formatMonto(totalProdServ)}</strong>
              </span>
              <span className="bg-slate-100 text-slate-700 text-[11px] font-mono-num px-2.5 py-1 rounded-lg border border-slate-200">
                Retenciones: <strong className="text-slate-950 font-bold">{formatMonto(totalRetPerc)}</strong>
              </span>
              <span className="bg-slate-100 text-slate-700 text-[11px] font-mono-num px-2.5 py-1 rounded-lg border border-slate-200">
                IVA: <strong className="text-slate-950 font-bold">{formatMonto(totalIva)}</strong>
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800 hover:text-slate-950 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 transition-colors shadow-2xs"
        >
          <span>{collapsed ? 'Ver desglose' : 'Colapsar panel'}</span>
          <span className="material-symbols-outlined text-[15px] text-slate-600">
            {collapsed ? 'expand_more' : 'expand_less'}
          </span>
        </button>
      </div>

      {!collapsed && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-100">
          <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/80">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200/60">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Productos y Servicios</p>
              <span className="text-[11px] font-bold font-mono-num text-slate-950">{formatMonto(totalProdServ)}</span>
            </div>
            <Row label="Gastos y Comisiones 21%" sub="Mantenimiento de cuenta" value={formatMonto(gastosMant21)} sub2={`IVA: ${formatMonto(ivaMant)}`} />
            {gastosMantExento > 0 && <Row label="Gastos y Comisiones Exento" sub="Comisiones de mercado" value={formatMonto(gastosMantExento)} />}
            <Row label="Imp. Débito y Crédito" value={formatMonto(impDebCred)} />
            <Row label="Impuesto Interno" value={formatMonto(impInterno)} />
            <Row label="Gastos y Comisiones 10,5%" sub="Intereses" value={formatMonto(gastosInt)} sub2={`IVA: ${formatMonto(ivaInt)}`} />
          </div>

          <div className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200/80">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200/60">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Retenciones y Percepciones</p>
              <span className="text-[11px] font-bold font-mono-num text-slate-950">{formatMonto(totalRetPerc)}</span>
            </div>
            <Row label="IVA" value={formatMonto(perIva)} />
            <Row label="Ingresos Brutos Bs. As." value={formatMonto(perIIBB)} />
          </div>
        </div>
      )}
    </div>
  );
}
