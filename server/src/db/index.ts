import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import * as schema from './schema';
import { config } from '../config';

// Neon: usa HTTP por defecto (no necesita PostgreSQL local)
neonConfig.fetchConnectionCache = true;

const pool = new Pool({
  connectionString: config.databaseUrl,
});

export const db = drizzle(pool, { schema });
export { schema };
