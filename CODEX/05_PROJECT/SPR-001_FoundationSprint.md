---
id: SPR-001
title: "Foundation Sprint — Project Scaffold & Infrastructure"
type: sprint
status: PLANNING
owner: architect
agents: [frontend, backend]
tags: [sprint, phase-0, scaffold, infrastructure]
related: [BCK-001, GOV-007, GOV-008, BLU-ARCH-001, CON-001]
created: 2026-03-22
updated: 2026-03-22
version: 1.0.0
---

> **BLUF:** Bootstrap both repos and the production VM. Frontend gets Next.js 15; Backend gets Fastify 4 + trust service shell. VM gets PostgreSQL, nginx, and PM2. Both get CI. End state: both services running with health endpoints, deployable to `lexflow-prod`. **Governance compliance is mandatory from task one.**

# SPR-001: Foundation Sprint

**Phase:** 0 — Project Scaffold & Infrastructure
**Target:** 2-4 hours (AI-agent pace)
**Parallel tracks:** Frontend (T-001, T-002) and Backend (T-003, T-004V, T-006V) run simultaneously.

---

## ⚠️ Mandatory Compliance — Every Task

All tasks in this sprint (and every future sprint) MUST incorporate the following governance standards from day one. These are not optional and not deferred:

| Governance Doc | Sprint Requirement |
|:---------------|:-------------------|
| **GOV-001** (Documentation) | All code files include JSDoc/TSDoc comments. README.md in each repo. |
| **GOV-002** (Testing) | Configure testing infrastructure: Vitest for unit/integration, ESLint + TypeScript strict for static analysis. Tests run on every commit. |
| **GOV-003** (Coding) | TypeScript strict mode, ESLint configured, consistent naming, no `any` types, complexity limits. |
| **GOV-004** (Error Handling) | Structured error response middleware in both services. Error boundary in Next.js. No unhandled promise rejections. |
| **GOV-005** (Dev Lifecycle) | Branch naming: `feature/SPR-001-TXXX-description`. Commit format: `feat(SPR-001): description`. |
| **GOV-006** (Logging) | Structured JSON logging configured (pino for Fastify, pino for Next.js API routes). Log levels, correlation IDs. |
| **GOV-007** (PM) | Task status updates in sprint doc. Blockers escalated via `DEF-` docs. |
| **GOV-008** (Infrastructure) | CODEX submodule linked. `.env.example` with all vars. |

**Acceptance gate:** No task is considered complete unless ALL applicable governance requirements are met. The Architect will audit compliance.

---

## Frontend Agent Tasks (lexflow-frontend)

### T-001: Frontend Project Scaffold
- **Branch:** `feature/SPR-001-T001-nextjs-scaffold`
- **Contracts:** None (first task)
- **Blueprints:** BLU-ARCH-001 §2 (Matter Management schema defines the DB target), §1.1 (overall architecture)
- **Deliverable:**
  - Next.js 15 App Router project with TypeScript strict mode
  - Tailwind CSS 3 + shadcn/ui component library initialized
  - `package.json` with dependencies: `drizzle-orm`, `@trpc/server`, `@trpc/client`, `@trpc/next`, `next-auth`, `argon2`, `zod`, `@tanstack/react-query`
  - PostgreSQL connection config (Drizzle) pointing to `localhost:5432/lexflow_main`
  - Base `tsconfig.json` with strict mode, path aliases (`@/`)
  - `.env.example` with all required vars
  - `.gitignore`
  - CODEX submodule reference: `git submodule add https://github.com/BigRigVibeCoder/lexflow-codex.git lexflow-codex`
- **Acceptance criteria:**
  - `npm install` succeeds
  - `npm run dev` starts Next.js on port 3000
  - `npm run build` succeeds (production build)
  - `npm run lint` passes
- **Status:** [ ] Not Started

### T-002: Frontend Health Endpoint
- **Branch:** `feature/SPR-001-T002-health-endpoint`
- **Dependencies:** T-001
- **Deliverable:**
  - `src/app/api/health/route.ts` returning `{ "status": "ok", "timestamp": "<ISO>" }`
- **Acceptance criteria:**
  - `curl http://localhost:3000/api/health` returns 200 with JSON
- **Status:** [ ] Not Started

---

## Backend Agent Tasks (lexflow-backend)

### T-003: Backend Trust Service Scaffold
- **Branch:** `feature/SPR-001-T003-trust-service-scaffold`
- **Contracts:** None (first task)
- **Blueprints:** BLU-ARCH-001 §4 (Trust Accounting)
- **Deliverable:**
  - Fastify 4 project with TypeScript strict mode
  - Dependencies: `fastify`, `@fastify/type-provider-typebox`, `drizzle-orm`, `drizzle-kit`, `pg`, `dotenv`, `@sinclair/typebox`, `zod`
  - PostgreSQL connection config pointing to `localhost:5432/lexflow_trust`
  - `GET /health` returning `{ "status": "ok", "uptimeMs": N }`
  - `.env.example` with: `DATABASE_URL`, `INTERNAL_SERVICE_KEY`, `PORT=4000`, `NODE_ENV`
  - `.gitignore`
  - CODEX submodule: `git submodule add https://github.com/BigRigVibeCoder/lexflow-codex.git lexflow-codex`
- **Acceptance criteria:**
  - `npm install` succeeds
  - `npm run dev` starts Fastify on port 4000
  - `npm run build` succeeds
  - `curl http://localhost:4000/health` returns 200
- **Status:** [ ] Not Started

### T-004V: VM Provisioning Scripts
- **Branch:** `feature/SPR-001-T004V-vm-provision`
- **Dependencies:** None
- **Blueprints:** GOV-008 §3
- **Deliverable:**
  - `scripts/provision.sh` — installs on `lexflow-prod`:
    - PostgreSQL 15 (`apt install postgresql-15`)
    - Creates databases: `lexflow_main`, `lexflow_trust`
    - Creates DB users: `lexflow_web` (owns `lexflow_main`), `lexflow_trust` (owns `lexflow_trust`)
    - Node.js 20 LTS (via nvm or nodesource)
    - PM2 (`npm install -g pm2`)
    - nginx with reverse proxy config:
      - `/ → localhost:3000` (Next.js)
      - `/api/trust/ → localhost:4000` (Trust Service)
    - Document storage directory: `mkdir -p /var/lexflow/documents && chown lexflow:lexflow /var/lexflow/documents`
    - UFW firewall: allow 80, 443, 22 only
  - `scripts/nginx.conf` — production nginx config
  - `scripts/ecosystem.config.js` — PM2 process config for both services
- **Acceptance criteria:**
  - Run on fresh Ubuntu 22.04 VM → PostgreSQL running, nginx serving, PM2 ready
  - `psql -U lexflow_web -d lexflow_main -c "SELECT 1"` succeeds
  - `psql -U lexflow_trust -d lexflow_trust -c "SELECT 1"` succeeds
- **Status:** [ ] Not Started

### T-005V: CI Pipeline (both repos)
- **Branch:** `feature/SPR-001-T005V-ci-pipeline`
- **Dependencies:** T-001 (frontend), T-003 (backend)
- **Deliverable:**
  - `.github/workflows/ci.yml` in BOTH repos:
    - Triggers on PR to `main` and push to `main`
    - Jobs: install → lint → typecheck → unit test
    - Node.js 20, npm
  - Each agent creates their own repo's CI file
- **Acceptance criteria:**
  - Push to PR branch triggers CI
  - All jobs pass on the scaffold project (no failures from empty test suites)
- **Status:** [ ] Not Started

### T-006V: Deployment Script
- **Branch:** `feature/SPR-001-T006V-deploy-script`
- **Dependencies:** T-004V
- **Deliverable:**
  - `scripts/deploy.sh` — deployment to `lexflow-prod`:
    1. SSH to VM
    2. `cd /opt/lexflow/backend && git pull origin main`
    3. `npm install --production`
    4. Run trust DB migrations: `npx drizzle-kit migrate`
    5. `pm2 restart lexflow-trust`
    6. Wait for health check: `curl -f localhost:4000/health`
    7. `cd /opt/lexflow/frontend && git pull origin main`
    8. `npm install --production && npm run build`
    9. Run main DB migrations: `npx drizzle-kit migrate`
    10. `pm2 restart lexflow-web`
    11. Wait for health check: `curl -f localhost:3000/api/health`
  - **Deploy order is critical:** trust migrations → trust restart → web migrations → web restart
- **Acceptance criteria:**
  - `./scripts/deploy.sh` deploys both services to VM
  - Both health endpoints return 200 after deployment
- **Status:** [ ] Not Started

---

## Sprint Checklist

| Task | Agent | Status | Branch | Audited |
|:-----|:------|:-------|:-------|:--------|
| T-001 | Frontend | [ ] | `feature/SPR-001-T001-nextjs-scaffold` | [ ] |
| T-002 | Frontend | [ ] | `feature/SPR-001-T002-health-endpoint` | [ ] |
| T-003 | Backend | [ ] | `feature/SPR-001-T003-trust-service-scaffold` | [ ] |
| T-004V | Backend | [ ] | `feature/SPR-001-T004V-vm-provision` | [ ] |
| T-005V | Both | [ ] | `feature/SPR-001-T005V-ci-pipeline` | [ ] |
| T-006V | Backend | [ ] | `feature/SPR-001-T006V-deploy-script` | [ ] |

---

## Sprint Completion Criteria

- [ ] Both repos have working scaffold projects
- [ ] Both health endpoints return 200
- [ ] CI pipeline runs on both repos
- [ ] `lexflow-prod` VM has PostgreSQL, nginx, PM2 configured
- [ ] Deploy script successfully deploys both services to VM
- [ ] Architect audit complete: all tasks match acceptance criteria
