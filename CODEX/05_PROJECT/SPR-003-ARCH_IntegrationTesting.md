---
id: SPR-003-ARCH
title: "Architect Sprint — Integration Testing & Governance Hardening"
type: sprint
status: ACTIVE
owner: architect
agents: [architect]
tags: [sprint, architect, integration, governance, contract-compliance]
related: [BCK-002, SPR-005, CON-001, CON-002, GOV-005]
created: 2026-03-24
updated: 2026-03-24
version: 1.0.0
---

> **BLUF:** Architect sprint running parallel with SPR-005 (Trust Accounting Frontend). This sprint covers: governance hardening delivered earlier today, integration test prep for the first cross-service deployment, CODEX maintenance, and sprint doc prep for SPR-006/007.

# SPR-003-ARCH: Integration Testing & Governance Hardening

**Phase:** 3 (parallel with SPR-005)
**Agent:** Architect only
**Dependencies:** SPR-002 + SPR-003 + SPR-004 merged to main

---

## Completed Tasks (This Session)

| ID | Task | BCK-002 Ref | Status |
|:---|:-----|:------------|:-------|
| ARCH-010 | GOV-005 branching rewrite (one branch per sprint) | — | [x] |
| ARCH-011 | Agent boot docs updated to v1.1 (HARD RULES) | — | [x] |
| ARCH-012 | `/git_commit` workflow — blocking test coverage gate | — | [x] |
| ARCH-013 | `/git_commit` workflow — blocking secrets scan gate | — | [x] |
| ARCH-014 | `/governance_scan` workflow — all 8 GOV docs | — | [x] |
| ARCH-015 | Lessons learned pushed to agentic_architect template | — | [x] |
| ARCH-016 | SPR-004 audit → VER-002 FULL PASS, merged to main | A-013 | [x] |
| ARCH-017 | SPR-002 audit → VER-003 FULL PASS, merged to main | A-009 | [x] |
| ARCH-018 | SPR-003 audit → VER-004 FULL PASS, merged to main | A-012 | [x] |
| ARCH-019 | Backend seed script audited + merged | — | [x] |
| ARCH-020 | Cleaned 28 stale branches (frontend + backend) | — | [x] |
| ARCH-021 | MANIFEST.yaml synced with all changes | — | [x] |
| ARCH-022 | SPR-003 sprint doc → GOV-005 v1.1 update | — | [x] |
| ARCH-023 | SPR-005 sprint doc → GOV-005 v1.1 + activated | — | [x] |

---

## Remaining Tasks (While Agents Sprint on SPR-005)

| ID | Task | BCK-002 Ref | Status |
|:---|:-----|:------------|:-------|
| ARCH-024 | Create contract compliance test runbook (RUN-001) | A-016 | [/] |
| ARCH-025 | Update SPR-006 sprint doc — GOV-005 v1.1 branching | — | [ ] |
| ARCH-026 | Update SPR-007 sprint doc — GOV-005 v1.1 branching | — | [ ] |
| ARCH-027 | MANIFEST sync (SPR-005 ACTIVE, VER-004 added) | — | [ ] |
| ARCH-028 | Update BCK-002 — mark completed tasks | — | [ ] |

---

## After SPR-005 Completes

| ID | Task | BCK-002 Ref | Status |
|:---|:-----|:------------|:-------|
| ARCH-029 | SPR-005 audit — quality gates + governance scan | A-016 | [ ] |
| ARCH-030 | **Contract compliance test** — run RUN-001 procedure | A-016, A-017 | [ ] |
| ARCH-031 | Deploy integrated system to prod (v0.4) | A-018 | [ ] |

---

## Sprint Completion Criteria

- [x] All governance workflows deployed (git_commit, governance_scan)
- [x] All prior sprint audits completed (VER-002, VER-003, VER-004)
- [x] CODEX docs updated for GOV-005 v1.1
- [ ] Contract compliance runbook created (RUN-001)
- [ ] SPR-006/007 sprint docs updated
- [ ] SPR-005 audit FULL PASS
- [ ] First cross-service integration test passes
- [ ] Deploy v0.4 to production
