import { NormalizedMovement, MatchResult } from '../../../shared/types';
import { MatchStrategy } from './exact-match';

/**
 * Estrategia: Asociación de Impuestos y Comisiones de MercadoPago (TAX_CHILD)
 *
 * En el extracto de MercadoPago, cada cobro genera un grupo de movimientos
 * vinculados por el campo `Operación Relacionada` en metadata:
 *
 *   Cobro                      +47,066.04  → padre (COBRANZA)
 *   Costo de Mercado Pago       -1,821.46  → hijo (COMISION)
 *   Imp. Créditos y Débitos       -282.40  → hijo (IMPUESTO)
 *   Retención IIBB SIRTAC          -188.26 → hijo (IMPUESTO)
 *   Retención IIBB CABA          -1,176.65 → hijo (IMPUESTO)
 *
 * Esta estrategia usa el vínculo explícito por `operacionRelacionada`
 * para marcar los hijos como TAX_CHILD de su padre. Es más precisa que
 * la estrategia de Galicia que infiere la relación por fecha y porcentaje.
 */
export class MPTaxAssociationStrategy implements MatchStrategy {
  readonly name = 'MPTaxAssociation';

  execute(
    extractoMovs: NormalizedMovement[],
    _mayorMovs: NormalizedMovement[]
  ): MatchResult[] {
    const results: MatchResult[] = [];

    // Solo aplica a movimientos del extracto MP (los que tienen operacionRelacionada)
    const mpMovs = extractoMovs.filter(
      (m) => m.source === 'EXTRACTO' && m.metadata?.banco === 'mercadopago'
    );

    if (mpMovs.length === 0) return results;

    // Agrupar movimientos por operacionRelacionada
    const groups = new Map<string, NormalizedMovement[]>();
    for (const mov of mpMovs) {
      const opRel = String(mov.metadata?.operacionRelacionada || '');
      if (!opRel) continue;
      if (!groups.has(opRel)) groups.set(opRel, []);
      groups.get(opRel)!.push(mov);
    }

    const usedIds = new Set<string>();

    for (const [, group] of groups) {
      // Identificar el padre del grupo: movimiento de COBRANZA o MOV_FONDOS positivo
      const padres = group.filter(
        (m) =>
          m.tipo === 'CREDITO' &&
          (m.categoria === 'COBRANZA' || m.categoria === 'MOV_FONDOS' || m.categoria === 'PAGO') &&
          m.match_type === 'UNMATCHED' &&
          !usedIds.has(m.id)
      );

      // Los hijos son comisiones e impuestos del mismo grupo
      const hijos = group.filter(
        (m) =>
          m.tipo === 'DEBITO' &&
          (m.categoria === 'IMPUESTO' || m.categoria === 'COMISION') &&
          m.match_type === 'UNMATCHED' &&
          !usedIds.has(m.id)
      );

      if (padres.length === 0 || hijos.length === 0) continue;

      // Tomamos el padre con mayor monto (el cobro principal)
      const padre = padres.reduce((a, b) => (a.monto >= b.monto ? a : b));

      for (const hijo of hijos) {
        if (usedIds.has(hijo.id)) continue;

        usedIds.add(hijo.id);
        results.push({
          id: crypto.randomUUID(),
          extracto_id: hijo.id,
          mayor_id: null,
          match_type: 'TAX_CHILD',
          confidence: 1.0,
          difference: 0,
          group_members: [padre.id, hijo.id],
        });
      }
    }

    return results;
  }
}
