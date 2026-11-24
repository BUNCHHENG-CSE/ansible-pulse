import { Pool, neon } from '@neondatabase/serverless';

export function isNeonConfigured(): boolean {
  const url = process.env.DATABASE_URL || '';
  return url.includes('neon.tech') || process.env.USE_NEON === 'true';
}

export function getNeonSql() {
  const url = process.env.DATABASE_URL;
  if (!url || !isNeonConfigured()) {
    throw new Error('Neon database is not configured in DATABASE_URL.');
  }
  return neon(url);
}

export function getNeonPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url || !isNeonConfigured()) {
    throw new Error('Neon database is not configured in DATABASE_URL.');
  }
  return new Pool({ connectionString: url });
}
