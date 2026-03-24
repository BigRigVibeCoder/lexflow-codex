---
id: SPR-009-ARCH
title: "Architect Sprint — E2E Testing"
type: reference
status: PLANNED
owner: architect
agents: [architect]
tags: [sprint, testing, e2e, playwright, architect]
related: [GOV-002, SPR-008, T-083]
created: 2026-03-24
updated: 2026-03-24
version: 1.0.0
---

> **BLUF:** Architect-owned sprint to build and execute a Playwright E2E suite against `lexflow-prod`. 8 tasks: scaffold, page objects, 6 critical flow tests. Free tools only. Phase 1 (Flows 1/2/5) can start now; Phase 2 (Flows 3/4/6) after SPR-007.

# Architect Sprint: E2E Testing

---

## Overview

| Item | Detail |
|:-----|:-------|
| **Framework** | Playwright (`@playwright/test`) |
| **Target** | `http://34.73.108.242` (lexflow-prod) |
| **Browser** | Chromium only (demo app) |
| **Artifacts** | Screenshots on every step, trace on failure, HTML report |
| **Pattern** | Page Object Model per GOV-002 §14.2 |
| **Workers** | 1 (serial — flows may share data) |

---

## Tasks

### A-E2E-001: Scaffold Playwright Project
- **Commit:** `feat(ARCH): A-E2E-001 scaffold Playwright project`
- **Deliverable:**
  - `tests/e2e/package.json` with `@playwright/test`
  - `tests/e2e/playwright.config.ts` (BASE_URL from env, screenshots on, trace on retry)
  - `tests/e2e/tsconfig.json`
  - Directory structure: `pages/`, `flows/`, `fixtures/`, `artifacts/`
  - `.gitignore` for `artifacts/` (generated per run, not committed)
- **Acceptance:** `npx playwright test` runs (0 tests, no errors).
- **Status:** [ ] Not Started

### A-E2E-002: Page Object Models
- **Commit:** `feat(ARCH): A-E2E-002 page object models`
- **Deliverable:**
  - `pages/login.page.ts` — goto, login, getError
  - `pages/dashboard.page.ts` — verifyLoaded, getKpiCards
  - `pages/clients.page.ts` — newClient, fillForm, submit, getList
  - `pages/matters.page.ts` — newMatter, fillForm, submit, getList
  - `pages/trust.page.ts` — newAccount, deposit, disburse, getBalance, getLedger
  - `pages/documents.page.ts` — upload, viewPdf, editMetadata
  - `fixtures/auth.fixture.ts` — authenticated page fixture (login once, reuse)
- **Acceptance:** All page objects compile with `tsc --noEmit`.
- **Status:** [ ] Not Started
- **Note:** Selectors use `data-testid` per GOV-002 §14.3. Missing `data-testid` attributes need to be added to frontend.

### A-E2E-003: Flow 1 — Login → Dashboard
- **Commit:** `test(ARCH): A-E2E-003 login and dashboard flow`
- **Deliverable:**
  - `flows/01-login-dashboard.spec.ts`
  - Steps: navigate → redirect to /login → enter credentials → sign in → verify dashboard → verify KPI cards → logout → verify return to /login
  - Error path: invalid credentials → error message, no redirect
- **Acceptance:** Flow passes against lexflow-prod. Screenshots saved.
- **Status:** [ ] Not Started

### A-E2E-004: Flow 2 — Create Client → Create Matter
- **Commit:** `test(ARCH): A-E2E-004 client and matter flow`
- **Deliverable:**
  - `flows/02-client-matter.spec.ts`
  - Steps: login → clients page → new client → fill form → submit → verify in list → open client → new matter → fill form (including SOL date) → submit → verify in matter list
- **Acceptance:** Flow passes. New client + matter visible in UI.
- **Status:** [ ] Not Started

### A-E2E-005: Flow 3 — Time Entry → Invoice → Payment
- **Commit:** `test(ARCH): A-E2E-005 time billing flow`
- **Dependencies:** SPR-007 complete
- **Deliverable:**
  - `flows/03-time-billing.spec.ts`
  - Steps: login → matter → time tab → create entry → verify amount (integer cents) → billing → create invoice (INV-YYYY-NNNN) → finalize → record payment → verify status PAID
  - `pages/billing.page.ts` and `pages/invoices.page.ts` added
- **Acceptance:** Full billing cycle passes. Invoice status transitions correctly.
- **Status:** [ ] Not Started (blocked on SPR-007)

### A-E2E-006: Flow 4 — Trust Accounting
- **Commit:** `test(ARCH): A-E2E-006 trust accounting flow`
- **Dependencies:** SPR-007 complete (for full UI)
- **Deliverable:**
  - `flows/04-trust-accounting.spec.ts`
  - Steps: login → trust accounts → create account → verify $0 balance → deposit $1,000 → verify balance → disburse $250 → verify balance $750 → check ledger (2 entries, running balance)
- **Acceptance:** Balances correct throughout. Ledger entries match.
- **Status:** [ ] Not Started

### A-E2E-007: Flow 5 — Document Upload → View
- **Commit:** `test(ARCH): A-E2E-007 document management flow`
- **Deliverable:**
  - `flows/05-document-management.spec.ts`
  - `fixtures/sample.pdf` — test PDF file
  - Steps: login → matter → documents tab → upload PDF → verify in list → click → PDF viewer loads → edit metadata (category, title) → verify metadata persisted on reload
- **Acceptance:** Upload + view + edit cycle passes.
- **Status:** [ ] Not Started

### A-E2E-008: Flow 6 — SOL Deadline on Dashboard
- **Commit:** `test(ARCH): A-E2E-008 SOL deadline flow`
- **Deliverable:**
  - `flows/06-sol-deadline.spec.ts`
  - Steps: login → create matter with SOL 30 days out → navigate to dashboard → verify SOL widget shows matter name + date
- **Acceptance:** SOL deadline visible on dashboard.
- **Status:** [ ] Not Started

---

## Execution Phases

### Phase 1 — Now
Tasks that can execute against the current deployment:
- A-E2E-001 (scaffold)
- A-E2E-002 (page objects)
- A-E2E-003 (login/dashboard)
- A-E2E-004 (client/matter)
- A-E2E-007 (documents)
- A-E2E-008 (SOL deadline)

### Phase 2 — After SPR-007
Tasks blocked on Time & Billing UI:
- A-E2E-005 (time/billing flow)
- A-E2E-006 (trust accounting — full UI)

---

## Error Capture Strategy

### On Success
- Screenshot per step: `artifacts/screenshots/{flow-name}/step-{N}.png`
- HTML report: `artifacts/reports/index.html`

### On Failure
- Auto-screenshot at failure point
- Playwright trace file: `artifacts/traces/{test-name}.zip`
  - Contains: DOM snapshots, network log, console log, action log
  - View: `npx playwright show-trace <trace.zip>`
- Video recording (on retry)

---

## Prerequisites

| Item | Status | Who |
|:-----|:-------|:----|
| `data-testid` on all interactive elements | Partial | Frontend agent (add in SPR-007 or as cleanup task) |
| Test user seeding (admin, attorney, staff) | Not built | Architect (part of A-E2E-001) |
| `sample.pdf` fixture file | Not built | Architect (part of A-E2E-007) |
| Playwright installed | Not done | Architect (part of A-E2E-001) |

---

## Definition of Done

1. All 8 tasks committed with conventional commit messages
2. `npx playwright test` passes all 6 flows against lexflow-prod
3. HTML report + screenshots saved as evidence
4. Results documented in `VER-009_E2E_Report.md` (that's the VER doc — the output, not the spec)
