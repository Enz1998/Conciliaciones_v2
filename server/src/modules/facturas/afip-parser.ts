import * as XLSX from 'xlsx';
import { v4 as uuid } from 'uuid';
import { RawAfipComprobante, NormalizedComprobante, ComprobanteParseResult } from '../../shared/types';
import { normalizarContraparte, parseFechaISO, parseFechaDMY } from '../../shared/utils';
import { categorizarTipoAfip, parseTipoAfip, signoPorTipo, limpiarCuit } from './utils';

// Columnas "core" que se tipan explícitamente. El resto (desglose de IVA por
// alícuota, F. Fiscal, etc.) se preserva íntegro en `metadata` sin perderse,
// pero no se muestra por default en la UI (ver plan_modulo_facturas.md, Sección 5).
const CORE_HEADERS = new Set([
  'Fecha', 'Tipo', 'Punto de Venta', 'Número Desde', 'Número Hasta',
  'Cód. Autorización', 'Tipo Doc. Emisor', 'Nro. Doc. Emisor', 'Denominación Emisor',
  'Tipo Doc. Receptor', 'Nro. Doc. Receptor', 'Tipo Cambio', 'Moneda', 'Imp. Total',
]);

export class AfipComprobantesParser {
  readonly fuenteName = 'Mis Comprobantes Recibidos (AFIP)';

  /**
   * Parsea el XLSX de "Mis Comprobantes Recibidos" de AFIP.
   * La fila 1 es un título (no headers) — se detecta dinámicamente la fila
   * que contiene los headers reales buscando "Fecha" + "Punto de Venta".
   */
  parseXLSX(buffer: any): RawAfipComprobante[] {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = rows[i] || [];
      if (row.includes('Fecha') && row.includes('Punto de Venta')) {
        headerRowIdx = i;
        break;
      }
    }
    if (headerRowIdx === -1) {
      throw new Error('El archivo no parece ser un export válido de "Mis Comprobantes Recibidos" de AFIP.');
    }

    const headers: string[] = rows[headerRowIdx].map((h: any) => String(h || '').trim());
    const idx = (name: string) => headers.indexOf(name);

    const iFecha = idx('Fecha');
    const iTipo = idx('Tipo');
    const iPtoVta = idx('Punto de Venta');
    const iNumDesde = idx('Número Desde');
    const iNumHasta = idx('Número Hasta');
    const iCodAut = idx('Cód. Autorización');
    const iTipoDocEmisor = idx('Tipo Doc. Emisor');
    const iNroDocEmisor = idx('Nro. Doc. Emisor');
    const iDenomEmisor = idx('Denominación Emisor');
    const iTipoDocReceptor = idx('Tipo Doc. Receptor');
    const iNroDocReceptor = idx('Nro. Doc. Receptor');
    const iTipoCambio = idx('Tipo Cambio');
    const iMoneda = idx('Moneda');
    const iImpTotal = idx('Imp. Total');

    const result: RawAfipComprobante[] = [];

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((c: any) => c === null || c === undefined || c === '')) continue;
      if (row[iTipo] === null || row[iTipo] === undefined || String(row[iTipo]).trim() === '') continue;

      const extra: Record<string, unknown> = {};
      headers.forEach((h, colIdx) => {
        if (h && !CORE_HEADERS.has(h)) extra[h] = row[colIdx];
      });

      result.push({
        Fecha: row[iFecha],
        Tipo: String(row[iTipo] || '').trim(),
        PuntoDeVenta: Number(row[iPtoVta]) || 0,
        NumeroDesde: Number(row[iNumDesde]) || 0,
        NumeroHasta: Number(row[iNumHasta]) || 0,
        CodAutorizacion: String(row[iCodAut] ?? ''),
        TipoDocEmisor: String(row[iTipoDocEmisor] || '').trim(),
        NroDocEmisor: String(row[iNroDocEmisor] ?? ''),
        DenominacionEmisor: String(row[iDenomEmisor] || '').trim(),
        TipoDocReceptor: String(row[iTipoDocReceptor] || '').trim(),
        NroDocReceptor: String(row[iNroDocReceptor] ?? ''),
        TipoCambio: Number(row[iTipoCambio]) || 1,
        Moneda: String(row[iMoneda] || '$').trim(),
        ImpTotal: Number(row[iImpTotal]) || 0,
        ...extra,
      });
    }

    return result;
  }

  /**
   * Normaliza los comprobantes crudos de AFIP. Filtra los que están fuera de
   * alcance (Recibos, Tiques, Liquidaciones, etc. — Decisión 4 del plan) y
   * cuenta cuántos se omitieron para transparencia.
   */
  normalize(raw: RawAfipComprobante[]): ComprobanteParseResult<NormalizedComprobante> {
    const comprobantes: NormalizedComprobante[] = [];
    let omitidos = 0;

    for (const r of raw) {
      const parsedTipo = parseTipoAfip(r.Tipo);
      if (!parsedTipo) { omitidos++; continue; }

      const tipoComprobante = categorizarTipoAfip(parsedTipo.codigo);
      if (!tipoComprobante) { omitidos++; continue; }

      const fecha = r.Fecha instanceof Date
        ? parseFechaISO(r.Fecha)
        : parseFechaDMY(String(r.Fecha));

      const cotizacion = r.TipoCambio && r.TipoCambio > 0 ? r.TipoCambio : 1;
      const signo = signoPorTipo(tipoComprobante);
      const importeTotal = Math.abs(r.ImpTotal) * signo;
      const importeTotalLocal = importeTotal * cotizacion;

      const { PuntoDeVenta, NumeroDesde, ...restoMetadata } = r;

      comprobantes.push({
        id: uuid(),
        source: 'AFIP',
        tipoComprobante,
        letra: parsedTipo.letra,
        puntoVenta: r.PuntoDeVenta,
        numero: r.NumeroDesde,
        fecha,
        cuitEmisor: limpiarCuit(r.NroDocEmisor),
        emisor: r.DenominacionEmisor,
        emisor_normalizado: normalizarContraparte(r.DenominacionEmisor),
        moneda: r.Moneda,
        cotizacion,
        importeTotal,
        importeTotalLocal,
        metadata: restoMetadata,
        match_group_id: null,
        match_type: 'UNMATCHED',
      });
    }

    return { comprobantes, omitidos };
  }
}
