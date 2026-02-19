import fs from 'fs';
import path from 'path';

type AnyRow = Record<string, unknown>;

type StatementLike = {
  run: (params?: AnyRow) => void;
  all: (...args: unknown[]) => AnyRow[];
  get: (...args: unknown[]) => AnyRow;
};

type DatabaseLike = {
  prepare: (sql: string) => StatementLike;
  exec: (sql: string) => void;
  pragma: (sql: string) => void;
};

function createNoopDb(): DatabaseLike {
  return {
    prepare: () => ({
      run: () => undefined,
      all: () => [],
      get: () => ({ count: 0, avgMs: 0 }),
    }),
    exec: () => undefined,
    pragma: () => undefined,
  };
}

function initializeSchema(db: DatabaseLike): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      requestId TEXT NOT NULL,
      route TEXT,
      hgvs TEXT,
      gene TEXT,
      status TEXT,
      processingMs INTEGER,
      metaJson TEXT
    );
  `);
}

function resolveDbPath(): string {
  if (process.env.NODE_ENV === 'test') return ':memory:';
  if (process.env.VERCEL) return '/tmp/variantlens-audit.db';
  return path.join(process.cwd(), 'data', 'audit.db');
}

function openDatabase(): DatabaseLike {
  let BetterSqlite3: any;
  try {
    // Lazy require prevents route import crashes when native bindings fail to load.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    BetterSqlite3 = require('better-sqlite3');
  } catch (error) {
    console.error('[AuditDB] better-sqlite3 unavailable. Falling back to no-op logger.', error);
    return createNoopDb();
  }

  const dbPath = resolveDbPath();
  try {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      console.log(`[AuditDB] Opening database at ${dbPath}`);
    }

    const db = new BetterSqlite3(dbPath) as DatabaseLike;
    db.pragma('journal_mode = WAL');
    initializeSchema(db);
    return db;
  } catch (error) {
    console.error('[AuditDB] Failed to initialize file database. Falling back to in-memory.', error);
    try {
      const memoryDb = new BetterSqlite3(':memory:') as DatabaseLike;
      initializeSchema(memoryDb);
      return memoryDb;
    } catch (fallbackError) {
      console.error('[AuditDB] Failed to initialize in-memory database. Using no-op logger.', fallbackError);
      return createNoopDb();
    }
  }
}

const db: DatabaseLike = openDatabase();
export default db;
