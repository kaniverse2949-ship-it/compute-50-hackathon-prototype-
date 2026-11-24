import fs from 'node:fs';
import path from 'node:path';
import { createInitialDatabase } from './seedData.ts';
import type { DatabaseState, StoredUser } from './seedData.ts';
import type { PublicUser } from '../types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'firstcure-db.json');

let dbCache: DatabaseState | null = null;

export function getDb(): DatabaseState {
  if (dbCache) return dbCache;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as DatabaseState;
      if (parsed && Array.isArray(parsed.doctors) && Array.isArray(parsed.users)) {
        dbCache = parsed;
        return dbCache;
      }
    } catch {
      // Fall back to fresh seed if file corrupted
    }
  }

  dbCache = createInitialDatabase();
  saveDb(dbCache);
  return dbCache;
}

export function saveDb(next: DatabaseState): void {
  dbCache = next;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpPath = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2), 'utf-8');
  fs.renameSync(tmpPath, DB_FILE);
}

export function toPublicUser(user: StoredUser): PublicUser {
  const { passwordHash: _h, passwordSalt: _s, ...pub } = user;
  return pub;
}
