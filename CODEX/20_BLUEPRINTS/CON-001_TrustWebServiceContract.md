---
id: CON-001
title: "Trust ↔ Web Service Communication Contract"
type: contract
status: APPROVED
owner: architect
agents: [frontend, backend]
tags: [contract, api, trust-service, inter-service]
related: [BLU-ARCH-001, GOV-008, CON-002]
created: 2026-03-22
updated: 2026-03-22
version: 1.0.0
---

> **BLUF:** This contract defines the communication interface between the Trust Service (backend) and the Web Service (frontend). Both services run on `lexflow-prod` and communicate over localhost. No OIDC — shared secret auth only. Any deviation from this contract is a defect.

# Trust ↔ Web Service Communication Contract

---

## 1. Transport & Authentication

### 1.1 Network

Per GOV-008 §3.2, both services run on the same VM:
- Web Service: `http://localhost:3000`
- Trust Service: `http://localhost:4000`

All inter-service calls are over **localhost HTTP** — no TLS, no OIDC tokens.

### 1.2 Authentication

Shared-secret header authentication:

```
X-Internal-Service-Key: <shared secret from environment variable INTERNAL_SERVICE_KEY>
```

Both services load the same `INTERNAL_SERVICE_KEY` from their `.env` file.

**Validation rules:**
- Missing header → `401 UNAUTHORIZED`
- Wrong value → `403 FORBIDDEN`
- **Dev mode:** If `NODE_ENV=development` and header is missing, allow the request (dev convenience)

---

## 2. Error Response Shape

All error responses from both services MUST use this shape:

```typescript
interface ErrorResponse {
  error: {
    code: string;        // Machine-readable error code (UPPER_SNAKE_CASE)
    message: string;     // Human-readable description
    details?: unknown;   // Optional additional context
  };
}
```

---

## 3. Web → Trust: Trust Client Methods

The Web Service calls the Trust Service via `src/lib/trust-client/http-client.ts`.

### 3.1 Circuit Breaker Configuration

```typescript
{
  timeout: 5000,                  // 5s per request
  errorThresholdPercentage: 50,   // Open after 50% errors
  resetTimeout: 30_000,           // 30s before half-open
  volumeThreshold: 5,             // Min 5 requests before tripping
}
```

When circuit is open, all trust calls return `503 SERVICE_UNAVAILABLE` to the UI immediately.

### 3.2 Method Mapping

| Trust Client Method | HTTP | Trust Service Route | Ref |
|:----|:----|:----|:---|
| `createAccount(data)` | POST | `/api/trust/accounts` | CON-002 §2.1 |
| `listAccounts()` | GET | `/api/trust/accounts` | CON-002 §2.2 |
| `getAccount(id)` | GET | `/api/trust/accounts/:id` | CON-002 §2.3 |
| `createLedger(accountId, data)` | POST | `/api/trust/accounts/:id/ledgers` | CON-002 §2.4 |
| `listLedgers(accountId)` | GET | `/api/trust/accounts/:id/ledgers` | CON-002 §2.5 |
| `recordDeposit(data)` | POST | `/api/trust/transactions/deposit` | CON-002 §3.1 |
| `recordDisbursement(data)` | POST | `/api/trust/transactions/disburse` | CON-002 §3.2 |
| `recordTransfer(data)` | POST | `/api/trust/transactions/transfer` | CON-002 §3.3 |
| `recordFeeTransfer(data)` | POST | `/api/trust/transactions/fee-transfer` | CON-002 §3.4 |
| `voidEntry(entryId, data)` | POST | `/api/trust/transactions/:entryId/void` | CON-002 §3.5 |
| `listTransactions(ledgerId, params)` | GET | `/api/trust/ledgers/:id/transactions` | CON-002 §4.1 |
| `getTransaction(id)` | GET | `/api/trust/transactions/:id` | CON-002 §4.2 |
| `importBankStatement(data)` | POST | `/api/trust/bank-statements/import` | CON-002 §5.1 |
| `startReconciliation(data)` | POST | `/api/trust/reconciliation` | CON-002 §5.2 |
| `getReconciliation(id)` | GET | `/api/trust/reconciliation/:id` | CON-002 §5.3 |
| `getThreeWayReport(accountId)` | GET | `/api/trust/accounts/:id/three-way-report` | CON-002 §5.4 |

---

## 4. Trust → Web: Validation Callback

### 4.1 `GET /api/internal/validate-matter-client`

The Trust Service calls this endpoint on the Web Service to validate that a matter-client pair exists before creating a ledger.

**Request:**
```
GET http://localhost:3000/api/internal/validate-matter-client?matterId=<uuid>&clientId=<uuid>
Headers:
  X-Internal-Service-Key: <shared secret>
```

**Success Response (200):**
```typescript
{
  valid: true;
  matterNumber: string;    // e.g., "2026-0042"
  clientName: string;       // e.g., "Jane Doe"
}
```

**Error Responses:**

| HTTP | Code | Meaning |
|:-----|:-----|:--------|
| 401 | `UNAUTHORIZED` | Missing or invalid `X-Internal-Service-Key` |
| 403 | `FORBIDDEN` | Key valid but caller not authorized |
| 404 | `MATTER_NOT_FOUND` | Matter ID does not exist |
| 404 | `CLIENT_NOT_FOUND` | Client ID does not exist |
| 422 | `CLIENT_NOT_ON_MATTER` | Client exists but is not associated with the specified matter |

### 4.2 Trust Service Behavior on Validation

When creating a ledger (`POST /api/trust/accounts/:id/ledgers`), the Trust Service:
1. Calls `validate-matter-client` with the provided `matterId` and `clientId`
2. On `200`: proceeds, stores `matterNumber` and `clientName` as denormalized fields
3. On `404`/`422`: returns the same error code to the caller
4. On network error/timeout: returns `503 INTERNAL_ERROR`

---

## 5. Shared TypeScript Types

> **Contract-first rule (GOV-008 §1.3):** These types are the canonical definition. Each agent generates their own `.ts` files from this section. The Architect audits for drift.

### 5.1 Pagination

```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
```

### 5.2 Trust Error Codes

```typescript
type TrustErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INSUFFICIENT_BALANCE'
  | 'ALREADY_VOIDED'
  | 'LEDGER_BUSY'
  | 'INTERNAL_ERROR'
  | 'DUPLICATE_ENTRY'
  | 'MATTER_NOT_FOUND'
  | 'CLIENT_NOT_FOUND'
  | 'CLIENT_NOT_ON_MATTER'
  | 'SERVICE_UNAVAILABLE';
```

---

*Any deviation between this contract and the implementation in either service constitutes a defect requiring immediate correction.*
