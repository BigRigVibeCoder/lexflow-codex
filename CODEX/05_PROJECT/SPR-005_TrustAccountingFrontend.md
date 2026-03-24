---
id: SPR-005
title: "Trust Accounting Frontend Sprint"
type: sprint
status: PLANNING
owner: architect
agents: [frontend]
tags: [sprint, phase-3, trust-accounting, frontend, integration]
related: [BCK-001, SPR-004, CON-001, CON-002]
created: 2026-03-24
updated: 2026-03-24
version: 1.0.0
---

> **BLUF:** Build the trust client library and all trust UI pages. Connect frontend to the running trust service (SPR-004). End state: users can manage trust accounts, record transactions, import bank statements, run reconciliation — all through the web UI. **This is the first sprint that integrates both services — the Architect performs contract compliance testing.**

# SPR-005: Trust Accounting Frontend

**Phase:** 3 — Trust Accounting (Frontend)
**Target:** 6-12 hours (AI-agent pace)
**Agent:** Frontend only
**Dependencies:** SPR-004 complete (trust service running with all CON-002 routes)
**Contracts:** **CON-001 is BINDING** (how to call trust service). **CON-002** (what the API looks like).

---

## ⚠️ Mandatory Compliance — Every Task

| Governance Doc | Sprint Requirement |
|:---------------|:-------------------|
| **GOV-001** | TSDoc on trust-client lib, all trust UI components. |
| **GOV-002** | Unit tests for trust-client with mock server. Integration tests against running trust service. |
| **GOV-003** | TypeScript strict. Trust client types match CON-002 schemas exactly. |
| **GOV-004** | Circuit breaker in trust-client (CON-001 §4). Trust service errors displayed in UI. |
| **GOV-005** | Branch: `feature/SPR-005-TXXX-description`. |
| **GOV-006** | Trust operations logged client-side. API call correlation IDs. |
| **GOV-007** | Task status updated. |
| **GOV-008** | Trust service on localhost:4000. Shared secret from env. |

---

## Frontend Agent Tasks (lexflow-frontend)

### T-044a: Trust Client Library (Mock Tests)
- **Branch:** `feature/SPR-005-T044a-trust-client-lib`
- **Dependencies:** T-002
- **Deliverable:**
  - `src/lib/trust-client/index.ts` — HTTP client for trust service
  - Methods: `createAccount()`, `getAccount()`, `listAccounts()`, `deposit()`, `disburse()`, `transfer()`, `feeTransfer()`, `voidEntry()`, `listTransactions()`, `importStatement()`, `startReconciliation()`, `matchTransaction()`, `completeReconciliation()`, `getThreeWayReport()`
  - Circuit breaker: 3 failures → open → 30s → half-open
  - `X-Internal-Service-Key` header on all requests
  - TypeScript types matching CON-002 schemas
  - **Unit tests with mock HTTP server** — does NOT require running trust service
- **Acceptance:** All client methods callable. Circuit breaker triggers. Types match CON-002.
- **Status:** [ ] Not Started

### T-044b: Trust Client Integration Tests
- **Branch:** `feature/SPR-005-T044b-trust-client-integration`
- **Dependencies:** T-044a, SPR-004 complete
- **Deliverable:**
  - Integration test suite that runs against actual trust service on localhost:4000
  - Tests: create account → deposit → check balance → disburse → verify
  - Tests: transfer between accounts
  - Tests: void entry
- **Acceptance:** All integration tests pass against running trust service.
- **Status:** [ ] Not Started

### T-049: Trust tRPC Proxy Router
- **Branch:** `feature/SPR-005-T049-trust-trpc-proxy`
- **Dependencies:** T-044a, T-010
- **Deliverable:**
  - `src/server/routers/trust.ts` — tRPC procedures that proxy to trust-client
  - Permission-gated: trust operations require `trust:view`, `trust:create`, `trust:manage`, `trust:reconcile` permissions
  - Maps trust-client methods to tRPC procedures
- **Acceptance:** tRPC calls reach trust service. Permission checks enforced.
- **Status:** [ ] Not Started

### T-050: Trust Dashboard UI
- **Branch:** `feature/SPR-005-T050-trust-dashboard`
- **Dependencies:** T-049, T-013
- **Deliverable:**
  - `src/app/(dashboard)/trust/page.tsx` — trust overview
  - KPI cards: total trust balance, number of accounts, recent transactions
  - Account list summary
- **Acceptance:** Dashboard displays real trust data.
- **Status:** [ ] Not Started

### T-051: Trust Account Management UI
- **Branch:** `feature/SPR-005-T051-trust-account-ui`
- **Dependencies:** T-049
- **Deliverable:**
  - Account list page with balances
  - Create account form (links to matter + client)
  - Account detail page with transaction history (paginated)
  - Account status management (activate/freeze/close)
- **Acceptance:** Full account CRUD from UI. Balance displayed correctly.
- **Status:** [ ] Not Started

### T-052: Deposit/Disbursement UI
- **Branch:** `feature/SPR-005-T052-transaction-ui`
- **Dependencies:** T-049
- **Deliverable:**
  - Deposit form: amount, memo, payment method, reference
  - Disbursement form: amount, payee, memo, check number
  - Transfer form: source account, destination account, amount
  - Fee transfer form with explanation
  - Transaction confirmation dialogs
- **Acceptance:** Deposits increase balance. Disbursements decrease. Overdraft shows error.
- **Status:** [ ] Not Started

### T-053: Reconciliation UI
- **Branch:** `feature/SPR-005-T053-reconciliation-ui`
- **Dependencies:** T-049
- **Deliverable:**
  - Bank statement CSV upload page
  - Reconciliation workspace: unmatched bank lines vs. unmatched book entries
  - Manual match drag-and-drop or button
  - Three-way reconciliation report view (bank vs. book vs. client ledger)
  - Complete reconciliation button
- **Acceptance:** CSV upload → auto-match → manual match → complete → report balances.
- **Status:** [ ] Not Started

### T-054: Matter Trust Tab (Activate)
- **Branch:** `feature/SPR-005-T054-matter-trust-tab`
- **Dependencies:** T-049, T-029
- **Deliverable:**
  - Replace "Coming in SPR-005" placeholder in matter detail trust tab
  - Shows trust accounts linked to this matter
  - Quick deposit/disburse buttons
  - Account balance and recent transactions
- **Acceptance:** Matter trust tab shows real trust data. Quick actions work.
- **Status:** [ ] Not Started

---

## 🏗️ Architect Action: Contract Compliance Test

**After SPR-005 completes, the Architect performs the first cross-service test:**

1. Pull both repos on `lexflow-architect`
2. Start trust service (port 4000) and web service (port 3000)
3. Verify: frontend trust-client HTTP calls match CON-002 routes exactly
4. Verify: trust service validate-matter-client callback reaches web service
5. Verify: circuit breaker triggers on trust service downtime
6. Run E2E: login → create matter → create trust account → deposit → disburse → verify balance

**PASS → deploy both services to lexflow-prod**
**FAIL → DEF-NNN filed → affected agent fixes → re-test**

---

## Sprint Checklist

| Task | Agent | Status | Branch | Audited |
|:-----|:------|:-------|:-------|:--------|
| T-044a | Frontend | [ ] | `feature/SPR-005-T044a-trust-client-lib` | [ ] |
| T-044b | Frontend | [ ] | `feature/SPR-005-T044b-trust-client-integration` | [ ] |
| T-049 | Frontend | [ ] | `feature/SPR-005-T049-trust-trpc-proxy` | [ ] |
| T-050 | Frontend | [ ] | `feature/SPR-005-T050-trust-dashboard` | [ ] |
| T-051 | Frontend | [ ] | `feature/SPR-005-T051-trust-account-ui` | [ ] |
| T-052 | Frontend | [ ] | `feature/SPR-005-T052-transaction-ui` | [ ] |
| T-053 | Frontend | [ ] | `feature/SPR-005-T053-reconciliation-ui` | [ ] |
| T-054 | Frontend | [ ] | `feature/SPR-005-T054-matter-trust-tab` | [ ] |

---

## Sprint Completion Criteria

- [ ] All 8 tasks pass acceptance criteria
- [ ] Trust client library calls all 17 CON-002 routes
- [ ] Circuit breaker handles trust service downtime
- [ ] Trust UI pages render with real data from trust service
- [ ] Three-way reconciliation report displays correctly
- [ ] **Architect contract compliance test passes** (cross-service integration)
- [ ] All GOV compliance checks pass
- [ ] All tests pass: `npm run lint && npm run typecheck && npm run test`
