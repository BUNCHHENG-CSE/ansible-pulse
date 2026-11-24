import { PrismaClient } from '@prisma/client';
import path from 'path';

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

function resolveDbUrl(): string {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    const dbPath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), 'ansible_pulse.db').replace(/\\/g, '/');
    return `file:${dbPath}`;
  }

  if (rawUrl.startsWith('file:') || (!rawUrl.startsWith('postgres://') && !rawUrl.startsWith('postgresql://'))) {
    const filePath = rawUrl.replace(/^file:/, '');
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(/*turbopackIgnore: true*/ process.cwd(), filePath);
    return `file:${absPath.replace(/\\/g, '/')}`;
  }

  return rawUrl;
}

export function createPrismaClient(): PrismaClient {
  const resolvedUrl = resolveDbUrl();
  return new PrismaClient({
    datasources: {
      db: {
        url: resolvedUrl
      }
    },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  });
}

export const prisma = globalThis.prismaGlobal ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

export default prisma;
