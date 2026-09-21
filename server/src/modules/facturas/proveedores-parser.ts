import * as XLSX from 'xlsx';
import { v4 as uuid } from 'uuid';
import { RawProveedorERP, NormalizedProveedor } from '../../shared/types';
import { normalizarContraparte } from '../../shared/utils';
import { limpiarCuit } from './utils';

const REQUIRED_HEADERS = ['Nombre', 'Tipo de Identificación', 'Número de Identificación'];

/** Índices en memoria para resolver el CUIT de un proveedor por nombre (Decisión 2 del plan). */
export interface ProveedorLookup {
  porNombreExacto: Map<string, string>;
  porNombreNormalizado: Map<string, string>;
}

export class ProveedoresParser {
  readonly fuenteName = 'Maestro de Proveedores (ERP)';

  /**
   * Parsea el maestro de proveedores del ERP ("Capasitio SAS - Proveedores.xlsx").
   * Se usa para triangular el CUIT de cada factura del ERP contra AFIP,
   * dado que el libro de facturas no trae CUIT, solo razón social.
   */
  parseXLSX(buffer: any): RawProveedorERP[] {
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
      throw new Error('El archivo no parece ser un maestro de proveedores válido del ERP. Verificá que tenga las columnas Nombre, Tipo de Identificación y Número de Identificación.');
    }

    const headers: string[] = rows[headerRowIdx].map((h: any) => String(h || '').trim());
    const idx = (name: string) => headers.indexOf(name);

    const iNombre = idx('Nombre');
    const iCodigo = idx('Codigo');
    const iCondicionIva = idx('Condición IVA');
    const iTipoId = idx('Tipo de Identificación');
    const iNroId = idx('Número de Identificación');
    const iProvincia = idx('Provincia');
    const iActivo = idx('Activo');

    const result: RawProveedorERP[] = [];

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((c: any) => c === null || c === undefined || c === '')) continue;
      const nombre = String(row[iNombre] || '').trim();
      if (!nombre) continue;

      const activoRaw = String(row[iActivo] ?? '').trim().toLowerCase();
      const activo = activoRaw === '1' || activoRaw === 'si' || activoRaw === 'sí' || activoRaw === 'true';

      result.push({
        Nombre: nombre,
        Codigo: String(row[iCodigo] ?? ''),
        CondicionIVA: String(row[iCondicionIva] || '').trim(),
        TipoIdentificacion: String(row[iTipoId] || '').trim(),
        NumeroIdentificacion: String(row[iNroId] ?? ''),
        Provincia: String(row[iProvincia] || '').trim(),
        Activo: activo,
      });
    }

    return result;
  }

  /** Normaliza el maestro, descartando proveedores sin un número de identificación utilizable. */
  normalize(raw: RawProveedorERP[]): NormalizedProveedor[] {
    const result: NormalizedProveedor[] = [];
    for (const r of raw) {
      const cuit = limpiarCuit(r.NumeroIdentificacion);
      if (!cuit) continue;
      result.push({
        id: uuid(),
        nombre: r.Nombre,
        nombre_normalizado: normalizarContraparte(r.Nombre),
        cuit,
        condicion_iva: r.CondicionIVA,
        activo: r.Activo,
      });
    }
    return result;
  }
}

/** Construye los índices de búsqueda proveedor→CUIT usados al normalizar facturas del ERP. */
export function buildProveedorLookup(proveedores: NormalizedProveedor[]): ProveedorLookup {
  const porNombreExacto = new Map<string, string>();
  const porNombreNormalizado = new Map<string, string>();
  for (const p of proveedores) {
    if (!porNombreExacto.has(p.nombre)) porNombreExacto.set(p.nombre, p.cuit);
    if (!porNombreNormalizado.has(p.nombre_normalizado)) porNombreNormalizado.set(p.nombre_normalizado, p.cuit);
  }
  return { porNombreExacto, porNombreNormalizado };
}
