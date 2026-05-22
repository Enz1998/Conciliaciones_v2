import { NormalizedMovement, MatchResult, MatchStrategy } from '../../shared/types';

/**
 * Motor de matcheo que ejecuta las estrategias en orden.
 *
 * El pipeline de estrategias a usar ahora es inyectado por el BankParser.
 */
export class MatchingEngine {

  /**
   * Ejecuta todas las estrategias sobre los movimientos.
   * Cada estrategia modifica los movimientos in-place (match_type, match_group_id)
   * y devuelve los MatchResult.
   */
  execute(
    extractoMovs: NormalizedMovement[],
    mayorMovs: NormalizedMovement[],
    strategies: MatchStrategy[]
  ): { matches: MatchResult[]; extractoMovs: NormalizedMovement[]; mayorMovs: NormalizedMovement[] } {
    // Copias para trabajar
    const extMovs = extractoMovs.map((m) => ({ ...m }));
    const mayMovs = mayorMovs.map((m) => ({ ...m }));

    const allMatches: MatchResult[] = [];

    for (const strategy of strategies) {
      const results = strategy.execute(extMovs, mayMovs);
      allMatches.push(...results);

      // Marcar movimientos como matcheados según los resultados
      for (const match of results) {
        if (match.match_type === 'TAX_CHILD') {
          // Marcar el impuesto como TAX_CHILD
          const impIdx = extMovs.findIndex((m) => m.id === match.extracto_id);
          if (impIdx >= 0) {
            extMovs[impIdx].match_type = 'TAX_CHILD';
            extMovs[impIdx].match_group_id = match.id;
          }
          continue;
        }

        // Marcar extracto
        if (match.extracto_id) {
          const extIdx = extMovs.findIndex((m) => m.id === match.extracto_id);
          if (extIdx >= 0) {
            extMovs[extIdx].match_type = match.match_type;
            extMovs[extIdx].match_group_id = match.id;
          }
        }

        // Marcar mayor
        if (match.mayor_id) {
          const mayIdx = mayMovs.findIndex((m) => m.id === match.mayor_id);
          if (mayIdx >= 0) {
            mayMovs[mayIdx].match_type = match.match_type;
            mayMovs[mayIdx].match_group_id = match.id;
          }
        }

        // Marcar group members
        if (match.group_members) {
          for (const memberId of match.group_members) {
            const extIdx = extMovs.findIndex((m) => m.id === memberId);
            if (extIdx >= 0) {
              extMovs[extIdx].match_type = match.match_type;
              extMovs[extIdx].match_group_id = match.id;
            }
            const mayIdx = mayMovs.findIndex((m) => m.id === memberId);
            if (mayIdx >= 0) {
              mayMovs[mayIdx].match_type = match.match_type;
              mayMovs[mayIdx].match_group_id = match.id;
            }
          }
        }
      }
    }

    return { matches: allMatches, extractoMovs: extMovs, mayorMovs: mayMovs };
  }
}

export const matchingEngine = new MatchingEngine();
