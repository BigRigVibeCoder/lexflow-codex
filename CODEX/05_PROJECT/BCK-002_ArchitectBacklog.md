---
id: BCK-002
title: "Architect Agent Backlog"
type: planning
status: ACTIVE
owner: architect
agents: [architect]
tags: [project-management, backlog, architect, audit, deployment]
related: [BCK-001, GOV-007, GOV-008]
created: 2026-03-24
updated: 2026-03-24
version: 1.0.0
---

> **BLUF:** The Architect Agent has its own work stream separate from developer sprints. This backlog tracks: infrastructure prep, sprint audits, contract compliance testing, deployment execution, CODEX maintenance, and production operations. The Architect works **in parallel** with developer agents — never idle.

# Architect Agent Backlog

---

## Work Categories

| Category | Code | Description |
|:---------|:-----|:------------|
| **Infrastructure** | ARCH-INFRA | VM setup, deploy scripts, prod environment |
| **Audit** | ARCH-AUDIT | Sprint audit against contracts + GOV docs |
| **Integration** | ARCH-INTEG | Cross-service contract compliance testing |
| **Deploy** | ARCH-DEPLOY | Production deployment execution |
| **CODEX** | ARCH-CODEX | Document maintenance, MANIFEST, sprint creation |
| **Monitor** | ARCH-MON | Agent progress monitoring, blocker resolution |

---

## Phase 0: During SPR-001 (NOW)

| ID | Task | Category | Dependencies | Deliverable | Status |
|:---|:-----|:---------|:-------------|:------------|:-------|
| A-001 | Verify `lexflow-prod` VM accessible | ARCH-INFRA | None | SSH access confirmed, note IP/hostname | [ ] |
| A-002 | Pre-stage prod environment | ARCH-INFRA | A-001 | Ensure VM has: Ubuntu 22.04+, git, Node.js 20, basic firewall | [ ] |
| A-003 | Create architect audit checklist template | ARCH-AUDIT | None | `40_VERIFICATION/VER-001_SprintAuditChecklist.md` — reusable checklist for all sprint audits | [ ] |
| A-004 | Create contract compliance test script | ARCH-INTEG | None | `scripts/contract-test.sh` — verifies both services health endpoints respond | [ ] |
| A-005 | Monitor frontend agent progress | ARCH-MON | Agents running | Check frontend repo for commits. Note any blockers. | [ ] |
| A-006 | Monitor backend agent progress | ARCH-MON | Agents running | Check backend repo for commits. Note any blockers. | [ ] |
| A-007 | SPR-001 Architect Audit | ARCH-AUDIT | SPR-001 complete | Pull both repos. Run audit checklist. File DEF- if needed. | [ ] |
| A-008 | SPR-001 Deploy to prod | ARCH-DEPLOY | A-007 passes | Run deploy, verify health endpoints on prod | [ ] |

---

## Phase 1: During SPR-002 (Auth) + SPR-004 starts

| ID | Task | Category | Dependencies | Deliverable | Status |
|:---|:-----|:---------|:-------------|:------------|:-------|
| A-009 | SPR-002 Architect Audit | ARCH-AUDIT | SPR-002 complete | Audit auth system against GOV-003/004. Test RBAC. | [ ] |
| A-010 | Deploy auth to prod (v0.2) | ARCH-DEPLOY | A-009 passes | Run migrations, restart web service | [ ] |
| A-011 | Create SPR-002 → SPR-004 handoff note | ARCH-CODEX | SPR-002 complete | Update backend agent: "Frontend auth is live, you can test validate-matter-client callback" | [ ] |

---

## Phase 2: During SPR-003 (Matter Mgmt) + SPR-004 (Trust BE)

| ID | Task | Category | Dependencies | Deliverable | Status |
|:---|:-----|:---------|:-------------|:------------|:-------|
| A-012 | SPR-003 Architect Audit | ARCH-AUDIT | SPR-003 complete | Audit matter management. Test matter creation wizard. | [ ] |
| A-013 | SPR-004 Architect Audit | ARCH-AUDIT | SPR-004 complete | **Critical:** audit all 17 CON-002 routes. TypeBox schemas match contract. | [ ] |
| A-014 | Deploy matter mgmt to prod (v0.3) | ARCH-DEPLOY | A-012 passes | Run migrations, restart web service | [ ] |
| A-015 | Deploy trust service to prod | ARCH-DEPLOY | A-013 passes | Run trust migrations, start trust service on port 4000 | [ ] |

---

## Phase 3: After SPR-005 (Trust FE) — First Integration

| ID | Task | Category | Dependencies | Deliverable | Status |
|:---|:-----|:---------|:-------------|:------------|:-------|
| A-016 | **Cross-service contract compliance test** | ARCH-INTEG | SPR-004 + SPR-005 | Run both services. Verify FE trust-client calls match BE routes per CON-002. | [ ] |
| A-017 | First E2E integration test | ARCH-INTEG | A-016 passes | Login → create matter → create trust account → deposit → verify balance | [ ] |
| A-018 | Deploy integrated system (v0.4) | ARCH-DEPLOY | A-017 passes | Both services running on prod, communicating | [ ] |

---

## Phase 4-5: SPR-006 (Documents) + SPR-007 (Billing)

| ID | Task | Category | Dependencies | Deliverable | Status |
|:---|:-----|:---------|:-------------|:------------|:-------|
| A-019 | Ensure `/var/lexflow/documents/` exists on prod | ARCH-INFRA | A-018 | Directory with correct permissions | [ ] |
| A-020 | SPR-006 Audit | ARCH-AUDIT | SPR-006 complete | Audit document management. Test upload/download. | [ ] |
| A-021 | SPR-007 Audit | ARCH-AUDIT | SPR-007 complete | Audit billing. Verify trust transfer integration. | [ ] |
| A-022 | Deploy docs + billing (v0.5) | ARCH-DEPLOY | A-020, A-021 | Full feature deployment | [ ] |

---

## Phase 6: SPR-008 (Hardening) — Final

| ID | Task | Category | Dependencies | Deliverable | Status |
|:---|:-----|:---------|:-------------|:------------|:-------|
| A-023 | SPR-008 Audit | ARCH-AUDIT | SPR-008 complete | Final audit: all GOV docs, E2E suite, performance | [ ] |
| A-024 | Production go-live (v1.0) | ARCH-DEPLOY | A-023 passes | TLS active, monitoring live, backups running | [ ] |
| A-025 | Archive all sprint docs | ARCH-CODEX | A-024 | Move SPR-001→008 to 90_ARCHIVE. Update MANIFEST. | [ ] |
| A-026 | Final CODEX reconciliation | ARCH-CODEX | A-025 | Verify all docs current, MANIFEST accurate, TAG_TAXONOMY updated | [ ] |

---

## Summary

| Phase | Architect Tasks | Parallel With |
|:------|:---------------:|:-------------|
| Phase 0 | 8 | SPR-001 (both agents scaffolding) |
| Phase 1 | 3 | SPR-002 (FE auth) + SPR-004 start (BE trust) |
| Phase 2 | 4 | SPR-003 (FE matter) + SPR-004 (BE trust) |
| Phase 3 | 3 | SPR-005 (FE trust UI) — **integration milestone** |
| Phase 4-5 | 4 | SPR-006 (docs) + SPR-007 (billing) |
| Phase 6 | 4 | SPR-008 (hardening) |
| **Total** | **26** | |
