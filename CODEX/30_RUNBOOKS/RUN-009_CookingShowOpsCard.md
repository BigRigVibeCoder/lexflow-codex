---
id: RUN-009
title: "Cooking Show — Master Operations Card"
type: runbook
status: ACTIVE
owner: architect
agents: [none]
tags: [training, cooking-show, operations, checkpoint, recovery]
related: [RUN-007, RUN-008, SPR-008]
created: 2026-03-25
updated: 2026-03-25
version: 1.0.0
---

> **BLUF:** This is the single source of truth for the Day 2 cooking show's technical state. Every checkpoint, every credential, every recovery command. If something breaks during the demo, you and the architect agent read THIS document to get back on track.
>
> **Companion docs:**
> - [RUN-007](file:///home/bdavidriggins/Documents/train_agentic_architect/CODEX/30_INSTRUCTOR_GUIDES/RUN-007_CookingShowGuide.md) — The teaching plan (phases, prompts, sous chef hooks)
> - [RUN-008](file:///home/bdavidriggins/Documents/train_agentic_architect/CODEX/30_INSTRUCTOR_GUIDES/RUN-008_CookingShowCheckpointPrep.md) — Checkpoint strategy (what to tag, why, demo flow pacing)

---

## 1. Current System State (as of 2026-03-25 18:25 UTC)

### Repos & Commits

| Repo | Branch | HEAD | Status |
|:-----|:-------|:-----|:-------|
| `lexflow-codex` | `main` | `b9c39e8` | Clean ✅ |
| `lexflow-backend` | `main` | `fb280e3` | Clean ✅ |
| `lexflow-frontend` | `main` | `d6f00ca` | Clean ✅ |

### Production VM

| Item | Value |
|:-----|:------|
| VM Name | `lexflow-prod` |
| Provider | GCP `us-east1-b` |
| Public IP | `34.26.122.46` |
| SSH | `ssh -i keys/forge_fleet bdavidriggins@34.26.122.46` |
| Frontend URL | `http://34.26.122.46` |
| Containers | `lexflow-web`, `lexflow-trust`, `lexflow-nginx`, `lexflow-postgres` |
| Docker Network | `deploy_lexflow-internal` |

### Credentials

| What | User | Password |
|:-----|:-----|:---------|
| E2E admin login | `admin@lexflow.test` | `TestAdmin123!` |
| E2E attorney login | `attorney@lexflow.test` | `TestAttorney123!` |
| PostgreSQL | `lexflow` | `lexflow_dev_password` |
| NextAuth secret | — | `change-me-in-production` |
| Service key | — | `lexflow-internal-key` |

### Databases

| Database | Tables | Container |
|:---------|:------:|:----------|
| `lexflow_web` | 14 | `lexflow-postgres` |
| `lexflow_trust` | 4+ | `lexflow-postgres` |

### Backup State

| Item | Value |
|:-----|:------|
| Backup dir | `/var/backups/lexflow/` |
| Last backup | `lexflow_web_20260325_181520.sql.gz` (8KB) |
| Cron | `0 2 * * *` daily |
| Restore cmd | `scripts/restore.sh <file> [db_name]` |

---

## 2. Checkpoint Map

> **Purpose:** Each tag marks a known-good state you can jump to.
> **How to jump:** `git checkout <tag>` in the relevant repo.
> **How to return:** `git checkout main`

### Live vs Pre-baked (per RUN-008 strategy)

| Phase | Type | Teaching Value |
|:------|:----:|:---------------|
| Research (cp-0, cp-1) | 🎤 Live | Students watch the Architect think |
| Architecture (cp-2) | 🎤 Live | Students see CODEX/contracts created |
| Backend sprint (cp-3) | ⏩ Tag | "20 min later, here's what came out" |
| Frontend sprint (cp-4) | ⏩ Tag | "Meanwhile, the frontend agent produced this" |
| Audit (cp-6) | ⏩ Tag | "Now the architect audits both sprints" |
| Deploy (cp-5, cp-7) | 🎤 Live | Show the deploy, then walk through |

### Tagged Checkpoints (current state)

| Tag | Repo | Commit | What You Get | Demo Step |
|:----|:-----|:-------|:-------------|:----------|
| `cp-3-backend` | lexflow-backend | `fb280e3` | Trust service, backup scripts, all tests pass | Step 5 |
| `cp-4-frontend` | lexflow-frontend | `d6f00ca` | Full UI: auth, matters, trust, billing, docs, 193 tests | Step 6 |
| `cp-5-deployed` | lexflow-codex | `f84a275` | Deployed state marker | Step 8 |
| `cp-6-audit` | lexflow-codex | `b9c39e8` | E2E suite, VER/DEF reports, handoffs | Step 7 |
| `cp-7-deployed` | lexflow-codex | `f84a275` | Final CODEX state | End |

### Demo Flow (from RUN-008 §Day 2 Demo Flow)

```
1. Open agentic_architect template    → "Here's what you start with"
2. 🎤 LIVE: DarkGravity research      → ~20 min
3. 🎤 LIVE: Build CODEX + contracts   → ~40 min
4. Show handoff to backend agent      → "Watch what happens"
5. git checkout cp-3-backend          → "20 min later, here's the output"
6. git checkout cp-4-frontend         → "Meanwhile, the frontend agent..."
7. git checkout cp-6-audit            → "Now the architect audits"
8. git checkout cp-5-deployed          → "And it deploys to production"
```

### Quick Jump Commands

```bash
# ── Fast-forward to backend complete (step 5) ──
cd ~/Documents/lexflow/lexflow-backend
git checkout cp-3-backend
# "20 minutes later, here's what came out. 17 routes, all tests passing."

# ── Fast-forward to frontend complete (step 6) ──
cd ~/Documents/lexflow/lexflow-frontend
git checkout cp-4-frontend
# "Meanwhile, the frontend agent produced this."

# ── Return to latest ──
git checkout main

# ── Full reset (nuclear option) ──
cd ~/Documents/lexflow/lexflow-backend  && git checkout main && git reset --hard origin/main
cd ~/Documents/lexflow/lexflow-frontend && git checkout main && git reset --hard origin/main
cd ~/Documents/lexflow/lexflow-codex    && git checkout main && git reset --hard origin/main
```

---

## 3. Recovery Playbook

### Scenario: Login fails during demo
```bash
# Verify credentials
# User: admin@lexflow.test  Password: TestAdmin123!
# If locked out, restart the container:
ssh -i keys/forge_fleet bdavidriggins@34.26.122.46 \
  "docker restart lexflow-web && sleep 10 && docker ps"
```

### Scenario: Frontend shows 500 error
```bash
# Check container logs
ssh -i keys/forge_fleet bdavidriggins@34.26.122.46 \
  "docker logs lexflow-web --tail 20"
# If auth-related, verify NEXTAUTH_URL:
ssh -i keys/forge_fleet bdavidriggins@34.26.122.46 \
  "docker inspect lexflow-web | grep NEXTAUTH_URL"
# Should be: http://34.26.122.46 (NOT localhost:3000)
```

### Scenario: Backend trust service is down
```bash
ssh -i keys/forge_fleet bdavidriggins@34.26.122.46 \
  "docker ps && curl -s http://localhost:4000/health | jq"
# If down:
ssh -i keys/forge_fleet bdavidriggins@34.26.122.46 \
  "docker restart lexflow-trust && sleep 5 && docker ps"
```

### Scenario: Database is empty / corrupted
```bash
# Restore from backup
ssh -i keys/forge_fleet bdavidriggins@34.26.122.46 \
  "ls -la /var/backups/lexflow/"
# Pick the latest and restore:
ssh -i keys/forge_fleet bdavidriggins@34.26.122.46 \
  "~/scripts/restore.sh /var/backups/lexflow/lexflow_web_20260325_181520.sql.gz"
```

### Scenario: Container won't start
```bash
# Full rebuild
ssh -i keys/forge_fleet bdavidriggins@34.26.122.46 \
  "docker stop lexflow-web && docker rm lexflow-web && \
   docker run -d --name lexflow-web --network deploy_lexflow-internal \
   --restart unless-stopped \
   -e NODE_ENV=production \
   -e NEXTAUTH_URL=http://34.26.122.46 \
   -e PORT=3000 \
   -e NEXTAUTH_SECRET=change-me-in-production \
   -e INTERNAL_SERVICE_KEY=lexflow-internal-key \
   -e 'DATABASE_URL=postgresql://lexflow:lexflow_dev_password@postgres:5432/lexflow_web' \
   -e TRUST_SERVICE_URL=http://lexflow-trust:4000 \
   -e HOSTNAME=0.0.0.0 \
   lexflow-web:latest"
```

### Scenario: E2E tests fail during demo
```bash
# Run just the login flow (fastest confirmation)
cd ~/Documents/lexflow/lexflow-codex/tests/e2e
npx playwright test flows/01-login-dashboard.spec.ts --reporter=list
```

### Scenario: Internet goes down
> All checkpoint tags are local. Switch to guided walkthrough mode:
> `git checkout cp-5-deployed` and walk through the code.
> "Welcome to disaster recovery. This is also an architect skill."

---

## 4. E2E Test Status

| # | Flow | Tests | Status |
|:-:|:-----|:-----:|:------:|
| 1 | Login → Dashboard → Logout | 4 | ✅ All pass |
| 2 | Client → Matter (wizard) | 2 | ✅ All pass |
| 3 | Time → Billing → Payment | 3 | ⏭️ Skipped |
| 4 | Trust Account → Deposit | 2 | 🟡 1 pass, 1 timeout |
| 5 | Document Search/Filter | 2 | ✅ All pass |
| 6 | SOL Deadline + KPI | 2 | ✅ All pass |

**Run command:** `cd tests/e2e && npx playwright test --reporter=list`

---

## 5. What's Built vs What's Remaining

### ✅ Shipped & Running

| Feature | Sprint | Frontend | Backend | Prod |
|:--------|:-------|:--------:|:-------:|:----:|
| Auth (NextAuth v4) | SPR-002 | ✅ | — | ✅ |
| Matter CRUD + Wizard | SPR-003 | ✅ | — | ✅ |
| Trust Accounting | SPR-004/005 | ✅ | ✅ | ✅ |
| Document Management | SPR-006 | ✅ | — | ✅ |
| Time & Billing | SPR-007 | ✅ | — | ✅ |
| E2E Test Suite | SPR-008 | ✅ | — | ✅ |
| Backup/Restore | SPR-008 | — | ✅ | ✅ |
| UFW + Fail2ban | SPR-008 | — | ✅ | ✅ |

### 🔲 Remaining for v1.0

| Task | Description | Owner | Priority |
|:-----|:------------|:------|:--------:|
| T-080 | Security headers (CSP, HSTS) | Frontend | 🔴 |
| T-077V | Deploy automation script | Backend | 🔴 |
| T-091 | FMEA trust accounting | Architect | 🔴 |
| T-092 | Post-incident runbook | Architect | 🟡 |
| T-093 | Traceability matrix | Architect | 🟡 |

### ⚪ Deferred to v1.1

T-078 (Sentry), T-079 (rate limiting), T-081 (encryption), T-082 (session UI),
T-084 (k6 perf), T-086 (ESLint), T-087 (coverage gate), T-088 (logs),
T-089 (correlation IDs), T-090 (accessibility)

---

## 6. Agent Bootstrap Commands

```bash
# ── Architect Agent ──
Read CODEX/80_AGENTS/AGT-001_Architect_Agent.md
# + read this ops card: RUN-009

# ── Backend Agent ──
Read codex/CODEX/80_AGENTS/AGT-002_Developer_Agent.md
Read codex/CODEX/10_GOVERNANCE/GOV-007_AgenticProjectManagement.md

# ── Frontend Agent ──
Read codex/CODEX/80_AGENTS/AGT-002_Developer_Agent.md
Read codex/CODEX/10_GOVERNANCE/GOV-007_AgenticProjectManagement.md
```

---

## 7. File Locations

| What | Path |
|:-----|:-----|
| SSH key | `lexflow-codex/keys/forge_fleet` |
| GCP key | `lexflow-codex/keys/GCP_lab_key.json` |
| E2E tests | `lexflow-codex/tests/e2e/` |
| Playwright config | `tests/e2e/playwright.config.ts` |
| Auth fixture | `tests/e2e/fixtures/auth.fixture.ts` |
| Seed data | `tests/e2e/fixtures/seed-data.sql` |
| Backup script | `lexflow-backend/scripts/backup.sh` |
| Restore script | `lexflow-backend/scripts/restore.sh` |
| Cooking show guide | `train_agentic_architect/CODEX/30_INSTRUCTOR_GUIDES/RUN-007_CookingShowGuide.md` |
| **This document** | `lexflow-codex/CODEX/30_RUNBOOKS/RUN-009_CookingShowOpsCard.md` |

---

## 8. How to Use This Document

**Before the show:**
1. Read this card + RUN-007
2. Verify all containers: `docker ps` on the prod VM
3. Run one E2E test to confirm: `npx playwright test flows/01-login-dashboard.spec.ts`

**During the show (if something breaks):**
1. Tell the architect agent: "Read `CODEX/30_RUNBOOKS/RUN-009_CookingShowOpsCard.md`"
2. The agent knows every credential, every checkpoint, every recovery command
3. Jump to the relevant section (§3 Recovery, §2 Checkpoints)

**If you need to rewind:**
```bash
git checkout cp-3-backend   # "Let me show you where the backend was"
```

**If you need to fast-forward:**
```bash
git checkout main            # "Let me jump to the current state"
```

**If the agent is confused about state:**
> "Read RUN-009, section 1. That's the current system state."
