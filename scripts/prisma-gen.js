const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Simple .env parser to read DATABASE_URL and USE_NEON if not already in process.env
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const dbUrl = process.env.DATABASE_URL || '';
const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://') || process.env.USE_NEON === 'true';

const schemaFile = isPostgres 
  ? path.join(__dirname, '../prisma/schema.postgresql.prisma') 
  : path.join(__dirname, '../prisma/schema.prisma');

console.log(`[Prisma-Gen] Target database provider: ${isPostgres ? 'PostgreSQL (Neon)' : 'SQLite (Local)'}`);
console.log(`[Prisma-Gen] Using schema: ${schemaFile}`);

try {
  execSync(`node ./node_modules/prisma/build/index.js generate --schema="${schemaFile}"`, { stdio: 'inherit' });
} catch (e) {
  console.error('[Prisma-Gen] Generation failed:', e.message);
  process.exit(1);
}
