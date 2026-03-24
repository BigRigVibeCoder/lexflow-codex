---
id: SPR-001-ARCH
title: "Architect Sprint — Parallel with SPR-001"
type: sprint
status: ACTIVE
owner: architect
agents: [architect]
tags: [sprint, architect, phase-0, infrastructure, audit]
related: [BCK-002, SPR-001, GOV-008]
created: 2026-03-24
updated: 2026-03-24
version: 1.0.0
---

> **BLUF:** While developer agents execute SPR-001 (scaffold + health endpoints), the Architect prepares production infrastructure, creates the audit checklist, and monitors agent progress. End state: prod VM is ready, audit tooling exists, and SPR-001 audit can begin the moment agents commit.

# SPR-001-ARCH: Architect Tasks (During SPR-001)

**Parallel with:** SPR-001 (Frontend T-001/T-002/T-005V, Backend T-003/T-004V/T-005V/T-006V)
**Target:** Complete before both agents finish SPR-001

---

## A-001: Verify lexflow-prod VM Accessible
- **Category:** ARCH-INFRA
- **Deliverable:** Confirm SSH access to `lexflow-prod`. Document IP, hostname, OS version, current state.
- **Acceptance:** `ssh lexflow-prod` connects. Note specs (CPU, RAM, disk).
- **Status:** [x] Complete — 4 CPUs, 15GB RAM, 48GB disk, Ubuntu 24.04, GCP us-east1-b

## A-002: Pre-Stage Production Environment
- **Category:** ARCH-INFRA
- **Dependencies:** A-001
- **Deliverable:**
  - Verify/install: Ubuntu 22.04+, git, Node.js 20 LTS, npm
  - Create directories: `/opt/lexflow/frontend`, `/opt/lexflow/backend`
  - Create system user: `lexflow` (non-root service account)
  - Clone both repos into `/opt/lexflow/`
  - Initialize CODEX submodule in both
- **Acceptance:** Both repos cloned on prod. Node.js 20 available. `lexflow` user exists.
- **Status:** [x] Complete — Node.js 20, PM2 6, PostgreSQL 16, nginx 1.24. Databases: `lexflow_web`, `lexflow_trust`. Dirs: `/opt/lexflow/{frontend,backend,backups}`

## A-003: Create Sprint Audit Checklist Template
- **Category:** ARCH-AUDIT
- **Deliverable:** `40_VERIFICATION/VER-001_SprintAuditChecklist.md` — reusable template:
  - [ ] Code compiles (`npm run build`)
  - [ ] Lint passes (`npm run lint`)
  - [ ] TypeCheck passes (`npm run typecheck`)
  - [ ] Tests pass (`npm run test`)
  - [ ] Health endpoint returns 200
  - [ ] GOV-001: README and TSDoc present
  - [ ] GOV-002: Test infrastructure configured
  - [ ] GOV-003: TypeScript strict, no `any`, complexity limits
  - [ ] GOV-004: Error middleware present, structured responses
  - [ ] GOV-005: Branch naming correct, commit format correct
  - [ ] GOV-006: pino logging configured, correlation IDs
  - [ ] GOV-008: `.env.example` present, CODEX submodule linked
  - [ ] Contract compliance (if applicable)
- **Acceptance:** Checklist doc exists and can be cloned per sprint.
- **Status:** [x] Complete — VER-001 template + first audit filed (VER-001_SPR-001_Audit.md)

## A-004: Create Health Check Script
- **Category:** ARCH-INTEG
- **Deliverable:** `scripts/health-check.sh`:
  ```bash
  curl -sf http://localhost:3000/api/health && echo "✅ Web OK" || echo "❌ Web FAIL"
  curl -sf http://localhost:4000/health && echo "✅ Trust OK" || echo "❌ Trust FAIL"
  ```
- **Acceptance:** Script runs, reports status of both services.
- **Status:** [x] Complete — `scripts/health-check.sh` created (local + remote support)

## A-005: Monitor Frontend Agent Progress
- **Category:** ARCH-MON
- **Deliverable:** Check `lexflow-frontend` repo for:
  - Branches created (feature/SPR-001-T001-*, feature/SPR-001-T002-*)
  - Commits pushed
  - Any issues/questions from agent
- **Status:** [x] Complete — Repo cloned, branch verified, build/test pass

## A-006: Monitor Backend Agent Progress
- **Category:** ARCH-MON
- **Deliverable:** Check `lexflow-backend` repo for:
  - Branches created (feature/SPR-001-T003-*, feature/SPR-001-T004V-*)
  - Commits pushed
  - Any issues/questions from agent
- **Status:** [x] Complete — Repo cloned, branch verified, build pass, lint DEF-002 filed

## A-007: SPR-001 Architect Audit
- **Category:** ARCH-AUDIT
- **Dependencies:** Both agents complete SPR-001
- **Deliverable:**
  - Clone/pull both repos on lexflow-architect
  - Run VER-001 audit checklist against both repos
  - Run health-check.sh locally
  - File `DEF-001` if any failures
  - Mark SPR-001 tasks as audited in sprint doc
- **Acceptance:** Both repos pass full audit checklist. Zero DEF- reports.
- **Status:** [x] Complete — CONDITIONAL PASS. DEF-001 + DEF-002 filed.

## A-008: SPR-001 Deploy to Production
- **Category:** ARCH-DEPLOY
- **Dependencies:** A-007 passes
- **Deliverable:**
  - Run deploy.sh (from backend T-006V) to push to lexflow-prod
  - Verify both health endpoints on production
  - Tag release: `v0.1.0`
- **Acceptance:** `https://lexflow-prod/api/health` and `https://lexflow-prod/health` return 200.
- **Status:** [ ] Not Started

---

## Sprint Checklist

| Task | Category | Status | Priority |
|:-----|:---------|:-------|:---------|
| A-001 | INFRA | [x] | ~~Do now~~ Done |
| A-002 | INFRA | [x] | ~~Do now~~ Done |
| A-003 | AUDIT | [x] | ~~Do now~~ Done |
| A-004 | INTEG | [x] | ~~Do now~~ Done |
| A-005 | MON | [x] | ~~Ongoing~~ Done |
| A-006 | MON | [x] | ~~Ongoing~~ Done |
| A-007 | AUDIT | [x] | ~~When agents finish~~ CONDITIONAL PASS |
| A-008 | DEPLOY | [ ] | After DEF fixes + re-audit |

---

## Current Priority (Right Now)

**Tasks A-001 through A-004 can be done NOW while agents build.** They prepare the infrastructure and tooling so that the moment agents commit, the audit can begin immediately with zero delay.
