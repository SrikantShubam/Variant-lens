# Operations Runbook V2

## Deployment

### Vercel (Recommended)
```bash
# Production
vercel --prod

# Environment variables
vercel env add OPENAI_API_KEY
vercel env add UPSTASH_REDIS_REST_URL  # optional, for rate limiting
vercel env add DATABASE_URL  # SQLite or Postgres
```

### Self-Hosted (Docker)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Monitoring

### Health Checks
```bash
# Liveness
GET /api/health
Response: {"status": "ok", "version": "2.0.0"}

# Readiness (checks external APIs)
GET /api/ready
Response: {"status": "ready", "services": {"pdb": "up", "uniprot": "up"}}
```

### Logging
```typescript
// Structured logging
logger.info('variant_analyzed', {
  variant: 'BRCA1:p.Cys61Gly',
  structure_source: 'PDB',
  duration_ms: 4500,
  cache_hit: true
});

logger.error('structure_fetch_failed', {
  source: 'PDB',
  error: error.message,
  fallback_used: true
});
```

### Alerts (Webhook to Slack/Discord)
- Error rate > 5% for 5 minutes
- Rate limiting triggered > 100 times/hour
- External API down > 10 minutes

## Incident Response

### Severity Levels
| Level | Example | Response |
|---|---|---|
| P0 | Complete outage | Page on-call, status page update |
| P1 | Batch processing failing | Disable batch, continue single |
| P2 | Validation set inaccessible | Degrade to V1 mode |
| P3 | Cosmetic bug | Fix in next release |

### Runbooks

**PDB API Down**
1. Check: https://www.rcsb.org/robots.txt
2. If confirmed: Deploy flag FORCE_ALPHAFOLD=true
3. Update status page
4. Monitor for recovery
5. Revert flag when PDB returns

**Agent Hallucination Detected**
1. Immediate: Disable agent for variant class
2. Review: Check validation set for similar errors
3. Fix: Update prompt or add guardrail
4. Communicate: GitHub issue + Twitter update
5. Retrospective: Add to validation set

**Rate Limit Abuse**
1. Check IP patterns
2. If DDoS: Enable Cloudflare "Under Attack" mode
3. If scraper: Block IP range, consider CAPTCHA
4. Document: Post-mortem in INCIDENTS.md

## Backups

### Case Files (if persistent storage used)
```bash
# Daily S3 sync
aws s3 sync s3://variantlens-case-files s3://variantlens-backup-$(date +%Y%m%d)
# Keep 30 days, delete older
```

### Validation Set
```bash
# Git-backed, but also:
tar -czf validation-backup-$(date +%Y%m%d).tar.gz validation/
```

## Scaling Triggers
| Metric | Current | Trigger | Action |
|---|---|---|---|
| Requests/day | <1,000 | >10,000 | Add CDN caching layer |
| Batch usage | <10/day | >100/day | Add Redis queue |
| Storage | <1GB | >10GB | Migrate to Postgres |
| Latency p95 | <5s | >10s | Add edge functions |

## Cost Monitoring
| Service | Free Tier | Paid Trigger | Budget |
|---|---|---|---|
| Vercel | 100GB bandwidth | >$20 | ₹2,000/mo |
| OpenAI | N/A | Per token | ₹5,000/mo |
| Upstash | 10k req/day | >100k | ₹1,000/mo |
| S3/R2 | 10GB | >100GB | ₹500/mo |

## Rollback Procedure
```bash
# Emergency rollback
vercel rollback production
# Or git-based
git revert HEAD
git push origin main
```

## Communication Templates

### Status Page Update
> [Investigating] VariantLens is experiencing issues with PDB structure retrieval. 
> We have automatically switched to AlphaFold fallback. 
> Expected resolution: 30 minutes.

### Post-Incident Report
## INCIDENT-2024-001: PDB Outage

**Duration:** 45 minutes
**Impact:** 12% of requests used AlphaFold fallback instead of PDB
**Root Cause:** RCSB PDB scheduled maintenance not in calendar
**Resolution:** Auto-fallback worked as designed
**Action Items:**
- [ ] Add PDB maintenance calendar to monitoring
- [ ] Improve fallback messaging in UI

## Security Response

### Dependency Vulnerability
```bash
npm audit
# If critical:
npm update <package>
npm run test
git commit -m "Security: Update vulnerable dependency"
```

### API Key Leak
1. Immediately rotate key in dashboard
2. Update environment variable
3. Redeploy
4. Review logs for abuse
5. Post-mortem: How was key exposed?

## Checklists

### Pre-Release
- [ ] All tests pass
- [ ] Validation set reviewed
- [ ] Prompts versioned
- [ ] Rate limits tested
- [ ] Fallbacks verified
- [ ] Documentation updated
- [ ] CHANGELOG.md updated

### Post-Release (24h)
- [ ] Error rates normal
- [ ] Latency acceptable
- [ ] No critical alerts
- [ ] User feedback reviewed
- [ ] Validation alignment stable
