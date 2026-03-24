---
id: GOV-007
title: "Agentic Project Management Standard"
type: reference
status: APPROVED
owner: architect
agents: [all]
tags: [governance, standards, project-management, workflow, agentic-development]
related: [GOV-001, GOV-005, GOV-008, BLU-020]
created: 2026-03-18
updated: 2026-03-24
version: 2.0.0
---

> **BLUF:** CODEX is the project management operating system. Markdown files are the database. The Architect Agent is the project manager. Forget Jira. Agents read, write, and execute against this file structure at machine speed — no human-paced ticket tools required.

# Agentic Project Management Standard

> **"Don't manage projects. Govern them. Machines execute. Humans decide. Documents remember."**

---

## 1. Philosophy: The Markdown Operating System

Traditional project management tools (Jira, Trello, Linear) are designed for humans — slow, UI-driven, context-heavy. In an agentic development environment where agents produce code in minutes, those tools become the bottleneck.

**CODEX is the replacement.** It is a suite of Markdown files arranged as a machine-readable operating system:

| Traditional PM | Agentic PM (CODEX) |
|:--------------|:-------------------|
| Jira ticket | `SPR-NNN / DEF-NNN` Markdown doc |
| Project manager | Architect Agent + Human |
| Sprint board | `05_PROJECT/SPR-NNN_ActiveSprint.md` |
| API specification | `20_BLUEPRINTS/CON-NNN_ContractName.md` |
| Team member profile | `80_AGENTS/AGT-NNN_RoleDefinition.md` |
| Status meeting | Architect reads CODEX, files discrepancy report |
| PR review | Architect audits code against contracts |

---

## 2. The Three-Tier Hierarchy

```
┌─────────────────────────────────────────────────┐
│         TIER 1: HUMAN (Architect/Owner)          │
│  Vision, final approval, contract ratification   │
└───────────────────┬─────────────────────────────┘
                    │ owns + approves
┌───────────────────▼─────────────────────────────┐
│         TIER 2: ARCHITECT AGENT                  │
│  Manages CODEX, files reports, assigns sprints   │
│  Audits developer output against contracts       │
└───────────────────┬─────────────────────────────┘
                    │ assigns + reviews
┌───────────────────▼─────────────────────────────┐
│     TIER 3: DEVELOPER / TESTER AGENTS            │
│  Execute sprint tasks, report defects,           │
│  propose contract changes upstream               │
└─────────────────────────────────────────────────┘
```

### 2.1 The Human Role

- Final authority on all architectural decisions
- Approves contract changes proposed by Architect Agent
- Defines project vision in `PRJ-001_Roadmap.md`
- Reviews discrepancy reports and determines: **developer error** or **contract ambiguity**

### 2.2 The Architect Agent Role

See `80_AGENTS/AGT-001_Architect_Agent.md` for full definition.

- Owns and maintains all CODEX documents
- Breaks down `EVO-` feature specs into `SPR-` sprint tasks
- Continuously audits developer output against `CON-` contracts
- Files `DEF-` defect reports for code violations
- Proposes contract updates → Human approves → propagates downstream
- **Does not write code.** Generates work assignments and discrepancy reports only.

### 2.3 The Developer Agent Role

See `80_AGENTS/AGT-002_Developer_Agent.md` for full definition.

- Receives work via sprint docs (`SPR-`)
- Executes against blueprints (`BLU-`) and contracts (`CON-`)
- Proposes contract changes via `EVO-` or annotated `DEF-` docs
- All proposed changes go upstream to Architect for review

### 2.4 The Tester Agent Role

See `80_AGENTS/AGT-003_Tester_Agent.md` for full definition.

- Validates developer output against verification specs (`40_VERIFICATION/`)
- Files `DEF-` defect reports for test failures
- Reports to Architect Agent, not directly to Developer

---

## 3. Document Taxonomy

The complete vocabulary of agentic project management:

| Code | Area | Agile Equivalent | Description | Owner |
|:-----|:-----|:-----------------|:------------|:------|
| `PRJ-` | `05_PROJECT/` | Initiative / Epic | High-level project roadmap and vision | Human |
| `SPR-` | `05_PROJECT/` | Sprint | Discrete sprint with tasks, assignees, status | Architect |
| `BCK-` | `05_PROJECT/` | Backlog | Prioritized feature backlog | Architect + Human |
| `BLU-` | `20_BLUEPRINTS/` | Story / Spec | Design specification for a feature or component | Architect |
| `CON-` | `20_BLUEPRINTS/` | API Definition | Interface contract — the binding rules of the road | Architect + Human |
| `EVO-` | `60_EVOLUTION/` | Feature Request | Proposed enhancements, originating from Human or Developer | Any |
| `DEF-` | `50_DEFECTS/` | Bug | Code defect or contract violation, filed by Architect or Tester | Architect/Tester |
| `VER-` | `40_VERIFICATION/` | Test Plan | Verification spec or test report | Tester |
| `RES-` | `70_RESEARCH/` | Research Spike | Investigation, POC, or literature review | Any |
| `AGT-` | `80_AGENTS/` | Team Member Profile | Agent role definition used to spin up a new agent | Human |
| `RUN-` | `30_RUNBOOKS/` | Runbook | Operational how-to, setup guide | Architect |
| `GOV-` | `10_GOVERNANCE/` | Engineering Standard | Universal coding, testing, logging standards | Human |

### 3.1 Contract Documents (`CON-`)

Contracts are the highest-authority documents in the system. They live in `20_BLUEPRINTS/` alongside design specs because they ARE the most binding form of blueprint.

**A contract defines:**
- Input/output schema for a service or module
- Error codes and failure behavior
- Versioning and backward-compatibility rules
- Which agent roles may call which interfaces

**Contracts are immutable without Human approval.** A developer finding a contract error opens an `EVO-` or `DEF-` doc and proposes the fix upstream. The Architect reviews, the Human approves, the updated contract propagates down.

---

## 4. Sprint Lifecycle

Sprints are **discrete, versioned documents** (not a single living file). Each sprint is `SPR-NNN.md`. When closed, it moves to `90_ARCHIVE/`.

```
EVO- (feature request)
  → Architect breaks into tasks
  → SPR-NNN.md created (ACTIVE)
  → Tasks assigned to Developer Agent(s)
  → Developer executes, commits code
  → Architect audits output against CON-/BLU-
  → If passes: SPR-NNN.md status → CLOSED, moved to 90_ARCHIVE
  → If fails: DEF-NNN.md filed, Sprint re-opened or new DEF sprint created
```

### 4.1 Sprint Document States

| Status | Meaning |
|:-------|:--------|
| `PLANNING` | Being defined by Architect, not yet assigned |
| `ACTIVE` | Developer agent(s) executing |
| `REVIEW` | Architect auditing output |
| `CLOSED` | Passed audit. Archived. |
| `BLOCKED` | Waiting on contract resolution or Human decision |

---

## 5. The Discrepancy Resolution Protocol

When the Architect audits code and finds a mismatch between the output and the contract:

```
Step 1: Architect determines — is this a DEVELOPER ERROR or CONTRACT AMBIGUITY?
        → Cannot determine alone → escalate to Human
        
Step 2a: Developer Error
         → File DEF-NNN.md against the developer's sprint
         → Developer agent re-executes the affected task
         
Step 2b: Contract Ambiguity
         → Architect flags the contract doc for Human review
         → Human + Architect clarify and update CON-NNN.md
         → Updated contract propagates to all affected sprints
         
Step 3: Re-audit. Loop until code matches contract.
```

**The Architect never guesses.** Ambiguity always escalates to Human.

---

## 6. Reading Order for Agents

When a new agent session starts, read CODEX in this order:

1. `00_INDEX/MANIFEST.yaml` — build your document map
2. `10_GOVERNANCE/GOV-007` (this doc) — understand the PM system
3. `10_GOVERNANCE/GOV-005` — understand the development lifecycle
4. `80_AGENTS/AGT-00N` — read your specific role definition
5. `05_PROJECT/PRJ-001_Roadmap.md` — understand the project vision
6. Your assigned `SPR-NNN.md` — understand your current tasks
7. Referenced `BLU-` and `CON-` docs — your execution constraints

**Architect Agent additionally reads:**
- All active `SPR-NNN.md` docs to track team state
- All `CON-NNN.md` docs to perform continuous auditing

---

## 7. PM Repo as Git Submodule (Multi-Repo Projects)

For projects spanning multiple code repositories, the agentic_architect template (this repo) functions as the **PM submodule**:

```
project-root/
├── frontend/           # Frontend code repo
├── backend/            # Backend code repo
├── mobile/             # Mobile code repo
└── project-management/ # This repo (agentic_architect template)
    └── CODEX/          # The markdown operating system
```

Each code repo's agent reads CODEX from the submodule. The Architect Agent operates against the submodule. Contract changes in CODEX propagate automatically via submodule updates.

**Single source of truth always lives in CODEX.**

---

## 8. Agent Instructions

When bootstrapping a new project using this template:

1. **Human writes** `05_PROJECT/PRJ-001_Roadmap.md` (vision and goals)
2. **Architect Agent reads** the roadmap and creates `05_PROJECT/BCK-001_Backlog.md`
3. **Architect Agent creates** `20_BLUEPRINTS/CON-001...` contracts for all interfaces
4. **Architect Agent spins up** Developer Agents using `80_AGENTS/AGT-002_Developer_Agent.md` as the jump-off template
5. **Architect creates** `SPR-001.md` and assigns tasks to Developer Agents
6. **Developer Agents execute**, committing code against the contracts
7. **Architect audits** and loops the discrepancy protocol (§5) as needed

## 9. Lessons Learned — Agentic PM Improvements

> These improvements were discovered during the LexFlow project build (March 2026) and are now codified into the standard.

### 9.1 Agent-Specific Boot Documents

Generic agent role definitions (`AGT-002`) are insufficient for real projects. Each agent needs a **project-specific boot doc** (e.g., `AGT-002-FE`, `AGT-003-BE`) containing:

- VM name, repo URL, service port, database name
- Full tech stack table
- Ordered CODEX reading sequence (which docs, in what order)
- Which contracts are binding (with section references)
- Database ownership (which tables this agent creates/owns)
- Governance compliance checklist
- Communication protocol (how to report back, what NOT to do)

**Rule:** The Architect creates agent-specific boot docs as part of sprint planning, not as an afterthought. These docs ARE the agent's onboarding — equivalent to briefing a new hire.

### 9.2 Infrastructure Governance Conversations

Architecture documents (BLU-) assume an idealized environment. Before sprint planning, the Architect MUST have an **infrastructure governance conversation** with the Human to resolve operational reality:

- Cloud Run vs. VM deployment
- Managed DB vs. self-managed
- Multi-repo vs. monorepo
- Shared types strategy
- File storage model

The output of this conversation becomes a governance doc (`GOV-008`) that overrides BLU- assumptions. This conversation is critical because it changes the task backlog, the contracts, and the deployment model.

**Rule:** Architecture + Infrastructure conversation → GOV-008 → THEN task backlog. Never create the backlog before resolving infrastructure.

### 9.3 Governance Compliance From Task One

Testing, error handling, and logging are NOT late-phase polish items. Every sprint document includes a **mandatory compliance table** mapping GOV docs to specific deliverables for that sprint:

```
| GOV-002 | Vitest configured, tests run on commit |
| GOV-003 | TypeScript strict, no `any`, complexity ≤10 |
| GOV-004 | Error middleware in place |
| GOV-006 | pino structured logging from task 1 |
```

**Rule:** A task that works but violates governance gets a `DEF-` defect report. Compliance is an acceptance criterion, not a checkbox.

### 9.4 Multi-Contract Architecture

A single `CON-001` is rarely sufficient. Each **interface boundary** should have its own contract:

| Contract | What It Defines |
|:---------|:----------------|
| CON-001 | HOW services communicate (transport, auth, error shapes) |
| CON-002 | WHAT the API looks like (routes, schemas, validation) |

The Architect tests contract compliance at sprint boundaries by pulling both repos and verifying that:
1. Frontend calls match CON-002 routes exactly
2. Backend routes match CON-002 schemas exactly
3. Shared types (errors, pagination) match CON-001

### 9.5 Architect as Integration Tester

Developer agents test their own code (unit, integration). The Architect tests the **system** — specifically, contract compliance across services. This is a distinct testing responsibility:

| Level | Who Tests | What They Test |
|:------|:----------|:---------------|
| Unit/Integration | Developer Agent | Own code against own tests |
| Contract Compliance | **Architect** | Frontend calls match Backend routes |
| E2E | **Architect** | Full user workflows across both services |
| Performance | **Architect** | System under load |

The Architect never reads agent code. The Architect reads **contracts** and **test results**.

### 9.6 Full Sprint Visibility

All sprints should be created up front (not just-in-time) so that:
- Agents can see the full project scope
- Dependencies between sprints are visible
- The Human can audit the complete plan
- Sprints can be adjusted as issues emerge

**Rule:** Create all sprint docs during planning. Sprint docs are living documents — adjust them as you learn.

### 9.7 Adaptation Tables

When an architecture document assumes managed cloud services but the actual deployment is different, create an **adaptation table** in the infrastructure governance doc:

```
| BLU-ARCH-001 Assumption | Actual (GOV-008)    |
| Cloud Run               | PM2 on GCP VM       |
| Cloud SQL               | Self-managed Postgres|
| GCS signed URLs         | Local disk           |
```

This prevents agents from building to the wrong infrastructure model.

### 9.8 MANIFEST.yaml as Agent Onboarding Gate

MANIFEST.yaml is the first file every agent reads. If it's stale or lists template defaults, agents won't find project documents. The Architect MUST:

1. Update MANIFEST.yaml every time a document is created
2. Verify `project:` field matches the actual project name
3. Ensure all category codes are listed (including `CON` in blueprints)
4. Write accurate summaries — agents filter by summary content

**Rule:** A stale MANIFEST is a broken project. Treat it as a deployment blocker.

---

> **"CODEX doesn't slow you down. Jira does."**

