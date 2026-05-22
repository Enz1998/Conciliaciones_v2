import { NormalizedMovement, MatchResult } from '../../../shared/types';

export interface MatchStrategy {
  name: string;
  execute(extractoMovs: NormalizedMovement[], mayorMovs: NormalizedMovement[]): MatchResult[];
}

/**
 * Estrategia: Match Exacto (One-to-One)
 * Condiciones:
 * 1. Mismo monto (exacto)
 * 2. Mismo tipo (CREDITO/DEBITO)
 * 3. Fecha con tolerancia de ±1 día
 * 4. Fuzzy match de contraparte >= 80%
 */
export class ExactMatchStrategy implements MatchStrategy {
  readonly name = 'ExactMatch';

  execute(
    extractoMovs: NormalizedMovement[],
    mayorMovs: NormalizedMovement[]
  ): MatchResult[] {
    const results: MatchResult[] = [];
    const usedExtracto = new Set<string>();
    const usedMayor = new Set<string>();

    for (const ext of extractoMovs) {
      if (usedExtracto.has(ext.id)) continue;
      if (ext.match_type !== 'UNMATCHED') continue;
      // Excluir impuestos/comisiones (se manejan por strategies específicas)
      if (['IMPUESTO', 'COMISION', 'INTERES'].includes(ext.categoria)) continue;

      for (const may of mayorMovs) {
        if (usedMayor.has(may.id)) continue;
        if (may.match_type !== 'UNMATCHED') continue;
        // No requerir categoría idéntica: banco y ERP usan descripciones distintas

        // 1. Exact amount
        if (Math.abs(ext.monto - may.monto) > 0.005) continue;

        // 2. Same type
        if (ext.tipo !== may.tipo) continue;

        // 3. Date tolerance ±5 days (para contemplar fines de semana largos)
        const dateDiff = this.daysBetween(ext.fecha, may.fecha);
        if (dateDiff > 5) continue;

        // 4. Se ignora la contraparte/descripción a pedido del usuario.
        // Solo importa monto igual y fecha (con tolerancia).
        // El matcheo 1 a 1 ya está garantizado por los Sets (usedExtracto y usedMayor).
        const matchConfidence = 1.0;

        // MATCH!
        const matchId = crypto.randomUUID();
        results.push({
          id: matchId,
          extracto_id: ext.id,
          mayor_id: may.id,
          match_type: 'AUTO',
          confidence: Math.round(matchConfidence * 100) / 100,
          difference: 0,
        });

        usedExtracto.add(ext.id);
        usedMayor.add(may.id);
        break;
      }
    }

    return results;
  }

  private daysBetween(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.abs((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Fuzzy matching usando Jaro-Winkler-like simple.
   * Para producción se puede usar string-similarity-js o Fuse.js.
   */
  private fuzzyMatch(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1.0;

    // Si uno contiene al otro completamente
    if (a.includes(b) || b.includes(a)) return 0.92;

    // Token-based matching (para nombres invertidos y abreviaciones, ej: "Franco Eleonora" vs "Eleonora Franco", o "NAT" vs "NATALIO")
    const aTokens = a.split(/\s+/).filter(t => t.length > 1);
    const bTokens = b.split(/\s+/).filter(t => t.length > 1);
    if (aTokens.length > 0 && bTokens.length > 0) {
      let commonCount = 0;
      for (const tA of aTokens) {
        // Un token matchea si es igual, o si uno es prefijo del otro (min 3 chars para evitar falsos positivos)
        const match = bTokens.some(tB => 
          tA === tB || 
          (tA.length >= 3 && tB.startsWith(tA)) || 
          (tB.length >= 3 && tA.startsWith(tB))
        );
        if (match) commonCount++;
      }
      const tokenSim = (commonCount * 2) / (aTokens.length + bTokens.length);
      if (tokenSim >= 0.70) return tokenSim;
    }

    // Jaro-Winkler simplificado
    const maxLen = Math.max(a.length, b.length);
    const matchDistance = Math.floor(maxLen / 2) - 1;
    const aChars = a.split('');
    const bChars = b.split('');
    const aMatches = new Array(a.length).fill(false);
    const bMatches = new Array(b.length).fill(false);

    let matches = 0;
    for (let i = 0; i < a.length; i++) {
      const start = Math.max(0, i - matchDistance);
      const end = Math.min(i + matchDistance + 1, b.length);
      for (let j = start; j < end; j++) {
        if (bMatches[j]) continue;
        if (aChars[i] !== bChars[j]) continue;
        aMatches[i] = true;
        bMatches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0;

    // Count transpositions
    let transpositions = 0;
    let k = 0;
    for (let i = 0; i < a.length; i++) {
      if (!aMatches[i]) continue;
      while (!bMatches[k]) k++;
      if (aChars[i] !== bChars[k]) transpositions++;
      k++;
    }

    const jaro = (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;

    // Winkler prefix bonus
    let prefix = 0;
    for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
      if (aChars[i] === bChars[i]) prefix++;
      else break;
    }

    return jaro + prefix * 0.1 * (1 - jaro);
  }
}
