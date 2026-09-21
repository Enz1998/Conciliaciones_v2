import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { db, schema } from '../../db';
import { eq } from 'drizzle-orm';
import { conciliacionService } from './service';
import { bankParsers } from '../banks/registry';
import { requireAuth } from '../../shared/middleware/auth';

const router = Router();

// Proteger todas las rutas de este router
router.use(requireAuth);

// Límite de 10MB para prevenir DoS por Out of Memory
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } 
});

/**
 * GET /api/conciliaciones/banks
 * Obtiene los bancos disponibles.
 */
router.get('/banks', (_req: Request, res: Response) => {
  const banksMetadata = Array.from(bankParsers.values()).map(parser => parser.metadata);
  res.json(banksMetadata);
});

/**
 * POST /api/conciliaciones/upload
 * Sube extracto bancario + libro mayor y crea una conciliación.
 * Soporta CSV (Galicia) y XLSX (MercadoPago).
 */
router.post('/upload', upload.fields([
  { name: 'extracto', maxCount: 1 },
  { name: 'mayor', maxCount: 1 },
]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const extractoFile = files['extracto']?.[0];
    const mayorFile = files['mayor']?.[0];
    const bankName = (req.body.bankName as string) || 'galicia';

    if (!extractoFile || !mayorFile) {
      return res.status(400).json({ error: 'Se requieren ambos archivos: extracto y mayor' });
    }

    // Detectar formato por extensión del archivo (.xls y .xlsx = Excel, el resto = CSV)
    const extName = extractoFile.originalname.toLowerCase();
    const extractoFormat = (extName.endsWith('.xlsx') || extName.endsWith('.xls')) ? 'xlsx' : 'csv';
    const mayName = mayorFile.originalname.toLowerCase();
    const mayorFormat = (mayName.endsWith('.xlsx') || mayName.endsWith('.xls')) ? 'xlsx' : 'csv';

    // Extraer saldos y periodo
    const s_ini_ext = req.body.saldo_inicial_extracto ? String(req.body.saldo_inicial_extracto) : null;
    const s_fin_ext = req.body.saldo_final_extracto ? String(req.body.saldo_final_extracto) : null;
    const s_ini_may = req.body.saldo_inicial_mayor ? String(req.body.saldo_inicial_mayor) : null;
    const s_fin_may = req.body.saldo_final_mayor ? String(req.body.saldo_final_mayor) : null;
    const periodo_id = req.body.periodo_id ? String(req.body.periodo_id) : null;

    // Crear conciliación (incluye campo banco)
    const [conciliacion] = await db.insert(schema.conciliaciones).values({
      nombre: req.body.nombre || `Conciliación ${new Date().toISOString().slice(0, 10)}`,
      extracto_filename: extractoFile.originalname,
      mayor_filename: mayorFile.originalname,
      estado: 'EN_PROGRESO',
      banco: bankName,
      periodo_id: periodo_id,
      saldo_inicial_extracto: s_ini_ext,
      saldo_final_extracto: s_fin_ext,
      saldo_inicial_mayor: s_ini_may,
      saldo_final_mayor: s_fin_may,
    }).returning();

    // Actualizar los saldos del periodo si se proveyó un periodo_id
    if (periodo_id) {
      const updateData: any = {};
      // Actualizamos los iniciales siempre que el usuario los envíe
      if (s_ini_ext !== null) updateData.saldo_inicial_extracto = s_ini_ext;
      if (s_ini_may !== null) updateData.saldo_inicial_mayor = s_ini_may;
      // Los finales también, aunque generalmente se fijan al "Cerrar Mes"
      if (s_fin_ext !== null) updateData.saldo_final_extracto = s_fin_ext;
      if (s_fin_may !== null) updateData.saldo_final_mayor = s_fin_may;
      
      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date();
        try {
          await db.update(schema.periodos)
            .set(updateData)
            .where(eq(schema.periodos.id, periodo_id));
        } catch (e) {
          console.error("No se pudo actualizar el periodo:", e);
        }
      }
    }

    // Procesar pasando los buffers asíncronamente para no bloquear el request
    conciliacionService.procesar(
      conciliacion.id,
      extractoFile.buffer,
      mayorFile.buffer,
      bankName,
      extractoFormat,
      mayorFormat
    ).catch(async (err) => {
      console.error('Error procesando conciliación en background:', err);
      try {
        await db.update(schema.conciliaciones).set({ estado: 'ERROR' }).where(eq(schema.conciliaciones.id, conciliacion.id));
      } catch(e) {
        console.error('No se pudo actualizar el estado a ERROR', e);
      }
    });

    // Responder inmediatamente
    res.json({
      id: conciliacion.id,
      estado: 'EN_PROGRESO'
    });
  } catch (error: any) {
    if (error.message && error.message.includes('válido')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

/**
 * GET /api/conciliaciones/:id
 * Obtiene una conciliación completa.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await conciliacionService.getById(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Conciliación no encontrada' });
    }
    res.json(result);
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /api/conciliaciones
 * Lista todas las conciliaciones.
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const conciliaciones = await db.query.conciliaciones.findMany({
      orderBy: (c, { desc }) => [desc(c.created_at)],
    });
    res.json(conciliaciones);
  } catch (error: any) {
    next(error);
  }
});

/**
 * DELETE /api/conciliaciones/:id
 * Elimina una conciliación.
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await conciliacionService.delete(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    next(error);
  }
});

import { z } from 'zod';

const manualMatchSchema = z.object({
  extractoIds: z.array(z.string().uuid()).default([]),
  mayorIds: z.array(z.string().uuid()).default([]),
}).refine(data => data.extractoIds.length > 0 || data.mayorIds.length > 0, {
  message: "Se requiere al menos un movimiento seleccionado",
});

/**
 * POST /api/conciliaciones/:id/match
 * Crea un match manual.
 */
router.post('/:id/match', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = manualMatchSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }
    const { extractoIds, mayorIds } = parseResult.data;

    const result = await conciliacionService.createManualMatch(
      req.params.id,
      extractoIds,
      mayorIds
    );

    res.json(result);
  } catch (error: any) {
    next(error);
  }
});

/**
 * DELETE /api/conciliaciones/:id/match/:matchId
 * Deshace un match.
 */
router.delete('/:id/match/:matchId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await conciliacionService.unmatch(req.params.matchId);
    res.json({ success: true });
  } catch (error: any) {
    next(error);
  }
});

const saldosSchema = z.object({
  saldo_inicial_extracto: z.string().nullable().optional(),
  saldo_final_extracto: z.string().nullable().optional(),
  saldo_inicial_mayor: z.string().nullable().optional(),
  saldo_final_mayor: z.string().nullable().optional(),
});

/**
 * PUT /api/conciliaciones/:id/saldos
 * Actualiza los saldos de una conciliación.
 */
router.put('/:id/saldos', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = saldosSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }
    const { 
      saldo_inicial_extracto, 
      saldo_final_extracto, 
      saldo_inicial_mayor, 
      saldo_final_mayor 
    } = parseResult.data;
    
    await conciliacionService.updateSaldos(req.params.id, {
      saldo_inicial_extracto: saldo_inicial_extracto ?? undefined,
      saldo_final_extracto: saldo_final_extracto ?? undefined,
      saldo_inicial_mayor: saldo_inicial_mayor ?? undefined,
      saldo_final_mayor: saldo_final_mayor ?? undefined,
    });
    
    res.json({ success: true });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /api/conciliaciones/:id/rematch
 * Re-ejecuta el matching automático preservando matches manuales.
 */
router.post('/:id/rematch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await conciliacionService.rematch(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Conciliación no encontrada' });
    }
    res.json(result);
  } catch (error: any) {
    next(error);
  }
});

export default router;
