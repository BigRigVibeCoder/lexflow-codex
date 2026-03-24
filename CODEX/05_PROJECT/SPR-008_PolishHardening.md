---
id: SPR-008
title: "Polish & Hardening Sprint"
type: sprint
status: ACTIVE
owner: architect
agents: [frontend, backend]
tags: [sprint, phase-6, security, testing, production, hardening]
related: [BCK-001, GOV-002, GOV-004, GOV-008]
created: 2026-03-24
updated: 2026-03-24
version: 1.1.0
---

> **BLUF:** Production hardening, security, E2E testing, performance testing, backup/restore. End state: LexFlow is production-ready on `lexflow-prod` with TLS, monitoring, rate limiting, E2E tests, and a documented backup/restore procedure. **Both agents contribute. This sprint is the final gate before v1.0 release.**

# SPR-008: Polish & Hardening

**Phase:** 6 — Polish & Hardening
**Target:** 6-12 hours (AI-agent pace)
**Agents:** Both (Frontend + Backend)
**Dependencies:** All previous sprints complete

---

## ⚠️ Mandatory Compliance — Every Task

| Governance Doc | Sprint Requirement |
|:---------------|:-------------------|
| **GOV-001** | JSDoc on all exports enforced via ESLint. File headers required. |
| **GOV-002** | E2E test suite (Playwright). Performance tests (k6). Coverage ≥80% gate. |
| **GOV-003** | Security review. ESLint complexity ≤10. Max 60-line functions. Accessibility (axe). |
| **GOV-004** | Sentry error monitoring. Global error handlers. FMEA for trust accounting. |
| **GOV-005** | Branch: `feature/SPR-008-polish-hardening` per agent. One commit per task. |
| **GOV-006** | Persistent log files (JSONL). Log rotation. Correlation IDs in frontend. |
| **GOV-008** | All hardening applied to `lexflow-prod` VM. |

---

## Backend Agent Tasks (lexflow-backend)

### T-076V: Production VM Hardening
- **Commit:** `feat(SPR-008): T-076V production VM hardening`
- **Dependencies:** T-004V
- **Deliverable:**
  - TLS via Let's Encrypt (Certbot) + nginx HTTPS config
  - Auto-renewal cron for certificates
  - PostgreSQL backup: `pg_dump` cron (daily, rotated 7 days)
  - PM2 cluster mode (2 instances per service)
  - Log rotation: logrotate config for `/var/log/lexflow/`
  - UFW rules verified: only 22, 80, 443
  - Fail2ban for SSH brute-force protection
- **Acceptance:** `https://lexflow-prod.example.com` loads with valid cert. Backups in `/var/backups/lexflow/`. PM2 shows 4 processes (2×2).
- **Status:** [ ] Not Started

### T-077V: Production Deploy Automation
- **Commit:** `feat(SPR-008): T-077V production deploy automation`
- **Dependencies:** T-006V, T-076V
- **Deliverable:**
  - Updated `scripts/deploy.sh` with:
    - Pre-deploy snapshot (pg_dump)
    - Zero-downtime restart (PM2 reload)
    - Health check verification (both services)
    - Rollback capability: `scripts/rollback.sh` restores previous DB snapshot and code version
  - Deployment checklist document
- **Acceptance:** Deploy succeeds with zero downtime. Rollback restores previous state.
- **Status:** [ ] Not Started

### T-085: Backup & Restore Verification
- **Commit:** `feat(SPR-008): T-085 backup and restore verification`
- **Dependencies:** T-076V
- **Deliverable:**
  - Documented backup/restore procedure
  - Test: create data → backup → drop DB → restore → verify data intact
  - Backup includes both databases (lexflow_main + lexflow_trust)
  - Restore script: `scripts/restore.sh <backup_file>`
- **Acceptance:** Full backup/restore cycle tested and documented.
- **Status:** [ ] Not Started

---

## Frontend Agent Tasks (lexflow-frontend)

### T-078: Error Monitoring (Both Services)
- **Commit:** `feat(SPR-008): T-078 error monitoring setup`
- **Agent:** Both (each adds to their own repo)
- **Dependencies:** T-002, T-003
- **Deliverable:**
  - Sentry SDK configured in both services
  - Source maps uploaded (frontend)
  - Error boundaries in Next.js (per-page and global)
  - Unhandled rejection handler in Fastify
  - Structured context: userId, matterId, requestId attached to errors
- **Acceptance:** Throw test error → appears in Sentry with full context.
- **Status:** [ ] Not Started

### T-079: Rate Limiting
- **Commit:** `feat(SPR-008): T-079 rate limiting`
- **Dependencies:** T-002
- **Deliverable:**
  - Auth routes: 5 requests/minute per IP
  - API routes: 100 requests/minute per authenticated user
  - Trust service: 50 requests/minute per service key
  - 429 response with `Retry-After` header
- **Acceptance:** Exceed limit → 429 with retry header. Normal usage unaffected.
- **Status:** [ ] Not Started

### T-080: Security Headers
- **Commit:** `feat(SPR-008): T-080 security headers`
- **Dependencies:** T-002
- **Deliverable:**
  - `next.config.ts` security headers: CSP, HSTS (max-age 31536000), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin
  - API routes include security headers
- **Acceptance:** Security headers scanner passes (securityheaders.com or manual check).
- **Status:** [ ] Not Started

### T-081: Data Encryption at Rest
- **Commit:** `feat(SPR-008): T-081 data encryption at rest`
- **Agent:** Both
- **Dependencies:** T-007, T-034
- **Deliverable:**
  - Frontend: encrypt TOTP secrets, SSN (ssnLast4) using AES-256-GCM
  - Backend: encrypt bank account numbers if stored
  - Encryption key from environment variable (`ENCRYPTION_KEY`)
  - Transparent encryption/decryption helpers
- **Acceptance:** DB stores encrypted values. Decryption only with correct key.
- **Status:** [ ] Not Started

### T-082: Session Management UI
- **Commit:** `feat(SPR-008): T-082 session management UI`
- **Dependencies:** T-011
- **Deliverable:**
  - Active sessions list (device, IP, last active)
  - Revoke session button
  - Revoke all other sessions button
- **Acceptance:** Sessions listed. Revoking logs out that session.
- **Status:** [ ] Not Started

### T-083: E2E Test Suite
- **Commit:** `test(SPR-008): T-083 E2E test suite`
- **Dependencies:** All UI tasks
- **Deliverable:**
  - Playwright test suite covering full workflows:
    1. Login → dashboard loads
    2. Create client → create matter → verify
    3. Add time entry → create invoice → record payment
    4. Create trust account → deposit → disburse → verify balance
    5. Upload document → view in PDF viewer
    6. SOL deadline appears in dashboard
  - Run against both services (frontend + trust backend)
  - CI integration: runs on deploy branch
- **Acceptance:** All E2E tests pass against running application.
- **Status:** [ ] Not Started

### T-084: Performance Testing
- **Commit:** `test(SPR-008): T-084 performance testing`
- **Agent:** Both
- **Dependencies:** All routes
- **Deliverable:**
  - k6 load test scripts:
    - Auth: 50 concurrent logins
    - Matter CRUD: 100 requests/second for 2 minutes
    - Trust transactions: 20 concurrent deposits
    - Document upload: 10 concurrent 5MB uploads
  - Performance baseline report
  - Target: p95 response time <500ms for API calls
- **Acceptance:** All endpoints meet p95 <500ms target. No errors under load.
- **Status:** [ ] Not Started

---

## Governance Compliance Tasks (New — From Gap Analysis)

> These tasks close the remaining governance gaps identified in the full GOV-001 through GOV-008 audit.

### T-086: ESLint Code Quality Rules (Both Services)
- **Commit:** `feat(SPR-008): T-086 ESLint code quality rules`
- **Agent:** Both
- **Deliverable:**
  - ESLint `jsdoc` plugin — require JSDoc on all exports (GOV-001 §4, GOV-003 §1.2)
  - ESLint `complexity` rule ≤10 (GOV-003 §1.3)
  - ESLint `max-lines-per-function` rule = 60 (GOV-003 §1.3)
  - Fix any violations or add `// GOV-003-exempt` with justification
- **Acceptance:** `npm run lint` passes with new rules active.
- **Status:** [ ] Not Started

### T-087: Coverage Threshold Gate (Both Services)
- **Commit:** `feat(SPR-008): T-087 coverage threshold gate`
- **Agent:** Both
- **Deliverable:**
  - vitest.config.ts: `coverage.thresholds.lines = 80`
  - `npm run test:coverage` fails if line coverage < 80%
  - Add coverage report to CI pipeline
- **Acceptance:** Coverage gate blocks merge if <80%. Current coverage documented.
- **Status:** [ ] Not Started

### T-088: Persistent Log Output (Both Services)
- **Commit:** `feat(SPR-008): T-088 persistent log output`
- **Agent:** Both
- **Deliverable:**
  - `LOG_FILE` env var support in pino config (GOV-006 §4)
  - JSONL output to `/var/log/lexflow/{service}_{date}.log`
  - Tests run at `LOG_LEVEL=TRACE` (GOV-006 §14)
  - `.env.example` updated with LOG_FILE, LOG_LEVEL
- **Acceptance:** Logs written to JSONL file in production. Tests run at TRACE.
- **Status:** [ ] Not Started

### T-089: Frontend Correlation ID Propagation
- **Commit:** `feat(SPR-008): T-089 frontend correlation ID propagation`
- **Agent:** Frontend
- **Deliverable:**
  - Trust-client includes `X-Correlation-ID` header on every request (GOV-004 §8)
  - tRPC middleware generates correlation ID for each request
  - All logger calls include correlation ID
- **Acceptance:** Trust service logs show correlation IDs matching frontend requests.
- **Status:** [ ] Not Started

### T-090: Accessibility Scan (axe)
- **Commit:** `test(SPR-008): T-090 accessibility scan`
- **Agent:** Frontend
- **Deliverable:**
  - Playwright axe integration in E2E suite (GOV-003 WCAG 2.1 AA)
  - Scan all major pages: dashboard, matters, trust, login
  - Fix critical accessibility violations
- **Acceptance:** axe reports zero critical/serious violations.
- **Status:** [ ] Not Started

---

## Architect Tasks (SPR-008)

### T-091: FMEA — Trust Accounting (Architect)
- **Agent:** Architect
- **Deliverable:**
  - Failure Mode & Effects Analysis for trust accounting (GOV-004 §11)
  - Document: `CODEX/40_VERIFICATION/VER-006_FMEA_TrustAccounting.md`
  - Cover: DB connection loss, trust service down, overdraft, double-entry mismatch
- **Status:** [ ] Not Started

### T-092: Post-Incident Review Runbook (Architect)
- **Agent:** Architect
- **Deliverable:**
  - `CODEX/30_RUNBOOKS/RUN-002_PostIncidentReview.md` (GOV-004 §12)
  - Template for Severity 1-3 incidents
  - Blameless review process documented
- **Status:** [ ] Not Started

### T-093: Requirements Traceability Matrix (Architect)
- **Agent:** Architect
- **Deliverable:**
  - `CODEX/40_VERIFICATION/VER-007_TraceabilityMatrix.md` (GOV-002 §22)
  - Map: CON-002 routes → backend route files → test files
  - Map: SPR task IDs → source files → test files
- **Status:** [ ] Not Started

---

## Sprint Checklist

| Task | Agent | Category | Status |
|:-----|:------|:---------|:-------|
| T-076V | Backend | VM Hardening | [ ] |
| T-077V | Backend | Deploy Automation | [ ] |
| T-078 | Both | Error Monitoring (Sentry) | [ ] |
| T-079 | Frontend | Rate Limiting | [ ] |
| T-080 | Frontend | Security Headers | [ ] |
| T-081 | Both | Encryption at Rest | [ ] |
| T-082 | Frontend | Session Management | [ ] |
| T-083 | Frontend | E2E Test Suite | [ ] |
| T-084 | Both | Performance Testing | [ ] |
| T-085 | Backend | Backup & Restore | [ ] |
| T-086 | Both | ESLint Code Quality | [ ] |
| T-087 | Both | Coverage Threshold | [ ] |
| T-088 | Both | Persistent Logs | [ ] |
| T-089 | Frontend | Correlation IDs | [ ] |
| T-090 | Frontend | Accessibility (axe) | [ ] |
| T-091 | Architect | FMEA Trust Accounting | [ ] |
| T-092 | Architect | Post-Incident Runbook | [ ] |
| T-093 | Architect | Traceability Matrix | [ ] |

---

## Sprint Completion Criteria

- [ ] All 18 tasks pass acceptance criteria
- [ ] TLS working on `lexflow-prod`
- [ ] E2E tests pass all 6 workflows
- [ ] Performance baseline met (p95 <500ms)
- [ ] Backup/restore verified
- [ ] Deploy with zero-downtime works
- [ ] Rollback procedure tested
- [ ] Rate limiting active
- [ ] Security headers pass audit
- [ ] Sentry capturing errors with context
- [ ] Coverage ≥80% on both repos
- [ ] Persistent log files configured
- [ ] Correlation IDs flow across service boundary
- [ ] Zero critical accessibility violations
- [ ] FMEA complete for trust accounting
- [ ] **Architect final audit: ALL GOV docs (001-008) compliance verified**
- [ ] **v1.0 release tag created**
