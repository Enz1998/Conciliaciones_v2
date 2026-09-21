import * as XLSX from 'xlsx';
import { ERPParser, RawMayorMovement, NormalizedMovement, ParseResult } from '../../shared/types';
import { parseMontoERP, parseFechaDMYGuion, normalizarContraparte, clasificarMovimiento, determinarTipo } from '../../shared/utils';
import { v4 as uuid } from 'uuid';

export class MayorParser implements ERPParser {
  readonly erpName = 'Libro Mayor';

  /**
   * Parsea el XLSX del Libro Mayor (para MercadoPago y futuros bancos con Mayor en Excel).
   * Las columnas son las mismas que el CSV: Fecha | Documento | Cuenta | Debe | Haber | Saldo | Descripción | Organización | Centro de Costos
   */
  parseXLSX(buffer: any): ParseResult<RawMayorMovement> {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    if (rows.length < 2) return { movimientos: [] };

    // Validación estructural
    const headers = rows[0] || [];
    const headerString = headers.join(' ').toLowerCase();
    if (!headerString.includes('documento') || !headerString.includes('cuenta') || !headerString.includes('debe')) {
      throw new Error('El archivo no parece ser un Libro Mayor válido. Verificá que tenga el formato correcto.');
    }

    const result: RawMayorMovement[] = [];
    let saldoInicial: number | undefined;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((c: any) => c === null || c === undefined || c === '')) continue;

      const fechaRaw = row[0];
      const documento = String(row[1] || '').trim();
      const saldoRaw = row[5];

      // Extraer saldo inicial y saltar
      if (documento === 'Saldo Inicial') {
        if (saldoRaw !== null && saldoRaw !== undefined) {
          saldoInicial = typeof saldoRaw === 'number' ? saldoRaw : parseMontoERP(String(saldoRaw));
        }
        continue;
      }
      if (documento === '') continue;

      // La fecha puede venir como Date object desde XLSX
      let fechaStr: string;
      if (fechaRaw instanceof Date) {
        const y = fechaRaw.getFullYear();
        const m = String(fechaRaw.getMonth() + 1).padStart(2, '0');
        const d = String(fechaRaw.getDate()).padStart(2, '0');
        fechaStr = `${d}-${m}-${y}`; // formato DD-MM-YYYY que parseFechaDMYGuion espera
      } else {
        fechaStr = String(fechaRaw || '').trim();
      }

      // Montos vienen como number en XLSX
      const debeRaw = row[3];
      const haberRaw = row[4];

      result.push({
        FECHA: fechaStr,
        DOCUMENTO: documento,
        ORGANIZACION: String(row[7] || '').trim(),
        CENTRODECOSTO: String(row[8] || '').trim(),
        CUENTA: String(row[2] || '').trim(),
        DESCRIPCION: String(row[6] || '').trim(),
        DEBEMONPRINCIPAL: debeRaw !== null && debeRaw !== undefined ? String(debeRaw) : '',
        HABERMONPRINCIPAL: haberRaw !== null && haberRaw !== undefined ? String(haberRaw) : '',
        SALDOMONPRINCIPAL: saldoRaw !== null && saldoRaw !== undefined ? String(saldoRaw) : '',
      });
    }

    let saldoFinal: number | undefined;
    if (result.length > 0) {
      const last = result[result.length - 1];
      if (last.SALDOMONPRINCIPAL) {
        saldoFinal = parseMontoERP(last.SALDOMONPRINCIPAL);
      }
    }

    return { movimientos: result, saldoInicial, saldoFinal };
  }

  /**
   * Parsea el CSV del Libro Mayor.
   * Delimitador: ; | Columnas: FECHA;DOCUMENTO;ORGANIZACION;...;DEBEMONPRINCIPAL;HABERMONPRINCIPAL;SALDOMONPRINCIPAL
   */
  async parseCSV(stream: import('stream').Readable, encoding: BufferEncoding): Promise<ParseResult<RawMayorMovement>> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity
    });

    const result: RawMayorMovement[] = [];
    let saldoInicial: number | undefined;
    let headerFound = false;

    for await (const line of rl) {
      const cleanLine = line.replace(/^\uFEFF/, '').replace(/\r/g, '');
      if (cleanLine.trim() === '') continue;

      if (!headerFound) {
        const headers = cleanLine.toLowerCase();
        if (headers.includes('documento') && headers.includes('organizacion') && (headers.includes('debemonprincipal') || headers.includes('debe'))) {
          headerFound = true;
        }
        continue;
      }

      const values = this.parseLine(cleanLine);
      if (values.length < 9) continue;

      if (values[1] === 'Saldo Inicial') {
        if (values[8]) saldoInicial = parseMontoERP(values[8]);
        continue;
      }

      result.push({
        FECHA: values[0] || '',
        DOCUMENTO: values[1] || '',
        ORGANIZACION: values[2] || '',
        CENTRODECOSTO: values[3] || '',
        CUENTA: values[4] || '',
        DESCRIPCION: values[5] || '',
        DEBEMONPRINCIPAL: values[6] || '',
        HABERMONPRINCIPAL: values[7] || '',
        SALDOMONPRINCIPAL: values[8] || '',
      });
    }

    if (!headerFound) {
      throw new Error('El archivo no parece ser un Libro Mayor válido en formato CSV.');
    }

    let saldoFinal: number | undefined;
    if (result.length > 0) {
      const last = result[result.length - 1];
      if (last.SALDOMONPRINCIPAL) {
        saldoFinal = parseMontoERP(last.SALDOMONPRINCIPAL);
      }
    }

    return { movimientos: result, saldoInicial, saldoFinal };
  }

  /**
   * Normaliza los movimientos crudos del ERP.
   */
  normalize(raw: RawMayorMovement[]): NormalizedMovement[] {
    return raw.map((r) => {
      const isDebito = !!(r.DEBEMONPRINCIPAL && r.DEBEMONPRINCIPAL.trim() !== '');
      const isCredito = !!(r.HABERMONPRINCIPAL && r.HABERMONPRINCIPAL.trim() !== '');
      const montoRaw: string = isDebito ? r.DEBEMONPRINCIPAL : r.HABERMONPRINCIPAL;
      const monto = parseMontoERP(montoRaw);
      // Invertir: en contabilidad, Débito en cuenta activo = dinero ENTRA = CREDITO bancario
      //           Crédito en cuenta activo = dinero SALE = DEBITO bancario
      const tipo = determinarTipo(isCredito, isDebito);

      return {
        id: uuid(),
        source: 'MAYOR',
        fecha: parseFechaDMYGuion(r.FECHA),
        descripcion: r.DESCRIPCION || r.DOCUMENTO,
        referencia: r.DOCUMENTO,
        contraparte: r.ORGANIZACION,
        contraparte_normalizada: normalizarContraparte(r.ORGANIZACION),
        tipo,
        monto,
        categoria: clasificarMovimiento(r.DESCRIPCION),
        metadata: {
          documento: r.DOCUMENTO,
          cuenta: r.CUENTA,
          centroDeCosto: r.CENTRODECOSTO,
          descripcionOriginal: r.DESCRIPCION,
        },
        match_group_id: null,
        match_type: 'UNMATCHED',
      };
    });
  }

  private parseLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ';' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }
}
