import { BankParser, RawExtractoMovement, NormalizedMovement } from '../../../shared/types';
import { parseMontoArg, parseFechaDMY, normalizarContraparte, clasificarMovimiento, determinarTipo } from '../../../shared/utils';
import { v4 as uuid } from 'uuid';

export class GaliciaExtractoParser implements BankParser {
  readonly bankName = 'Galicia';

  /**
   * Parsea el CSV del extracto del Galicia.
   * Delimitador: ; | Columnas: Fecha;Descripción;Origen;Débitos;Créditos;...
   */
  parseCSV(content: string): RawExtractoMovement[] {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = this.parseLine(lines[0]);
    const result: RawExtractoMovement[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseLine(lines[i]);
      if (values.length < 12) continue;

      result.push({
        Fecha: values[0] || '',
        Descripcion: values[1] || '',
        Origen: values[2] || '',
        Debitos: values[3] || '',
        Creditos: values[4] || '',
        GrupoConceptos: values[5] || '',
        Concepto: values[6] || '',
        NumeroTerminal: values[7] || '',
        ObservacionesCliente: values[8] || '',
        NumeroComprobante: values[9] || '',
        LeyendaAdicional1: values[10] || '',
        LeyendaAdicional2: values[11] || '',
        LeyendaAdicional3: values[12] || '',
        LeyendaAdicional4: values[13] || '',
        TipoMovimiento: values[14] || '',
        Saldo: values[15] || '',
      });
    }

    return result;
  }

  /**
   * Normaliza los movimientos crudos a la estructura común.
   */
  normalize(raw: RawExtractoMovement[]): NormalizedMovement[] {
    return raw.map((r) => {
      const isDebito = !!(r.Debitos && r.Debitos.trim() !== '');
      const isCredito = !!(r.Creditos && r.Creditos.trim() !== '');
      const montoRaw: string = isDebito ? r.Debitos : r.Creditos;
      const monto = parseMontoArg(montoRaw);
      const tipo = determinarTipo(isDebito, isCredito);

      // Contraparte: ObservacionesCliente o LeyendaAdicional1 (el campo más relevante)
      const contraparte = (r.ObservacionesCliente && r.ObservacionesCliente !== '0'
        ? r.ObservacionesCliente
        : r.LeyendaAdicional1) || '';

      return {
        id: uuid(),
        source: 'EXTRACTO',
        fecha: parseFechaDMY(r.Fecha),
        descripcion: r.Descripcion,
        referencia: r.NumeroComprobante || r.NumeroTerminal || '',
        contraparte: contraparte,
        contraparte_normalizada: normalizarContraparte(contraparte),
        tipo,
        monto,
        categoria: clasificarMovimiento(r.Descripcion, r.GrupoConceptos),
        metadata: {
          origen: r.Origen,
          grupoConceptos: r.GrupoConceptos,
          concepto: r.Concepto,
          numeroTerminal: r.NumeroTerminal,
          leyendaAdicional1: r.LeyendaAdicional1,
          leyendaAdicional2: r.LeyendaAdicional2,
          leyendaAdicional3: r.LeyendaAdicional3,
          leyendaAdicional4: r.LeyendaAdicional4,
          tipoMovimiento: r.TipoMovimiento,
        },
        match_group_id: null,
        match_type: 'UNMATCHED',
      };
    });
  }

  /**
   * Parsea una línea CSV con delimitador ; respetando comillas (rara vez en este formato).
   */
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
