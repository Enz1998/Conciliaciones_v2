import { db, schema } from '../../db';
import { eq, and, sql } from 'drizzle-orm';
import { getBankParser } from '../banks/registry';
import { MayorParser } from '../erp/mayor-parser';
import { matchingEngine } from '../matching/engine';
import { NormalizedMovement, ConciliacionSummary } from '../../shared/types';
import Decimal from 'decimal.js';

export class ConciliacionService {
  /**
   * Procesa una conciliación completa:
   * 1. Parsea el extracto bancario (CSV o XLSX según banco)
   * 2. Parsea el libro mayor (CSV o XLSX según banco)
   * 3. Ejecuta el motor de matcheo con el pipeline correcto para el banco
   * 4. Guarda todo en la DB
   */
  async procesar(
    conciliacionId: string,
    extractoBuffer: Buffer,
    mayorBuffer: Buffer,
    bankName: string = 'galicia',
    extractoFormat: 'csv' | 'xlsx' = 'csv',
    mayorFormat: 'csv' | 'xlsx' = 'csv'
  ) {
    // 1. Parsear extracto bancario
    const bankParser = getBankParser(bankName);
    let extractoMovs: NormalizedMovement[];
    let autoSaldoIniExt: number | undefined;
    let autoSaldoFinExt: number | undefined;

    if (extractoFormat === 'xlsx') {
      if (!bankParser.parseXLSX) {
        throw new Error(`El parser de ${bankName} no soporta formato XLSX`);
      }
      const rawExtracto = bankParser.parseXLSX(extractoBuffer);
      extractoMovs = bankParser.normalize(rawExtracto.movimientos);
      autoSaldoIniExt = rawExtracto.saldoInicial;
      autoSaldoFinExt = rawExtracto.saldoFinal;
    } else {
      const encoding = extractoBuffer.indexOf('\u0000') !== -1 ? 'utf16le' : 'utf-8';
      if (!bankParser.parseCSV) {
        throw new Error(`El parser de ${bankName} no soporta formato CSV`);
      }
      const { Readable } = await import('stream');
      const stream = Readable.from(extractoBuffer);
      stream.setEncoding(encoding);
      const rawExtracto = await bankParser.parseCSV(stream, encoding);
      extractoMovs = bankParser.normalize(rawExtracto.movimientos);
      autoSaldoIniExt = rawExtracto.saldoInicial;
      autoSaldoFinExt = rawExtracto.saldoFinal;
    }

    // 2. Parsear libro mayor
    const mayorParser = new MayorParser();
    let mayorMovs: NormalizedMovement[];
    let autoSaldoIniMay: number | undefined;
    let autoSaldoFinMay: number | undefined;

    if (mayorFormat === 'xlsx') {
      const rawMayor = mayorParser.parseXLSX(mayorBuffer);
      mayorMovs = mayorParser.normalize(rawMayor.movimientos);
      autoSaldoIniMay = rawMayor.saldoInicial;
      autoSaldoFinMay = rawMayor.saldoFinal;
    } else {
      const encoding = mayorBuffer.indexOf('\u0000') !== -1 ? 'utf16le' : 'utf-8';
      const { Readable } = await import('stream');
      const stream = Readable.from(mayorBuffer);
      stream.setEncoding(encoding);
      const rawMayor = await mayorParser.parseCSV!(stream, encoding);
      mayorMovs = mayorParser.normalize(rawMayor.movimientos);
      autoSaldoIniMay = rawMayor.saldoInicial;
      autoSaldoFinMay = rawMayor.saldoFinal;
    }

    // 3. Ejecutar matcheo con pipeline del banco
    const pipeline = bankParser.getMatchingPipeline();
    const { matches, extractoMovs: matchedExt, mayorMovs: matchedMay } =
      matchingEngine.execute(extractoMovs, mayorMovs, pipeline);

    // Transacción ACID para asegurar consistencia
    await db.transaction(async (tx) => {
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
        await tx.insert(schema.movimientos).values(movValues);
      }

      // 5. Guardar matches (batch insert)
      if (matches.length > 0) {
        const matchValues = matches.map((match) => {
          const members = (match.group_members && match.group_members.length > 0)
            ? match.group_members
            : ([match.extracto_id, match.mayor_id].filter(Boolean) as string[]);
          return {
            id: match.id,
            conciliacion_id: conciliacionId,
            match_type: match.match_type,
            confidence: match.confidence.toString(),
            diferencia: match.difference.toString(),
            group_members: members,
          };
        });
        await tx.insert(schema.matches).values(matchValues);

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
          await tx.insert(schema.matchMovimientos).values(pivotValues);
        }
      }

      // 6. Actualizar estado de la conciliación y los saldos detectados
      const [currentConc] = await tx.select().from(schema.conciliaciones).where(eq(schema.conciliaciones.id, conciliacionId));
      const updateData: any = { estado: 'COMPLETADA', updated_at: new Date() };
      
      if (currentConc) {
        if (currentConc.saldo_inicial_extracto === null && autoSaldoIniExt !== undefined) updateData.saldo_inicial_extracto = autoSaldoIniExt.toString();
        if (currentConc.saldo_final_extracto === null && autoSaldoFinExt !== undefined) updateData.saldo_final_extracto = autoSaldoFinExt.toString();
        if (currentConc.saldo_inicial_mayor === null && autoSaldoIniMay !== undefined) updateData.saldo_inicial_mayor = autoSaldoIniMay.toString();
        if (currentConc.saldo_final_mayor === null && autoSaldoFinMay !== undefined) updateData.saldo_final_mayor = autoSaldoFinMay.toString();
      }

      await tx.update(schema.conciliaciones)
        .set(updateData)
        .where(eq(schema.conciliaciones.id, conciliacionId));
    });

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

    // Mapear movimientos por match_group_id para enriquecer matches (incluso históricos)
    const movsByMatchId = new Map<string, typeof movimientos>();
    for (const m of movimientos) {
      if (m.match_group_id) {
        if (!movsByMatchId.has(m.match_group_id)) movsByMatchId.set(m.match_group_id, []);
        movsByMatchId.get(m.match_group_id)!.push(m);
      }
    }

    const enrichedMatches = matches.map((match) => {
      const groupMovs = movsByMatchId.get(match.id) || [];
      const extMovs = groupMovs.filter((m) => m.source === 'EXTRACTO');
      const mayMovs = groupMovs.filter((m) => m.source === 'MAYOR');

      const existingMembers: string[] = (() => {
        if (!match.group_members) return [];
        if (Array.isArray(match.group_members)) return match.group_members;
        if (typeof match.group_members === 'object') return Object.values(match.group_members);
        try {
          const parsed = JSON.parse(match.group_members as any);
          return Array.isArray(parsed) ? parsed : Object.values(parsed);
        } catch {
          return [];
        }
      })();

      const allMembers = Array.from(new Set([
        ...existingMembers,
        ...groupMovs.map((m) => m.id),
      ]));

      return {
        ...match,
        confidence: Number(match.confidence),
        difference: Number(match.diferencia),
        extracto_id: extMovs.length === 1 ? extMovs[0].id : null,
        mayor_id: mayMovs.length === 1 ? mayMovs[0].id : null,
        group_members: allMembers,
      };
    });

    // Convertir montos de string a number (Drizzle devuelve decimal como string)
    const parseMov = (m: any) => ({ ...m, monto: Number(m.monto) });
    const extractoMovs = movimientos.filter((m) => m.source === 'EXTRACTO').map(parseMov) as unknown as NormalizedMovement[];
    const mayorMovs = movimientos.filter((m) => m.source === 'MAYOR').map(parseMov) as unknown as NormalizedMovement[];

    const summary = this.calcularSummary(extractoMovs, mayorMovs, enrichedMatches);

    return {
      ...conciliacion,
      movimientos,
      matches: enrichedMatches,
      extractoMovs,
      mayorMovs,
      summary,
    };
  }

  /**
   * Actualiza los saldos de una conciliación.
   */
  async updateSaldos(id: string, saldos: { 
    saldo_inicial_extracto?: string; 
    saldo_final_extracto?: string; 
    saldo_inicial_mayor?: string; 
    saldo_final_mayor?: string; 
  }) {
    const [conc] = await db.update(schema.conciliaciones)
      .set({
        saldo_inicial_extracto: saldos.saldo_inicial_extracto !== undefined ? saldos.saldo_inicial_extracto : null,
        saldo_final_extracto: saldos.saldo_final_extracto !== undefined ? saldos.saldo_final_extracto : null,
        saldo_inicial_mayor: saldos.saldo_inicial_mayor !== undefined ? saldos.saldo_inicial_mayor : null,
        saldo_final_mayor: saldos.saldo_final_mayor !== undefined ? saldos.saldo_final_mayor : null,
      })
      .where(eq(schema.conciliaciones.id, id))
      .returning();

    if (conc && conc.periodo_id) {
      const updateData: any = {};
      if (saldos.saldo_inicial_extracto !== undefined) updateData.saldo_inicial_extracto = saldos.saldo_inicial_extracto || null;
      if (saldos.saldo_inicial_mayor !== undefined) updateData.saldo_inicial_mayor = saldos.saldo_inicial_mayor || null;
      if (saldos.saldo_final_extracto !== undefined) updateData.saldo_final_extracto = saldos.saldo_final_extracto || null;
      if (saldos.saldo_final_mayor !== undefined) updateData.saldo_final_mayor = saldos.saldo_final_mayor || null;
      
      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date();
        await db.update(schema.periodos).set(updateData).where(eq(schema.periodos.id, conc.periodo_id));
      }
    }
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

    // Obtener SOLO los movimientos involucrados
    const { inArray } = await import('drizzle-orm');
    const involucrados = await db.query.movimientos.findMany({
      where: inArray(schema.movimientos.id, allIds),
    });

    const calcSigned = (m: any) => m.tipo === 'CREDITO' ? new Decimal(m.monto) : new Decimal(m.monto).negated();

    const extSet = new Set(extractoIds);
    const maySet = new Set(mayorIds);

    let extSum = new Decimal(0);
    let maySum = new Decimal(0);
    for (const m of involucrados) {
      if (extSet.has(m.id)) extSum = extSum.plus(calcSigned(m));
      if (maySet.has(m.id)) maySum = maySum.plus(calcSigned(m));
    }
    
    const diff = extSum.minus(maySum).absoluteValue();

    await db.transaction(async (tx) => {
      await tx.insert(schema.matches).values({
        id: matchId,
        conciliacion_id: conciliacionId,
        match_type: 'MANUAL',
        confidence: '1.00',
        diferencia: diff.toString(),
        group_members: allIds,
      });

      for (const eid of extractoIds) {
        await tx.insert(schema.matchMovimientos).values({
          match_id: matchId,
          movimiento_id: eid,
          role: 'EXTRACTO',
        });
        await tx.update(schema.movimientos)
          .set({ match_type: 'MANUAL', match_group_id: matchId })
          .where(eq(schema.movimientos.id, eid));
      }

      for (const mid of mayorIds) {
        await tx.insert(schema.matchMovimientos).values({
          match_id: matchId,
          movimiento_id: mid,
          role: 'MAYOR',
        });
        await tx.update(schema.movimientos)
          .set({ match_type: 'MANUAL', match_group_id: matchId })
          .where(eq(schema.movimientos.id, mid));
      }
    });

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
    await db.transaction(async (tx) => {
      const pivotEntries = await tx.query.matchMovimientos.findMany({
        where: eq(schema.matchMovimientos.match_id, matchId),
      });

      for (const entry of pivotEntries) {
        await tx.update(schema.movimientos)
          .set({ match_type: 'UNMATCHED', match_group_id: null })
          .where(eq(schema.movimientos.id, entry.movimiento_id));
      }

      await tx.delete(schema.matchMovimientos)
        .where(eq(schema.matchMovimientos.match_id, matchId));
      await tx.delete(schema.matches)
        .where(eq(schema.matches.id, matchId));
    });
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

    const { matches, matchedExt, matchedMay } = await db.transaction(async (tx) => {
      // 2. Eliminar matches automáticos y resetear movimientos
      if (autoMatches.length > 0) {
        await tx.update(schema.movimientos)
          .set({ match_type: 'UNMATCHED', match_group_id: null })
          .where(
            and(
              eq(schema.movimientos.conciliacion_id, conciliacionId),
              sql`${schema.movimientos.match_type} != 'MANUAL'`
            )
          );

        await tx.delete(schema.matches)
          .where(
            and(
              eq(schema.matches.conciliacion_id, conciliacionId),
              sql`${schema.matches.match_type} != 'MANUAL'`
            )
          );
      }

      // 3. Cargar todos los movimientos actualizados dentro de la transacción
      const movimientos = await tx.query.movimientos.findMany({
        where: eq(schema.movimientos.conciliacion_id, conciliacionId),
      });
      const parseMov = (m: any) => ({ ...m, monto: Number(m.monto) });
      const extractoMovs = movimientos
        .filter((m) => m.source === 'EXTRACTO')
        .map(parseMov) as unknown as NormalizedMovement[];
      const mayorMovs = movimientos
        .filter((m) => m.source === 'MAYOR')
        .map(parseMov) as unknown as NormalizedMovement[];

      // Determinar el banco de la conciliación para usar el pipeline correcto
      const bankName = (conciliacion as any).banco || 'galicia';
      const bankParser = getBankParser(bankName);
      const pipeline = bankParser.getMatchingPipeline();

      // 4. Re-ejecutar matching engine
      const { matches: newMatches, extractoMovs: matchedExt, mayorMovs: matchedMay } =
        matchingEngine.execute(extractoMovs, mayorMovs, pipeline);

      // 5. Guardar nuevos matches
      if (newMatches.length > 0) {
        const matchValues = newMatches.map((match) => {
          const members = (match.group_members && match.group_members.length > 0)
            ? match.group_members
            : ([match.extracto_id, match.mayor_id].filter(Boolean) as string[]);
          return {
            id: match.id,
            conciliacion_id: conciliacionId,
            match_type: match.match_type,
            confidence: match.confidence.toString(),
            diferencia: match.difference.toString(),
            group_members: members,
          };
        });
        await tx.insert(schema.matches).values(matchValues);

        const pivotValues = newMatches.flatMap((match) => {
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
          await tx.insert(schema.matchMovimientos).values(pivotValues);
        }
      }

      // 6. Actualizar match_type en movimientos
      const movsToUpdate = [...matchedExt, ...matchedMay].filter(m => m.match_type !== 'UNMATCHED');
      for (const m of movsToUpdate) {
        await tx.update(schema.movimientos)
          .set({ match_type: m.match_type, match_group_id: m.match_group_id })
          .where(eq(schema.movimientos.id, m.id));
      }

      return { matches: newMatches, matchedExt, matchedMay };
    });

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
      if (m.extracto_id) matchedMovIds.add(m.extracto_id);
      if (m.mayor_id) matchedMovIds.add(m.mayor_id);
      if (m.group_members) {
        for (const mid of m.group_members as string[]) {
          matchedMovIds.add(mid);
        }
      }
    }

    const extCredito = extractoMovs
      .filter((m) => m.tipo === 'CREDITO')
      .reduce((s, m) => s.plus(m.monto), new Decimal(0));
    const extDebito = extractoMovs
      .filter((m) => m.tipo === 'DEBITO')
      .reduce((s, m) => s.plus(m.monto), new Decimal(0));

    const mayCredito = mayorMovs
      .filter((m) => m.tipo === 'CREDITO')
      .reduce((s, m) => s.plus(m.monto), new Decimal(0));
    const mayDebito = mayorMovs
      .filter((m) => m.tipo === 'DEBITO')
      .reduce((s, m) => s.plus(m.monto), new Decimal(0));

    const unmatchedExt = extractoMovs.filter(
      (m) => m.match_type === 'UNMATCHED' && !matchedMovIds.has(m.id)
    );
    const unmatchedMay = mayorMovs.filter(
      (m) => m.match_type === 'UNMATCHED' && !matchedMovIds.has(m.id)
    );

    return {
      total_extracto: extCredito.minus(extDebito).toNumber(),
      total_mayor: mayCredito.minus(mayDebito).toNumber(),
      matched_count: matches.length,
      matched_amount: extractoMovs
        .filter((m) => m.match_type !== 'UNMATCHED' && m.match_type !== 'TAX_CHILD')
        .reduce((s, m) => s.plus(m.tipo === 'CREDITO' ? m.monto : new Decimal(m.monto).negated()), new Decimal(0)).toNumber(),
      unmatched_extracto_count: unmatchedExt.length,
      unmatched_extracto_amount: unmatchedExt.reduce((s, m) => s.plus(m.tipo === 'CREDITO' ? m.monto : new Decimal(m.monto).negated()), new Decimal(0)).toNumber(),
      unmatched_mayor_count: unmatchedMay.length,
      unmatched_mayor_amount: unmatchedMay.reduce((s, m) => s.plus(m.tipo === 'CREDITO' ? m.monto : new Decimal(m.monto).negated()), new Decimal(0)).toNumber(),
      diferencia: extCredito.minus(extDebito).minus(mayCredito.minus(mayDebito)).toNumber(),
    };
  }
}

export const conciliacionService = new ConciliacionService();
