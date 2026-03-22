---
id: CON-002
title: "Trust Service HTTP API Contract"
type: contract
status: APPROVED
owner: architect
agents: [backend, frontend]
tags: [contract, api, trust-service, http, iolta]
related: [BLU-ARCH-001, GOV-008, CON-001, GOV-003, GOV-004, GOV-006]
created: 2026-03-22
updated: 2026-03-22
version: 1.0.0
---

> **BLUF:** Complete HTTP API specification for the Trust Accounting Service. Every route, request schema, response schema, error code, and validation rule. Backend Agent builds these routes. Frontend Agent builds the trust client (CON-001) against these routes. Any deviation is a defect.

# Trust Service HTTP API Contract

**Base URL:** `http://localhost:4000` (per GOV-008 §3.2)
**Auth:** `X-Internal-Service-Key` header (per CON-001 §1.2)
**Content-Type:** `application/json`
**Error shape:** Per CON-001 §2

---

## 1. Health

### 1.1 `GET /health`

No authentication required.

**Response (200):**
```typescript
{
  status: "ok";
  uptimeMs: number;
  dbConnected: boolean;
}
```

---

## 2. Trust Accounts

### 2.1 `POST /api/trust/accounts`

Create a new trust bank account.

**Request:**
```typescript
{
  bankName: string;           // Required, 1-255 chars
  accountNumber: string;      // Required, encrypted at rest
  routingNumber: string;      // Required, 9 digits, encrypted at rest
  accountName: string;        // Required, display name
  accountType: "iolta" | "operating";
}
```

**Response (201):**
```typescript
{
  id: string;                 // UUID
  bankName: string;
  accountName: string;
  accountType: "iolta" | "operating";
  balance: string;            // Decimal string, "0.00"
  createdAt: string;          // ISO 8601
}
```

**Errors:** `400 VALIDATION_ERROR`

---

### 2.2 `GET /api/trust/accounts`

List all trust accounts.

**Response (200):**
```typescript
{
  data: TrustAccount[];
}
```

```typescript
interface TrustAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountType: "iolta" | "operating";
  balance: string;
  ledgerCount: number;
  createdAt: string;
}
```

---

### 2.3 `GET /api/trust/accounts/:id`

Get a single trust account with summary.

**Response (200):** `TrustAccount`
**Errors:** `404 NOT_FOUND`

---

### 2.4 `POST /api/trust/accounts/:id/ledgers`

Create a client ledger within a trust account. **Calls `validate-matter-client` on Web Service** (per CON-001 §4).

**Request:**
```typescript
{
  matterId: string;           // UUID — validated against web service
  clientId: string;           // UUID — validated against web service
  createdByName: string;      // Display name of creating user
}
```

**Response (201):**
```typescript
{
  id: string;                 // UUID
  trustAccountId: string;
  matterId: string;
  clientId: string;
  matterNumber: string;       // Denormalized from web service
  clientName: string;         // Denormalized from web service
  balance: string;            // "0.00"
  createdAt: string;
}
```

**Errors:**
| HTTP | Code | Cause |
|:-----|:-----|:------|
| 404 | `MATTER_NOT_FOUND` | Matter ID not found in web service |
| 404 | `CLIENT_NOT_FOUND` | Client ID not found |
| 409 | `DUPLICATE_ENTRY` | Ledger already exists for this matter+client on this account |
| 422 | `CLIENT_NOT_ON_MATTER` | Client exists but not linked to matter |
| 503 | `INTERNAL_ERROR` | Web service unreachable |

---

### 2.5 `GET /api/trust/accounts/:id/ledgers`

List all client ledgers for a trust account.

**Response (200):**
```typescript
{
  data: ClientLedger[];
}
```

```typescript
interface ClientLedger {
  id: string;
  trustAccountId: string;
  matterId: string;
  clientId: string;
  matterNumber: string;
  clientName: string;
  balance: string;
  createdAt: string;
}
```

---

## 3. Transactions

All transaction routes use **advisory locking** and **SERIALIZABLE isolation**. If a lock cannot be acquired within 2 seconds, `503 LEDGER_BUSY` is returned.

### 3.1 `POST /api/trust/transactions/deposit`

**Request:**
```typescript
{
  trustAccountId: string;     // UUID
  clientLedgerId: string;     // UUID
  amount: string;             // Decimal string, > 0, e.g., "1500.00"
  description: string;        // Required, 1-500 chars
  payorName: string;          // Required
  paymentMethod: "check" | "wire" | "ach" | "cash" | "other";
  referenceNumber?: string;   // Check number, wire reference, etc.
  createdByName: string;      // Display name of user
}
```

**Response (201):**
```typescript
{
  entryId: string;            // UUID — the journal entry group
  trustAccountBalance: string;
  clientLedgerBalance: string;
  createdAt: string;
}
```

**Errors:** `400 VALIDATION_ERROR`, `404 NOT_FOUND`, `503 LEDGER_BUSY`

---

### 3.2 `POST /api/trust/transactions/disburse`

**Request:**
```typescript
{
  trustAccountId: string;
  clientLedgerId: string;
  amount: string;             // > 0
  description: string;
  payeeName: string;
  paymentMethod: "check" | "wire" | "ach" | "other";
  referenceNumber?: string;
  createdByName: string;
}
```

**Response (201):** Same shape as deposit response.

**Errors:** `400 VALIDATION_ERROR`, `404 NOT_FOUND`, `422 INSUFFICIENT_BALANCE`, `503 LEDGER_BUSY`

---

### 3.3 `POST /api/trust/transactions/transfer`

Transfer between two client ledgers within the same trust account. Trust bank balance unchanged.

**Request:**
```typescript
{
  trustAccountId: string;
  fromLedgerId: string;
  toLedgerId: string;
  amount: string;             // > 0
  description: string;
  createdByName: string;
}
```

**Response (201):**
```typescript
{
  entryId: string;
  fromLedgerBalance: string;
  toLedgerBalance: string;
  createdAt: string;
}
```

**Errors:** `400 VALIDATION_ERROR`, `404 NOT_FOUND`, `422 INSUFFICIENT_BALANCE`, `503 LEDGER_BUSY`

---

### 3.4 `POST /api/trust/transactions/fee-transfer`

Move earned fees from client trust ledger to operating account.

**Request:**
```typescript
{
  trustAccountId: string;
  clientLedgerId: string;
  operatingAccountId: string;
  amount: string;             // > 0
  description: string;
  invoiceReference?: string;
  createdByName: string;
}
```

**Response (201):**
```typescript
{
  entryId: string;
  clientLedgerBalance: string;
  trustAccountBalance: string;
  createdAt: string;
}
```

**Errors:** `400 VALIDATION_ERROR`, `404 NOT_FOUND`, `422 INSUFFICIENT_BALANCE`, `503 LEDGER_BUSY`

---

### 3.5 `POST /api/trust/transactions/:entryId/void`

Void a journal entry by creating a reversing entry.

**Request:**
```typescript
{
  reason: string;             // Required, 1-500 chars
  voidedByName: string;       // Display name of user
}
```

**Response (201):**
```typescript
{
  voidEntryId: string;        // UUID of the reversing entry
  originalEntryId: string;
  trustAccountBalance: string;
  clientLedgerBalance: string;
  voidedAt: string;
}
```

**Errors:** `404 NOT_FOUND`, `409 ALREADY_VOIDED`, `503 LEDGER_BUSY`

---

## 4. Transaction Queries

### 4.1 `GET /api/trust/ledgers/:id/transactions`

Paginated transaction history for a client ledger.

**Query params:**
```
page=1            (default: 1)
pageSize=50       (default: 50, max: 100)
startDate=        (ISO date, optional)
endDate=          (ISO date, optional)
```

**Response (200):**
```typescript
{
  data: JournalEntry[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
```

```typescript
interface JournalEntry {
  id: string;
  entryGroupId: string;
  transactionType: "deposit" | "disbursement" | "transfer_in" | "transfer_out" | "fee_transfer" | "void";
  amount: string;             // Positive for credits, negative for debits
  runningBalance: string;
  description: string;
  referenceNumber: string | null;
  createdByName: string;
  isVoided: boolean;
  voidedByName: string | null;
  voidedAt: string | null;
  createdAt: string;
}
```

---

### 4.2 `GET /api/trust/transactions/:id`

Get a single journal entry group with all line items.

**Response (200):**
```typescript
{
  id: string;
  transactionType: string;
  lineItems: {
    account: string;          // "trust_bank" | "client_ledger" | "operating"
    accountName: string;
    debit: string;
    credit: string;
  }[];
  description: string;
  createdByName: string;
  createdAt: string;
  isVoided: boolean;
}
```

**Errors:** `404 NOT_FOUND`

---

## 5. Bank Reconciliation

### 5.1 `POST /api/trust/bank-statements/import`

Import bank statement transactions (CSV parsed by frontend, sent as JSON).

**Request:**
```typescript
{
  trustAccountId: string;
  statementDate: string;      // ISO date
  transactions: {
    date: string;             // ISO date
    description: string;
    amount: string;           // Positive = deposit, negative = withdrawal
    externalId: string;       // Bank's transaction ID — used for deduplication
    checkNumber?: string;
  }[];
  importedByName: string;
}
```

**Response (201):**
```typescript
{
  imported: number;
  duplicatesSkipped: number;
  statementId: string;
}
```

**Errors:** `400 VALIDATION_ERROR`, `404 NOT_FOUND`

---

### 5.2 `POST /api/trust/reconciliation`

Start a reconciliation.

**Request:**
```typescript
{
  trustAccountId: string;
  statementEndDate: string;
  statementEndBalance: string;
  preparedByName: string;
}
```

**Response (201):**
```typescript
{
  reconciliationId: string;
  status: "balanced" | "unbalanced";
  bankBalance: string;
  bookBalance: string;
  variance: string;
  unmatchedBankTransactions: number;
  unmatchedBookEntries: number;
}
```

---

### 5.3 `GET /api/trust/reconciliation/:id`

Get reconciliation details.

**Response (200):** Full reconciliation record with matched/unmatched items.
**Errors:** `404 NOT_FOUND`

---

### 5.4 `GET /api/trust/accounts/:id/three-way-report`

Three-way reconciliation: bank balance vs. book balance vs. sum of client ledgers.

**Response (200):**
```typescript
{
  trustAccountId: string;
  bankBalance: string;
  bookBalance: string;
  clientLedgerTotal: string;
  bankToBookVariance: string;
  bookToLedgerVariance: string;
  isBalanced: boolean;
  asOfDate: string;
  ledgerBreakdown: {
    ledgerId: string;
    matterNumber: string;
    clientName: string;
    balance: string;
  }[];
}
```

---

## 6. Compliance Requirements

All routes MUST comply with:

| Governance Doc | Requirement |
|:---------------|:------------|
| **GOV-003** (Coding Standard) | TypeScript strict, TypeBox schemas, consistent naming |
| **GOV-004** (Error Handling) | Structured error responses per CON-001 §2, no unhandled rejections, Fastify error handler |
| **GOV-006** (Logging) | Structured JSON logging via pino (Fastify default), correlation IDs, log all transactions |
| **GOV-002** (Testing) | Unit tests for all business logic, integration tests with DB for all routes, contract tests verifying this spec |

### 6.1 Logging Requirements (per GOV-006)

Every transaction mutation MUST log:
```json
{
  "level": "info",
  "event": "trust.transaction",
  "transactionType": "deposit",
  "entryId": "uuid",
  "trustAccountId": "uuid",
  "clientLedgerId": "uuid",
  "amount": "1500.00",
  "createdBy": "user-uuid",
  "correlationId": "request-uuid"
}
```

### 6.2 Error Handling Requirements (per GOV-004)

- All database errors wrapped in application-level error codes
- PostgreSQL `40001` (serialization failure) → retry up to 3× with jitter
- PostgreSQL `55P03` (lock timeout) → return `503 LEDGER_BUSY` immediately, no retry
- Never expose raw SQL errors to clients

### 6.3 Test Requirements (per GOV-002)

| Tier | Requirement |
|:-----|:------------|
| Static Analysis (§4) | TypeScript strict, ESLint, Bandit equivalent |
| Unit (§5) | LedgerEngine balance math, lock sorting, error mapping |
| Integration (§9) | All routes against test PostgreSQL with real advisory locks |
| Contract (§10) | Verify all routes match CON-002 schemas exactly |
| E2E (§12) | Full deposit → disburse → reconcile workflow |

---

*Any deviation between this contract and the Fastify route implementation constitutes a blocking defect. The Backend Agent MUST NOT deviate from these schemas without filing an `EVO-` proposal.*
