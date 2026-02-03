# API Specification V2

## Endpoints

### GET /api/variant
**Purpose:** Single variant interpretation

**Params:**
- `hgvs` (required): Protein HGVS (e.g., `BRCA1:p.Cys61Gly`)
- `format` (optional): `json` | `md` (default: json)

**Response 200:**
```json
{
  "variant": "BRCA1:p.Cys61Gly",
  "structure": {
    "source": "PDB",
    "id": "1JNX",
    "url": "https://files.rcsb.org/download/1JNX.pdb"
  },
  "hypothesis": { ... },
  "export_url": "/api/export/case-uuid"
}
```
Response 429: Rate limit exceeded

### POST /api/batch
Purpose: Limited batch processing (max 20)
Body:
```json
{
  "variants": ["BRCA1:p.Cys61Gly", "TP53:p.Arg175His"],
  "email": "optional@for.notification"
}
```
Response 202:
```json
{
  "job_id": "uuid",
  "status": "pending",
  "poll_url": "/api/batch/uuid/status"
}
```

### GET /api/validation-set
Purpose: Retrieve curated validation variants
Response: Array of variant objects with expert notes (if authenticated)

### GET /api/export/:id
Purpose: Download case file
Response: case.json + report.md as zip

## Rate Limits
| Endpoint | Limit | Window |
|---|---|---|
| /variant | 10 | 1 min |
| /batch | 2 | 1 hour |
| /validation-set | 100 | 1 hour |
| /export | 50 | 1 min |

## Error Codes
| Code | Meaning | Action |
|---|---|---|
| 400 | Invalid HGVS | Check format |
| 404 | No structure found | Try alternative variant |
| 429 | Rate limited | Wait or export |
| 503 | External service down | Retry with fallback |
