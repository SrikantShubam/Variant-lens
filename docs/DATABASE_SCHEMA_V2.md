# Database Schema V2

## Philosophy
No persistent user data. Read-heavy, write-light. File-based with optional SQLite.

## Collections (If using lightweight DB like SQLite or Supabase)

### variants_cache
```sql
CREATE TABLE variants_cache (
  id TEXT PRIMARY KEY, -- normalized HGVS
  uniprot_id TEXT NOT NULL,
  sequence TEXT NOT NULL,
  domains JSONB, -- InterPro domains
  last_fetched TIMESTAMP,
  ttl_hours INTEGER DEFAULT 168 -- 7 days
);
```

### structures_cache
```sql
CREATE TABLE structures_cache (
  id TEXT PRIMARY KEY, -- PDB ID or AFDB ID
  source TEXT CHECK(source IN ('PDB', 'AlphaFold')),
  resolution REAL,
  coordinates_url TEXT,
  plddt_scores JSONB, -- AlphaFold only
  coverage TEXT,
  last_fetched TIMESTAMP
);
```

### validation_set
```sql
CREATE TABLE validation_set (
  variant_id TEXT PRIMARY KEY REFERENCES variants_cache(id),
  expert_hypothesis TEXT NOT NULL,
  expert_confidence TEXT CHECK(confidence IN ('high', 'moderate', 'low')),
  expert_background TEXT,
  agent_hypothesis TEXT,
  alignment_score REAL,
  agreement_level TEXT CHECK(agreement IN ('full', 'partial', 'none')),
  reviewed_by TEXT[], -- expert identifiers
  public BOOLEAN DEFAULT true
);
```

### case_files (ephemeral)
```sql
CREATE TABLE case_files (
  id UUID PRIMARY KEY,
  variant_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP, -- 30 days
  json_url TEXT,
  md_url TEXT,
  access_count INTEGER DEFAULT 0
);
```

### rate_limits
```sql
CREATE TABLE rate_limits (
  ip_hash TEXT PRIMARY KEY, -- hashed for privacy
  endpoint TEXT,
  window_start TIMESTAMP,
  request_count INTEGER,
  window_duration INTEGER -- seconds
);
```

## File Storage Schema (S3/Cloudflare R2)
```
bucket/
├── structures/
│   ├── pdb/{pdb_id}.cif
│   └── alphafold/{uniprot_id}.pdb
├── case-files/
│   └── {uuid}/
│       ├── case.json
│       └── report.md
└── validation/
    └── ground-truth.json
```

## Local Development (SQLite)
Single file: variantlens.db
Migrations: Drizzle ORM or Prisma
No Redis, no PostgreSQL required for V2

## Indexes
```sql
CREATE INDEX idx_variants_uniprot ON variants_cache(uniprot_id);
CREATE INDEX idx_case_files_expiry ON case_files(expires_at);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_start);
```

## Data Retention Jobs
Daily cleanup (serverless cron):
```javascript
// Delete expired case files
DELETE FROM case_files WHERE expires_at < NOW();
DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 day';
VACUUM; // SQLite only
```
