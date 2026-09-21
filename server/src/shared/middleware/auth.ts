import { Request, Response, NextFunction } from 'express';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  // API_SECRET desde variable de entorno o fallback para desarrollo
  const expectedToken = process.env.API_SECRET || 'dev-super-secret-token';

  if (!token || token !== expectedToken) {
    return res.status(401).json({ error: 'No autorizado. Token inválido o ausente.' });
  }

  next();
}
