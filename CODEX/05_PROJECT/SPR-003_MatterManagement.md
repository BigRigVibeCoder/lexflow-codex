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
| **GOV-005** | Branch: `feature/SPR-003-TXXX-description`. |
| **GOV-006** | Log matter creation, status changes, team assignments. |
| **GOV-007** | Task status updated. |
| **GOV-008** | All data in `lexflow_main` DB. |

---

## Frontend Agent Tasks (lexflow-frontend)

### T-018: Client DB Schema + Drizzle
- **Branch:** `feature/SPR-003-T018-client-schema`
- **Dependencies:** T-007
- **Deliverable:**
  - `clients` table: id, firstName, lastName, email, phone, dateOfBirth, address, ssnLast4 (encrypted), insuranceCarrier, insurancePolicyNumber, referralSource, notes, isActive, createdAt, updatedAt
  - PI-specific fields built in from day one
  - Migration files
- **Acceptance:** Migration runs. `INSERT INTO clients` succeeds. Encrypted fields stored correctly.
- **Status:** [ ] Not Started

### T-019: Client tRPC Router
- **Branch:** `feature/SPR-003-T019-client-router`
- **Dependencies:** T-018, T-010
- **Deliverable:** CRUD + paginated search with filters (name, referralSource, isActive). Permission-gated.
- **Acceptance:** Create, read, update, deactivate clients. Pagination works. Permission checks enforced.
- **Status:** [ ] Not Started

### T-020: Client UI Pages
- **Branch:** `feature/SPR-003-T020-client-ui`
- **Dependencies:** T-019, T-013
- **Deliverable:** Client list (DataTable), create form, detail page, edit form.
- **Acceptance:** Full client CRUD from UI. Responsive. SSN field masked.
- **Status:** [ ] Not Started

### T-021: Matter DB Schema + Drizzle
- **Branch:** `feature/SPR-003-T021-matter-schema`
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
- **Branch:** `feature/SPR-003-T022-contact-schema`
- **Dependencies:** T-007
- **Deliverable:** `contacts` (id, name, type [adjuster/doctor/expert/court/opposing_counsel], company, email, phone, address, notes). `matter_contacts` junction table.
- **Acceptance:** Contacts can be linked to multiple matters. Type enum enforced.
- **Status:** [ ] Not Started

### T-023: Matter tRPC Router
- **Branch:** `feature/SPR-003-T023-matter-router`
- **Dependencies:** T-021, T-022, T-010
- **Deliverable:** Full CRUD + team assignment + status transitions + archival (soft delete). Paginated list with filters.
- **Acceptance:** Create matter → auto number. Assign team members. Archive. Filter by status.
- **Status:** [ ] Not Started

### T-024: Deadline tRPC Procedures
- **Branch:** `feature/SPR-003-T024-deadline-procedures`
- **Dependencies:** T-021, T-010
- **Deliverable:** `addDeadline`, `completeDeadline`, `listUpcomingDeadlines` (next 30 days), `listOverdueDeadlines`.
- **Acceptance:** SOL deadline shows as critical. Completed deadlines filtered out of upcoming list.
- **Status:** [ ] Not Started

### T-025: Medical Treatment tRPC Procedures
- **Branch:** `feature/SPR-003-T025-medical-treatment-procedures`
- **Dependencies:** T-021, T-010
- **Deliverable:** CRUD for treatments. Auto-updates `matter.totalMedicalBills` on insert/update/delete.
- **Acceptance:** Adding treatment with amount $5,000 → matter.totalMedicalBills increases by $5,000.
- **Status:** [ ] Not Started

### T-026: Contact tRPC Router
- **Branch:** `feature/SPR-003-T026-contact-router`
- **Dependencies:** T-022, T-010
- **Deliverable:** CRUD + `linkToMatter`, `unlinkFromMatter`. Paginated.
- **Acceptance:** Contact linked to matter appears in matter's contact list.
- **Status:** [ ] Not Started

### T-027: Matter List UI
- **Branch:** `feature/SPR-003-T027-matter-list-ui`
- **Dependencies:** T-023, T-013
- **Deliverable:** DataTable with columns: matterNumber, client, title, status, feeType, SOL date. Filters, search, pagination. Status badges with colors.
- **Acceptance:** Table renders. Filters narrow results. Clicking row → matter detail.
- **Status:** [ ] Not Started

### T-028: Matter Creation Wizard UI
- **Branch:** `feature/SPR-003-T028-matter-wizard-ui`
- **Dependencies:** T-023, T-020
- **Deliverable:** Multi-step wizard: Step 1 (select/create client) → Step 2 (case details: type, accident date, description) → Step 3 (fee arrangement) → Step 4 (insurance info) → Step 5 (review + submit).
- **Acceptance:** Wizard completes. Matter created with all fields. Back/next navigation works.
- **Status:** [ ] Not Started

### T-029: Matter Detail Layout + Tabs
- **Branch:** `feature/SPR-003-T029-matter-detail-tabs`
- **Dependencies:** T-023
- **Deliverable:** Tab navigation: Overview, Team, Deadlines, Medical, Documents, Time, Billing, Trust, Contacts. **Trust tab shows "Coming in SPR-005" placeholder.**
- **Acceptance:** All tabs render. Tab state persists in URL.
- **Status:** [ ] Not Started

### T-030: Matter Team UI
- **Branch:** `feature/SPR-003-T030-matter-team-ui`
- **Dependencies:** T-023
- **Deliverable:** Team management within matter detail. Add/remove team members. Role display.
- **Acceptance:** Add user to matter team → appears in list. Remove works.
- **Status:** [ ] Not Started

### T-031: Matter Deadlines UI
- **Branch:** `feature/SPR-003-T031-deadlines-ui`
- **Dependencies:** T-024
- **Deliverable:** Deadline list with SOL highlighting (red if <30 days). Add deadline form. Complete button. Calendar-style view optional.
- **Acceptance:** SOL deadline highlighted in red. Completed deadlines grayed out.
- **Status:** [ ] Not Started

### T-032: Medical Treatment UI
- **Branch:** `feature/SPR-003-T032-medical-treatment-ui`
- **Dependencies:** T-025
- **Deliverable:** Treatment log table. Add treatment form. Running total displayed prominently.
- **Acceptance:** Add treatment → total updates. Edit/delete reflected in total.
- **Status:** [ ] Not Started

### T-033: Dashboard Widgets
- **Branch:** `feature/SPR-003-T033-dashboard-widgets`
- **Dependencies:** T-023, T-024
- **Deliverable:** KPI cards: Active Matters count, Upcoming Deadlines (next 7 days), Recent Activity feed, Matter Status chart (pie/bar).
- **Acceptance:** Dashboard loads with real data. Widgets update with new matters.
- **Status:** [ ] Not Started

---

## Sprint Checklist

| Task | Agent | Status | Branch | Audited |
|:-----|:------|:-------|:-------|:--------|
| T-018 | Frontend | [ ] | `feature/SPR-003-T018-client-schema` | [ ] |
| T-019 | Frontend | [ ] | `feature/SPR-003-T019-client-router` | [ ] |
| T-020 | Frontend | [ ] | `feature/SPR-003-T020-client-ui` | [ ] |
| T-021 | Frontend | [ ] | `feature/SPR-003-T021-matter-schema` | [ ] |
| T-022 | Frontend | [ ] | `feature/SPR-003-T022-contact-schema` | [ ] |
| T-023 | Frontend | [ ] | `feature/SPR-003-T023-matter-router` | [ ] |
| T-024 | Frontend | [ ] | `feature/SPR-003-T024-deadline-procedures` | [ ] |
| T-025 | Frontend | [ ] | `feature/SPR-003-T025-medical-treatment-procedures` | [ ] |
| T-026 | Frontend | [ ] | `feature/SPR-003-T026-contact-router` | [ ] |
| T-027 | Frontend | [ ] | `feature/SPR-003-T027-matter-list-ui` | [ ] |
| T-028 | Frontend | [ ] | `feature/SPR-003-T028-matter-wizard-ui` | [ ] |
| T-029 | Frontend | [ ] | `feature/SPR-003-T029-matter-detail-tabs` | [ ] |
| T-030 | Frontend | [ ] | `feature/SPR-003-T030-matter-team-ui` | [ ] |
| T-031 | Frontend | [ ] | `feature/SPR-003-T031-deadlines-ui` | [ ] |
| T-032 | Frontend | [ ] | `feature/SPR-003-T032-medical-treatment-ui` | [ ] |
| T-033 | Frontend | [ ] | `feature/SPR-003-T033-dashboard-widgets` | [ ] |

---

## Sprint Completion Criteria

- [ ] All 16 tasks pass acceptance criteria
- [ ] Client intake → matter creation → team assignment flow works end-to-end
- [ ] SOL deadline tracking displays correctly
- [ ] Medical treatment totals auto-calculate
- [ ] Dashboard shows real data from matters/deadlines
- [ ] All GOV compliance checks pass
- [ ] All tests pass: `npm run lint && npm run typecheck && npm run test`
