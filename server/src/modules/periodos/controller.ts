import { Request, Response } from 'express';
import { db, schema } from '../../db';
import { eq, and, desc } from 'drizzle-orm';
import { periodos } from '../../db/schema';

export const periodosController = {
  // 1. Listar períodos (generalmente por banco)
  async getPeriodos(req: Request, res: Response) {
    try {
      const banco = req.query.banco as string;
      let query = db.select().from(periodos);
      
      if (banco) {
        query = query.where(eq(periodos.banco, banco)) as any;
      }
      
      const results = await query.orderBy(desc(periodos.anio), desc(periodos.mes));
      res.json(results);
    } catch (error: any) {
      console.error('Error al obtener periodos:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // 2. Crear un nuevo período
  async createPeriodo(req: Request, res: Response) {
    try {
      const { banco, mes, anio, saldo_inicial_extracto, saldo_inicial_mayor } = req.body;
      
      if (!banco || !mes || !anio) {
        return res.status(400).json({ error: 'Faltan campos obligatorios: banco, mes, anio' });
      }

      // Check if period already exists
      const existing = await db.select().from(periodos)
        .where(and(eq(periodos.banco, banco), eq(periodos.mes, mes), eq(periodos.anio, anio)));

      if (existing.length > 0) {
        return res.status(400).json({ error: 'El período ya existe para este banco.' });
      }

      const [newPeriodo] = await db.insert(periodos).values({
        banco,
        mes,
        anio,
        saldo_inicial_extracto: saldo_inicial_extracto?.toString() || null,
        saldo_inicial_mayor: saldo_inicial_mayor?.toString() || null,
      }).returning();

      res.status(201).json(newPeriodo);
    } catch (error: any) {
      console.error('Error al crear periodo:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // 3. Actualizar saldos iniciales (si hay correcciones y está ABIERTO)
  async updateSaldos(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { saldo_inicial_extracto, saldo_inicial_mayor, saldo_final_extracto, saldo_final_mayor } = req.body;

      const toUpdate: any = { updated_at: new Date() };
      if (saldo_inicial_extracto !== undefined) toUpdate.saldo_inicial_extracto = saldo_inicial_extracto?.toString();
      if (saldo_inicial_mayor !== undefined) toUpdate.saldo_inicial_mayor = saldo_inicial_mayor?.toString();
      if (saldo_final_extracto !== undefined) toUpdate.saldo_final_extracto = saldo_final_extracto?.toString();
      if (saldo_final_mayor !== undefined) toUpdate.saldo_final_mayor = saldo_final_mayor?.toString();

      const [updated] = await db.update(periodos)
        .set(toUpdate)
        .where(eq(periodos.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Período no encontrado' });
      }

      res.json(updated);
    } catch (error: any) {
      console.error('Error al actualizar saldos:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // 4. Cerrar el mes
  async cerrarMes(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { saldo_final_extracto, saldo_final_mayor } = req.body;

      if (saldo_final_extracto === undefined || saldo_final_mayor === undefined) {
        return res.status(400).json({ error: 'Se requieren los saldos finales para cerrar el mes.' });
      }

      // Validar que exista el periodo y no esté cerrado ya
      const [periodo] = await db.select().from(periodos).where(eq(periodos.id, id));
      if (!periodo) {
        return res.status(404).json({ error: 'Período no encontrado' });
      }
      if (periodo.estado === 'CERRADO') {
        return res.status(400).json({ error: 'El período ya está cerrado.' });
      }

      // Se asume que el Frontend ya validó que (Inicial + Movimientos) - Final = 0.
      // Podríamos hacer la validación aquí en el Backend sumando todo, pero para empezar guardamos el estado.
      
      const [updated] = await db.update(periodos)
        .set({
          estado: 'CERRADO',
          saldo_final_extracto: saldo_final_extracto.toString(),
          saldo_final_mayor: saldo_final_mayor.toString(),
          updated_at: new Date(),
        })
        .where(eq(periodos.id, id))
        .returning();

      // Crear automáticamente el próximo período
      let nextMes = periodo.mes + 1;
      let nextAnio = periodo.anio;
      if (nextMes > 12) {
        nextMes = 1;
        nextAnio += 1;
      }

      await db.insert(periodos).values({
        banco: periodo.banco,
        mes: nextMes,
        anio: nextAnio,
        estado: 'ABIERTO',
        saldo_inicial_extracto: saldo_final_extracto.toString(),
        saldo_inicial_mayor: saldo_final_mayor.toString(),
      });

      res.json(updated);
    } catch (error: any) {
      console.error('Error al cerrar el mes:', error);
      res.status(500).json({ error: error.message });
    }
  },

  // 5. Reabrir mes
  async reabrirMes(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const [updated] = await db.update(periodos)
        .set({
          estado: 'ABIERTO',
          updated_at: new Date(),
        })
        .where(eq(periodos.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: 'Período no encontrado' });
      }

      // Nota: Si reabre un mes, el siguiente mes (que se creó automáticamente) 
      // quizá deba ser borrado o ajustado manualmente si ya tiene conciliaciones. 
      // Por ahora lo dejamos simple.

      res.json(updated);
    } catch (error: any) {
      console.error('Error al reabrir el mes:', error);
      res.status(500).json({ error: error.message });
    }
  }
};
