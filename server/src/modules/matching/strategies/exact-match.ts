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
 * 3. Fecha con tolerancia de ±5 días
 *
 * Se resuelve en dos pasadas para no cruzar movimientos del mismo monto:
 * 1. Primero los pares que comparten un número de comprobante (ej: nro de cheque).
 * 2. Después el resto, eligiendo la fecha más cercana. Dos cheques con números
 *    distintos nunca se matchean entre sí.
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

    // Excluir impuestos/comisiones (se manejan por strategies específicas)
    const exts = extractoMovs.filter(
      (m) => m.match_type === 'UNMATCHED' && !['IMPUESTO', 'COMISION', 'INTERES'].includes(m.categoria)
    );
    const mays = mayorMovs.filter((m) => m.match_type === 'UNMATCHED');

    // Números largos para emparejar con confianza; todos (incluso "29") para detectar cheques distintos
    const numsById = new Map<string, Set<string>>();
    const allNumsById = new Map<string, Set<string>>();
    for (const m of [...exts, ...mays]) {
      numsById.set(m.id, this.extractNumbers(m, 3));
      allNumsById.set(m.id, this.extractNumbers(m, 1));
    }

    const shares = (nums: Map<string, Set<string>>, ext: NormalizedMovement, may: NormalizedMovement) => {
      const mayNums = nums.get(may.id)!;
      for (const n of nums.get(ext.id)!) if (mayNums.has(n)) return true;
      return false;
    };
    const sharesNumber = (ext: NormalizedMovement, may: NormalizedMovement) => shares(numsById, ext, may);

    const isCheque = (m: NormalizedMovement) => /CHEQ/i.test(m.descripcion || '');

    const pass = (accept: (ext: NormalizedMovement, may: NormalizedMovement) => boolean) => {
      for (const ext of exts) {
        if (usedExtracto.has(ext.id)) continue;

        let best: NormalizedMovement | null = null;
        let bestDiff = Infinity;
        for (const may of mays) {
          if (usedMayor.has(may.id)) continue;
          // 1. Exact amount
          if (Math.abs(ext.monto - may.monto) > 0.005) continue;
          // 2. Same type
          if (ext.tipo !== may.tipo) continue;
          // 3. Date tolerance ±5 days (para contemplar fines de semana largos)
          const dateDiff = this.daysBetween(ext.fecha, may.fecha);
          if (dateDiff > 5) continue;
          if (!accept(ext, may)) continue;
          if (dateDiff < bestDiff) { best = may; bestDiff = dateDiff; }
        }
        if (!best) continue;

        results.push({
          id: crypto.randomUUID(),
          extracto_id: ext.id,
          mayor_id: best.id,
          match_type: 'AUTO',
          confidence: 1.0,
          difference: 0,
        });
        usedExtracto.add(ext.id);
        usedMayor.add(best.id);
      }
    };

    const sameCounterparty = (ext: NormalizedMovement, may: NormalizedMovement) =>
      this.counterpartySimilarity(
        ext.contraparte_normalizada || ext.contraparte,
        may.contraparte_normalizada || may.contraparte
      ) >= 0.6;

    // Pasada 1: mismo número de comprobante
    pass(sharesNumber);

    // Pasada 2: misma contraparte (ej: varios cobros del mismo monto de distintos clientes)
    pass(sameCounterparty);

    // Pasada 3: monto + fecha, sin cruzar cheques con números distintos
    pass((ext, may) => {
      if (!isCheque(ext) || !isCheque(may)) return true;
      if (allNumsById.get(ext.id)!.size === 0 || allNumsById.get(may.id)!.size === 0) return true;
      return shares(allNumsById, ext, may);
    });

    return results;
  }

  /**
   * Proporción de palabras del nombre más corto que aparecen en el otro, ignorando el tipo
   * societario. Tolera abreviaturas y nombres cortados del banco.
   * Ej: "COOP PROD INTEG CEREZA" vs "COOPERATIVA PRODUCTORES INTEGRADOS CEREZAS LIMITADA" → 1.0
   */
  private counterpartySimilarity(a: string, b: string): number {
    const ignore = new Set(['SA', 'SRL', 'SAS', 'SOCIEDAD', 'ANONIMA', 'LIMITADA', 'RESPONSABILIDAD', 'DE', 'DEL', 'LA', 'LOS', 'LAS', 'Y']);
    const tokens = (s: string) =>
      (s || '').toUpperCase().replace(/[^A-Z0-9Ñ ]/g, ' ').split(/\s+/).filter((t) => t.length > 1 && !ignore.has(t));
    const aT = tokens(a), bT = tokens(b);
    if (!aT.length || !bT.length) return 0;
    const [short, long] = aT.length <= bT.length ? [aT, bT] : [bT, aT];
    const same = (x: string, y: string) =>
      x === y ||
      (x.length >= 3 && y.startsWith(x)) ||
      (y.length >= 3 && x.startsWith(y)) ||
      (x.length >= 5 && y.length >= 5 && x.slice(0, 5) === y.slice(0, 5));
    return short.filter((t) => long.some((u) => same(t, u))).length / short.length;
  }

  /**
   * Números de minLen+ dígitos (sin ceros a la izquierda) presentes en la referencia y descripción.
   * Ej: "G.DE ECHEQ Q90000108 BOL79686532" → {90000108, 79686532}
   */
  private extractNumbers(m: NormalizedMovement, minLen: number): Set<string> {
    const text = `${m.referencia || ''} ${m.descripcion || ''}`;
    const nums = new Set<string>();
    for (const raw of text.match(/\d+/g) || []) {
      const n = raw.replace(/^0+/, '');
      if (n.length >= minLen) nums.add(n);
    }
    return nums;
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
