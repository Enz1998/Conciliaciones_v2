import { Router, Request, Response } from 'express';
import multer from 'multer';
import { db, schema } from '../../db';
import { eq } from 'drizzle-orm';
import { conciliacionService } from './service';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * POST /api/conciliaciones/upload
 * Sube extracto bancario + libro mayor y crea una conciliación.
 */
router.post('/upload', upload.fields([
  { name: 'extracto', maxCount: 1 },
  { name: 'mayor', maxCount: 1 },
]), async (req: Request, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const extractoFile = files['extracto']?.[0];
    const mayorFile = files['mayor']?.[0];
    const bankName = (req.body.bankName as string) || 'galicia';

    if (!extractoFile || !mayorFile) {
      return res.status(400).json({ error: 'Se requieren ambos archivos: extracto y mayor' });
    }

    const extractoContent = extractoFile.buffer.toString('utf-8');
    const mayorContent = mayorFile.buffer.toString('utf-8');

    // Extraer saldos
    const s_ini_ext = req.body.saldo_inicial_extracto ? String(req.body.saldo_inicial_extracto) : null;
    const s_fin_ext = req.body.saldo_final_extracto ? String(req.body.saldo_final_extracto) : null;
    const s_ini_may = req.body.saldo_inicial_mayor ? String(req.body.saldo_inicial_mayor) : null;
    const s_fin_may = req.body.saldo_final_mayor ? String(req.body.saldo_final_mayor) : null;

    // Crear conciliación
    const [conciliacion] = await db.insert(schema.conciliaciones).values({
      nombre: req.body.nombre || `Conciliación ${new Date().toISOString().slice(0, 10)}`,
      extracto_filename: extractoFile.originalname,
      mayor_filename: mayorFile.originalname,
      estado: 'EN_PROGRESO',
      saldo_inicial_extracto: s_ini_ext,
      saldo_final_extracto: s_fin_ext,
      saldo_inicial_mayor: s_ini_may,
      saldo_final_mayor: s_fin_may,
    }).returning();

    // Procesar
    const result = await conciliacionService.procesar(
      conciliacion.id,
      extractoContent,
      mayorContent,
      bankName
    );

    res.json({
      id: conciliacion.id,
      ...result,
    });
  } catch (error: any) {
    console.error('Error en upload:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/conciliaciones/:id
 * Obtiene una conciliación completa.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await conciliacionService.getById(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Conciliación no encontrada' });
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/conciliaciones
 * Lista todas las conciliaciones.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const conciliaciones = await db.query.conciliaciones.findMany({
      orderBy: (c, { desc }) => [desc(c.created_at)],
    });
    res.json(conciliaciones);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/conciliaciones/:id
 * Elimina una conciliación.
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await conciliacionService.delete(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/conciliaciones/:id/match
 * Crea un match manual.
 */
router.post('/:id/match', async (req: Request, res: Response) => {
  try {
    const { extractoIds, mayorIds } = req.body;
    if ((!extractoIds || extractoIds.length === 0) && (!mayorIds || mayorIds.length === 0)) {
      return res.status(400).json({ error: 'Se requiere al menos un movimiento seleccionado' });
    }

    const result = await conciliacionService.createManualMatch(
      req.params.id,
      extractoIds,
      mayorIds
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/conciliaciones/:id/match/:matchId
 * Deshace un match.
 */
router.delete('/:id/match/:matchId', async (req: Request, res: Response) => {
  try {
    await conciliacionService.unmatch(req.params.matchId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/conciliaciones/:id/rematch
 * Re-ejecuta el matching automático preservando matches manuales.
 */
router.post('/:id/rematch', async (req: Request, res: Response) => {
  try {
    const result = await conciliacionService.rematch(req.params.id);
    if (!result) {
      return res.status(404).json({ error: 'Conciliación no encontrada' });
    }
    res.json(result);
  } catch (error: any) {
    console.error('Error en rematch:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
