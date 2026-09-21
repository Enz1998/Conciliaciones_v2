import { Router } from 'express';
import { periodosController } from './controller';

const router = Router();

router.get('/', periodosController.getPeriodos);
router.post('/', periodosController.createPeriodo);
router.patch('/:id/saldos', periodosController.updateSaldos);
router.post('/:id/cerrar', periodosController.cerrarMes);
router.post('/:id/reabrir', periodosController.reabrirMes);

export default router;
