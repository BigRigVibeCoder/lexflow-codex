---
id: SPR-003
title: "Matter Management Sprint"
type: sprint
status: PLANNING
owner: architect
agents: [frontend]
tags: [sprint, phase-2, matter-management, clients, contacts]
related: [BCK-001, SPR-002, CON-001, BLU-ARCH-001]
created: 2026-03-24
updated: 2026-03-24
version: 1.0.0
---

> **BLUF:** Full client/matter/contact management. Clients with PI-specific fields, matters with SOL tracking, contacts linked to matters, dashboard widgets, creation wizard. End state: users can manage the complete lifecycle of a personal injury case — intake through active management. **Backend Agent works on SPR-004 (trust accounting) in parallel.**

# SPR-003: Matter Management

**Phase:** 2 — Matter Management
**Target:** 12-24 hours (AI-agent pace)
**Agent:** Frontend only
**Dependencies:** SPR-002 complete (auth, RBAC, dashboard shell)
**Contracts:** CON-001 (trust tab shows placeholder — no API call yet)

---

## ⚠️ Mandatory Compliance — Every Task

| Governance Doc | Sprint Requirement |
|:---------------|:-------------------|
| **GOV-001** | TSDoc on all models, routers, components. |
| **GOV-002** | Unit tests for tRPC routers. Integration tests for DB queries. Snapshot tests for UI components. |
| **GOV-003** | TypeScript strict. Drizzle relations typed. No raw SQL. |
| **GOV-004** | Validation errors surfaced to UI. Matter archival is soft-delete (never hard delete). |
| **GOV-005** | Branch: `feature/SPR-003-matter-management`. One commit per task: `feat(SPR-003): T-XXX description`. |
| **GOV-006** | Log matter creation, status changes, team assignments. |
| **GOV-007** | Task status updated. |
| **GOV-008** | All data in `lexflow_main` DB. |

---

## Frontend Agent Tasks (lexflow-frontend)

### T-018: Client DB Schema + Drizzle
- **Commit:** `feat(SPR-003): T-018 client schema + migration`
- **Dependencies:** T-007
- **Deliverable:**
  - `clients` table: id, firstName, lastName, email, phone, dateOfBirth, address, ssnLast4 (encrypted), insuranceCarrier, insurancePolicyNumber, referralSource, notes, isActive, createdAt, updatedAt
  - PI-specific fields built in from day one
  - Migration files
- **Acceptance:** Migration runs. `INSERT INTO clients` succeeds. Encrypted fields stored correctly.
- **Status:** [ ] Not Started

### T-019: Client tRPC Router
- **Commit:** `feat(SPR-003): T-019 client tRPC router`
- **Dependencies:** T-018, T-010
- **Deliverable:** CRUD + paginated search with filters (name, referralSource, isActive). Permission-gated.
- **Acceptance:** Create, read, update, deactivate clients. Pagination works. Permission checks enforced.
- **Status:** [ ] Not Started

### T-020: Client UI Pages
- **Commit:** `feat(SPR-003): T-020 client UI pages`
- **Dependencies:** T-019, T-013
- **Deliverable:** Client list (DataTable), create form, detail page, edit form.
- **Acceptance:** Full client CRUD from UI. Responsive. SSN field masked.
- **Status:** [ ] Not Started

### T-021: Matter DB Schema + Drizzle
- **Commit:** `feat(SPR-003): T-021 matter schema + migration`
- **Dependencies:** T-018
- **Deliverable:**
  - `matters` table: id, matterNumber (auto-generated: YYYY-NNNN), clientId (FK), title, type ('personal_injury'), status (enum), feeType, feePercentage, accidentDate, statuteOfLimitations, totalMedicalBills, totalSettlement, description, archivedAt, createdAt, updatedAt
  - `matter_team` junction table
  - `matter_deadlines` table (SOL tracking, hearing dates)
  - `medical_treatments` table (provider, date, amount, description)
  - Auto-increment matter number generator
- **Acceptance:** Migrations run. Matter creation auto-generates number. FK constraints enforced.
- **Status:** [ ] Not Started

### T-022: Contact DB Schema + Drizzle
- **Commit:** `feat(SPR-003): T-022 contact schema`
- **Dependencies:** T-007
- **Deliverable:** `contacts` (id, name, type [adjuster/doctor/expert/court/opposing_counsel], company, email, phone, address, notes). `matter_contacts` junction table.
- **Acceptance:** Contacts can be linked to multiple matters. Type enum enforced.
- **Status:** [ ] Not Started

### T-023: Matter tRPC Router
- **Commit:** `feat(SPR-003): T-023 matter tRPC router`
- **Dependencies:** T-021, T-022, T-010
- **Deliverable:** Full CRUD + team assignment + status transitions + archival (soft delete). Paginated list with filters.
- **Acceptance:** Create matter → auto number. Assign team members. Archive. Filter by status.
- **Status:** [ ] Not Started

### T-024: Deadline tRPC Procedures
- **Commit:** `feat(SPR-003): T-024 deadline procedures`
- **Dependencies:** T-021, T-010
- **Deliverable:** `addDeadline`, `completeDeadline`, `listUpcomingDeadlines` (next 30 days), `listOverdueDeadlines`.
- **Acceptance:** SOL deadline shows as critical. Completed deadlines filtered out of upcoming list.
- **Status:** [ ] Not Started

### T-025: Medical Treatment tRPC Procedures
- **Commit:** `feat(SPR-003): T-025 medical treatment procedures`
- **Dependencies:** T-021, T-010
- **Deliverable:** CRUD for treatments. Auto-updates `matter.totalMedicalBills` on insert/update/delete.
- **Acceptance:** Adding treatment with amount $5,000 → matter.totalMedicalBills increases by $5,000.
- **Status:** [ ] Not Started

### T-026: Contact tRPC Router
- **Commit:** `feat(SPR-003): T-026 contact tRPC router`
- **Dependencies:** T-022, T-010
- **Deliverable:** CRUD + `linkToMatter`, `unlinkFromMatter`. Paginated.
- **Acceptance:** Contact linked to matter appears in matter's contact list.
- **Status:** [ ] Not Started

### T-027: Matter List UI
- **Commit:** `feat(SPR-003): T-027 matter list UI`
- **Dependencies:** T-023, T-013
- **Deliverable:** DataTable with columns: matterNumber, client, title, status, feeType, SOL date. Filters, search, pagination. Status badges with colors.
- **Acceptance:** Table renders. Filters narrow results. Clicking row → matter detail.
- **Status:** [ ] Not Started

### T-028: Matter Creation Wizard UI
- **Commit:** `feat(SPR-003): T-028 matter creation wizard`
- **Dependencies:** T-023, T-020
- **Deliverable:** Multi-step wizard: Step 1 (select/create client) → Step 2 (case details: type, accident date, description) → Step 3 (fee arrangement) → Step 4 (insurance info) → Step 5 (review + submit).
- **Acceptance:** Wizard completes. Matter created with all fields. Back/next navigation works.
- **Status:** [ ] Not Started

### T-029: Matter Detail Layout + Tabs
- **Commit:** `feat(SPR-003): T-029 matter detail layout + tabs`
- **Dependencies:** T-023
- **Deliverable:** Tab navigation: Overview, Team, Deadlines, Medical, Documents, Time, Billing, Trust, Contacts. **Trust tab shows "Coming in SPR-005" placeholder.**
- **Acceptance:** All tabs render. Tab state persists in URL.
- **Status:** [ ] Not Started

### T-030: Matter Team UI
- **Commit:** `feat(SPR-003): T-030 matter team UI`
- **Dependencies:** T-023
- **Deliverable:** Team management within matter detail. Add/remove team members. Role display.
- **Acceptance:** Add user to matter team → appears in list. Remove works.
- **Status:** [ ] Not Started

### T-031: Matter Deadlines UI
- **Commit:** `feat(SPR-003): T-031 deadlines UI`
- **Dependencies:** T-024
- **Deliverable:** Deadline list with SOL highlighting (red if <30 days). Add deadline form. Complete button. Calendar-style view optional.
- **Acceptance:** SOL deadline highlighted in red. Completed deadlines grayed out.
- **Status:** [ ] Not Started

### T-032: Medical Treatment UI
- **Commit:** `feat(SPR-003): T-032 medical treatment UI`
- **Dependencies:** T-025
- **Deliverable:** Treatment log table. Add treatment form. Running total displayed prominently.
- **Acceptance:** Add treatment → total updates. Edit/delete reflected in total.
- **Status:** [ ] Not Started

### T-033: Dashboard Widgets
- **Commit:** `feat(SPR-003): T-033 dashboard widgets`
- **Dependencies:** T-023, T-024
- **Deliverable:** KPI cards: Active Matters count, Upcoming Deadlines (next 7 days), Recent Activity feed, Matter Status chart (pie/bar).
- **Acceptance:** Dashboard loads with real data. Widgets update with new matters.
- **Status:** [ ] Not Started

---

## Sprint Checklist

| Task | Agent | Status |
|:-----|:------|:-------|
| T-018 | Frontend | [ ] |
| T-019 | Frontend | [ ] |
| T-020 | Frontend | [ ] |
| T-021 | Frontend | [ ] |
| T-022 | Frontend | [ ] |
| T-023 | Frontend | [ ] |
| T-024 | Frontend | [ ] |
| T-025 | Frontend | [ ] |
| T-026 | Frontend | [ ] |
| T-027 | Frontend | [ ] |
| T-028 | Frontend | [ ] |
| T-029 | Frontend | [ ] |
| T-030 | Frontend | [ ] |
| T-031 | Frontend | [ ] |
| T-032 | Frontend | [ ] |
| T-033 | Frontend | [ ] |

---

## Sprint Completion Criteria

- [ ] All 16 tasks pass acceptance criteria
- [ ] Client intake → matter creation → team assignment flow works end-to-end
- [ ] SOL deadline tracking displays correctly
- [ ] Medical treatment totals auto-calculate
- [ ] Dashboard shows real data from matters/deadlines
- [ ] All GOV compliance checks pass
- [ ] All tests pass: `npm run lint && npm run typecheck && npm run test`
