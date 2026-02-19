import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database;

try {
  const dbDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Use in-memory DB for tests to ensure isolation and speed
  const dbPath = process.env.NODE_ENV === 'test' 
    ? ':memory:' 
    : path.join(dbDir, 'audit.db');
    
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[AuditDB] Opening database at ${dbPath}`);
  }
  
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Schema migration
  // Simplified schema with metaJson for flexibility
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
} catch (error) {
  console.error('[AuditDB] Failed to initialize database:', error);
  throw error;
}

export default db;
