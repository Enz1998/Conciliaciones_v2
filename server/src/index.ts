import express from 'express';
import cors from 'cors';
import { config } from './config';
import conciliacionRoutes from './modules/conciliacion/routes';

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/conciliaciones', conciliacionRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Environment: ${config.nodeEnv}`);
});

export default app;
