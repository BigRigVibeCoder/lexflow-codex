---
id: GOV-008
title: "LexFlow Infrastructure & Operations Standard"
type: reference
status: APPROVED
owner: human
agents: [all]
tags: [governance, infrastructure, deployment, git-workflow, agent-operations]
related: [GOV-007, GOV-005, AGT-001, BLU-ARCH-001]
created: 2026-03-22
updated: 2026-03-22
version: 1.0.0
---

> **BLUF:** LexFlow uses a multi-repo architecture with CODEX as the shared PM submodule. All services deploy to a single GCP VM (not Cloud Run). Development is fully AI-agent-paced — the Architect Agent documents, commits, and triggers; the Developer Agents execute at machine speed.

# LexFlow Infrastructure & Operations Standard

---

## 1. Repository Architecture

LexFlow is a multi-repo project. The CODEX PM system lives in its own repository and is consumed by frontend and backend repos as a Git submodule.

```
┌──────────────────────────────────────┐
│   lexflow-codex (PM + Governance)    │
│   github.com/BigRigVibeCoder/        │
│            lexflow-codex             │
│                                      │
│   CODEX/                             │
│   ├── 05_PROJECT/   (sprints, etc.)  │
│   ├── 10_GOVERNANCE/                 │
│   ├── 20_BLUEPRINTS/                 │
│   ├── 30_RUNBOOKS/                   │
│   └── ...                            │
└──────────┬──────────┬────────────────┘
           │          │
    submodule      submodule
           │          │
┌──────────▼────┐  ┌──▼───────────────┐
│ lexflow-       │  │ lexflow-          │
│ frontend       │  │ backend           │
│ (Next.js app)  │  │ (Trust service +  │
│                │  │  API layer)       │
│ github.com/    │  │ github.com/       │
│ BigRigVibeCoder│  │ BigRigVibeCoder/  │
│ /lexflow-      │  │ lexflow-backend   │
│  frontend      │  │                   │
└────────────────┘  └───────────────────┘
```

### 1.1 Repository Responsibilities

| Repository | Contents | Primary Agent | VM |
|:-----------|:---------|:--------------|:---|
| `lexflow-codex` | CODEX PM system, governance, blueprints, contracts, sprints | Architect Agent | (local) |
| `lexflow-frontend` | Next.js 15 App Router, UI components, tRPC client, NextAuth | Frontend Developer Agent | `lexflow-architect` |
| `lexflow-backend` | Trust Accounting Service (Fastify), DB migrations, API layer | Backend Developer Agent | `lexflow-backend` |

### 1.2 Submodule Contract

Both `lexflow-frontend` and `lexflow-backend` include `lexflow-codex` as a Git submodule. This means:

- **Agents read CODEX from their own repo's submodule** — sprint assignments, contracts, and blueprints are always available locally
- **The Architect Agent pushes to `lexflow-codex`** — when a sprint doc or contract is committed, both dev agents see it on their next `git submodule update`
- **Dev agents never write to `lexflow-codex`** — if they need a contract change, they propose it via `EVO-` or `DEF-` doc (per GOV-007 §5)

### 1.3 Mapping BLU-ARCH-001 Monorepo to Multi-Repo

BLU-ARCH-001 specifies a monorepo structure. The mapping to multi-repo is:

| BLU-ARCH-001 Monorepo Path | Actual Location |
|:---------------------------|:----------------|
| `apps/web/` | `lexflow-frontend/` (entire repo) |
| `apps/trust-service/` | `lexflow-backend/` (entire repo) |
| `packages/shared-types/` | Contract-first: defined in `CON-` docs, each agent generates types from contracts |
| `packages/trust-client/` | Lives in `lexflow-frontend/src/lib/trust-client/` |

> [!IMPORTANT]
> **Contract-first shared types (decided):** TypeScript interfaces are defined canonically in `CON-` contract documents. Each Dev Agent generates their own type files from the contract spec. The Architect Agent audits both repos for type drift against `CON-` docs. This aligns with GOV-007's principle that contracts are the highest-authority documents.

---

## 2. Git Workflow

### 2.1 Branch Strategy

Each Dev Agent works in their own repo with their own branches:

```
lexflow-frontend (Frontend Agent):
  main ← feature/SPR-001-T001-nextjs-scaffold
       ← feature/SPR-001-T002-nextauth-setup
       ← ...

lexflow-backend (Backend Agent):
  main ← feature/SPR-001-T010-trust-service-scaffold
       ← feature/SPR-001-T011-db-migrations
       ← ...

lexflow-codex (Architect Agent):
  main ← (direct commits — sprints, contracts, governance)
```

### 2.2 Merge Authority

| Action | Who |
|:-------|:----|
| Merge feature branches in `lexflow-frontend` | Human (after Architect audit) |
| Merge feature branches in `lexflow-backend` | Human (after Architect audit) |
| Commit to `lexflow-codex` | Architect Agent (direct to main) |
| Update CODEX submodule pointer in frontend/backend | Human or CI |

### 2.3 Human Integration and Deployment

The Human pulls all repos to their local machine for integration testing and production deployment:

```
/home/bdavidriggins/Documents/lexflow/
├── lexflow-codex/        ← Architect's PM system
├── lexflow-frontend/     ← pulls from Frontend Agent's repo
├── lexflow-backend/      ← pulls from Backend Agent's repo
└── lexflow-prod/         ← deployment staging area
```

---

## 3. Deployment Architecture

### 3.1 Target: Single GCP VM

> [!CAUTION]
> **BLU-ARCH-001 specifies Cloud Run, Cloud SQL (managed), and GCS.** The actual deployment target is a **single GCP VM (`lexflow-prod`)**. All services run on this VM directly — no Cloud Run, no managed database services.

This changes the deployment model significantly:

| BLU-ARCH-001 Specification | Actual Deployment |
|:---------------------------|:------------------|
| Cloud Run (Next.js) | PM2 or systemd on VM |
| Cloud Run (Trust Service) | PM2 or systemd on VM |
| Cloud SQL (managed PostgreSQL HA) | PostgreSQL installed on VM (self-managed) |
| GCS (signed URL uploads) | **Local filesystem** (`/var/lexflow/documents/`) |
| Cloud Run OIDC auth between services | Local network (localhost) or Unix socket |
| Cloud Monitoring / Cloud Armor | Self-hosted monitoring (Prometheus/Grafana or similar) |
| Terraform for Cloud infra | Ansible/shell scripts for VM configuration |

### 3.2 VM Service Architecture

```
lexflow-prod (GCP VM)
├── nginx (reverse proxy, TLS termination)
│   ├── / → localhost:3000 (Next.js app)
│   └── /api/trust/ → localhost:4000 (Trust service)
├── Node.js (Next.js 15) → port 3000
│   └── managed by PM2 or systemd
├── Node.js (Fastify Trust Service) → port 4000
│   └── managed by PM2 or systemd
├── PostgreSQL 15
│   ├── lexflow_main (frontend DB)
│   └── lexflow_trust (trust service DB)
└── File storage
    └── /var/lexflow/documents/ (local disk — test environment)
```

### 3.3 Security Implications

- **Service-to-service auth simplifies** — both services on localhost, no OIDC tokens needed for internal calls
- **HIPAA/data sovereignty improves** — all data on a VM you fully control
- **PostgreSQL HA** — must be self-managed (streaming replication or periodic backups instead of Cloud SQL HA)
- **TLS** — nginx handles HTTPS termination; internal services communicate over localhost (plain HTTP)
- **Backups** — must be scripted (pg_dump + cron instead of Cloud SQL automated backups)

---

## 4. Agent Communication Protocol

### 4.1 Architect → Developer Communication

The Architect Agent communicates with Developer Agents exclusively through CODEX:

```
Architect commits to lexflow-codex:
  CODEX/05_PROJECT/SPR-001_FoundationSprint.md
  CODEX/20_BLUEPRINTS/CON-001_TrustServiceAPI.md

Dev Agent updates submodule:
  git submodule update --remote

Dev Agent reads:
  lexflow-codex/CODEX/05_PROJECT/SPR-001_FoundationSprint.md
  → sees assigned tasks → executes
```

### 4.2 Developer → Architect Communication

Developer Agents communicate back through their own repo:

- **Code output**: committed to feature branches in `lexflow-frontend` or `lexflow-backend`
- **Contract issues**: Dev creates `EVO-` or `DEF-` proposal as a file in their repo's `docs/` or as a PR comment
- **Status updates**: Dev updates task status inline in their sprint doc copy (Architect reads on next pull)

### 4.3 Sprint Assignment Format

Sprint tasks must specify which agent is responsible:

```markdown
## Task T-001: Initialize Next.js 15 Project
- **Assignee:** Frontend Agent (`lexflow-frontend`)
- **Branch:** `feature/SPR-001-T001-nextjs-scaffold`
- **Contract:** CON-002 §1.1
- **Acceptance:** `npm run build` succeeds, App Router structure matches BLU-ARCH-001 §1.2
```

---

## 5. Development Pace

### 5.1 AI-Agent Speed Model

This is an **agentic development project**. All three agents (Architect, Frontend Dev, Backend Dev) are AI. Development pace is measured in minutes, not days.

| Activity | Expected Duration |
|:---------|:-----------------|
| Architect creates sprint doc | 5–15 minutes |
| Dev Agent completes a task | 10–60 minutes |
| Architect audit of output | 5–15 minutes |
| Full sprint cycle (5–8 tasks) | 2–6 hours |
| Module delivery (all sprints) | 1–3 days |

### 5.2 Implications for Sprint Planning

- **All sprints and contracts must be ready before agents start** — agents execute immediately upon receiving assignments
- **Sprint docs must be specific and self-contained** — no back-and-forth clarification cycles
- **Contracts are the gating mechanism** — if a contract is ambiguous, the agent blocks and escalates immediately rather than guessing
- **Parallelize where possible** — Frontend and Backend agents can execute simultaneously on independent tasks

### 5.3 Architect's Preparation Checklist

Before Developer Agents begin:

1. [x] Research complete (RES-002)
2. [x] Architecture spec complete (BLU-ARCH-001)
3. [x] Infrastructure governance complete (GOV-008 — this document)
4. [ ] Interface contracts extracted (`CON-001` through `CON-NNN`)
5. [ ] Backlog created (`BCK-001`)
6. [ ] Agent definitions created (`AGT-002`, `AGT-003`)
7. [ ] Foundation sprint created (`SPR-001`)

---

## 6. Deployment Pipeline

### 6.1 From Dev to Production

```
Frontend Agent → feature branch → PR → Human merges to main
Backend Agent  → feature branch → PR → Human merges to main

Human pulls both repos locally:
  cd /home/bdavidriggins/Documents/lexflow/lexflow-frontend && git pull
  cd /home/bdavidriggins/Documents/lexflow/lexflow-backend && git pull

Human deploys to lexflow-prod:
  (rsync / scp / git pull on VM — exact method TBD in RUN-001)
```

### 6.2 Deployment Order (from BLU-ARCH-001)

1. PostgreSQL schema migrations (trust service owns trust tables)
2. Trust Service restart
3. Next.js app restart (depends on trust service being up)

This ordering must be respected in all deployments.

---

> **"Three repos. Three agents. One CODEX. Machine speed."**
