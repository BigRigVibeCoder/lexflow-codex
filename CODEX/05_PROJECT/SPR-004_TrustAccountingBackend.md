---
id: SPR-004
title: "Trust Accounting Backend Sprint"
type: sprint
status: PLANNING
owner: architect
agents: [backend]
tags: [sprint, phase-3, trust-accounting, iolta, ledger, backend]
related: [BCK-001, SPR-001, CON-001, CON-002, BLU-ARCH-001]
created: 2026-03-24
updated: 2026-03-24
version: 1.0.0
---

> **BLUF:** Build the entire Trust Accounting Service backend — all 17 routes from CON-002. Ledger engine with advisory locks, SERIALIZABLE isolation, immutable journal entries, three-way reconciliation. This is the most complex sprint. End state: trust service fully operational, all CON-002 routes responding, bank reconciliation working. **Frontend Agent works on SPR-002/003 in parallel.**

# SPR-004: Trust Accounting Backend

**Phase:** 3 — Trust Accounting (Backend)
**Target:** 12-24 hours (AI-agent pace)
**Agent:** Backend only
**Dependencies:** SPR-001 complete (Fastify scaffold + health endpoint)
**Contracts:** **CON-002 is BINDING.** Every route, schema, and error code in CON-002 must be implemented exactly. No deviations without Architect approval.

---

## ⚠️ Mandatory Compliance — Every Task

| Governance Doc | Sprint Requirement |
|:---------------|:-------------------|
| **GOV-001** | TSDoc on all routes, services, models. README with trust service architecture. |
| **GOV-002** | Unit tests for ledger engine (balance calculations, lock behavior). Integration tests for all routes. |
| **GOV-003** | TypeScript strict. TypeBox schemas matching CON-002. No `any`. |
| **GOV-004** | CON-002 error codes implemented exactly. Circuit breaker on web-client calls. |
| **GOV-005** | Branch: `feature/SPR-004-TXXX-description`. |
| **GOV-006** | All trust operations logged with correlation IDs. Transaction amounts logged at INFO. |
| **GOV-007** | Task status updated. Contract deviations → `EVO-` doc upstream. |
| **GOV-008** | All data in `lexflow_trust` DB. Service listens on port 4000. |

---

## ⚠️ Critical Implementation Rules

These rules are non-negotiable per CON-002 and BLU-ARCH-001:

1. **Journal entries are IMMUTABLE.** No `UPDATE` or `DELETE` on `journal_entries`. Corrections use void + reversing entry.
2. **Advisory locks** on all balance-affecting operations: `SELECT pg_advisory_xact_lock(account_id)`.
3. **SERIALIZABLE isolation** for all transaction operations.
4. **Balance verification** after every transaction: `SUM(debits) == SUM(credits)` per account.
5. **No cross-schema foreign keys.** Trust service validates matter/client existence via HTTP callback to web service (CON-001 §3).

---

## Backend Agent Tasks (lexflow-backend)

### T-034: Trust DB Schema + Drizzle
- **Branch:** `feature/SPR-004-T034-trust-schema`
- **Dependencies:** T-003
- **Blueprints:** BLU-ARCH-001 §4.2, CON-002 §2
- **Deliverable:**
  - Tables: `trust_accounts`, `journal_entries`, `bank_statements`, `bank_statement_lines`, `reconciliation_sessions`, `reconciliation_matches`
  - Denormalized `_name` columns on journal_entries (matterName, clientName — snapshot at transaction time)
  - Immutability trigger: `BEFORE UPDATE OR DELETE ON journal_entries → RAISE EXCEPTION`
  - Index on `journal_entries(trust_account_id, created_at)` for ledger queries
  - Migration files
- **Acceptance:** Migrations run. `INSERT INTO trust_accounts` succeeds. `UPDATE journal_entries` throws error.
- **Status:** [ ] Not Started

### T-035V: Trust Service Auth Middleware (VM)
- **Branch:** `feature/SPR-004-T035V-auth-middleware`
- **Dependencies:** T-003
- **Deliverable:**
  - Fastify `onRequest` hook: validates `X-Internal-Service-Key` header against `INTERNAL_SERVICE_KEY` env var
  - Health endpoint exempt from auth
  - Dev mode (`NODE_ENV=development`): auth passthrough for testing
  - 401 response on missing/invalid key (per CON-002 error format)
- **Acceptance:** Request without key → 401. Request with correct key → passes through.
- **Status:** [ ] Not Started

### T-036: Validate-Matter-Client Endpoint (Frontend)
- **Branch:** `feature/SPR-003-T036-validate-endpoint` (note: created in frontend repo)
- **Agent:** **Frontend** (this is a web service endpoint)
- **Dependencies:** T-021, T-018
- **Deliverable:**
  - `src/app/api/internal/validate-matter-client/route.ts`
  - Validates `X-Internal-Service-Key` header
  - Query params: `matterId`, `clientId`
  - Returns: `{ valid: boolean, matterNumber?: string, clientName?: string, reason?: string }`
  - Per CON-001 §3
- **Acceptance:** Valid matter+client → `{ valid: true }`. Invalid → `{ valid: false, reason: "..." }`.
- **Status:** [ ] Not Started

### T-037: Trust Web-Client Service
- **Branch:** `feature/SPR-004-T037-web-client-service`
- **Dependencies:** T-003
- **Deliverable:**
  - `src/services/web-client.ts` — HTTP client calling web service on localhost:3000
  - `validateMatterClient(matterId, clientId)` method
  - Sends `X-Internal-Service-Key` header
  - Circuit breaker: 3 failures → open → 30s timeout → half-open
  - Timeout: 5 seconds
- **Acceptance:** Calls web service validate endpoint. Circuit breaker opens after 3 failures.
- **Status:** [ ] Not Started

### T-038: Ledger Engine with Advisory Locking
- **Branch:** `feature/SPR-004-T038-ledger-engine`
- **Dependencies:** T-034
- **Deliverable:**
  - `src/services/ledger-engine.ts`
  - `recordTransaction(type, params)`: acquires advisory lock, opens SERIALIZABLE tx, inserts journal entries, verifies balance, commits
  - `getAccountBalance(accountId)`: `SUM(credits) - SUM(debits)` from journal_entries
  - `getAccountLedger(accountId, pagination)`: paginated journal entries
  - Balance verification assertion after every write
- **Acceptance:** Concurrent deposits don't corrupt balance. Advisory lock prevents double-spend.
- **Status:** [ ] Not Started

### T-039: Trust Account Routes
- **Branch:** `feature/SPR-004-T039-account-routes`
- **Dependencies:** T-034, T-035V, T-037
- **Deliverable:**
  - `POST /api/trust/accounts` — create account (validates matter/client via web-client)
  - `GET /api/trust/accounts` — list accounts (paginated)
  - `GET /api/trust/accounts/:id` — get account with balance
  - `PUT /api/trust/accounts/:id` — update account metadata
  - `PATCH /api/trust/accounts/:id/status` — activate/freeze/close
  - TypeBox schemas matching CON-002 §3.1-3.5 exactly
- **Acceptance:** All 5 routes match CON-002. Create validates matter/client. Status transitions enforced.
- **Status:** [ ] Not Started

### T-040: Deposit Route
- **Branch:** `feature/SPR-004-T040-deposit-route`
- **Dependencies:** T-038, T-039
- **Deliverable:** `POST /api/trust/transactions/deposit` per CON-002 §3.6.
- **Acceptance:** Deposit increases account balance. Journal entry created. Balance verifies.
- **Status:** [ ] Not Started

### T-041: Disbursement Route
- **Branch:** `feature/SPR-004-T041-disburse-route`
- **Dependencies:** T-038, T-039
- **Deliverable:** `POST /api/trust/transactions/disburse` per CON-002 §3.7. Overdraft protection: 400 if insufficient funds.
- **Acceptance:** Cannot disburse more than balance. Error matches CON-002 format.
- **Status:** [ ] Not Started

### T-042: Transfer Route
- **Branch:** `feature/SPR-004-T042-transfer-route`
- **Dependencies:** T-038, T-039
- **Deliverable:** `POST /api/trust/transactions/transfer` per CON-002 §3.8. Both accounts locked atomically.
- **Acceptance:** Transfer debits source, credits destination. Both balances correct.
- **Status:** [ ] Not Started

### T-043: Fee Transfer Route
- **Branch:** `feature/SPR-004-T043-fee-transfer-route`
- **Dependencies:** T-038, T-039
- **Deliverable:** `POST /api/trust/transactions/fee-transfer` per CON-002 §3.9. Records fee disbursement from trust to operating.
- **Acceptance:** Fee transfer creates proper journal entries.
- **Status:** [ ] Not Started

### T-045: Void Entry Route
- **Branch:** `feature/SPR-004-T045-void-route`
- **Dependencies:** T-038
- **Deliverable:** `POST /api/trust/transactions/:id/void` per CON-002 §3.10. Creates reversing entry. 409 if already voided.
- **Acceptance:** Void creates reversing entry. Second void → 409.
- **Status:** [ ] Not Started

### T-046: Transaction Listing Routes
- **Branch:** `feature/SPR-004-T046-transaction-listing`
- **Dependencies:** T-034
- **Deliverable:** `GET /api/trust/transactions` (paginated, filterable) and `GET /api/trust/transactions/:id` (detail). Per CON-002 §3.11-3.12.
- **Acceptance:** Pagination works. Filters by account, date range, type.
- **Status:** [ ] Not Started

### T-047: Bank Statement Import
- **Branch:** `feature/SPR-004-T047-bank-import`
- **Dependencies:** T-034
- **Deliverable:** `POST /api/trust/bank-statements/import` per CON-002 §3.13. CSV upload, parse, store. Deduplication by reference number.
- **Acceptance:** CSV upload creates bank_statement + bank_statement_lines. Duplicate import doesn't create duplicates.
- **Status:** [ ] Not Started

### T-048: Reconciliation Engine + Routes
- **Branch:** `feature/SPR-004-T048-reconciliation`
- **Dependencies:** T-034, T-047
- **Deliverable:**
  - `POST /api/trust/reconciliation/start` — create session, auto-match
  - `POST /api/trust/reconciliation/:id/match` — manual match
  - `POST /api/trust/reconciliation/:id/complete` — finalize
  - `GET /api/trust/reports/three-way` — three-way reconciliation report
  - Per CON-002 §3.14-3.17
- **Acceptance:** Auto-match by amount/date. Three-way report balances.
- **Status:** [ ] Not Started

---

## Sprint Checklist

| Task | Agent | Status | Branch | Audited |
|:-----|:------|:-------|:-------|:--------|
| T-034 | Backend | [ ] | `feature/SPR-004-T034-trust-schema` | [ ] |
| T-035V | Backend | [ ] | `feature/SPR-004-T035V-auth-middleware` | [ ] |
| T-036 | Frontend | [ ] | `feature/SPR-003-T036-validate-endpoint` | [ ] |
| T-037 | Backend | [ ] | `feature/SPR-004-T037-web-client-service` | [ ] |
| T-038 | Backend | [ ] | `feature/SPR-004-T038-ledger-engine` | [ ] |
| T-039 | Backend | [ ] | `feature/SPR-004-T039-account-routes` | [ ] |
| T-040 | Backend | [ ] | `feature/SPR-004-T040-deposit-route` | [ ] |
| T-041 | Backend | [ ] | `feature/SPR-004-T041-disburse-route` | [ ] |
| T-042 | Backend | [ ] | `feature/SPR-004-T042-transfer-route` | [ ] |
| T-043 | Backend | [ ] | `feature/SPR-004-T043-fee-transfer-route` | [ ] |
| T-045 | Backend | [ ] | `feature/SPR-004-T045-void-route` | [ ] |
| T-046 | Backend | [ ] | `feature/SPR-004-T046-transaction-listing` | [ ] |
| T-047 | Backend | [ ] | `feature/SPR-004-T047-bank-import` | [ ] |
| T-048 | Backend | [ ] | `feature/SPR-004-T048-reconciliation` | [ ] |

---

## Sprint Completion Criteria

- [ ] All 14 tasks pass acceptance criteria
- [ ] All 17 CON-002 routes respond correctly (health + 16 trust routes)
- [ ] Ledger engine handles concurrent transactions without corruption
- [ ] Immutability triggers prevent journal_entry modification
- [ ] Three-way reconciliation report balances
- [ ] Contract compliance: all TypeBox schemas match CON-002 exactly
- [ ] All GOV compliance checks pass
- [ ] All tests pass: `npm run lint && npm run typecheck && npm run test`
