import { db, schema } from '../../db';
import { eq, and, sql } from 'drizzle-orm';
import { getBankParser } from '../banks/registry';
import { MayorParser } from '../erp/mayor-parser';
import { matchingEngine } from '../matching/engine';
import { NormalizedMovement, ConciliacionSummary } from '../../shared/types';

export class ConciliacionService {
  /**
   * Procesa una conciliación completa:
   * 1. Parsea el extracto bancario
   * 2. Parsea el libro mayor
   * 3. Ejecuta el motor de matcheo
   * 4. Guarda todo en la DB
   */
  async procesar(
    conciliacionId: string,
    extractoContent: string,
    mayorContent: string,
    bankName: string = 'galicia'
  ) {
    // 1. Parsear extracto bancario
    const bankParser = getBankParser(bankName);
    const rawExtracto = bankParser.parseCSV(extractoContent);
    const extractoMovs = bankParser.normalize(rawExtracto);

    // 2. Parsear libro mayor
    const mayorParser = new MayorParser();
    const rawMayor = mayorParser.parseCSV(mayorContent);
    const mayorMovs = mayorParser.normalize(rawMayor);

    // 3. Ejecutar matcheo
    const { matches, extractoMovs: matchedExt, mayorMovs: matchedMay } =
      matchingEngine.execute(extractoMovs, mayorMovs);

    // 4. Guardar movimientos en DB (batch insert)
    const allMovs = [...matchedExt, ...matchedMay];
    if (allMovs.length > 0) {
      const movValues = allMovs.map((mov) => ({
        id: mov.id,
        conciliacion_id: conciliacionId,
        source: mov.source,
        fecha: mov.fecha,
        descripcion: mov.descripcion,
        referencia: mov.referencia,
        contraparte: mov.contraparte,
        contraparte_normalizada: mov.contraparte_normalizada,
        tipo: mov.tipo,
        monto: mov.monto.toString(),
        categoria: mov.categoria,
        metadata: mov.metadata,
        match_group_id: mov.match_group_id,
        match_type: mov.match_type,
      }));
      await db.insert(schema.movimientos).values(movValues);
    }

    // 5. Guardar matches (batch insert)
    if (matches.length > 0) {
      const matchValues = matches.map((match) => ({
        id: match.id,
        conciliacion_id: conciliacionId,
        match_type: match.match_type,
        confidence: match.confidence.toString(),
        diferencia: match.difference.toString(),
        group_members: match.group_members || [],
      }));
      await db.insert(schema.matches).values(matchValues);

      // Insertar en tabla pivote (batch)
      const pivotValues = matches.flatMap((match) => {
        const entries: any[] = [];
        if (match.extracto_id) {
          entries.push({
            match_id: match.id,
            movimiento_id: match.extracto_id,
            role: 'EXTRACTO',
          });
        }
        if (match.mayor_id) {
          entries.push({
            match_id: match.id,
            movimiento_id: match.mayor_id,
            role: 'MAYOR',
          });
        }
        return entries;
      });
      if (pivotValues.length > 0) {
        await db.insert(schema.matchMovimientos).values(pivotValues);
      }
    }

    // 6. Actualizar estado de la conciliación
    await db.update(schema.conciliaciones)
      .set({ estado: 'COMPLETADA', updated_at: new Date() })
      .where(eq(schema.conciliaciones.id, conciliacionId));

    // 7. Calcular summary
    const summary = this.calcularSummary(matchedExt, matchedMay, matches);

    return {
      extractoMovs: matchedExt,
      mayorMovs: matchedMay,
      matches,
      summary,
    };
  }

  /**
   * Obtiene una conciliación con todos sus datos.
   */
  async getById(conciliacionId: string) {
    const conciliacion = await db.query.conciliaciones.findFirst({
      where: eq(schema.conciliaciones.id, conciliacionId),
    });

    if (!conciliacion) return null;

    const movimientos = await db.query.movimientos.findMany({
      where: eq(schema.movimientos.conciliacion_id, conciliacionId),
    });

    const matches = await db.query.matches.findMany({
      where: eq(schema.matches.conciliacion_id, conciliacionId),
    });

    // Convertir montos de string a number (Drizzle devuelve decimal como string)
    const parseMov = (m: any) => ({ ...m, monto: Number(m.monto) });
    const extractoMovs = movimientos.filter((m) => m.source === 'EXTRACTO').map(parseMov) as unknown as NormalizedMovement[];
    const mayorMovs = movimientos.filter((m) => m.source === 'MAYOR').map(parseMov) as unknown as NormalizedMovement[];

    const summary = this.calcularSummary(extractoMovs, mayorMovs, matches);

    return {
      ...conciliacion,
      movimientos,
      matches,
      extractoMovs,
      mayorMovs,
      summary,
    };
  }

  /**
   * Crea un match manual entre movimientos específicos.
   */
  async createManualMatch(
    conciliacionId: string,
    extractoIds: string[],
    mayorIds: string[]
  ) {
    const matchId = crypto.randomUUID();
    const allIds = [...extractoIds, ...mayorIds];

    // Calcular diferencia
    const extMovs = await db.query.movimientos.findMany({
      where: eq(schema.movimientos.conciliacion_id, conciliacionId),
    });

    const calcSigned = (m: any) => m.tipo === 'CREDITO' ? Number(m.monto) : -Number(m.monto);

    const extSum = extMovs
      .filter((m) => extractoIds.includes(m.id))
      .reduce((sum, m) => sum + calcSigned(m), 0);
    const maySum = extMovs
      .filter((m) => mayorIds.includes(m.id))
      .reduce((sum, m) => sum + calcSigned(m), 0);
    const diff = Math.abs(extSum - maySum);

    await db.insert(schema.matches).values({
      id: matchId,
      conciliacion_id: conciliacionId,
      match_type: 'MANUAL',
      confidence: '1.00',
      diferencia: diff.toString(),
      group_members: allIds,
    });

    for (const eid of extractoIds) {
      await db.insert(schema.matchMovimientos).values({
        match_id: matchId,
        movimiento_id: eid,
        role: 'EXTRACTO',
      });
      await db.update(schema.movimientos)
        .set({ match_type: 'MANUAL', match_group_id: matchId })
        .where(eq(schema.movimientos.id, eid));
    }

    for (const mid of mayorIds) {
      await db.insert(schema.matchMovimientos).values({
        match_id: matchId,
        movimiento_id: mid,
        role: 'MAYOR',
      });
      await db.update(schema.movimientos)
        .set({ match_type: 'MANUAL', match_group_id: matchId })
        .where(eq(schema.movimientos.id, mid));
    }

    return { matchId, extSum, maySum, diff };
  }

  /**
   * Elimina una conciliación y todos sus datos relacionados (gracias al ON DELETE CASCADE)
   */
  async delete(conciliacionId: string) {
    await db.delete(schema.conciliaciones)
      .where(eq(schema.conciliaciones.id, conciliacionId));
  }

  /**
   * Deshace un match (ya sea manual o automático).
   */
  async unmatch(matchId: string) {
    const pivotEntries = await db.query.matchMovimientos.findMany({
      where: eq(schema.matchMovimientos.match_id, matchId),
    });

    for (const entry of pivotEntries) {
      await db.update(schema.movimientos)
        .set({ match_type: 'UNMATCHED', match_group_id: null })
        .where(eq(schema.movimientos.id, entry.movimiento_id));
    }

    await db.delete(schema.matchMovimientos)
      .where(eq(schema.matchMovimientos.match_id, matchId));
    await db.delete(schema.matches)
      .where(eq(schema.matches.id, matchId));
  }

  /**
   * Re-ejecuta el matching automático preservando matches manuales.
   * 1. Elimina matches AUTO, GROUPED, TAX_CHILD
   * 2. Resetea movimientos afectados a UNMATCHED
   * 3. Re-ejecuta el matching engine
   * 4. Guarda nuevos resultados
   */
  async rematch(conciliacionId: string) {
    // Verificar que existe
    const conciliacion = await db.query.conciliaciones.findFirst({
      where: eq(schema.conciliaciones.id, conciliacionId),
    });
    if (!conciliacion) return null;

    // 1. Obtener matches automáticos (no manuales)
    const allMatches = await db.query.matches.findMany({
      where: eq(schema.matches.conciliacion_id, conciliacionId),
    });
    const autoMatches = allMatches.filter(
      (m) => m.match_type !== 'MANUAL'
    );

    // 2. Eliminar matches automáticos y resetear movimientos (OPTIMIZADO)
    if (autoMatches.length > 0) {
      // Resetear movimientos a UNMATCHED masivamente
      await db.update(schema.movimientos)
        .set({ match_type: 'UNMATCHED', match_group_id: null })
        .where(
          and(
            eq(schema.movimientos.conciliacion_id, conciliacionId),
            sql`${schema.movimientos.match_type} != 'MANUAL'`
          )
        );

      // Eliminar los matches masivamente (las tablas pivote se borran por CASCADE)
      await db.delete(schema.matches)
        .where(
          and(
            eq(schema.matches.conciliacion_id, conciliacionId),
            sql`${schema.matches.match_type} != 'MANUAL'`
          )
        );
    }

    // 3. Cargar todos los movimientos actualizados
    const movimientos = await db.query.movimientos.findMany({
      where: eq(schema.movimientos.conciliacion_id, conciliacionId),
    });
    const parseMov = (m: any) => ({ ...m, monto: Number(m.monto) });
    const extractoMovs = movimientos
      .filter((m) => m.source === 'EXTRACTO')
      .map(parseMov) as unknown as NormalizedMovement[];
    const mayorMovs = movimientos
      .filter((m) => m.source === 'MAYOR')
      .map(parseMov) as unknown as NormalizedMovement[];

    // 4. Re-ejecutar matching engine
    const { matches, extractoMovs: matchedExt, mayorMovs: matchedMay } =
      matchingEngine.execute(extractoMovs, mayorMovs);

    // 5. Guardar nuevos matches
    if (matches.length > 0) {
      const matchValues = matches.map((match) => ({
        id: match.id,
        conciliacion_id: conciliacionId,
        match_type: match.match_type,
        confidence: match.confidence.toString(),
        diferencia: match.difference.toString(),
        group_members: match.group_members || [],
      }));
      await db.insert(schema.matches).values(matchValues);

      const pivotValues = matches.flatMap((match) => {
        const entries: any[] = [];
        if (match.extracto_id) {
          entries.push({
            match_id: match.id,
            movimiento_id: match.extracto_id,
            role: 'EXTRACTO',
          });
        }
        if (match.mayor_id) {
          entries.push({
            match_id: match.id,
            movimiento_id: match.mayor_id,
            role: 'MAYOR',
          });
        }
        return entries;
      });
      if (pivotValues.length > 0) {
        await db.insert(schema.matchMovimientos).values(pivotValues);
      }
    }

    // 6. Actualizar match_type en movimientos (OPTIMIZADO con chunks en paralelo)
    const movsToUpdate = [...matchedExt, ...matchedMay].filter(m => m.match_type !== 'UNMATCHED');
    for (let i = 0; i < movsToUpdate.length; i += 200) {
      const chunk = movsToUpdate.slice(i, i + 200);
      await Promise.all(
        chunk.map((m) =>
          db.update(schema.movimientos)
            .set({ match_type: m.match_type, match_group_id: m.match_group_id })
            .where(eq(schema.movimientos.id, m.id))
        )
      );
    }

    // 7. Recalcular summary
    const summary = this.calcularSummary(matchedExt, matchedMay, [
      ...allMatches.filter((m) => m.match_type === 'MANUAL'),
      ...matches,
    ]);

    return {
      extractoMovs: matchedExt,
      mayorMovs: matchedMay,
      matches,
      summary,
      rematchedCount: matches.length,
    };
  }

  private calcularSummary(
    extractoMovs: NormalizedMovement[],
    mayorMovs: NormalizedMovement[],
    matches: any[]
  ): ConciliacionSummary {
    const matchedMovIds = new Set<string>();
    for (const m of matches) {
      if (m.group_members) {
        for (const mid of m.group_members as string[]) {
          matchedMovIds.add(mid);
        }
      }
    }

    const extCredito = extractoMovs
      .filter((m) => m.tipo === 'CREDITO')
      .reduce((s, m) => s + m.monto, 0);
    const extDebito = extractoMovs
      .filter((m) => m.tipo === 'DEBITO')
      .reduce((s, m) => s + m.monto, 0);

    const mayCredito = mayorMovs
      .filter((m) => m.tipo === 'CREDITO')
      .reduce((s, m) => s + m.monto, 0);
    const mayDebito = mayorMovs
      .filter((m) => m.tipo === 'DEBITO')
      .reduce((s, m) => s + m.monto, 0);

    const unmatchedExt = extractoMovs.filter(
      (m) => m.match_type === 'UNMATCHED' && !matchedMovIds.has(m.id)
    );
    const unmatchedMay = mayorMovs.filter(
      (m) => m.match_type === 'UNMATCHED' && !matchedMovIds.has(m.id)
    );

    return {
      total_extracto: extCredito - extDebito,
      total_mayor: mayCredito - mayDebito,
      matched_count: matches.length,
      matched_amount: extractoMovs
        .filter((m) => m.match_type !== 'UNMATCHED' && m.match_type !== 'TAX_CHILD')
        .reduce((s, m) => s + (m.tipo === 'CREDITO' ? m.monto : -m.monto), 0),
      unmatched_extracto_count: unmatchedExt.length,
      unmatched_extracto_amount: unmatchedExt.reduce((s, m) => s + (m.tipo === 'CREDITO' ? m.monto : -m.monto), 0),
      unmatched_mayor_count: unmatchedMay.length,
      unmatched_mayor_amount: unmatchedMay.reduce((s, m) => s + (m.tipo === 'CREDITO' ? m.monto : -m.monto), 0),
      diferencia: (extCredito - extDebito) - (mayCredito - mayDebito),
    };
  }
}

export const conciliacionService = new ConciliacionService();
