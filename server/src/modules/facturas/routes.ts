import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { db, schema } from '../../db';
import { eq } from 'drizzle-orm';
import { facturasService } from './service';
import { requireAuth } from '../../shared/middleware/auth';

const router = Router();

router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * POST /api/facturas/proveedores/sync
 * Sincroniza el maestro de proveedores del ERP (reemplaza el contenido completo).
 */
router.post('/proveedores/sync', upload.single('proveedores'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Se requiere el archivo del maestro de proveedores' });
    }
    const result = await facturasService.syncProveedores(req.file.buffer);
    res.json(result);
  } catch (error: any) {
    if (error.message && error.message.includes('válido')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * GET /api/facturas/proveedores/count
 * Cantidad de proveedores sincronizados (para que la UI sepa si hace falta sincronizar).
 */
router.get('/proveedores/count', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await facturasService.getProveedoresCount();
    res.json({ count });
  } catch (error: any) {
    next(error);
  }
});

const conceptoSchema = z.object({
  nombre: z.string().min(1, 'Falta el nombre del proveedor'),
  concepto: z.string().max(255),
});

/**
 * PUT /api/facturas/conceptos
 * Asigna el concepto de un proveedor (por nombre) — se aplica a todos sus
 * comprobantes, pasados y futuros, y sobrevive a la resincronización del
 * maestro de proveedores.
 */
router.put('/conceptos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = conceptoSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }
    const result = await facturasService.setConcepto(parseResult.data.nombre, parseResult.data.concepto);
    res.json(result);
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/facturas/upload
 * Sube "Mis Comprobantes Recibidos" (AFIP) + libro de facturas (ERP) y crea una conciliación.
 */
router.post('/upload', upload.fields([
  { name: 'afip', maxCount: 1 },
  { name: 'erp', maxCount: 1 },
]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const afipFile = files['afip']?.[0];
    const erpFile = files['erp']?.[0];

    if (!afipFile || !erpFile) {
      return res.status(400).json({ error: 'Se requieren ambos archivos: comprobantes AFIP y facturas del ERP' });
    }

    const proveedoresCount = await facturasService.getProveedoresCount();
    if (proveedoresCount === 0) {
      return res.status(400).json({ error: 'Todavía no sincronizaste el maestro de proveedores. Hacelo antes de subir una conciliación.' });
    }

    const periodo_id = req.body.periodo_id ? String(req.body.periodo_id) : null;

    const [conciliacion] = await db.insert(schema.facturasConciliaciones).values({
      nombre: req.body.nombre || `Facturas ${new Date().toISOString().slice(0, 10)}`,
      afip_filename: afipFile.originalname,
      erp_filename: erpFile.originalname,
      estado: 'EN_PROGRESO',
      periodo_id,
    }).returning();

    facturasService.procesar(conciliacion.id, afipFile.buffer, erpFile.buffer).catch(async (err) => {
      console.error('Error procesando conciliación de facturas en background:', err);
      try {
        await db.update(schema.facturasConciliaciones).set({ estado: 'ERROR' }).where(eq(schema.facturasConciliaciones.id, conciliacion.id));
      } catch (e) {
        console.error('No se pudo actualizar el estado a ERROR', e);
      }
    });

    res.json({ id: conciliacion.id, estado: 'EN_PROGRESO' });
  } catch (error: any) {
    if (error.message && (error.message.includes('válido') || error.message.includes('válida'))) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * GET /api/facturas
 * Lista todas las conciliaciones de facturas.
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const conciliaciones = await db.query.facturasConciliaciones.findMany({
      orderBy: (c, { desc }) => [desc(c.created_at)],
    });
    res.json(conciliaciones);
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/facturas/:id
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await facturasService.getById(req.params.id);
    if (!result) return res.status(404).json({ error: 'Conciliación no encontrada' });
    res.json(result);
  } catch (error: any) {
    next(error);
  }
});

/**
 * DELETE /api/facturas/:id
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await facturasService.delete(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    next(error);
  }
});

const deleteComprobantesSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'Se requiere al menos un comprobante seleccionado'),
});

/**
 * DELETE /api/facturas/:id/comprobantes
 * Elimina comprobantes puntuales (solo los UNMATCHED) de una conciliación.
 */
router.delete('/:id/comprobantes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = deleteComprobantesSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }
    const result = await facturasService.deleteComprobantes(req.params.id, parseResult.data.ids);
    res.json(result);
  } catch (error: any) {
    next(error);
  }
});

const manualMatchSchema = z.object({
  afipIds: z.array(z.string().uuid()).default([]),
  erpIds: z.array(z.string().uuid()).default([]),
}).refine((data) => data.afipIds.length > 0 || data.erpIds.length > 0, {
  message: 'Se requiere al menos un comprobante seleccionado',
});

/**
 * POST /api/facturas/:id/match
 */
router.post('/:id/match', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = manualMatchSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }
    const { afipIds, erpIds } = parseResult.data;
    const result = await facturasService.createManualMatch(req.params.id, afipIds, erpIds);
    res.json(result);
  } catch (error: any) {
    next(error);
  }
});

/**
 * DELETE /api/facturas/:id/match/:matchId
 */
router.delete('/:id/match/:matchId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await facturasService.unmatch(req.params.matchId);
    res.json({ success: true });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/facturas/:id/rematch
 */
router.post('/:id/rematch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await facturasService.rematch(req.params.id);
    if (!result) return res.status(404).json({ error: 'Conciliación no encontrada' });
    res.json(result);
  } catch (error: any) {
    next(error);
  }
});

export default router;
