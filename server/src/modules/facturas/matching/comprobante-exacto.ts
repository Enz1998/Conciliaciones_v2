import { NormalizedComprobante, ComprobanteMatchResult, FacturasMatchStrategy } from '../../../shared/types';
import { diferencia } from './tolerancia';

/**
 * Paso 1 — Match exacto por comprobante (ver plan_modulo_facturas.md, Sección 3).
 * Clave: CUIT emisor + Letra + PuntoVenta + Número, idéntica en ambos lados.
 * Es una clave determinística gracias a la triangulación con el maestro de
 * proveedores (Decisión 2) — no requiere validar el nombre del proveedor.
 * Si el importe difiere más que la tolerancia, igual matchea pero queda con
 * `difference > 0` para que se revise en la UI.
 */
export class ComprobanteExactoStrategy implements FacturasMatchStrategy {
  readonly name = 'ComprobanteExacto';

  execute(afipComps: NormalizedComprobante[], erpComps: NormalizedComprobante[]): ComprobanteMatchResult[] {
    const results: ComprobanteMatchResult[] = [];

    // La numeración de AFIP es por PtoVta + tipo de comprobante: una Factura C
    // y una Nota de Crédito C del mismo punto de venta pueden compartir
    // número sin ser el mismo comprobante, así que el tipo va en la clave.
    const claveDe = (c: NormalizedComprobante) => `${c.cuitEmisor}|${c.tipoComprobante}|${c.letra}|${c.puntoVenta}|${c.numero}`;

    const afipPorClave = new Map<string, NormalizedComprobante>();
    for (const a of afipComps) {
      if (a.match_type !== 'UNMATCHED' || !a.cuitEmisor) continue;
      afipPorClave.set(claveDe(a), a);
    }

    for (const e of erpComps) {
      if (e.match_type !== 'UNMATCHED' || !e.cuitEmisor) continue;

      const afip = afipPorClave.get(claveDe(e));
      if (!afip || afip.match_type !== 'UNMATCHED') continue;
      // Misma clave debería implicar mismo tipo de comprobante; se valida por seguridad.
      if (afip.tipoComprobante !== e.tipoComprobante) continue;

      results.push({
        id: crypto.randomUUID(),
        afip_id: afip.id,
        erp_id: e.id,
        match_type: 'AUTO',
        confidence: 1.0,
        difference: diferencia(afip.importeTotalLocal, e.importeTotalLocal),
      });

      afipPorClave.delete(claveDe(e));
    }

    return results;
  }
}
