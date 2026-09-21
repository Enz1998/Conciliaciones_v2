import * as XLSX from 'xlsx';
import { BankParser, RawMacroExtractoMovement, NormalizedMovement, BankMetadata, MatchStrategy, ParseResult } from '../../../shared/types';
import { parseFechaMacro, normalizarContraparte, clasificarMovimientoMacro, extraerContraparteMacro } from '../../../shared/utils';
import { v4 as uuid } from 'uuid';
import { ExactMatchStrategy } from '../../matching/strategies/exact-match';
import { TaxAssociationStrategy } from '../../matching/strategies/tax-association';
import { MonthEndMatchStrategy } from '../../matching/strategies/month-end-match';
import { GroupedMatchStrategy } from '../../matching/strategies/grouped-match';

/**
 * Parser para extractos bancarios del Banco Macro.
 *
 * Formato del archivo (.xls / .xlsx):
 * - Filas 0-6: Metadata (título, tipo de cuenta, número, moneda)
 * - Fila 7: Headers (Fecha, Nro. de Referencia, Causal, Concepto, Importe, Saldo)
 * - Filas 8+: Datos (hasta encontrar footer "Fecha de descarga:")
 * - Últimas 3 filas: Footer (fecha descarga, empresa, operador)
 *
 * Diferencias con Galicia:
 * - Una sola columna "Importe" con signo (+ crédito, - débito) en lugar de Débitos/Créditos separados
 * - Columnas no contiguas (hay columnas vacías intermedias: índices 1, 2, 7, 8, 9, 11)
 * - Contraparte embebida en el campo Concepto (no hay campo separado)
 */
export class MacroExtractoParser implements BankParser {
  readonly bankName = 'Macro';
  readonly metadata: BankMetadata = {
    value: 'macro',
    label: 'Banco Macro',
    icon: '🏛️',
    extractoLabel: 'Extracto Bancario (.xls / .xlsx)',
    mayorLabel: 'Libro Mayor ERP (.xlsx)',
    acceptFormats: '.xls,.xlsx,.XLS,.XLSX,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };

  // Fila donde comienzan los datos (0-indexed, después del header en fila 7)
  private static readonly DATA_START_ROW = 8;

  // Índices de columnas en el Excel (con columnas vacías intermedias)
  private static readonly COL = {
    FECHA: 0,
    REFERENCIA: 3,
    CAUSAL: 4,
    CONCEPTO: 5,
    IMPORTE: 6,
    SALDO: 10,
  } as const;

  getMatchingPipeline(): MatchStrategy[] {
    return [
      new ExactMatchStrategy(),
      new TaxAssociationStrategy(),
      new MonthEndMatchStrategy(),
      new GroupedMatchStrategy(),
    ];
  }

  parseXLSX(buffer: any): ParseResult<RawMacroExtractoMovement> {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // 1. Buscar la fila de headers dinámicamente
    let headerRowIndex = -1;
    let colIndices: Record<string, number> = {
      FECHA: MacroExtractoParser.COL.FECHA,
      REFERENCIA: MacroExtractoParser.COL.REFERENCIA,
      CAUSAL: MacroExtractoParser.COL.CAUSAL,
      CONCEPTO: MacroExtractoParser.COL.CONCEPTO,
      IMPORTE: MacroExtractoParser.COL.IMPORTE,
      SALDO: MacroExtractoParser.COL.SALDO,
    };

    for (let i = 0; i < Math.min(rows.length, 30); i++) {
      const row = rows[i] || [];
      const rowStrings = row.map(cell => String(cell || '').toLowerCase().trim());
      const headerString = rowStrings.join(' ');
      
      if (headerString.includes('fecha') && headerString.includes('concepto') && headerString.includes('importe')) {
        headerRowIndex = i;
        
        // Asignar índices dinámicamente
        const findCol = (keywords: string[]) => rowStrings.findIndex(s => keywords.some(k => s.includes(k)));

        const fIdx = findCol(['fecha']);
        const rIdx = findCol(['referencia', 'nro.']);
        const cIdx = findCol(['causal']);
        const coIdx = findCol(['concepto']);
        const iIdx = findCol(['importe', 'monto']);
        const sIdx = findCol(['saldo']);

        if (fIdx !== -1) colIndices.FECHA = fIdx;
        if (rIdx !== -1) colIndices.REFERENCIA = rIdx;
        if (cIdx !== -1) colIndices.CAUSAL = cIdx;
        if (coIdx !== -1) colIndices.CONCEPTO = coIdx;
        if (iIdx !== -1) colIndices.IMPORTE = iIdx;
        if (sIdx !== -1) colIndices.SALDO = sIdx;
        
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error(
        'El archivo no parece ser un extracto válido del Banco Macro. ' +
        'Verificá que tenga el formato correcto con columnas Fecha, Concepto e Importe.'
      );
    }

    const result: RawMacroExtractoMovement[] = [];
    let saldoInicial: number | undefined;
    let saldoFinal: number | undefined;

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      // Detectar filas de footer o texto irrelevante en la primera columna visible
      const firstCell = String(row[colIndices.FECHA] || row[0] || '').trim();
      if (/^(Fecha de descarga|Empresa|Operador|Totales)/i.test(firstCell)) {
        break;
      }

      // Validar que la fila tenga datos relevantes (fecha e importe)
      const fechaRaw = row[colIndices.FECHA];
      const importeRaw = row[colIndices.IMPORTE];
      if (fechaRaw === null || fechaRaw === undefined || fechaRaw === '' || 
          importeRaw === null || importeRaw === undefined || importeRaw === '') {
        continue;
      }

      const importeStr = String(importeRaw).replace(/\./g, '').replace(',', '.');
      const importe = typeof importeRaw === 'number' ? importeRaw : parseFloat(importeStr) || 0;
      
      const saldoRaw = row[colIndices.SALDO];
      const saldoStr = String(saldoRaw || '0').replace(/\./g, '').replace(',', '.');
      const saldo = typeof saldoRaw === 'number' ? saldoRaw : parseFloat(saldoStr) || 0;

      result.push({
        fecha: fechaRaw,
        referencia: String(row[colIndices.REFERENCIA] || '').trim(),
        causal: String(row[colIndices.CAUSAL] || '').trim(),
        concepto: String(row[colIndices.CONCEPTO] || '').trim(),
        importe,
        saldo,
      });
    }

    // Los datos vienen ordenados del más reciente al más antiguo
    // Saldo final = saldo de la primera fila de datos, saldo inicial = saldo de la última
    if (result.length > 0) {
      saldoFinal = result[0].saldo;
      saldoInicial = result[result.length - 1].saldo;
    }

    return { movimientos: result, saldoInicial, saldoFinal };
  }

  normalize(raw: RawMacroExtractoMovement[]): NormalizedMovement[] {
    return raw.map((r) => {
      const isCredito = r.importe >= 0;
      const monto = Math.abs(r.importe);
      const tipo = isCredito ? 'CREDITO' : 'DEBITO';

      const contraparte = extraerContraparteMacro(r.concepto);
      const categoria = clasificarMovimientoMacro(r.concepto, r.causal);

      // Parsear fecha: puede ser un Date object de Excel o un string "YY-MM-DD" / ISO
      const fecha = parseFechaMacro(r.fecha);

      return {
        id: uuid(),
        source: 'EXTRACTO' as const,
        fecha,
        descripcion: r.concepto,
        referencia: r.referencia,
        contraparte,
        contraparte_normalizada: normalizarContraparte(contraparte),
        tipo,
        monto,
        categoria,
        metadata: {
          causal: r.causal,
          referencia: r.referencia,
          conceptoOriginal: r.concepto,
          saldo: r.saldo,
          banco: 'macro',
        },
        match_group_id: null,
        match_type: 'UNMATCHED' as const,
      };
    });
  }

  // Macro no usa CSV, pero implementamos el método para cumplir la interfaz
  async parseCSV(_stream: import('stream').Readable, _encoding: BufferEncoding): Promise<ParseResult<RawMacroExtractoMovement>> {
    return { movimientos: [] };
  }
}
