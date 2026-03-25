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
version: 2.0.0
---

> **BLUF:** Single source of truth for the Day 2 cooking show. Every credential, checkpoint, recovery command, and coordination rule. If something breaks during the demo, tell the architect agent: "Read `CODEX/30_RUNBOOKS/RUN-009_CookingShowOpsCard.md`."
>
> **Companion docs:**
> - [RUN-007](file:///home/bdavidriggins/Documents/train_agentic_architect/CODEX/30_INSTRUCTOR_GUIDES/RUN-007_CookingShowGuide.md) — Teaching plan (detailed phase scripts)
> - [RUN-008](file:///home/bdavidriggins/Documents/train_agentic_architect/CODEX/30_INSTRUCTOR_GUIDES/RUN-008_CookingShowCheckpointPrep.md) — Checkpoint strategy

---

# The 3-Act Structure

| Act | Time | What Happens | Directory |
|:----|:----:|:-------------|:----------|
| **1. Setup** | 60 min | Fork template, wire CODEX, bootstrap agents, build governance, run research, generate sprints | `/lexflow-demo/` |
| **2. Sprint Reveals** | 15 min | Show handoff → `git checkout` tags → walk through highlights | `/lexflow/` |
| **3. The Site** | 15 min | Pull up live app, walk through features, business pitch | `http://34.26.122.46` |

---

## Dual-Directory Layout

```
/home/bdavidriggins/Documents/
├── lexflow/                ← FINISHED PRODUCT (don't touch)
│   ├── lexflow-codex/      ← Tags: cp-5, cp-6, cp-7
│   ├── lexflow-backend/    ← Tag: cp-3-backend
│   ├── lexflow-frontend/   ← Tag: cp-4-frontend
│   └── darkgravity/
│
├── lexflow-demo/           ← ACT 1 WORKSPACE (build from scratch)
│   └── (empty — you build it live)
│
└── train_agentic_architect/ ← Course materials
```

**Rule:** Act 1 happens in `lexflow-demo/`. Acts 2–3 happen in `lexflow/` and the prod VM. Never mix them.

---

## Two Agents Running

| Agent | Context | Directory | Role |
|:------|:--------|:----------|:-----|
| **lexflowdemo-architect** | New session | `/lexflow-demo/` | The "from scratch" agent students watch. YOU drive this one. |
| **lexflow-architect** (me) | This session | `/lexflow/` | Backstage support. Owns finished product + prod VM. YOU talk to me on the side. |

**Coordination:**
- You work with the demo-architect in one IDE window (the show)
- You message me in this window when you need recovery, checkpoints, or ops help
- I never touch `/lexflow-demo/` — that's the demo-architect's space
- The demo-architect never touches `/lexflow/` or the prod VM — that's mine

---

# Act 1: The Setup (60 min)

> **Directory:** `/home/bdavidriggins/Documents/lexflow-demo/`

### Step-by-step

| # | What you do | What students learn | Time |
|:-:|:------------|:-------------------|:----:|
| 1 | Fork `agentic_architect` template → `lexflow-codex` | "This is your CODEX — governance travels through Git" | 5 min |
| 2 | Create `lexflow-backend` repo, add CODEX as submodule | "Both code repos share one governance layer" | 5 min |
| 3 | Create `lexflow-frontend` repo, add CODEX as submodule | Same pattern, students see the repetition | 3 min |
| 4 | Bootstrap the architect agent — read AGT-001 | "This is how you onboard an AI PM" | 5 min |
| 5 | Architect reads CODEX, asks YOU 5 questions about the environment | **KEY MOMENT:** "The agent asks before building. That's GOV-007." | 5 min |
| 6 | Show DarkGravity research prompt, use pre-baked output | "We started with chat, then used the swarm to go deeper" | 10 min |
| 7 | Architect generates roadmap, contracts, sprint docs | "PM work, not code. The Architect plans, developers execute." | 15 min |
| 8 | Push CODEX, show dev agent pulling via submodule | "Governance travels through Git, not Slack" | 5 min |
| 9 | Hand off sprint to backend dev agent, show it start coding | "Watch what happens when I hand this to a developer" | 5 min |

**If you're running long at step 6:** Skip the research walkthrough. Show the prompt, say "I ran this last night," and jump to step 7.

**If you're running long at step 9:** Don't wait for the agent to finish. Say "20 minutes later..." and transition to Act 2.

---

# Act 2: Sprint Reveals (15 min)

> **Directory:** `/home/bdavidriggins/Documents/lexflow/`

### The Checkpoint Jumps

```bash
# Step 1: "Here's what the backend agent produced"
cd ~/Documents/lexflow/lexflow-backend
git checkout cp-3-backend
# Show: 17 CON-002 routes, test results, commit history

# Step 2: "Meanwhile, the frontend agent produced this"
cd ~/Documents/lexflow/lexflow-frontend
git checkout cp-4-frontend
# Show: auth, matters wizard, trust UI, 193 tests

# Step 3: "And the architect audited both"
cd ~/Documents/lexflow/lexflow-codex
git checkout cp-6-audit
# Show: VER reports, DEF reports, governance scan

# Step 4: Return to main when done
cd ~/Documents/lexflow/lexflow-backend  && git checkout main
cd ~/Documents/lexflow/lexflow-frontend && git checkout main
cd ~/Documents/lexflow/lexflow-codex    && git checkout main
```

### What to highlight at each checkpoint

| Checkpoint | Show these | Say this |
|:-----------|:-----------|:---------|
| cp-3-backend | `npm test` output, route count, commit log | "17 API routes, all tests green, governance-compliant" |
| cp-4-frontend | Browser screenshots, test count, wizard flow | "Full UI — auth, 5-step matter wizard, trust accounting" |
| cp-6-audit | VER reports, DEF-007 defect cycle | "The architect doesn't read code — it reads test results" |

---

# Act 3: The Site (15 min)

> **Target:** `http://34.26.122.46`

### Demo walkthrough

| # | Action | What to show |
|:-:|:-------|:-------------|
| 1 | Navigate to `http://34.26.122.46` | Login page loads |
| 2 | Log in as `admin@lexflow.test` / `TestAdmin123!` | Dashboard with KPI cards |
| 3 | Click Clients → show list | Data from seed migration |
| 4 | Click Matters → show list + "New Matter" wizard | 5-step wizard flow |
| 5 | Click Trust → show accounts | Trust balance, transaction history |
| 6 | Click Documents → show search | Category filter, document table |
| 7 | Sign Out → redirects to login | "Auth works, session management works" |

### The business pitch

> "Built from an empty template. Three agents. One CODEX. Running on a $97/month server. Clio charges $890/month. The firm owns every line of code and every byte of data."

---

# System State

### Production VM

| Item | Value |
|:-----|:------|
| IP | `34.26.122.46` |
| SSH | `ssh -i keys/forge_fleet bdavidriggins@34.26.122.46` |
| SSH key | `lexflow-codex/keys/forge_fleet` |
| Containers | `lexflow-web`, `lexflow-trust`, `lexflow-nginx`, `lexflow-postgres` |
| Frontend URL | `http://34.26.122.46` |
| Docker Network | `deploy_lexflow-internal` |

### Credentials

| What | User | Password |
|:-----|:-----|:---------|
| E2E admin | `admin@lexflow.test` | `TestAdmin123!` |
| E2E attorney | `attorney@lexflow.test` | `TestAttorney123!` |
| PostgreSQL | `lexflow` | `lexflow_dev_password` |
| NextAuth secret | — | `change-me-in-production` |
| Service key | — | `lexflow-internal-key` |

### Checkpoint Tags

| Tag | Repo | Commit |
|:----|:-----|:-------|
| `cp-3-backend` | lexflow-backend | `fb280e3` |
| `cp-4-frontend` | lexflow-frontend | `d6f00ca` |
| `cp-5-deployed` | lexflow-codex | `f84a275` |
| `cp-6-audit` | lexflow-codex | `b9c39e8` |
| `cp-7-deployed` | lexflow-codex | `f84a275` |

### Backup State

| Item | Value |
|:-----|:------|
| Dir | `/var/backups/lexflow/` |
| Cron | `0 2 * * *` daily |
| Last backup | `lexflow_web_20260325_181520.sql.gz` |

---

# Recovery Playbook

### Login fails
```bash
# Correct creds: admin@lexflow.test / TestAdmin123!
# If locked, restart container:
ssh -i keys/forge_fleet bdavidriggins@34.26.122.46 \
  "docker restart lexflow-web && sleep 10 && docker ps"
```

### Frontend 500 error
```bash
ssh -i keys/forge_fleet bdavidriggins@34.26.122.46 \
  "docker logs lexflow-web --tail 20"
# Verify NEXTAUTH_URL is http://34.26.122.46 (not localhost)
```

### Container won't start
```bash
ssh -i keys/forge_fleet bdavidriggins@34.26.122.46 \
  "docker stop lexflow-web && docker rm lexflow-web && \
   docker run -d --name lexflow-web --network deploy_lexflow-internal \
   --restart unless-stopped \
   -e NODE_ENV=production \
   -e NEXTAUTH_URL=http://34.26.122.46 \
   -e PORT=3000 -e NEXTAUTH_SECRET=change-me-in-production \
   -e INTERNAL_SERVICE_KEY=lexflow-internal-key \
   -e 'DATABASE_URL=postgresql://lexflow:lexflow_dev_password@postgres:5432/lexflow_web' \
   -e TRUST_SERVICE_URL=http://lexflow-trust:4000 \
   -e HOSTNAME=0.0.0.0 lexflow-web:latest"
```

### Database corrupted
```bash
ssh -i keys/forge_fleet bdavidriggins@34.26.122.46 \
  "~/scripts/restore.sh /var/backups/lexflow/lexflow_web_20260325_181520.sql.gz"
```

### E2E quick smoke test
```bash
cd ~/Documents/lexflow/lexflow-codex/tests/e2e
npx playwright test flows/01-login-dashboard.spec.ts --reporter=list
```

### Internet dies
> All tags are local. `git checkout cp-5-deployed` and walk through code.
> "Welcome to disaster recovery. This is also an architect skill."

---

# File Locations

| What | Path |
|:-----|:-----|
| **Demo workspace** | `/home/bdavidriggins/Documents/lexflow-demo/` |
| **Finished product** | `/home/bdavidriggins/Documents/lexflow/` |
| SSH key | `lexflow-codex/keys/forge_fleet` |
| GCP key | `lexflow-codex/keys/GCP_lab_key.json` |
| E2E tests | `lexflow-codex/tests/e2e/` |
| Backup script | `lexflow-backend/scripts/backup.sh` |
| Restore script | `lexflow-backend/scripts/restore.sh` |
| Cooking show guide | `train_agentic_architect/CODEX/30_INSTRUCTOR_GUIDES/RUN-007_CookingShowGuide.md` |
| Checkpoint prep | `train_agentic_architect/CODEX/30_INSTRUCTOR_GUIDES/RUN-008_CookingShowCheckpointPrep.md` |
| **This document** | `lexflow-codex/CODEX/30_RUNBOOKS/RUN-009_CookingShowOpsCard.md` |
