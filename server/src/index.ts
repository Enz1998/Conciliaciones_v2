import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config';
import conciliacionRoutes from './modules/conciliacion/routes';
import periodosRoutes from './modules/periodos/routes';
import facturasRoutes from './modules/facturas/routes';

const app = express();
const PORT = config.port || 3002;

app.use(cors({
  origin: config.nodeEnv === 'production' ? process.env.FRONTEND_URL || false : '*'
}));
app.use(express.json());

// Routes
app.use('/api/conciliaciones', conciliacionRoutes);
app.use('/api/periodos', periodosRoutes);
app.use('/api/facturas', facturasRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('🔥 Error no controlado:', err);
  
  // Ocultar error en producción, mostrarlo si estamos en desarrollo
  const errorMsg = config.nodeEnv === 'development' ? err.message : 'Error interno del servidor';
  
  res.status(err.status || 500).json({
    error: errorMsg,
  });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📋 Environment: ${config.nodeEnv}`);
  });
}

export default app;

