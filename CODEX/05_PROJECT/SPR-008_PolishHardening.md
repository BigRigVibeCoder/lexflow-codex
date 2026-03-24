---
id: SPR-008
title: "Polish & Hardening Sprint"
type: sprint
status: PLANNING
owner: architect
agents: [frontend, backend]
tags: [sprint, phase-6, security, testing, production, hardening]
related: [BCK-001, GOV-002, GOV-004, GOV-008]
created: 2026-03-24
updated: 2026-03-24
version: 1.0.0
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
| **GOV-002** | E2E test suite (Playwright). Performance tests (k6). |
| **GOV-003** | Security review: no secrets in code, no hardcoded URLs. |
| **GOV-004** | Sentry error monitoring. Global error handlers verified. |
| **GOV-006** | Log rotation configured. Structured logs flowing to files. |
| **GOV-008** | All hardening applied to `lexflow-prod` VM. |

---

## Backend Agent Tasks (lexflow-backend)

### T-076V: Production VM Hardening
- **Branch:** `feature/SPR-008-T076V-vm-hardening`
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
- **Branch:** `feature/SPR-008-T077V-deploy-automation`
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
- **Branch:** `feature/SPR-008-T085-backup-restore`
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
- **Branch:** `feature/SPR-008-T078-error-monitoring`
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
- **Branch:** `feature/SPR-008-T079-rate-limiting`
- **Dependencies:** T-002
- **Deliverable:**
  - Auth routes: 5 requests/minute per IP
  - API routes: 100 requests/minute per authenticated user
  - Trust service: 50 requests/minute per service key
  - 429 response with `Retry-After` header
- **Acceptance:** Exceed limit → 429 with retry header. Normal usage unaffected.
- **Status:** [ ] Not Started

### T-080: Security Headers
- **Branch:** `feature/SPR-008-T080-security-headers`
- **Dependencies:** T-002
- **Deliverable:**
  - `next.config.ts` security headers: CSP, HSTS (max-age 31536000), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin
  - API routes include security headers
- **Acceptance:** Security headers scanner passes (securityheaders.com or manual check).
- **Status:** [ ] Not Started

### T-081: Data Encryption at Rest
- **Branch:** `feature/SPR-008-T081-encryption-at-rest`
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
- **Branch:** `feature/SPR-008-T082-session-management`
- **Dependencies:** T-011
- **Deliverable:**
  - Active sessions list (device, IP, last active)
  - Revoke session button
  - Revoke all other sessions button
- **Acceptance:** Sessions listed. Revoking logs out that session.
- **Status:** [ ] Not Started

### T-083: E2E Test Suite
- **Branch:** `feature/SPR-008-T083-e2e-tests`
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
- **Branch:** `feature/SPR-008-T084-performance-tests`
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

## Sprint Checklist

| Task | Agent | Status | Branch | Audited |
|:-----|:------|:-------|:-------|:--------|
| T-076V | Backend | [ ] | `feature/SPR-008-T076V-vm-hardening` | [ ] |
| T-077V | Backend | [ ] | `feature/SPR-008-T077V-deploy-automation` | [ ] |
| T-078 | Both | [ ] | `feature/SPR-008-T078-error-monitoring` | [ ] |
| T-079 | Frontend | [ ] | `feature/SPR-008-T079-rate-limiting` | [ ] |
| T-080 | Frontend | [ ] | `feature/SPR-008-T080-security-headers` | [ ] |
| T-081 | Both | [ ] | `feature/SPR-008-T081-encryption-at-rest` | [ ] |
| T-082 | Frontend | [ ] | `feature/SPR-008-T082-session-management` | [ ] |
| T-083 | Frontend | [ ] | `feature/SPR-008-T083-e2e-tests` | [ ] |
| T-084 | Both | [ ] | `feature/SPR-008-T084-performance-tests` | [ ] |
| T-085 | Backend | [ ] | `feature/SPR-008-T085-backup-restore` | [ ] |

---

## Sprint Completion Criteria

- [ ] All 10 tasks pass acceptance criteria
- [ ] TLS working on `lexflow-prod`
- [ ] E2E tests pass all 6 workflows
- [ ] Performance baseline met (p95 <500ms)
- [ ] Backup/restore verified
- [ ] Deploy with zero-downtime works
- [ ] Rollback procedure tested
- [ ] Rate limiting active
- [ ] Security headers pass audit
- [ ] Sentry capturing errors with context
- [ ] **Architect final audit: ALL GOV docs (001-008) compliance verified across both repos**
- [ ] **v1.0 release tag created**
