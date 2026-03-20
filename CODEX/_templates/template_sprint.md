---
id: SPR-NNN
title: "[Sprint Title]"
type: how-to
status: PLANNING
owner: architect
agents: [coder, tester]
tags: [project-management, sprint, workflow]
related: [BCK-001, BLU-NNN]
created: YYYY-MM-DD
updated: YYYY-MM-DD
version: 1.0.0
---

> **BLUF:** Sprint [NNN] targets [goal in one sentence]. [N] tasks assigned to [Developer/Tester Agent]. Estimated completion: [timeframe or "scope-bounded"].

# Sprint [NNN]: [Title]

**Status:** `PLANNING` | `ACTIVE` | `REVIEW` | `BLOCKED` | `CLOSED`
**Assigned to:** [Agent name or "unassigned"]
**Opened:** YYYY-MM-DD
**Closed:** —
**Refs:** [EVO-NNN or PRJ-NNN that spawned this sprint]

---

## Objective

[One paragraph. What does "done" look like for this sprint? What user value or system capability does it deliver?]

---

## Context

[Brief background. What triggered this sprint? What contracts or blueprints does it implement? Link them.]

- **Blueprint:** [BLU-NNN — title]
- **Contracts:** [CON-NNN — title]
- **Parent feature:** [EVO-NNN — title]

---

## Task List

> Update status as work progresses. The Architect audits output after all tasks reach `DONE`.

| # | Task | Assigned Agent | Status | Notes |
|:--|:-----|:--------------|:-------|:------|
| 1 | [Task description] | Developer | `TODO` | [ref: CON-NNN §X] |
| 2 | [Task description] | Developer | `TODO` | |
| 3 | Write unit tests for task 1 | Developer | `TODO` | per GOV-002 |
| 4 | Verification pass | Tester | `TODO` | ref: VER-NNN |

**Status legend:** `TODO` → `IN_PROGRESS` → `DONE` → `BLOCKED`

---

## Acceptance Criteria

The sprint is CLOSED only when ALL of the following are true:

- [ ] All tasks above reach `DONE`
- [ ] Test coverage meets `GOV-002` thresholds (≥80% line coverage)
- [ ] All output validates against referenced `CON-` contracts
- [ ] No open `DEF-` reports filed against this sprint
- [ ] Architect audit complete and signed off
- [ ] `VER-NNN.md` filed by Tester Agent with PASS verdict

---

## Blockers

| # | Blocker | Filed by | Status |
|:--|:--------|:---------|:-------|
| — | None | — | — |

---

## Defects Filed Against This Sprint

| DEF ID | Summary | Status |
|:-------|:--------|:-------|
| — | None | — |

---

## Audit Notes (Architect)

[Architect fills this in during §4.2 of GOV-007 audit workflow.]

---

## Close Notes

**Closed:** YYYY-MM-DD
**Verdict:** PASS / FAIL
**Moved to:** `90_ARCHIVE/`
