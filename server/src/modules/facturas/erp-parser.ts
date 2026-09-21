import * as XLSX from 'xlsx';
import { v4 as uuid } from 'uuid';
import { RawERPFactura, NormalizedComprobante, ComprobanteParseResult } from '../../shared/types';
import { normalizarContraparte, parseFechaISO, parseFechaDMY } from '../../shared/utils';
import { categorizarTipoErp, parseComprobanteErp, signoPorTipo } from './utils';
import { ProveedorLookup } from './proveedores-parser';

const REQUIRED_HEADERS = ['Fecha', 'Tipo', 'Comprobante', 'Proveedor', 'Total'];

export class ErpFacturasParser {
  readonly fuenteName = 'Libro de Facturas (ERP)';

  /**
   * Parsea el libro de facturas del ERP (mismo formato que "Factura.xlsx" /
   * "Factura copia.xlsx": Fecha, F. Fiscal, Tipo, Comprobante, Proveedor,
   * Moneda, Importe Bruto, Impuestos, Total, Observaciones, Provincia,
   * Cotización, Total Mon. Principal, cbuinformada).
   */
  parseXLSX(buffer: any): RawERPFactura[] {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = (rows[i] || []).map((c: any) => String(c || '').trim());
      if (REQUIRED_HEADERS.every((h) => row.includes(h))) {
        headerRowIdx = i;
        break;
      }
    }
    if (headerRowIdx === -1) {
      throw new Error('El archivo no parece ser un libro de facturas válido del ERP. Verificá que tenga las columnas Fecha, Tipo, Comprobante, Proveedor y Total.');
    }

    const headers: string[] = rows[headerRowIdx].map((h: any) => String(h || '').trim());
    const idx = (name: string) => headers.indexOf(name);

    const iFecha = idx('Fecha');
    const iFFiscal = idx('F. Fiscal');
    const iTipo = idx('Tipo');
    const iComprobante = idx('Comprobante');
    const iProveedor = idx('Proveedor');
    const iMoneda = idx('Moneda');
    const iImporteBruto = idx('Importe Bruto');
    const iImpuestos = idx('Impuestos');
    const iTotal = idx('Total');
    const iObservaciones = idx('Observaciones');
    const iProvincia = idx('Provincia');
    const iCotizacion = idx('Cotización');
    const iTotalMonPrincipal = idx('Total Mon. Principal');
    const iCbu = idx('cbuinformada');

    const result: RawERPFactura[] = [];

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((c: any) => c === null || c === undefined || c === '')) continue;
      if (row[iComprobante] === null || row[iComprobante] === undefined || String(row[iComprobante]).trim() === '') continue;

      result.push({
        Fecha: row[iFecha],
        FFiscal: iFFiscal >= 0 ? row[iFFiscal] : row[iFecha],
        Tipo: String(row[iTipo] || '').trim(),
        Comprobante: String(row[iComprobante] || '').trim(),
        Proveedor: String(row[iProveedor] || '').trim(),
        Moneda: String(row[iMoneda] || '').trim(),
        ImporteBruto: Number(row[iImporteBruto]) || 0,
        Impuestos: Number(row[iImpuestos]) || 0,
        Total: Number(row[iTotal]) || 0,
        Observaciones: String(row[iObservaciones] || '').trim(),
        Provincia: String(row[iProvincia] || '').trim(),
        Cotizacion: Number(row[iCotizacion]) || 1,
        TotalMonPrincipal: Number(row[iTotalMonPrincipal]) || 0,
        cbuinformada: String(row[iCbu] ?? ''),
      });
    }

    return result;
  }

  /**
   * Normaliza las facturas crudas del ERP. Filtra las que están fuera de
   * alcance (Recibo, Extracto Bancario, Otros Comprobantes — Decisión 4) y
   * resuelve el CUIT del proveedor por triangulación con el maestro
   * (Decisión 2 del plan): primero por nombre exacto, luego por nombre
   * normalizado como respaldo.
   */
  normalize(raw: RawERPFactura[], proveedores: ProveedorLookup): ComprobanteParseResult<NormalizedComprobante> {
    const comprobantes: NormalizedComprobante[] = [];
    let omitidos = 0;

    for (const r of raw) {
      const tipoComprobante = categorizarTipoErp(r.Tipo);
      if (!tipoComprobante) { omitidos++; continue; }

      const clave = parseComprobanteErp(r.Comprobante);
      if (!clave) { omitidos++; continue; }

      const fecha = r.Fecha instanceof Date
        ? parseFechaISO(r.Fecha)
        : parseFechaDMY(String(r.Fecha));

      const emisorNormalizado = normalizarContraparte(r.Proveedor);
      const cuitEmisor =
        proveedores.porNombreExacto.get(r.Proveedor.trim()) ??
        proveedores.porNombreNormalizado.get(emisorNormalizado) ??
        null;

      const cotizacion = r.Cotizacion && r.Cotizacion > 0 ? r.Cotizacion : 1;
      const signo = signoPorTipo(tipoComprobante);
      const importeTotal = Math.abs(r.Total) * signo;
      const importeTotalLocal = Math.abs(r.TotalMonPrincipal || r.Total) * signo;

      comprobantes.push({
        id: uuid(),
        source: 'ERP',
        tipoComprobante,
        letra: clave.letra,
        puntoVenta: clave.puntoVenta,
        numero: clave.numero,
        fecha,
        cuitEmisor,
        emisor: r.Proveedor,
        emisor_normalizado: emisorNormalizado,
        moneda: r.Moneda,
        cotizacion,
        importeTotal,
        importeTotalLocal,
        metadata: {
          fFiscal: r.FFiscal,
          comprobanteOriginal: r.Comprobante,
          importeBruto: r.ImporteBruto,
          impuestos: r.Impuestos,
          observaciones: r.Observaciones,
          provincia: r.Provincia,
          cbuinformada: r.cbuinformada,
        },
        match_group_id: null,
        match_type: 'UNMATCHED',
      });
    }

    return { comprobantes, omitidos };
  }
}
