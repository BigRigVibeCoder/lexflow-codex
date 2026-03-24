---
id: RUN-001
title: "Contract Compliance Test — Cross-Service Integration"
type: how-to
status: DRAFT
owner: architect
agents: [architect]
tags: [runbook, integration, contract-compliance, testing, deployment]
related: [CON-001, CON-002, SPR-004, SPR-005, GOV-002]
created: 2026-03-24
updated: 2026-03-24
version: 1.0.0
---

> **BLUF:** Step-by-step procedure for the Architect to verify that the frontend trust client correctly calls the backend trust service per CON-001 and CON-002. Run this after SPR-005 audit passes, before any integrated deployment. Reusable for all future cross-service integration sprints.

# RUN-001: Contract Compliance Test

---

## Prerequisites

- SPR-004 (trust backend) merged to main ✅
- SPR-005 (trust frontend) audit passed ✅
- Both repos pulled to latest main on `lexflow-architect` VM
- PostgreSQL running with `lexflow_trust` database
- Seed data loaded (`npx tsx scripts/seed.ts` in backend repo)

---

## Step 1: Start Both Services

```bash
# Terminal 1 — Trust Service (backend)
cd ~/Documents/lexflow/lexflow-backend
cp .env.example .env  # ensure TRUST_SERVICE_KEY is set
npm run dev
# Verify: curl http://localhost:4000/health → {"status":"ok"}

# Terminal 2 — Web Service (frontend)
cd ~/Documents/lexflow/lexflow-frontend
cp .env.example .env  # ensure TRUST_SERVICE_KEY matches backend
npm run dev
# Verify: curl http://localhost:3000/api/health → {"status":"ok"}
```

**Gate:** Both health endpoints return 200. If not, stop and fix.

---

## Step 2: Verify CON-001 — Communication Contract

### 2a. Shared Secret Auth

```bash
# Should succeed with correct key
curl -H "X-Internal-Service-Key: $TRUST_SERVICE_KEY" \
  http://localhost:4000/api/trust/accounts

# Should fail with wrong key (401)
curl -H "X-Internal-Service-Key: wrong-key" \
  http://localhost:4000/api/trust/accounts
```

**Expected:** 200 with correct key, 401 with wrong key.

### 2b. Validate-Matter-Client Callback

```bash
# Backend calls frontend to validate matter/client existence
# This happens during deposit/disburse — test via a deposit with matter context
# The trust service should call GET http://localhost:3000/api/trust/validate-matter-client
```

**Expected:** Callback reaches frontend, returns valid/invalid response.

---

## Step 3: Verify CON-002 — All 17 Routes

Test each route category with curl or the seed script data:

### Account Routes

| # | Method | Path | Test |
|:--|:-------|:-----|:-----|
| 1 | POST | `/api/trust/accounts` | Create new trust account |
| 2 | GET | `/api/trust/accounts` | List all accounts |
| 3 | GET | `/api/trust/accounts/:id` | Get account detail |
| 4 | PATCH | `/api/trust/accounts/:id` | Update account status |

### Ledger Routes

| # | Method | Path | Test |
|:--|:-------|:-----|:-----|
| 5 | GET | `/api/trust/accounts/:id/ledgers` | List client ledgers |
| 6 | POST | `/api/trust/accounts/:id/ledgers` | Create client ledger |

### Transaction Routes

| # | Method | Path | Test |
|:--|:-------|:-----|:-----|
| 7 | POST | `/api/trust/transactions/deposit` | Deposit funds |
| 8 | POST | `/api/trust/transactions/disburse` | Disburse funds |
| 9 | POST | `/api/trust/transactions/transfer` | Transfer between ledgers |
| 10 | POST | `/api/trust/transactions/fee-transfer` | Fee transfer |
| 11 | POST | `/api/trust/transactions/:id/void` | Void entry |
| 12 | GET | `/api/trust/transactions` | List transactions |

### Bank Reconciliation Routes

| # | Method | Path | Test |
|:--|:-------|:-----|:-----|
| 13 | POST | `/api/trust/bank-import` | Import CSV statement |
| 14 | POST | `/api/trust/reconciliation/start` | Start reconciliation |
| 15 | POST | `/api/trust/reconciliation/match` | Match transaction |
| 16 | POST | `/api/trust/reconciliation/complete` | Complete reconciliation |
| 17 | GET | `/api/trust/reconciliation/three-way-report` | Three-way report |

**For each route, verify:**
1. Request schema matches CON-002 (field names, types, required/optional)
2. Response schema matches CON-002 (field names, types, structure)
3. Error cases return correct HTTP codes and error shapes
4. Validation rejects invalid payloads per contract

---

## Step 4: E2E Integration Flow

Run a complete workflow through the frontend UI:

```
1. Login as admin user
2. Navigate to Matters → Create new matter (SPR-003 wizard)
3. Navigate to Trust → Create trust account linked to matter
4. Deposit $10,000 into the account
5. Verify balance shows $10,000
6. Disburse $3,000 to attorney (fee transfer)
7. Verify balance shows $7,000
8. Navigate to matter → Trust tab → verify same data
9. Import a bank statement CSV
10. Run reconciliation → verify three-way report
```

**Gate:** All 10 steps complete without errors. Balances match.

---

## Step 5: Circuit Breaker Test

```bash
# Stop the trust service (Ctrl+C in terminal 1)
# In the frontend UI, try to load trust dashboard
# Expected: Circuit breaker triggers, UI shows "Trust service unavailable"
# The UI should NOT crash — it should degrade gracefully

# Restart trust service
# After ~30 seconds, try again
# Expected: Circuit breaker enters half-open → succeeds → closes circuit
```

**Gate:** Frontend degrades gracefully on trust service downtime. Recovers automatically.

---

## Step 6: Results

### Pass Criteria

| Test | Required |
|:-----|:---------|
| Both services start and health check | ✅ |
| Shared secret auth works (accept/reject) | ✅ |
| All 17 CON-002 routes respond correctly | ✅ |
| E2E flow completes (10 steps) | ✅ |
| Circuit breaker triggers and recovers | ✅ |
| Request/response schemas match CON-002 | ✅ |

### Fail Actions

- Type mismatch → file `DEF-NNN`, assign to the agent whose types are wrong
- Missing route → file `DEF-NNN`, assign to backend agent
- UI crash on error → file `DEF-NNN`, assign to frontend agent
- Circuit breaker doesn't trigger → file `DEF-NNN`, assign to frontend agent

### After PASS

1. Tag both repos: `git tag v0.4.0`
2. Deploy via Docker Compose: `cd deploy && docker compose up -d --build`
3. Run `scripts/health-check.sh` against production
4. Update MANIFEST: SPR-005 → COMPLETE
5. File VER-005 audit report
