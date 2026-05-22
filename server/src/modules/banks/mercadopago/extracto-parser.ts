import * as XLSX from 'xlsx';
import { BankParser, RawMPExtractoMovement, NormalizedMovement, BankMetadata, MatchStrategy, ParseResult } from '../../../shared/types';
import { parseFechaISO, clasificarMovimientoMP, normalizarContraparte } from '../../../shared/utils';
import { v4 as uuid } from 'uuid';
import { ExactMatchStrategy } from '../../matching/strategies/exact-match';
import { GroupedMatchStrategy } from '../../matching/strategies/grouped-match';
import { MPTaxAssociationStrategy } from '../../matching/strategies/mp-tax-association';
import { MPRendimientoStrategy } from '../../matching/strategies/mp-rendimiento';

export class MercadoPagoExtractoParser implements BankParser {
  readonly bankName = 'MercadoPago';
  readonly metadata: BankMetadata = {
    value: 'mercadopago',
    label: 'MercadoPago',
    icon: '💳',
    extractoLabel: 'Extracto MercadoPago (.xlsx)',
    mayorLabel: 'Libro Mayor ERP (.xlsx)',
    acceptFormats: '.xlsx'
  };

  getMatchingPipeline(): MatchStrategy[] {
    return [
      new ExactMatchStrategy(),
      new MPTaxAssociationStrategy(),
      new MPRendimientoStrategy(),
      new GroupedMatchStrategy(),
    ];
  }

  /**
   * Parsea el XLSX del extracto de MercadoPago.
   * Columnas: Fecha de Pago | Tipo de Operación | Número de Movimiento | Operación Relacionada | Importe
   */
  parseXLSX(buffer: any): ParseResult<RawMPExtractoMovement> {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convertir a array de arrays (AOA) para control total del parsing
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    if (rows.length < 2) return { movimientos: [] };

    // Validación estructural
    const headers = rows[0] || [];
    const headerString = headers.join(' ').toLowerCase();
    if (!headerString.includes('tipo de operación') || !headerString.includes('operación relacionada') || !headerString.includes('importe')) {
      throw new Error('El archivo no parece ser un extracto válido de MercadoPago. Verificá que tenga el formato correcto.');
    }

    const result: RawMPExtractoMovement[] = [];

    // Fila 0 es el header, empezamos desde fila 1
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      // Saltar filas vacías
      if (!row || row.every((c) => c === null || c === undefined || c === '')) continue;

      const fechaRaw = row[0];
      const tipoOperacion = String(row[1] || '').trim();
      const numeroMovimiento = String(row[2] || '').trim();
      const operacionRelacionada = String(row[3] || '').trim();
      const importeRaw = row[4];

      if (!tipoOperacion || importeRaw === null || importeRaw === undefined) continue;

      result.push({
        fechaPago: fechaRaw,
        tipoOperacion,
        numeroMovimiento,
        operacionRelacionada,
        importe: typeof importeRaw === 'number' ? importeRaw : parseFloat(String(importeRaw)) || 0,
      });
    }

    return { movimientos: result };
  }

  /**
   * Normaliza los movimientos crudos de MP al formato NormalizedMovement común.
   */
  normalize(raw: RawMPExtractoMovement[]): NormalizedMovement[] {
    return raw.map((r) => {
      const importe = r.importe;
      const isCredito = importe >= 0;
      const monto = Math.abs(importe);
      const tipo = isCredito ? 'CREDITO' : 'DEBITO';
      const categoria = clasificarMovimientoMP(r.tipoOperacion);
      const fecha = parseFechaISO(r.fechaPago as any);

      return {
        id: uuid(),
        source: 'EXTRACTO',
        fecha,
        descripcion: r.tipoOperacion,
        referencia: r.numeroMovimiento,
        contraparte: '',  // MP no provee nombre del cliente en el extracto
        contraparte_normalizada: '',
        tipo,
        monto,
        categoria,
        metadata: {
          tipoOperacion: r.tipoOperacion,
          numeroMovimiento: r.numeroMovimiento,
          operacionRelacionada: r.operacionRelacionada,
          banco: 'mercadopago',
        },
        match_group_id: null,
        match_type: 'UNMATCHED',
      };
    });
  }

  /**
   * parseCSV no aplica a MercadoPago (usa XLSX), pero se implementa
   * para cumplir con compatibilidad hacia atrás si el engine lo llama.
   */
  parseCSV(_content: string): ParseResult<RawMPExtractoMovement> {
    return { movimientos: [] };
  }
}
