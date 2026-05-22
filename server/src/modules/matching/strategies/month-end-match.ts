import { NormalizedMovement, MatchResult } from '../../../shared/types';
import { MatchStrategy } from './exact-match';

/**
 * Estrategia: Agrupación de Cargos de Fin de Mes
 *
 * En el extracto bancario, los cargos de fin de mes aparecen como múltiples
 * débitos individuales (comisiones, IVA, IIBB, sellos, intereses, etc.).
 * En el ERP, estos se registran como un único asiento sumarizado.
 *
 * También agrupa los ING. BRUTOS diarios (retenciones por cada crédito)
 * contra un asiento manual mensual del ERP.
 *
 * Esta estrategia:
 * 1. Agrupa cargos bancarios por mes
 * 2. Busca un asiento del Mayor con monto = suma del grupo
 * 3. Si matchea, crea un match GROUPED con todos los items
 */
export class MonthEndMatchStrategy implements MatchStrategy {
  readonly name = 'MonthEndMatch';

  execute(
    extractoMovs: NormalizedMovement[],
    mayorMovs: NormalizedMovement[]
  ): MatchResult[] {
    const results: MatchResult[] = [];

    // --- Grupo 1: Cargos bancarios de fin de mes (comisiones, IVA, sellos, etc.)
    // NO incluir ING. BRUTOS S/ CRED (esos son impuestos diarios por transacción)
    const monthEndCharges = extractoMovs.filter(
      (m) =>
        m.match_type === 'UNMATCHED' &&
        m.tipo === 'DEBITO' &&
        this.isMonthEndCharge(m)
    );

    // --- Grupo 2: ING. BRUTOS diarios (retenciones por cada crédito)
    const dailyIIBB = extractoMovs.filter(
      (m) =>
        m.match_type === 'UNMATCHED' &&
        m.tipo === 'DEBITO' &&
        m.categoria === 'IMPUESTO' &&
        this.isDailyIIBB(m)
    );

    // Agrupar cargos de fin de mes por mes y buscar match
    const chargesByMonth = this.groupByMonth(monthEndCharges);
    for (const [month, charges] of chargesByMonth.entries()) {
      const total = charges.reduce((s, c) => s + c.monto, 0);
      const match = this.findMayorMatch(mayorMovs, total, month, [
        'COMISION',
        'OTRO',
      ]);
      if (match) {
        const allIds = [...charges.map((c) => c.id), match.id];
        results.push({
          id: crypto.randomUUID(),
          extracto_id: null,
          mayor_id: null,
          match_type: 'GROUPED',
          confidence: 0.85,
          difference: Math.abs(total - match.monto),
          group_members: allIds,
        });
        // Marcar como usados
        for (const c of charges) c.match_type = 'GROUPED';
        match.match_type = 'GROUPED';
      }
    }

    // Agrupar ING. BRUTOS diarios por mes y buscar match con asiento manual
    const iibbByMonth = this.groupByMonth(dailyIIBB);
    for (const [month, taxes] of iibbByMonth.entries()) {
      const total = taxes.reduce((s, t) => s + t.monto, 0);
      const match = this.findMayorMatch(mayorMovs, total, month, [
        'IMPUESTO',
        'OTRO',
      ]);
      if (match) {
        const allIds = [...taxes.map((t) => t.id), match.id];
        results.push({
          id: crypto.randomUUID(),
          extracto_id: null,
          mayor_id: null,
          match_type: 'GROUPED',
          confidence: 0.80,
          difference: Math.abs(total - match.monto),
          group_members: allIds,
        });
        for (const t of taxes) t.match_type = 'GROUPED';
        match.match_type = 'GROUPED';
      }
    }

    return results;
  }

  /**
   * Determina si un movimiento es un cargo bancario de fin de mes.
   * Excluye ING. BRUTOS S/ CRED (impuestos diarios por transacción).
   */
  private isMonthEndCharge(m: NormalizedMovement): boolean {
    const desc = m.descripcion.toUpperCase();

    // Comisiones
    if (/COMISION/i.test(desc)) return true;
    // IVA sobre comisiones
    if (/^IVA\b/i.test(desc)) return true;
    // Percepción IVA
    if (/PERCEP\.\s*IVA/i.test(desc)) return true;
    // Impuesto de sellos
    if (/SELLOS/i.test(desc)) return true;
    // Intereses sobre saldos deudores
    if (/INTERES/i.test(desc)) return true;
    // Imp. Débito/Crédito Ley 25413
    if (/IMP\.\s*DEB\.\s*LEY|IMP\.\s*CRE\.\s*LEY/i.test(desc)) return true;
    // IMP. ING. BRUTOS (el genérico mensual, no el S/ CRED diario)
    if (/IMP\.\s*ING\.\s*BRUTOS/i.test(desc) && !/S\/\s*CRED/i.test(desc))
      return true;

    // Usar metadata de grupo de conceptos si disponible
    const grupo = (m.metadata as any)?.grupoConceptos || '';
    if (grupo.includes('000808') || grupo.includes('000901') || grupo.includes('000814'))
      return true;

    return false;
  }

  /**
   * Determina si un movimiento es un ING. BRUTOS diario (retención por crédito).
   */
  private isDailyIIBB(m: NormalizedMovement): boolean {
    const desc = m.descripcion.toUpperCase();
    return /ING\.\s*BRUTOS\s*S\/\s*CRED/i.test(desc);
  }

  /**
   * Agrupa movimientos por mes (YYYY-MM).
   */
  private groupByMonth(movs: NormalizedMovement[]): Map<string, NormalizedMovement[]> {
    const groups = new Map<string, NormalizedMovement[]>();
    for (const m of movs) {
      // fecha viene en formato YYYY-MM-DD
      const month = m.fecha.substring(0, 7); // "2026-05"
      if (!groups.has(month)) groups.set(month, []);
      groups.get(month)!.push(m);
    }
    return groups;
  }

  /**
   * Busca un movimiento del Mayor que sea un asiento sumarizado
   * de cargos bancarios con monto cercano al total.
   */
  private findMayorMatch(
    mayorMovs: NormalizedMovement[],
    total: number,
    month: string,
    allowedCategorias: string[]
  ): NormalizedMovement | undefined {
    return mayorMovs.find((m) => {
      if (m.match_type !== 'UNMATCHED') return false;
      // El asiento del Mayor debe ser un DEBITO (dinero sale = gasto)
      // Post-fix del parser, DEBITO en Mayor = dinero sale = correcto
      if (m.tipo !== 'DEBITO') return false;
      // Categoría compatible
      if (!allowedCategorias.includes(m.categoria)) return false;
      // Monto con tolerancia
      if (Math.abs(m.monto - total) > 1.0) return false;
      // Fecha en el mismo mes o mes siguiente (los cargos de mayo pueden
      // contabilizarse en junio con un asiento de ajuste)
      const mayMonth = m.fecha.substring(0, 7);
      if (mayMonth !== month && !this.isNextMonth(month, mayMonth)) return false;

      return true;
    });
  }

  /**
   * Verifica si monthB es el mes siguiente a monthA.
   * Formato: "YYYY-MM"
   */
  private isNextMonth(monthA: string, monthB: string): boolean {
    const [yA, mA] = monthA.split('-').map(Number);
    const [yB, mB] = monthB.split('-').map(Number);
    if (mA === 12) return yB === yA + 1 && mB === 1;
    return yB === yA && mB === mA + 1;
  }
}
