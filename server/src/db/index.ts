import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { config } from '../config';

const getCleanConnectionString = (urlStr: string) => {
  try {
    const url = new URL(urlStr);
    url.searchParams.delete('sslmode');
    return url.toString();
  } catch {
    return urlStr;
  }
};

const pool = new Pool({
  connectionString: getCleanConnectionString(config.databaseUrl),
  ssl: {
    rejectUnauthorized: false,
  },
});

export const db = drizzle(pool, { schema });
export { schema };


