import { NormalizedComprobante, ComprobanteMatchResult, FacturasMatchStrategy } from '../../../shared/types';
import { dentroDeTolerancia, diferencia } from './tolerancia';

const DIAS_TOLERANCIA_FECHA = 15;

/**
 * Paso 2 — Match por proveedor + importe + fecha cercana (ver plan, Sección 3).
 * Cubre los casos que no matchearon por clave exacta: número de comprobante
 * mal tipeado en el ERP, o proveedor sin CUIT resuelto (no está en el
 * maestro todavía) — en ese caso se identifica por nombre normalizado.
 */
export class ProveedorImporteStrategy implements FacturasMatchStrategy {
  readonly name = 'ProveedorImporte';

  execute(afipComps: NormalizedComprobante[], erpComps: NormalizedComprobante[]): ComprobanteMatchResult[] {
    const results: ComprobanteMatchResult[] = [];
    const usedAfip = new Set<string>();

    const identidad = (c: NormalizedComprobante) => c.cuitEmisor || c.emisor_normalizado;

    for (const e of erpComps) {
      if (e.match_type !== 'UNMATCHED') continue;

      let mejor: NormalizedComprobante | null = null;
      let mejorDiff = Infinity;

      for (const a of afipComps) {
        if (a.match_type !== 'UNMATCHED' || usedAfip.has(a.id)) continue;
        if (a.tipoComprobante !== e.tipoComprobante) continue;
        if (identidad(a) !== identidad(e)) continue;
        if (!dentroDeTolerancia(a.importeTotalLocal, e.importeTotalLocal)) continue;
        if (this.diasEntre(a.fecha, e.fecha) > DIAS_TOLERANCIA_FECHA) continue;

        const diff = diferencia(a.importeTotalLocal, e.importeTotalLocal);
        if (diff < mejorDiff) { mejor = a; mejorDiff = diff; }
      }

      if (mejor) {
        results.push({
          id: crypto.randomUUID(),
          afip_id: mejor.id,
          erp_id: e.id,
          match_type: 'AUTO',
          confidence: 0.7,
          difference: mejorDiff,
        });
        usedAfip.add(mejor.id);
      }
    }

    return results;
  }

  private diasEntre(f1: string, f2: string): number {
    const d1 = new Date(f1);
    const d2 = new Date(f2);
    return Math.abs((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  }
}
