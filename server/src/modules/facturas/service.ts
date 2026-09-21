import { db, schema } from '../../db';
import { eq, and, sql, inArray } from 'drizzle-orm';
import Decimal from 'decimal.js';
import { AfipComprobantesParser } from './afip-parser';
import { ErpFacturasParser } from './erp-parser';
import { ProveedoresParser, buildProveedorLookup } from './proveedores-parser';
import { facturasMatchingEngine } from './matching/engine';
import { NormalizedComprobante, FacturasConciliacionSummary } from '../../shared/types';
import { normalizarContraparte } from '../../shared/utils';

const afipParser = new AfipComprobantesParser();
const erpParser = new ErpFacturasParser();
const proveedoresParser = new ProveedoresParser();

/** Reconstruye un NormalizedComprobante a partir de una fila de la tabla `comprobantes` (columnas snake_case). */
function rowToComprobante(row: any): NormalizedComprobante {
  return {
    id: row.id,
    source: row.source,
    tipoComprobante: row.tipo_comprobante,
    letra: row.letra,
    puntoVenta: row.punto_venta,
    numero: row.numero,
    fecha: row.fecha,
    cuitEmisor: row.cuit_emisor,
    emisor: row.emisor,
    emisor_normalizado: row.emisor_normalizado,
    moneda: row.moneda,
    cotizacion: Number(row.cotizacion),
    importeTotal: Number(row.importe_total),
    importeTotalLocal: Number(row.importe_total_local),
    metadata: row.metadata,
    match_group_id: row.match_group_id,
    match_type: row.match_type,
  };
}

/** Adjunta el concepto asignado por el usuario (por proveedor) a cada comprobante, si existe. */
async function attachConceptos(comps: NormalizedComprobante[]): Promise<NormalizedComprobante[]> {
  if (comps.length === 0) return comps;
  const rows = await db.select().from(schema.proveedorConceptos);
  const map = new Map(rows.map((r) => [r.nombre_normalizado, r.concepto]));
  return comps.map((c) => ({ ...c, concepto: map.get(c.emisor_normalizado) || '' }));
}

export class FacturasService {
  /** Asigna (o actualiza) el concepto de un proveedor, identificado por su nombre. */
  async setConcepto(nombreProveedor: string, concepto: string) {
    const nombreNormalizado = normalizarContraparte(nombreProveedor);
    await db.insert(schema.proveedorConceptos)
      .values({ nombre_normalizado: nombreNormalizado, concepto })
      .onConflictDoUpdate({
        target: schema.proveedorConceptos.nombre_normalizado,
        set: { concepto, updated_at: new Date() },
      });
    return { nombre_normalizado: nombreNormalizado, concepto };
  }

  /**
   * Sincroniza el maestro de proveedores del ERP: reemplaza el contenido
   * completo de la tabla (no es incremental — el maestro se sube entero
   * cada vez que cambia, ver plan Sección 4.4).
   */
  async syncProveedores(buffer: Buffer) {
    const raw = proveedoresParser.parseXLSX(buffer);
    const proveedores = proveedoresParser.normalize(raw);

    if (proveedores.length === 0) {
      throw new Error('El archivo no contiene proveedores válidos con CUIT.');
    }

    await db.transaction(async (tx) => {
      await tx.delete(schema.proveedores);
      await tx.insert(schema.proveedores).values(
        proveedores.map((p) => ({
          nombre: p.nombre,
          nombre_normalizado: p.nombre_normalizado,
          cuit: p.cuit,
          condicion_iva: p.condicion_iva,
          activo: p.activo,
        }))
      );
    });

    return { count: proveedores.length };
  }

  async getProveedoresCount(): Promise<number> {
    const rows = await db.select({ count: sql<number>`count(*)::int` }).from(schema.proveedores);
    return rows[0]?.count || 0;
  }

  /**
   * Procesa una conciliación de facturas completa:
   * 1. Parsea AFIP y ERP
   * 2. Resuelve el CUIT de cada factura del ERP contra el maestro de proveedores
   * 3. Ejecuta el matching (comprobante exacto → proveedor+importe)
   * 4. Guarda todo en la DB
   */
  async procesar(conciliacionId: string, afipBuffer: Buffer, erpBuffer: Buffer) {
    const proveedoresRows = await db.select().from(schema.proveedores);
    const lookup = buildProveedorLookup(
      proveedoresRows.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        nombre_normalizado: p.nombre_normalizado,
        cuit: p.cuit,
        condicion_iva: p.condicion_iva || '',
        activo: p.activo,
      }))
    );

    const rawAfip = afipParser.parseXLSX(afipBuffer);
    const { comprobantes: afipCompsRaw, omitidos: omitidosAfip } = afipParser.normalize(rawAfip);

    const rawErp = erpParser.parseXLSX(erpBuffer);
    const { comprobantes: erpCompsRaw, omitidos: omitidosErp } = erpParser.normalize(rawErp, lookup);

    const { matches, afipComps, erpComps } = facturasMatchingEngine.execute(afipCompsRaw, erpCompsRaw);

    await db.transaction(async (tx) => {
      const allComps = [...afipComps, ...erpComps];
      if (allComps.length > 0) {
        await tx.insert(schema.comprobantes).values(
          allComps.map((c) => this.compToRow(conciliacionId, c))
        );
      }

      if (matches.length > 0) {
        await tx.insert(schema.comprobanteMatches).values(
          matches.map((m) => ({
            id: m.id,
            conciliacion_id: conciliacionId,
            afip_comprobante_id: m.afip_id,
            erp_comprobante_id: m.erp_id,
            match_type: m.match_type,
            confidence: m.confidence.toString(),
            diferencia: m.difference.toString(),
          }))
        );
      }

      const fechas = [...afipComps, ...erpComps].map((c) => c.fecha).sort();
      await tx.update(schema.facturasConciliaciones)
        .set({
          estado: 'COMPLETADA',
          omitidos_afip: omitidosAfip,
          omitidos_erp: omitidosErp,
          fecha_inicio: fechas[0] || null,
          fecha_fin: fechas[fechas.length - 1] || null,
          updated_at: new Date(),
        })
        .where(eq(schema.facturasConciliaciones.id, conciliacionId));
    });

    const summary = this.calcularSummary(afipComps, erpComps, matches);
    return {
      afipComps: await attachConceptos(afipComps),
      erpComps: await attachConceptos(erpComps),
      matches, summary, omitidosAfip, omitidosErp,
    };
  }

  async getById(conciliacionId: string) {
    const conciliacion = await db.query.facturasConciliaciones.findFirst({
      where: eq(schema.facturasConciliaciones.id, conciliacionId),
    });
    if (!conciliacion) return null;

    const comprobantesRows = await db.query.comprobantes.findMany({
      where: eq(schema.comprobantes.conciliacion_id, conciliacionId),
    });
    const matchesRows = await db.query.comprobanteMatches.findMany({
      where: eq(schema.comprobanteMatches.conciliacion_id, conciliacionId),
    });

    const afipComps = await attachConceptos(comprobantesRows.filter((c) => c.source === 'AFIP').map(rowToComprobante));
    const erpComps = await attachConceptos(comprobantesRows.filter((c) => c.source === 'ERP').map(rowToComprobante));

    const matches = matchesRows.map((m) => ({
      id: m.id,
      afip_id: m.afip_comprobante_id,
      erp_id: m.erp_comprobante_id,
      match_type: m.match_type,
      confidence: Number(m.confidence),
      difference: Number(m.diferencia),
      group_members: (m.group_members as string[] | null) || [],
    }));

    const summary = this.calcularSummary(afipComps, erpComps, matches as any);

    return { ...conciliacion, afipComps, erpComps, matches, summary };
  }

  async delete(conciliacionId: string) {
    await db.delete(schema.facturasConciliaciones).where(eq(schema.facturasConciliaciones.id, conciliacionId));
  }

  /**
   * Elimina comprobantes puntuales (ej. filas en $0, duplicados o que no
   * corresponden) de una conciliación. Solo permite borrar los que están
   * UNMATCHED — uno matcheado hay que desvincularlo primero (unmatch).
   */
  async deleteComprobantes(conciliacionId: string, ids: string[]) {
    if (ids.length === 0) return { deleted: 0 };
    const result = await db.delete(schema.comprobantes)
      .where(and(
        eq(schema.comprobantes.conciliacion_id, conciliacionId),
        inArray(schema.comprobantes.id, ids),
        eq(schema.comprobantes.match_type, 'UNMATCHED')
      ))
      .returning({ id: schema.comprobantes.id });
    return { deleted: result.length };
  }

  /**
   * Crea un match manual. Soporta selección múltiple de cada lado (varios
   * comprobantes AFIP contra varios ERP) — cuando hay exactamente uno de
   * cada lado también se completan afip_comprobante_id/erp_comprobante_id
   * para que se comporte igual que un match AUTO en el resto de la UI.
   */
  async createManualMatch(conciliacionId: string, afipIds: string[], erpIds: string[]) {
    const allIds = [...afipIds, ...erpIds];
    if (allIds.length === 0) throw new Error('Se requiere al menos un comprobante seleccionado');

    const matchId = crypto.randomUUID();

    const rows = await db.select().from(schema.comprobantes).where(inArray(schema.comprobantes.id, allIds));
    const sum = (ids: string[]) => ids.reduce((s, cid) => {
      const r = rows.find((row) => row.id === cid);
      return r ? s.plus(r.importe_total_local) : s;
    }, new Decimal(0));
    const afipSum = sum(afipIds);
    const erpSum = sum(erpIds);
    const diff = afipSum.minus(erpSum).absoluteValue().toNumber();

    await db.transaction(async (tx) => {
      await tx.insert(schema.comprobanteMatches).values({
        id: matchId,
        conciliacion_id: conciliacionId,
        afip_comprobante_id: afipIds.length === 1 ? afipIds[0] : null,
        erp_comprobante_id: erpIds.length === 1 ? erpIds[0] : null,
        match_type: 'MANUAL',
        confidence: '1.00',
        diferencia: diff.toString(),
        group_members: allIds,
      });

      await tx.update(schema.comprobantes)
        .set({ match_type: 'MANUAL', match_group_id: matchId })
        .where(inArray(schema.comprobantes.id, allIds));
    });

    return { matchId, diff };
  }

  async unmatch(matchId: string) {
    await db.transaction(async (tx) => {
      const [match] = await tx.select().from(schema.comprobanteMatches).where(eq(schema.comprobanteMatches.id, matchId));
      if (!match) return;

      const ids = ((match.group_members as string[] | null) && (match.group_members as string[]).length > 0)
        ? (match.group_members as string[])
        : [match.afip_comprobante_id, match.erp_comprobante_id].filter((x): x is string => !!x);

      if (ids.length > 0) {
        await tx.update(schema.comprobantes)
          .set({ match_type: 'UNMATCHED', match_group_id: null })
          .where(inArray(schema.comprobantes.id, ids));
      }
      await tx.delete(schema.comprobanteMatches).where(eq(schema.comprobanteMatches.id, matchId));
    });
  }

  /**
   * Re-ejecuta el matching automático preservando matches manuales.
   */
  async rematch(conciliacionId: string) {
    const conciliacion = await db.query.facturasConciliaciones.findFirst({
      where: eq(schema.facturasConciliaciones.id, conciliacionId),
    });
    if (!conciliacion) return null;

    const allMatches = await db.query.comprobanteMatches.findMany({
      where: eq(schema.comprobanteMatches.conciliacion_id, conciliacionId),
    });
    const autoMatches = allMatches.filter((m) => m.match_type !== 'MANUAL');

    const { matches, afipComps, erpComps } = await db.transaction(async (tx) => {
      if (autoMatches.length > 0) {
        await tx.update(schema.comprobantes)
          .set({ match_type: 'UNMATCHED', match_group_id: null })
          .where(and(
            eq(schema.comprobantes.conciliacion_id, conciliacionId),
            sql`${schema.comprobantes.match_type} != 'MANUAL'`
          ));

        await tx.delete(schema.comprobanteMatches)
          .where(and(
            eq(schema.comprobanteMatches.conciliacion_id, conciliacionId),
            sql`${schema.comprobanteMatches.match_type} != 'MANUAL'`
          ));
      }

      const comprobantesRows = await tx.query.comprobantes.findMany({
        where: eq(schema.comprobantes.conciliacion_id, conciliacionId),
      });
      const afip = comprobantesRows.filter((c) => c.source === 'AFIP').map(rowToComprobante);
      const erp = comprobantesRows.filter((c) => c.source === 'ERP').map(rowToComprobante);

      const { matches: newMatches, afipComps: matchedAfip, erpComps: matchedErp } = facturasMatchingEngine.execute(afip, erp);

      if (newMatches.length > 0) {
        await tx.insert(schema.comprobanteMatches).values(
          newMatches.map((m) => ({
            id: m.id,
            conciliacion_id: conciliacionId,
            afip_comprobante_id: m.afip_id,
            erp_comprobante_id: m.erp_id,
            match_type: m.match_type,
            confidence: m.confidence.toString(),
            diferencia: m.difference.toString(),
          }))
        );
      }

      const toUpdate = [...matchedAfip, ...matchedErp].filter((c) => c.match_type !== 'UNMATCHED');
      for (const c of toUpdate) {
        await tx.update(schema.comprobantes).set({ match_type: c.match_type, match_group_id: c.match_group_id }).where(eq(schema.comprobantes.id, c.id));
      }

      return { matches: newMatches, afipComps: matchedAfip, erpComps: matchedErp };
    });

    const summary = this.calcularSummary(afipComps, erpComps, [
      ...(autoMatches.length !== allMatches.length ? allMatches.filter((m) => m.match_type === 'MANUAL').map((m) => ({
        id: m.id, afip_id: m.afip_comprobante_id, erp_id: m.erp_comprobante_id,
        match_type: m.match_type as any, confidence: Number(m.confidence), difference: Number(m.diferencia),
      })) : []),
      ...matches,
    ]);

    return { afipComps, erpComps, matches, summary, rematchedCount: matches.length };
  }

  private compToRow(conciliacionId: string, c: NormalizedComprobante) {
    return {
      id: c.id,
      conciliacion_id: conciliacionId,
      source: c.source,
      tipo_comprobante: c.tipoComprobante,
      letra: c.letra,
      punto_venta: c.puntoVenta,
      numero: c.numero,
      fecha: c.fecha,
      cuit_emisor: c.cuitEmisor,
      emisor: c.emisor,
      emisor_normalizado: c.emisor_normalizado,
      moneda: c.moneda,
      cotizacion: c.cotizacion.toString(),
      importe_total: c.importeTotal.toString(),
      importe_total_local: c.importeTotalLocal.toString(),
      metadata: c.metadata,
      match_group_id: c.match_group_id,
      match_type: c.match_type,
    };
  }

  private calcularSummary(
    afipComps: NormalizedComprobante[],
    erpComps: NormalizedComprobante[],
    matches: any[]
  ): FacturasConciliacionSummary {
    const matchedIds = new Set<string>();
    for (const m of matches) {
      if (m.afip_id) matchedIds.add(m.afip_id);
      if (m.erp_id) matchedIds.add(m.erp_id);
    }

    const sum = (comps: NormalizedComprobante[]) => comps.reduce((s, c) => s.plus(c.importeTotalLocal), new Decimal(0));

    const totalAfip = sum(afipComps);
    const totalErp = sum(erpComps);

    const unmatchedAfip = afipComps.filter((c) => c.match_type === 'UNMATCHED' && !matchedIds.has(c.id));
    const unmatchedErp = erpComps.filter((c) => c.match_type === 'UNMATCHED' && !matchedIds.has(c.id));

    return {
      total_afip: totalAfip.toNumber(),
      total_erp: totalErp.toNumber(),
      matched_count: matches.length,
      matched_amount: afipComps
        .filter((c) => c.match_type !== 'UNMATCHED')
        .reduce((s, c) => s.plus(c.importeTotalLocal), new Decimal(0)).toNumber(),
      unmatched_afip_count: unmatchedAfip.length,
      unmatched_afip_amount: sum(unmatchedAfip).toNumber(),
      unmatched_erp_count: unmatchedErp.length,
      unmatched_erp_amount: sum(unmatchedErp).toNumber(),
      diferencia: totalAfip.minus(totalErp).toNumber(),
    };
  }
}

export const facturasService = new FacturasService();
