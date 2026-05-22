import { NormalizedMovement, MatchResult } from '../../../shared/types';
import { MatchStrategy } from './exact-match';

/**
 * Estrategia: Agrupación sugerida (Many-to-One)
 *
 * Encuentra combinaciones de N movimientos del extracto que suman
 * exactamente 1 movimiento del mayor (o viceversa).
 *
 * Se limita a combinaciones de 2 o 3 movimientos por performance.
 */
export class GroupedMatchStrategy implements MatchStrategy {
  readonly name = 'GroupedMatch';

  execute(
    extractoMovs: NormalizedMovement[],
    mayorMovs: NormalizedMovement[]
  ): MatchResult[] {
    const results: MatchResult[] = [];

    const unmatchedExt = extractoMovs.filter(
      (m) => m.match_type === 'UNMATCHED' && !['IMPUESTO', 'COMISION', 'INTERES'].includes(m.categoria)
    );
    const unmatchedMay = mayorMovs.filter(
      (m) => m.match_type === 'UNMATCHED' && !['IMPUESTO', 'COMISION', 'INTERES'].includes(m.categoria)
    );

    // Buscar: 2 extracto suman 1 mayor
    results.push(...this.findGroup(unmatchedExt, unmatchedMay, 'EXTRACTO'));

    // Buscar: 2 mayor suman 1 extracto
    results.push(...this.findGroup(unmatchedMay, unmatchedExt, 'MAYOR'));

    return results;
  }

  private findGroup(
    source: NormalizedMovement[],
    target: NormalizedMovement[],
    groupSource: string
  ): MatchResult[] {
    const results: MatchResult[] = [];
    const usedSource = new Set<string>();
    const usedTarget = new Set<string>();

    // Combinaciones de 2 source
    for (let i = 0; i < source.length; i++) {
      if (usedSource.has(source[i].id)) continue;
      for (let j = i + 1; j < source.length; j++) {
        if (usedSource.has(source[j].id)) continue;
        if (source[i].tipo !== source[j].tipo) continue;
        // Misma fecha (±1 día entre ellos)
        const dateDiff = this.daysBetween(source[i].fecha, source[j].fecha);
        if (dateDiff > 1) continue;

        const sum = source[i].monto + source[j].monto;

        for (const tgt of target) {
          if (usedTarget.has(tgt.id)) continue;
          if (source[i].tipo !== tgt.tipo) continue;
          if (Math.abs(sum - tgt.monto) > 0.01) continue;

          // Fecha cercana
          const d1 = this.daysBetween(source[i].fecha, tgt.fecha);
          const d2 = this.daysBetween(source[j].fecha, tgt.fecha);
          if (d1 > 2 || d2 > 2) continue;

          // Match grupal sugerido (baja confianza, requiere confirmación)
          const matchId = crypto.randomUUID();
          results.push({
            id: matchId,
            extracto_id: groupSource === 'EXTRACTO' ? null : tgt.id,
            mayor_id: groupSource === 'MAYOR' ? null : tgt.id,
            match_type: 'GROUPED',
            confidence: 0.7,
            difference: 0,
            group_members: [source[i].id, source[j].id, tgt.id],
          });

          usedSource.add(source[i].id);
          usedSource.add(source[j].id);
          usedTarget.add(tgt.id);
          break;
        }
      }
    }

    return results;
  }

  private daysBetween(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.abs((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  }
}
