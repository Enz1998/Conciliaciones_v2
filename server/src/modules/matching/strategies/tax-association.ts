import { NormalizedMovement, MatchResult } from '../../../shared/types';
import { MatchStrategy } from './exact-match';

/**
 * Estrategia: Asociación de Impuestos (TAX_CHILD)
 *
 * En el extracto del Galicia, cada crédito va seguido de 2 débitos:
 * - ING. BRUTOS S/ CRED — DT.301/03-TUCUMAN (~0.06%)
 * - ING. BRUTOS S/ CRED — REG.RECAU.SIRCREB (~1.8%)
 *
 * Esta estrategia asocia esos impuestos al crédito padre.
 */
export class TaxAssociationStrategy implements MatchStrategy {
  readonly name = 'TaxAssociation';

  execute(
    extractoMovs: NormalizedMovement[],
    _mayorMovs: NormalizedMovement[]
  ): MatchResult[] {
    const results: MatchResult[] = [];
    const creditos = extractoMovs.filter(
      (m) => m.tipo === 'CREDITO' && m.categoria === 'COBRANZA'
    );
    const impuestos = extractoMovs.filter(
      (m) => m.tipo === 'DEBITO' && m.categoria === 'IMPUESTO' && m.match_type === 'UNMATCHED'
    );

    const usedImpuestos = new Set<string>();

    for (const cred of creditos) {
      for (const imp of impuestos) {
        if (usedImpuestos.has(imp.id)) continue;

        // El impuesto debe ser del mismo día
        if (cred.fecha !== imp.fecha) continue;

        // El impuesto debe estar entre 0.05% y 2.5% del crédito
        const ratio = imp.monto / cred.monto;
        if (ratio < 0.0004 || ratio > 0.025) continue;

        // Asociar como TAX_CHILD (no crea match, solo marca relación)
        usedImpuestos.add(imp.id);
        results.push({
          id: crypto.randomUUID(),
          extracto_id: imp.id,
          mayor_id: null,
          match_type: 'TAX_CHILD',
          confidence: 1.0,
          difference: 0,
          group_members: [cred.id, imp.id],
        });
      }
    }

    return results;
  }
}
