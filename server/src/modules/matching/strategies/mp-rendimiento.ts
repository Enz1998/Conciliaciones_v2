import { NormalizedMovement, MatchResult } from '../../../shared/types';
import { MatchStrategy } from './exact-match';

/**
 * Estrategia: Agrupación de Rendimientos Mensuales de MercadoPago
 *
 * El extracto de MP tiene múltiples entradas de "Rendimiento positivo de la inversión"
 * (categoría INTERES) distribuidas a lo largo del mes.
 * En el ERP, el contador registra estos como un asiento manual a fin de mes.
 *
 * Esta estrategia:
 * 1. Agrupa los rendimientos del extracto MP por mes
 * 2. Busca un asiento del Mayor que sea CREDITO + INTERES/OTRO con monto ≈ suma del mes
 */
export class MPRendimientoStrategy implements MatchStrategy {
  readonly name = 'MPRendimiento';

  execute(
    extractoMovs: NormalizedMovement[],
    mayorMovs: NormalizedMovement[]
  ): MatchResult[] {
    const results: MatchResult[] = [];

    // Solo aplica a extracto MP
    const rendimientos = extractoMovs.filter(
      (m) =>
        m.source === 'EXTRACTO' &&
        m.metadata?.banco === 'mercadopago' &&
        m.categoria === 'INTERES' &&
        m.tipo === 'CREDITO' &&
        m.match_type === 'UNMATCHED'
    );

    if (rendimientos.length === 0) return results;

    // Agrupar rendimientos por mes (YYYY-MM)
    const byMonth = new Map<string, NormalizedMovement[]>();
    for (const r of rendimientos) {
      const month = r.fecha.substring(0, 7);
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month)!.push(r);
    }

    for (const [month, items] of byMonth) {
      const total = items.reduce((s, m) => s + m.monto, 0);

      // Buscar asiento manual del Mayor: CREDITO + categoría INTERES u OTRO
      // con monto cercano al total del mes, en el mismo mes o siguiente
      const mayorMatch = mayorMovs.find((m) => {
        if (m.match_type !== 'UNMATCHED') return false;
        // En el mayor, el rendimiento es un CREDITO (dinero entra a la cuenta)
        if (m.tipo !== 'CREDITO') return false;
        if (!['INTERES', 'OTRO'].includes(m.categoria)) return false;
        if (Math.abs(m.monto - total) > 1.0) return false;
        const mayMonth = m.fecha.substring(0, 7);
        return mayMonth === month || this.isNextMonth(month, mayMonth);
      });

      if (mayorMatch) {
        const allIds = [...items.map((i) => i.id), mayorMatch.id];
        results.push({
          id: crypto.randomUUID(),
          extracto_id: null,
          mayor_id: null,
          match_type: 'GROUPED',
          confidence: 0.85,
          difference: Math.abs(total - mayorMatch.monto),
          group_members: allIds,
        });
        // Marcar como usados para que otras estrategias no los toquen
        for (const item of items) item.match_type = 'GROUPED';
        mayorMatch.match_type = 'GROUPED';
      }
    }

    return results;
  }

  private isNextMonth(monthA: string, monthB: string): boolean {
    const [yA, mA] = monthA.split('-').map(Number);
    const [yB, mB] = monthB.split('-').map(Number);
    if (mA === 12) return yB === yA + 1 && mB === 1;
    return yB === yA && mB === mA + 1;
  }
}
