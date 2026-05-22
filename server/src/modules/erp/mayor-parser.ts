import { ERPParser, RawMayorMovement, NormalizedMovement } from '../../shared/types';
import { parseMontoERP, parseFechaDMYGuion, normalizarContraparte, clasificarMovimiento, determinarTipo } from '../../shared/utils';
import { v4 as uuid } from 'uuid';

export class MayorParser implements ERPParser {
  readonly erpName = 'Libro Mayor';

  /**
   * Parsea el CSV del Libro Mayor.
   * Delimitador: ; | Columnas: FECHA;DOCUMENTO;ORGANIZACION;...;DEBEMONPRINCIPAL;HABERMONPRINCIPAL;SALDOMONPRINCIPAL
   */
  parseCSV(content: string): RawMayorMovement[] {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    const result: RawMayorMovement[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseLine(lines[i]);
      if (values.length < 9) continue;

      // Saltar el saldo inicial
      if (values[1] === 'Saldo Inicial') continue;

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

    return result;
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
