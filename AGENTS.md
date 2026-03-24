# AGENTS.md — Project Context for AI Coding Agents

> **What this file does:** This is the universal agent briefing for any AI coding tool working in the LexFlow CODEX repository. It is tool-agnostic — Gemini, Claude, Cursor, Copilot, and any other AGENTS.md-compatible tool will read it automatically.
>
> **Related files:**
> - `GEMINI.md` — Antigravity-specific personality and behavioral rules (Gemini only)
> - `.agent/context.md` — legacy context file, now delegates here
> - `CODEX/80_AGENTS/` — detailed role templates and project-specific boot docs

---

## 1. Project Overview

**LexFlow** is a trust accounting and matter management application for law firms. It manages attorney-client trust (IOLTA) accounts with legal compliance — every dollar in, every dollar out, fully auditable.

### Architecture

| Layer | Tech | Repo | VM |
|:------|:-----|:-----|:---|
| **Frontend** | Next.js 15, TypeScript, Tailwind, shadcn/ui | `lexflow-frontend` | `lexflow-architect` |
| **Backend** | Fastify 4, TypeScript, Drizzle, PostgreSQL | `lexflow-backend` | `lexflow-backend` |
| **CODEX** | This repo — governance, contracts, sprints | `lexflow-codex` | All VMs (submodule) |
| **Production** | PM2, nginx, PostgreSQL | — | `lexflow-prod` |

### Multi-Repo Structure

```
lexflow-frontend/
├── src/                    # Next.js application
├── lexflow-codex/          ← This repo (Git submodule)
│   └── CODEX/
└── package.json

lexflow-backend/
├── src/                    # Fastify trust service
├── lexflow-codex/          ← This repo (Git submodule)
│   └── CODEX/
└── package.json
```

Both code repos include `lexflow-codex` as a Git submodule. Contract changes propagate via `git submodule update`.

### Three-Tier Hierarchy

```
Human (final authority)
    ↓ works with
Architect Agent (AI project manager — manages this CODEX repo)
    ↓ assigns work to
Frontend Agent (lexflow-frontend) + Backend Agent (lexflow-backend)
```

---

## 2. Repository Structure

All project documentation lives in `CODEX/`. Do **not** create docs outside this structure.

```
CODEX/
├── 00_INDEX/          ← MANIFEST.yaml is your document map. Start here.
├── 05_PROJECT/        ← Active ops: roadmaps, sprints (SPR-001–008), backlogs
├── 10_GOVERNANCE/     ← Standards and rules — read FIRST (GOV-001 through GOV-008)
├── 20_BLUEPRINTS/     ← Architecture (BLU-), contracts (CON-001, CON-002)
├── 30_RUNBOOKS/       ← Operational procedures
├── 40_VERIFICATION/   ← Test specs, audit reports (VER-)
├── 50_DEFECTS/        ← Bug reports (DEF-)
├── 60_EVOLUTION/      ← Feature proposals (EVO-)
├── 70_RESEARCH/       ← Research (RES-002 DarkGravity research)
├── 80_AGENTS/         ← Agent role definitions + project-specific boot docs
├── 90_ARCHIVE/        ← Deprecated docs — do not use
└── _templates/        ← Templates for new docs
```

Other top-level directories:

```
.agent/                ← Agent config (workflows, DarkGravity engine config)
bin/                   ← Utility scripts (compliance_check.sh, DarkGravity resolver)
```

---

## 3. How to Find Documents

1. **Parse** `CODEX/00_INDEX/MANIFEST.yaml`
2. **Filter** by `tags`, `type`, `status`, or `agents` field
3. **Read** only the docs that match your current task

Do not scan the entire CODEX. Use MANIFEST.yaml as your index — it's kept in sync by the Architect Agent.

---

## 4. Governance — The Laws

All governance documents live in `CODEX/10_GOVERNANCE/`. **Read these first** — they are mandatory, not advisory.

| ID | Document | What It Governs |
|:---|:---------|:----------------|
| GOV-001 | `DocumentationStandard.md` | Doc formatting, frontmatter schema, CODEX taxonomy |
| GOV-002 | `TestingProtocol.md` | Testing tiers, coverage thresholds, forensic reports |
| GOV-003 | `CodingStandard.md` | TypeScript strict, no `any`, complexity ≤10 |
| GOV-004 | `ErrorHandlingProtocol.md` | Structured error handling, GOV-004 error shapes |
| GOV-005 | `AgenticDevelopmentLifecycle.md` | Branch naming, commit format, dev workflow |
| GOV-006 | `LoggingSpecification.md` | pino structured JSON logging, correlation IDs |
| GOV-007 | `AgenticProjectManagement.md` | PM system, sprint/backlog/defect management, §9 lessons learned |
| GOV-008 | `InfrastructureAndOperations.md` | Multi-repo, VM deployment, DB ownership, file storage |

### Key Rules (Quick Reference)

- Every `.md` file requires YAML frontmatter (see GOV-001 for schema)
- Stay under 10KB per document — split large docs
- Use templates from `CODEX/_templates/` for new docs
- Use controlled tags from `CODEX/00_INDEX/TAG_TAXONOMY.yaml` only
- Update `MANIFEST.yaml` when creating or modifying docs
- Never change a `CON-` contract unilaterally — propose via `EVO-`
- Governance compliance is mandatory from task 1 — not a "polish" phase

---

## 5. Contracts — The Binding Interfaces

| Contract | What It Defines | Key Content |
|:---------|:----------------|:------------|
| `CON-001` | Communication Protocol | Transport (HTTP), auth (shared secret), error shapes |
| `CON-002` | Trust Service HTTP API | 17 routes with full TypeScript request/response schemas |

Contracts are **immutable without Human approval**. If you find a contract error, create an `EVO-` proposal — do not self-fix.

---

## 6. Agent Roles

Detailed role definitions live in `CODEX/80_AGENTS/`.

| File | Role | Use When |
|:-----|:-----|:---------|
| `AGT-001_Architect_Agent.md` | Architect (AI PM) | Generic architect role template |
| `AGT-002_Developer_Agent.md` | Developer (generic) | Generic developer role template |
| `AGT-002-FE_Frontend_Developer.md` | Frontend Developer | **LexFlow-specific** — boot doc for frontend agent |
| `AGT-003-BE_Backend_Developer.md` | Backend Developer | **LexFlow-specific** — boot doc for backend agent |
| `AGT-003_Tester_Agent.md` | Tester | Generic tester role template |

### Role Boundaries

- **Architect:** Governs, audits, assigns, deploys. Does not write feature code. Has own backlog (BCK-002).
- **Frontend Developer:** Builds Next.js UI. Owns `lexflow_web` database (if any).
- **Backend Developer:** Builds Fastify trust service. Owns `lexflow_trust` database and all 17 CON-002 routes.
- **Tester:** Verifies output against contracts. Does not fix defects.

---

## 7. Sprint Plan

LexFlow has **8 developer sprints** and **architect sprints** running in parallel:

| Sprint | Focus | Agent(s) |
|:-------|:------|:---------|
| SPR-001 | Foundation scaffold + health endpoints | Both |
| SPR-002 | Authentication & RBAC | Frontend |
| SPR-003 | Matter Management | Frontend |
| SPR-004 | Trust Accounting Backend | Backend |
| SPR-005 | Trust Accounting Frontend | Frontend |
| SPR-006 | Document Management | Both |
| SPR-007 | Time & Billing | Both |
| SPR-008 | Polish & Hardening | Both |
| SPR-NNN-ARCH | Architect parallel tasks (infra, audit, deploy) | Architect |

---

## 8. Workflows and Commands

| Command | What It Does |
|:--------|:-------------|
| `/darkgravity_setup` | One-time DarkGravity bootstrap |
| `/darkgravity_research` | Research swarm on a topic |
| `/darkgravity_architect` | Generate task backlog / architecture |
| `/darkgravity_coder` | Generate and test code |
| `/darkgravity_swarm` | Full 4-stage pipeline |
| `/test` | Run GOV-002 test tiers (auto-detect stack) |
| `/git_commit` | Verify hygiene, analyze diffs, commit |
| `/manage_documents` | Scan, lint, and sync CODEX docs |
| `/deploy` | Production deployment with health checks and rollback |
| `/audit_sprint` | Architect sprint audit checklist |

---

## 9. Commit Conventions

Use conventional commits with CODEX references:

```
feat(SPR-NNN): description of feature
fix(DEF-NNN): description of fix
docs(GOV-NNN): description of doc change
```

---

## 10. New Session Reading Order

When starting a fresh session:

1. `AGENTS.md` — this file (project context)
2. `CODEX/00_INDEX/MANIFEST.yaml` — build your document map
3. `CODEX/10_GOVERNANCE/` — governance docs relevant to your role
4. `CODEX/80_AGENTS/AGT-NNN` — your role definition (use project-specific boot doc if one exists)
5. `CODEX/05_PROJECT/` — check active sprints, backlog, roadmap
6. Referenced `BLU-` and `CON-` docs — your execution constraints
