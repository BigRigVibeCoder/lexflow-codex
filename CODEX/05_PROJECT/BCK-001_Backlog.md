---
id: BCK-001
title: "LexFlow Implementation Backlog"
type: planning
status: ACTIVE
owner: architect
agents: [all]
tags: [project-management, backlog, sprints]
related: [GOV-007, GOV-008, BLU-ARCH-001, PRJ-001]
created: 2026-03-22
updated: 2026-03-22
version: 1.0.0
---

> **BLUF:** 85 tasks across 7 phases. Frontend Agent and Backend Agent execute in parallel where dependencies allow. All tasks adapted for multi-repo (GOV-008) and VM deployment. **Governance compliance (GOV-001 through GOV-008) is mandatory from task one.** Source of truth for task definitions: BLU-ARCH-001 §9.

# LexFlow Implementation Backlog

---

## Governance Compliance — Non-Negotiable From Day One

Every task in every phase MUST satisfy ALL applicable governance standards. These are not "Phase 6: Polish" items — they are baked into Task 1:

| Doc | What It Enforces | Sprint 1 Deliverable |
|:----|:-----------------|:---------------------|
| **GOV-001** | Documentation standards | README.md, JSDoc/TSDoc in all files |
| **GOV-002** | Testing protocol (17 tiers) | Vitest configured, ESLint + tsc strict, CI runs tests |
| **GOV-003** | Coding standards | TypeScript strict, no `any`, complexity ≤10 |
| **GOV-004** | Error handling | Error middleware in both services, structured error responses |
| **GOV-005** | Dev lifecycle | Branch naming, commit format, audit workflow |
| **GOV-006** | Logging | pino structured JSON logging, correlation IDs |
| **GOV-007** | Project management | CODEX task tracking, contract-first |
| **GOV-008** | Infrastructure | Multi-repo, CODEX submodule, VM deployment |

**Architect audit includes governance compliance.** A task that works but violates GOV docs gets a `DEF-` defect report.

## Adaptation Notes (from BLU-ARCH-001)

Per GOV-008, the following BLU-ARCH-001 assumptions are overridden:

| BLU-ARCH-001 Assumption | Actual (GOV-008) |
|:------------------------|:-----------------|
| Monorepo (`apps/web`, `apps/trust-service`) | Multi-repo: `lexflow-frontend` + `lexflow-backend` |
| Cloud Run deployment | PM2/systemd on GCP VM (`lexflow-prod`) |
| Cloud SQL (managed) | PostgreSQL 15 (self-managed on VM) |
| GCS signed URL uploads | Local disk (`/var/lexflow/documents/`) |
| Cloud Run OIDC between services | Localhost HTTP (no OIDC needed) |
| Terraform for cloud infra | Shell scripts / Ansible for VM config |
| `packages/shared-types/` npm package | Contract-first: types defined in `CON-` docs |
| Cloud Scheduler / Cloud Tasks | cron jobs on VM |

**Tasks T-004 (Terraform), T-005/T-006 (CI/CD for Cloud Run), T-076/T-077 (production Terraform/CD) are replaced** with VM-appropriate equivalents below.

---

## Phase 0: Project Scaffold & Infrastructure

**Sprint:** SPR-001

| ID | Task | Agent | Dependencies | Deliverable |
|----|------|-------|-------------|-------------|
| **T-001** | Frontend project scaffold | Frontend | None | Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui. `package.json` with Drizzle, tRPC, NextAuth deps. |
| **T-002** | Frontend health endpoint | Frontend | T-001 | `/api/health` route returning `{"status":"ok"}`. Dev server starts. |
| **T-003** | Backend trust service scaffold | Backend | None | Fastify 4 + TypeScript + Drizzle. `GET /health` returning `{"status":"ok","uptimeMs":N}`. |
| **T-004V** | VM provisioning scripts | Backend | None | Shell scripts for PostgreSQL 15 install, nginx config, PM2 setup, document directory, firewall rules on `lexflow-prod`. |
| **T-005V** | CI pipeline (GitHub Actions) | Both | T-001, T-003 | `.github/workflows/ci.yml` in each repo: lint, typecheck, unit test. Runs on PR and push to main. |
| **T-006V** | Deployment script | Backend | T-004V | `deploy.sh` script: SSH to `lexflow-prod`, pull code, run migrations, restart services (trust first, then web). |

---

## Phase 1: Authentication & RBAC

**Sprint:** SPR-002

| ID | Task | Agent | Dependencies | Deliverable |
|----|------|-------|-------------|-------------|
| **T-007** | Foundation DB schema + Drizzle | Frontend | T-001 | `users`, `sessions`, `audit_logs` tables. Drizzle schema. Migration files. |
| **T-008** | RBAC permission system | Frontend | T-001 | `src/lib/rbac.ts` with role-permission matrix, `hasPermission()`. Unit tests. |
| **T-009** | NextAuth.js configuration | Frontend | T-007 | Credentials provider, argon2, JWT sessions, account lockout. |
| **T-010** | tRPC setup with auth middleware | Frontend | T-008, T-009 | `protectedProcedure`, `permissionProcedure()`. |
| **T-011** | Auth tRPC router | Frontend | T-010 | `me`, `listUsers`, `createUser`. Seed script for initial owner. |
| **T-012** | Login UI | Frontend | T-009 | Login page with email/password form, error handling. |
| **T-013** | Dashboard layout shell | Frontend | T-012 | Sidebar, header, breadcrumbs. Auth-protected. |
| **T-014** | TOTP MFA implementation | Frontend | T-011 | `setupTotp`, `verifyTotp` procedures; recovery codes. |
| **T-015** | MFA UI pages | Frontend | T-014, T-013 | MFA setup, verify, profile toggle pages. |
| **T-016** | Audit logging middleware | Frontend | T-007, T-010 | tRPC middleware logging mutations to `audit_logs`. |
| **T-017** | User management UI | Frontend | T-011, T-013 | User list, user detail pages. Owner-only. |

> **Backend Agent is idle during Phase 1.** Use this time to complete T-004V and T-006V if not done, or begin T-034 (trust schema) early.

---

## Phase 2: Matter Management

**Sprint:** SPR-003

| ID | Task | Agent | Dependencies | Deliverable |
|----|------|-------|-------------|-------------|
| **T-018** | Client DB schema + Drizzle | Frontend | T-007 | `clients` table with PI-specific fields. |
| **T-019** | Client tRPC router | Frontend | T-018, T-010 | CRUD + paginated search. |
| **T-020** | Client UI pages | Frontend | T-019, T-013 | Client list, create, detail, edit pages. |
| **T-021** | Matter DB schema + Drizzle | Frontend | T-018 | `matters`, `matter_team`, `matter_deadlines`, `medical_treatments`. Auto-generated matter number. |
| **T-022** | Contact DB schema + Drizzle | Frontend | T-007 | `contacts`, `matter_contacts` tables. |
| **T-023** | Matter tRPC router | Frontend | T-021, T-022, T-010 | Full CRUD + team assignment + archival. |
| **T-024** | Deadline tRPC procedures | Frontend | T-021, T-010 | `addDeadline`, `completeDeadline`, `listUpcomingDeadlines`. |
| **T-025** | Medical treatment tRPC procedures | Frontend | T-021, T-010 | CRUD + auto-update `total_medical_bills`. |
| **T-026** | Contact tRPC router | Frontend | T-022, T-010 | CRUD + `linkToMatter`, `unlinkFromMatter`. |
| **T-027** | Matter list UI | Frontend | T-023, T-013 | DataTable with filters, search, pagination. |
| **T-028** | Matter creation wizard UI | Frontend | T-023, T-020 | Multi-step wizard: client → case details → fee → insurance → review. |
| **T-029** | Matter detail layout + tabs | Frontend | T-023 | Tab navigation. **Trust tab shows placeholder** — no API call yet. |
| **T-030** | Matter team UI | Frontend | T-023 | Team management page for matters. |
| **T-031** | Matter deadlines UI | Frontend | T-024 | Deadline management with SOL highlighting. |
| **T-032** | Medical treatment UI | Frontend | T-025 | Treatment log with running totals. |
| **T-033** | Dashboard widgets | Frontend | T-023, T-024 | Active matters, upcoming deadlines, recent activity, status chart. |

> **Backend Agent works on Phase 3 (Trust Accounting) in parallel** starting from T-034.

---

## Phase 3: Trust Accounting

**Sprint:** SPR-004 (Backend), SPR-005 (Frontend trust UI)

| ID | Task | Agent | Dependencies | Deliverable |
|----|------|-------|-------------|-------------|
| **T-034** | Trust DB schema + Drizzle | Backend | T-003 | All trust tables per BLU-ARCH-001 §4.2. Immutability triggers. Denormalized `_name` columns. |
| **T-035V** | Trust service auth middleware (VM) | Backend | T-003 | Shared secret auth for localhost. Dev mode passthrough. |
| **T-036** | validate-matter-client endpoint | Frontend | T-021, T-018 | `GET /api/internal/validate-matter-client` on web service. Shared secret validation. Per CON-001 §3. |
| **T-037** | Trust web-client service | Backend | T-003 | `src/services/web-client.ts` — calls validate-matter-client on localhost:3000. |
| **T-038** | Ledger engine with advisory locking | Backend | T-034 | `LedgerEngine` with advisory locks, SERIALIZABLE isolation, balance verification. |
| **T-039** | Trust account routes | Backend | T-034, T-035V, T-037 | Full CRUD per CON-002. TypeBox schemas. |
| **T-040** | Deposit route | Backend | T-038, T-039 | `POST /api/trust/transactions/deposit`. |
| **T-041** | Disbursement route | Backend | T-038, T-039 | `POST /api/trust/transactions/disburse`. Overdraft protection. |
| **T-042** | Transfer route | Backend | T-038, T-039 | `POST /api/trust/transactions/transfer`. |
| **T-043** | Fee transfer route | Backend | T-038, T-039 | `POST /api/trust/transactions/fee-transfer`. |
| **T-044a** | Trust client library (mock tests) | Frontend | T-002 | `src/lib/trust-client/` with HTTP client, circuit breaker. Unit tests with mock server. |
| **T-045** | Void entry route | Backend | T-038 | Void + reversing entry. 409 if already voided. |
| **T-046** | Transaction listing routes | Backend | T-034 | Paginated listing + detail. |
| **T-047** | Bank statement import | Backend | T-034 | CSV import with deduplication. |
| **T-048** | Reconciliation engine + routes | Backend | T-034, T-047 | Three-way reconciliation. |
| **T-044b** | Trust client integration tests | Frontend | T-044a, T-048 | Integration tests against real trust service. |
| **T-049** | Trust tRPC proxy router | Frontend | T-044a, T-010 | tRPC procedures proxying to trust client. Permission-gated. |
| **T-050** | Trust dashboard UI | Frontend | T-049, T-013 | Account overview, total balances. |
| **T-051** | Trust account management UI | Frontend | T-049 | Account CRUD pages. |
| **T-052** | Deposit/Disbursement UI | Frontend | T-049 | Transaction recording pages. |
| **T-053** | Reconciliation UI | Frontend | T-049 | Import CSV, match transactions, three-way report. |
| **T-054** | Matter trust tab (activate) | Frontend | T-049, T-029 | Replace placeholder with live trust data. |

---

## Phase 4: Document Management

**Sprint:** SPR-006

| ID | Task | Agent | Dependencies | Deliverable |
|----|------|-------|-------------|-------------|
| **T-055** | Document DB schema + Drizzle | Frontend | T-007 | `documents`, `document_access_log` tables. |
| **T-056V** | Upload service (local disk) | Frontend | T-055, T-010 | Multer-based file upload to `/var/lexflow/documents/`. Cleanup cron. |
| **T-057V** | Document tRPC router (local) | Frontend | T-055, T-056V, T-010 | Upload (direct to server), download (serve from disk), list, update, delete. |
| **T-058V** | Document upload component | Frontend | T-057V | Drag-and-drop, category selector, progress bar, direct upload to server. |
| **T-059** | Document list UI | Frontend | T-057V | Filterable table with category badges, download buttons. |
| **T-060** | Medical record viewer | Frontend | T-057V | PDF viewer with page navigation, zoom. |
| **T-061** | Document metadata editor | Frontend | T-057V | Inline editing for title, description, tags. |
| **T-062** | Global document search | Frontend | T-057V | Cross-matter document search. |

---

## Phase 5: Time & Billing

**Sprint:** SPR-007

| ID | Task | Agent | Dependencies | Deliverable |
|----|------|-------|-------------|-------------|
| **T-063** | Time & billing DB schema + Drizzle | Frontend | T-007, T-021 | `time_entries`, `expense_entries`, `invoices`, `payments`, `operating_transactions`. |
| **T-064** | Time entry tRPC router | Frontend | T-063, T-010 | CRUD + timer. Own-entries filter. |
| **T-065** | Time entry UI | Frontend | T-064, T-013 | Time list, new entry form, timer widget. |
| **T-066** | Matter time tab | Frontend | T-064 | Time entries for a specific matter. |
| **T-067** | Expense entry tRPC procedures | Frontend | T-063, T-010 | CRUD for expenses, receipt linking. |
| **T-068** | Invoice tRPC router | Frontend | T-063, T-064, T-010 | Create, list, get, void invoices. |
| **T-069** | Payment tRPC procedures | Frontend | T-063, T-068, T-044a | Record payments, trust transfers. |
| **T-070** | Invoice creation UI | Frontend | T-068 | Invoice wizard. |
| **T-071** | Invoice detail UI | Frontend | T-068 | Invoice view with line items. |
| **T-072** | Payment recording UI | Frontend | T-069 | Payment form. |
| **T-073** | Billing dashboard | Frontend | T-068 | Outstanding, overdue, receivables. |
| **T-074** | Matter billing tab | Frontend | T-068 | Per-matter billing view. |
| **T-075** | Aging report | Frontend | T-068 | AR aging buckets. |

---

## Phase 6: Polish & Hardening

**Sprint:** SPR-008

| ID | Task | Agent | Dependencies | Deliverable |
|----|------|-------|-------------|-------------|
| **T-076V** | Production VM hardening | Backend | T-004V | TLS via Let's Encrypt + nginx, PostgreSQL backups (pg_dump cron), PM2 clustering, log rotation. |
| **T-077V** | Production deploy automation | Backend | T-006V, T-076V | Full deploy script with health checks, rollback capability. |
| **T-078** | Error monitoring | Both | T-002, T-003 | Sentry for both services. Structured logging. |
| **T-079** | Rate limiting | Frontend | T-002 | Auth routes (5/min), API (100/min). |
| **T-080** | Security headers | Frontend | T-002 | CSP, HSTS, X-Frame-Options. |
| **T-081** | Data encryption at rest | Both | T-007, T-034 | Encrypt TOTP secrets, SSN, bank numbers. |
| **T-082** | Session management UI | Frontend | T-011 | Active sessions, revoke. |
| **T-083** | E2E test suite | Frontend | All UI | Full workflow test. |
| **T-084** | Performance testing | Both | All | k6 load tests. |
| **T-085** | Backup & restore verification | Backend | T-076V | Documented backup/restore procedure. Tested. |

---

## Task Assignment Summary

| Agent | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 | Total |
|:------|:-------:|:-------:|:-------:|:-------:|:-------:|:-------:|:-------:|:-----:|
| Frontend | 2 | 11 | 16 | 8 | 8 | 13 | 5 | **63** |
| Backend | 4 | 0* | 0* | 13 | 0 | 0 | 4 | **21** |
| Both | — | — | — | — | — | — | 1 | **1** |

*\* Backend starts Phase 3 (trust service) in parallel with Frontend Phase 1-2.*

---

## Estimated Timeline (AI-Agent Pace per GOV-008 §5)

| Phase | Sprint | Tasks | Duration |
|:------|:-------|:-----:|:---------|
| Phase 0 | SPR-001 | 6 | 2-4 hours |
| Phase 1 | SPR-002 | 11 | 6-12 hours |
| Phase 2 | SPR-003 | 16 | 12-24 hours |
| Phase 3 | SPR-004/005 | 21 | 12-24 hours |
| Phase 4 | SPR-006 | 8 | 4-8 hours |
| Phase 5 | SPR-007 | 13 | 8-16 hours |
| Phase 6 | SPR-008 | 10 | 6-12 hours |
| **Total** | **8 sprints** | **85** | **~3-6 days** |
