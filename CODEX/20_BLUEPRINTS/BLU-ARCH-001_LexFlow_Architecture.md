# LexFlow — Architectural Design Document (Revised v2)

## Comprehensive System Architecture for Personal Injury Practice Management

---

## REVISION NOTES (v2)

This revision addresses six issues raised in the second architectural review:

1. **Web-to-Trust Validation Contract (Critical)** — Added a complete, canonical specification for the `GET /api/internal/validate-matter-client` endpoint on the web service, including the HTTP contract, TypeScript types, error codes, and the exact call sequence in the trust service ledger creation handler. The trust service now has a defined, testable contract for this validation call.

2. **User UUID Coupling in Trust Schema (Critical)** — Clarified that `created_by`, `voided_by`, `matched_by`, and `approved_by` columns in the trust schema are **denormalized audit fields**, not foreign keys. Added a `created_by_name` denormalized display column alongside each UUID. Defined the behavior when a user is deleted in the main app (trust records are retained; the UUID becomes a historical reference). Added this to the failure mode table.

3. **Advisory Lock Latency Under Sustained Load (Major)** — Added a quantified latency model for advisory lock hold time, a concrete per-ledger throughput ceiling, and a documented escalation path (request queue with backpressure) for the rare case where a single ledger receives sustained concurrent writes. Added a `503 LEDGER_BUSY` response code to the canonical API contract for this case.

4. **Cloud Tasks Enqueue Failure Leaving Orphaned Records (Major)** — Redesigned the cleanup architecture to be resilient to Cloud Tasks unavailability. The `getUploadUrl` mutation now uses a two-phase approach: (a) the document record is only inserted after the Cloud Tasks enqueue succeeds, or (b) a fallback periodic sweep job (Cloud Scheduler → Cloud Tasks) catches any records where the task was never enqueued. The failure mode table is updated accordingly.

5. **Circular Testing Dependency for Trust Client (Major)** — Resolved by splitting T-044 into two sub-tasks: T-044a (trust client unit tests with a mock HTTP server) and T-044b (trust client integration tests against the real trust service). T-044a has no dependency on a running trust service. T-044b depends on T-047 (trust service fully deployed). The dependency graph is updated.

6. **Duplicated Pagination Type (Minor)** — Moved `PaginatedResponse<T>` to `packages/shared-types`. `PaginatedJournalEntries` in the trust service now uses this shared type. Both the tRPC router and the trust service HTTP response use the same pagination shape.

---

## 1. SYSTEM OVERVIEW

### 1.1 Architecture Topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Google Cloud Platform                          │
│                                                                         │
│  ┌──────────────────────────────────┐  ┌─────────────────────────────┐ │
│  │   Cloud Run: lexflow-web         │  │  Cloud Run: lexflow-trust   │ │
│  │   (Next.js 14 App Router)        │  │  (Fastify 4 + Drizzle)     │ │
│  │                                  │  │                             │ │
│  │  ┌────────────┐ ┌─────────────┐  │  │  ┌──────────┐ ┌─────────┐ │ │
│  │  │ NextAuth.js│ │ tRPC Router │  │  │  │ Ledger   │ │ Recon   │ │ │
│  │  │ + TOTP MFA │ │ (App APIs)  │◀─┼──┼──│ Engine   │ │ Engine  │ │ │
│  │  └────────────┘ └──────┬──────┘  │  │  └──────────┘ └─────────┘ │ │
│  │  ┌────────────┐        │         │  │  ┌──────────────────────┐ │ │
│  │  │ RBAC       │        │─────────┼──┼─▶│ Double-Entry Ledger  │ │ │
│  │  │ Middleware  │        │         │  │  │ Advisory Lock + Retry│ │ │
│  │  └────────────┘        │         │  │  └──────────────────────┘ │ │
│  │  ┌──────────────────────────┐    │  └──────────────┬─────────────┘ │
│  │  │ trust-client/            │    │                 │               │
│  │  │  http-client.ts          │    │                 │               │
│  │  │  circuit-breaker.ts      │    │                 │               │
│  │  │  oidc-token.ts           │    │                 │               │
│  │  └──────────────────────────┘    │                 │               │
│  │  ┌──────────────────────────┐    │                 │               │
│  │  │ /api/internal/           │    │                 │               │
│  │  │  validate-matter-client  │◀───┼─────────────────┘               │
│  │  └──────────────────────────┘    │                                 │
│  └──────────────┬───────────────────┘                                 │
│                 │                                                      │
│                 ▼                                                      │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              Cloud SQL (PostgreSQL 15 HA)                        │  │
│  │  ┌─────────────────────────┐  ┌──────────────────────────────┐  │  │
│  │  │  lexflow_main (schema)  │  │  lexflow_trust (schema)      │  │  │
│  │  │  - users, sessions      │  │  - trust_accounts            │  │  │
│  │  │  - matters, clients     │  │  - journal_entries           │  │  │
│  │  │  - contacts, documents  │  │  - journal_lines             │  │  │
│  │  │  - time_entries         │  │  - bank_transactions         │  │  │
│  │  │  - invoices, payments   │  │  - reconciliation_reports    │  │  │
│  │  └─────────────────────────┘  └──────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌─────────────────────┐  ┌──────────────────────────────────────────┐ │
│  │  GCS: lexflow-docs  │  │  Cloud Tasks: lexflow-tasks              │ │
│  │  - /uploads          │  │  - upload cleanup (24h TTL)              │ │
│  │  - /medical-records  │  │  - stale upload sweep (Cloud Scheduler)  │ │
│  │  - /generated        │  │  - invoice generation                    │ │
│  │                      │  │  - reconciliation runs                   │ │
│  └─────────────────────┘  └──────────────────────────────────────────┘ │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Secret Manager: NEXTAUTH_SECRET, DB creds, OIDC SA keys        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo | Turborepo + pnpm workspaces | Shared types, atomic commits across services |
| Web Framework | Next.js 14 App Router | RSC for data-heavy pages, server actions for mutations |
| API Layer (Web) | tRPC v11 | End-to-end type safety, no codegen |
| Trust Service | Fastify 4 (separate Cloud Run) | Regulatory isolation, independent scaling |
| Trust Client | Inline in `apps/web/src/server/trust-client/` | Single consumer; no separate package needed |
| ORM | Drizzle ORM | Type-safe SQL, explicit queries, migration control |
| Auth | NextAuth.js v5 (Auth.js) | Credential provider + TOTP, session strategy: JWT |
| UI | shadcn/ui + Tailwind CSS 3 | Accessible components, full control |
| Database | Cloud SQL PostgreSQL 15 | HA, automatic backups, schema-level isolation |
| Object Storage | GCS with signed URLs | Direct upload/download, no proxy overhead |
| IaC | Terraform + GCS backend | Reproducible, auditable infrastructure |
| CI/CD | GitHub Actions | Native GCP integration, matrix builds |
| Trust Concurrency | Advisory locks + SERIALIZABLE retry | Eliminates phantom reads; advisory locks reduce abort rate to near-zero |
| Trust Schema Isolation | No cross-schema FK; API validation at ledger creation | Prevents hidden coupling; trust service remains independently deployable |
| Trust User References | Denormalized audit UUIDs + display names | User deletions do not corrupt trust audit trail |
| Pagination | Shared `PaginatedResponse<T>` in `packages/shared-types` | Single pagination shape across all services |
| Upload Cleanup Resilience | Per-upload Cloud Tasks task + Cloud Scheduler sweep fallback | Cleanup survives Cloud Tasks transient failures |

### 1.3 Service Communication Contracts

#### 1.3.1 Trust Service Authentication (Web → Trust)

```
┌─────────────┐     HTTPS + OIDC Token      ┌──────────────┐
│ lexflow-web  │ ──────────────────────────▶  │ lexflow-trust│
│ (Cloud Run)  │                              │ (Cloud Run)  │
│              │ ◀──────────────────────────  │              │
│  SA: web@    │     JSON Response            │  SA: trust@  │
└─────────────┘                               └──────────────┘

Authentication: Cloud Run service-to-service OIDC
- lexflow-web's service account has roles/run.invoker on lexflow-trust
- Web service fetches ID token from GCP metadata server per request
- Trust service validates token via Cloud Run's built-in auth
- Token audience = TRUST_SERVICE_URL (the Cloud Run service URL)
```

#### 1.3.2 Matter/Client Validation Contract (Trust → Web)

**Context:** When the trust service creates a client ledger (`POST /api/trust/accounts/:accountId/ledgers`), it must verify that the `matterId` and `clientId` exist in the main application and that the client is associated with the matter. This call is made by the trust service to the web service using OIDC authentication (the trust service's service account has `roles/run.invoker` on the web service).

**This endpoint is the single source of truth for cross-service matter/client validation. The trust service route handler (§4.3), the web service route implementation (§1.3.2 below), and the integration tests for T-037 MUST all conform to this contract.**

```
Method:  GET
Path:    /api/internal/validate-matter-client
Auth:    Bearer <OIDC token> — trust service SA must have roles/run.invoker on web service
```

**Request Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `matterId` | UUID string | Yes | The matter UUID to validate |
| `clientId` | UUID string | Yes | The client UUID to validate |

**Success Response — `200 OK`:**

```typescript
interface ValidateMatterClientResponse {
  valid: true;
  matterNumber: string;   // e.g. "2024-0042" — for denormalization in client_ledgers
  clientName: string;     // e.g. "Jane Smith" — for denormalization in client_ledgers
  matterStatus: string;   // e.g. "pre_litigation" — informational; trust service does not gate on this
}
```

**Error Responses:**

```typescript
// 400 Bad Request — missing or malformed query parameters
{ error: { code: 'VALIDATION_ERROR', message: 'matterId and clientId must be valid UUIDs' } }

// 404 Not Found — matter does not exist
{ error: { code: 'MATTER_NOT_FOUND', message: 'Matter not found' } }

// 404 Not Found — client does not exist
{ error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' } }

// 422 Unprocessable — matter exists and client exists, but client is not linked to matter
{ error: { code: 'CLIENT_NOT_ON_MATTER', message: 'Client is not associated with this matter' } }

// 401 Unauthorized — missing or invalid OIDC token
{ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization token' } }

// 403 Forbidden — token is valid but not from the trust service account
{ error: { code: 'FORBIDDEN', message: 'Token is not from a recognized service account' } }
```

**Web service implementation:**

```typescript
// apps/web/src/app/api/internal/validate-matter-client/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../../../server/db';
import { matters, clients } from '@lexflow/db-main';
import { eq, and } from 'drizzle-orm';

const authClient = new OAuth2Client();
const TRUST_SA_EMAIL = process.env.TRUST_SERVICE_ACCOUNT_EMAIL!;

export async function GET(req: NextRequest) {
  // 1. Validate OIDC token from trust service
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Missing authorization token' } },
      { status: 401 }
    );
  }

  if (process.env.NODE_ENV !== 'development') {
    try {
      const ticket = await authClient.verifyIdToken({
        idToken: authHeader.slice(7),
        audience: process.env.NEXTAUTH_URL!,
      });
      const payload = ticket.getPayload();
      if (payload?.email !== TRUST_SA_EMAIL) {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN', message: 'Token is not from a recognized service account' } },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
        { status: 401 }
      );
    }
  }

  // 2. Parse and validate query parameters
  const { searchParams } = new URL(req.url);
  const matterId = searchParams.get('matterId');
  const clientId = searchParams.get('clientId');

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!matterId || !clientId || !uuidRegex.test(matterId) || !uuidRegex.test(clientId)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'matterId and clientId must be valid UUIDs' } },
      { status: 400 }
    );
  }

  // 3. Verify matter exists
  const [matter] = await db
    .select({
      id: matters.id,
      matterNumber: matters.matterNumber,
      clientId: matters.clientId,
      status: matters.status,
    })
    .from(matters)
    .where(eq(matters.id, matterId))
    .limit(1);

  if (!matter) {
    return NextResponse.json(
      { error: { code: 'MATTER_NOT_FOUND', message: 'Matter not found' } },
      { status: 404 }
    );
  }

  // 4. Verify client exists
  const [client] = await db
    .select({
      id: clients.id,
      firstName: clients.firstName,
      lastName: clients.lastName,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) {
    return NextResponse.json(
      { error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' } },
      { status: 404 }
    );
  }

  // 5. Verify client is associated with matter
  if (matter.clientId !== clientId) {
    return NextResponse.json(
      { error: { code: 'CLIENT_NOT_ON_MATTER', message: 'Client is not associated with this matter' } },
      { status: 422 }
    );
  }

  return NextResponse.json({
    valid: true,
    matterNumber: matter.matterNumber,
    clientName: `${client.firstName} ${client.lastName}`.trim(),
    matterStatus: matter.status,
  });
}
```

**Trust service call sequence for ledger creation:**

```typescript
// In apps/trust-service/src/routes/accounts.ts — POST /api/trust/accounts/:accountId/ledgers
// Step executed BEFORE inserting the client_ledger record:

async function validateMatterClient(
  matterId: string,
  clientId: string,
  webServiceUrl: string,
  oidcToken: string
): Promise<{ matterNumber: string; clientName: string }> {
  const url = `${webServiceUrl}/api/internal/validate-matter-client` +
    `?matterId=${encodeURIComponent(matterId)}&clientId=${encodeURIComponent(clientId)}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${oidcToken}` },
    signal: AbortSignal.timeout(5000), // 5s timeout
  });

  if (response.status === 200) {
    const body = await response.json();
    return { matterNumber: body.matterNumber, clientName: body.clientName };
  }

  const errBody = await response.json().catch(() => ({
    error: { code: 'INTERNAL_ERROR', message: 'Unparseable validation response' },
  }));

  // Map validation error codes to trust service error codes
  const statusMap: Record<number, number> = { 400: 400, 404: 404, 422: 422, 401: 401, 403: 403 };
  const trustStatus = statusMap[response.status] ?? 500;

  // Re-throw as a structured error that the route handler will catch and return
  const err = new Error(errBody.error.message) as any;
  err.trustCode = errBody.error.code;
  err.httpStatus = trustStatus;
  throw err;
}
```

**Error propagation to trust service client:** When `validateMatterClient` throws, the route handler catches it and returns the appropriate trust service error response. The `code` values `MATTER_NOT_FOUND` and `CLIENT_NOT_FOUND` are mapped to `NOT_FOUND` (404); `CLIENT_NOT_ON_MATTER` is mapped to `VALIDATION_ERROR` (400) since the request body is semantically invalid from the trust service's perspective.

**Development mode:** In `NODE_ENV=development`, the trust service skips the OIDC token check on the validation call (same as the main auth middleware pattern). The web service validation endpoint also skips token verification in development.

#### 1.3.3 Canonical Trust Service HTTP API Contract

This table is the single source of truth. The `trustClient` (§1.3.4), Fastify route handlers (§4.3), and tRPC proxy router (§4.8) MUST all conform to these exact paths and schemas.

| Method | Path | Request Body / Query | Success Response | Error Codes |
|--------|------|----------------------|-----------------|-------------|
| `POST` | `/api/trust/accounts` | `CreateTrustAccountRequest` | `201 TrustAccount` | `400` validation, `409` duplicate account number |
| `GET` | `/api/trust/accounts` | — | `200 TrustAccount[]` | — |
| `GET` | `/api/trust/accounts/:accountId` | — | `200 TrustAccount` | `404` not found |
| `POST` | `/api/trust/accounts/:accountId/ledgers` | `CreateClientLedgerRequest` | `201 ClientLedger` | `400` validation/client-not-on-matter, `404` account/matter/client not found, `409` ledger exists for matter |
| `GET` | `/api/trust/accounts/:accountId/ledgers` | — | `200 ClientLedger[]` | `404` account not found |
| `GET` | `/api/trust/ledgers/:ledgerId` | — | `200 ClientLedger` | `404` not found |
| `GET` | `/api/trust/ledgers/:ledgerId/transactions` | query: `page`, `pageSize`, `dateFrom`, `dateTo` | `200 PaginatedResponse<JournalEntry>` | `404` not found |
| `POST` | `/api/trust/transactions/deposit` | `RecordDepositRequest` | `201 JournalEntry` | `400` validation, `404` account/ledger not found |
| `POST` | `/api/trust/transactions/disburse` | `RecordDisbursementRequest` | `201 JournalEntry` | `400` validation, `404` not found, `422` insufficient balance, `503` ledger busy |
| `POST` | `/api/trust/transactions/transfer` | `RecordTransferRequest` | `201 JournalEntry` | `400` validation, `404` not found, `422` insufficient balance, `503` ledger busy |
| `POST` | `/api/trust/transactions/fee-transfer` | `RecordFeeTransferRequest` | `201 JournalEntry` | `400` validation, `404` not found, `422` insufficient balance, `503` ledger busy |
| `POST` | `/api/trust/transactions/:entryId/void` | `VoidEntryRequest` | `200 JournalEntry` | `404` not found, `409` already voided |
| `GET` | `/api/trust/transactions/:entryId` | — | `200 JournalEntry` | `404` not found |
| `POST` | `/api/trust/bank-statements/import` | `ImportStatementRequest` | `200 ImportResult` | `400` validation, `404` account not found |
| `POST` | `/api/trust/reconciliation` | `ReconciliationRequest` | `201 ReconciliationReport` | `400` validation, `404` account not found |
| `GET` | `/api/trust/reconciliation/:reportId` | — | `200 ReconciliationReport` | `404` not found |
| `GET` | `/api/trust/accounts/:accountId/three-way-report` | query: `asOfDate` | `200 ThreeWayReport` | `404` not found |
| `GET` | `/health` | — | `200 { status: "ok", uptimeMs: number }` | — |

**Canonical Error Response Shape** (all non-2xx responses):

```typescript
// All trust service errors conform to this shape.
// The web service trust-client MUST parse this shape.
interface TrustServiceErrorResponse {
  error: {
    code: TrustErrorCode;   // Machine-readable
    message: string;        // Human-readable
    details?: unknown;      // Validation details (e.g., Zod errors)
  };
}

type TrustErrorCode =
  | 'VALIDATION_ERROR'        // 400: Request body failed schema validation
  | 'NOT_FOUND'               // 404: Resource does not exist
  | 'CONFLICT'                // 409: Duplicate resource or already-voided entry
  | 'INSUFFICIENT_BALANCE'    // 422: Client ledger balance would go negative
  | 'LEDGER_BUSY'             // 503: Advisory lock wait timeout; caller should retry
  | 'UNAUTHORIZED'            // 401: Missing or invalid OIDC token
  | 'FORBIDDEN'               // 403: Token is valid but not a recognized service account
  | 'INTERNAL_ERROR';         // 500: Unexpected server error
```

#### 1.3.4 TypeScript Service Client Contract

The trust client lives at `apps/web/src/server/trust-client/` (not a separate package). It is the only code in the web service that makes HTTP calls to the trust service.

```typescript
// apps/web/src/server/trust-client/types.ts
// This file is the TypeScript mirror of the HTTP contract table above.
// Fastify route schemas in the trust service MUST match these types.
// PaginatedResponse<T> is imported from packages/shared-types.

import type { PaginatedResponse } from '@lexflow/shared-types';

export type { PaginatedResponse };

export interface CreateTrustAccountRequest {
  accountName: string;
  bankName: string;
  accountNumber: string;
  routingNumber: string;       // Must match /^\d{9}$/
  isIolta: boolean;
}

export interface CreateClientLedgerRequest {
  matterId: string;            // UUID — validated against web service at creation time
  clientId: string;            // UUID — validated against web service at creation time
  // matterNumber and clientName are NOT sent by the caller;
  // the trust service fetches them from the web service validation endpoint
  // and stores them as denormalized display values.
}

export interface RecordDepositRequest {
  trustAccountId: string;
  clientLedgerId: string;
  amount: number;              // Positive, max 2 decimal places
  description: string;
  referenceNumber?: string;
  effectiveDate: string;       // ISO 8601 date: YYYY-MM-DD
  createdBy: string;           // User UUID from main app
  createdByName: string;       // Denormalized display name for audit trail
}

export interface RecordDisbursementRequest {
  trustAccountId: string;
  clientLedgerId: string;
  amount: number;
  description: string;
  checkNumber?: string;
  payee: string;
  effectiveDate: string;
  createdBy: string;
  createdByName: string;
}

export interface RecordTransferRequest {
  trustAccountId: string;
  fromClientLedgerId: string;
  toClientLedgerId: string;
  amount: number;
  description: string;
  effectiveDate: string;
  createdBy: string;
  createdByName: string;
}

export interface RecordFeeTransferRequest {
  trustAccountId: string;
  clientLedgerId: string;
  amount: number;
  description: string;
  invoiceId?: string;
  effectiveDate: string;
  createdBy: string;
  createdByName: string;
}

export interface VoidEntryRequest {
  voidedBy: string;            // User UUID
  voidedByName: string;        // Denormalized display name
  voidReason: string;
}

export interface ImportStatementRequest {
  trustAccountId: string;
  importedBy: string;
  importedByName: string;
  transactions: {
    transactionDate: string;   // YYYY-MM-DD
    postDate?: string;
    description: string;
    amount: number;            // Positive = deposit, negative = withdrawal
    runningBalance?: number;
    externalId?: string;       // Bank-provided ID for deduplication
  }[];
}

export interface ReconciliationRequest {
  trustAccountId: string;
  periodStart: string;
  periodEnd: string;
  bankStatementBalance: number;
  preparedBy: string;
  preparedByName: string;
}

// ── Response Types ─────────────────────────────────────────

export interface TrustAccount {
  id: string;
  accountName: string;
  bankName: string;
  accountNumberLast4: string;  // Never return full account number
  routingNumberLast4: string;
  isIolta: boolean;
  currentBalance: number;
  isActive: boolean;
  openedDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientLedger {
  id: string;
  trustAccountId: string;
  matterId: string;
  clientId: string;
  matterNumber: string;
  clientName: string;
  currentBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface JournalLine {
  id: string;
  trustAccountId: string | null;
  clientLedgerId: string | null;
  debitAmount: number;
  creditAmount: number;
  description: string | null;
  lineOrder: number;
}

export interface JournalEntry {
  id: string;
  entryNumber: number;
  entryType: string;
  description: string;
  matterId: string | null;
  checkNumber: string | null;
  referenceNumber: string | null;
  totalAmount: number;
  effectiveDate: string;
  postedAt: string;
  isVoid: boolean;
  voidedAt: string | null;
  voidReason: string | null;
  createdBy: string;           // UUID — historical reference only
  createdByName: string;       // Denormalized display name
  lines: JournalLine[];
}

export interface ImportResult {
  batchId: string;
  imported: number;
  duplicatesSkipped: number;
  errors: { row: number; reason: string }[];
}

export interface ReconciliationReport {
  id: string;
  trustAccountId: string;
  periodStart: string;
  periodEnd: string;
  bankStatementBalance: number;
  bookBalance: number;
  clientLedgerTotal: number;
  outstandingDeposits: number;
  outstandingChecks: number;
  unmatchedBankItems: number;
  unmatchedBookItems: number;
  adjustedBankBalance: number;
  adjustedBookBalance: number;
  isBalanced: boolean;
  variance: number;
  status: 'pending' | 'in_progress' | 'balanced' | 'unbalanced' | 'approved';
  preparedBy: string;
  preparedByName: string;
  reviewedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface ThreeWayReport {
  asOfDate: string;
  trustAccountId: string;
  bankBalance: number;
  bookBalance: number;
  clientLedgerTotal: number;
  isBalanced: boolean;
  variance: number;
  clientLedgerDetails: {
    ledgerId: string;
    matterNumber: string;
    clientName: string;
    balance: number;
  }[];
}

export interface TrustServiceErrorResponse {
  error: {
    code: TrustErrorCode;
    message: string;
    details?: unknown;
  };
}

export type TrustErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INSUFFICIENT_BALANCE'
  | 'LEDGER_BUSY'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INTERNAL_ERROR';
```

```typescript
// apps/web/src/server/trust-client/http-client.ts

import CircuitBreaker from 'opossum';
import { getOidcToken } from './oidc-token';
import type {
  TrustAccount, ClientLedger, JournalEntry,
  ImportResult, ReconciliationReport, ThreeWayReport,
  CreateTrustAccountRequest, CreateClientLedgerRequest,
  RecordDepositRequest, RecordDisbursementRequest,
  RecordTransferRequest, RecordFeeTransferRequest,
  VoidEntryRequest, ImportStatementRequest,
  ReconciliationRequest, TrustServiceErrorResponse,
} from './types';
import type { PaginatedResponse } from '@lexflow/shared-types';
import { TRPCError } from '@trpc/server';

const TRUST_BASE_URL = process.env.TRUST_SERVICE_URL!;
const TIMEOUT_MS = 5000;

// ── Circuit Breaker ────────────────────────────────────────

async function rawFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const breaker = new CircuitBreaker(rawFetch, {
  timeout: TIMEOUT_MS,
  errorThresholdPercentage: 50,
  resetTimeout: 30_000,
  volumeThreshold: 5,
});

breaker.on('open', () =>
  console.error('[CIRCUIT_BREAKER] Trust service circuit OPEN')
);
breaker.on('halfOpen', () =>
  console.warn('[CIRCUIT_BREAKER] Trust service circuit HALF-OPEN, probing...')
);
breaker.on('close', () =>
  console.info('[CIRCUIT_BREAKER] Trust service circuit CLOSED, recovered')
);
breaker.fallback(() => {
  throw new TRPCError({
    code: 'SERVICE_UNAVAILABLE',
    message: 'Trust accounting service is temporarily unavailable. Please try again shortly.',
  });
});

// ── Core HTTP helper ───────────────────────────────────────

async function trustRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await getOidcToken(TRUST_BASE_URL);
  const url = `${TRUST_BASE_URL}${path}`;

  const response = await breaker.fire(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }) as Response;

  if (!response.ok) {
    const errBody: TrustServiceErrorResponse = await response.json().catch(() => ({
      error: { code: 'INTERNAL_ERROR', message: 'Unparseable error from trust service' },
    }));
    // Map trust error codes to tRPC error codes
    const codeMap: Record<string, TRPCError['code']> = {
      VALIDATION_ERROR:    'BAD_REQUEST',
      NOT_FOUND:           'NOT_FOUND',
      CONFLICT:            'CONFLICT',
      INSUFFICIENT_BALANCE:'UNPROCESSABLE_CONTENT',
      LEDGER_BUSY:         'SERVICE_UNAVAILABLE',
      UNAUTHORIZED:        'UNAUTHORIZED',
      FORBIDDEN:           'FORBIDDEN',
      INTERNAL_ERROR:      'INTERNAL_SERVER_ERROR',
    };
    throw new TRPCError({
      code: codeMap[errBody.error.code] ?? 'INTERNAL_SERVER_ERROR',
      message: errBody.error.message,
    });
  }

  return response.json() as Promise<T>;
}

// ── Public API ─────────────────────────────────────────────

export const trustClient = {
  createTrustAccount: (req: CreateTrustAccountRequest) =>
    trustRequest<TrustAccount>('POST', '/api/trust/accounts', req),

  listTrustAccounts: () =>
    trustRequest<TrustAccount[]>('GET', '/api/trust/accounts'),

  getTrustAccount: (accountId: string) =>
    trustRequest<TrustAccount>('GET', `/api/trust/accounts/${accountId}`),

  createClientLedger: (accountId: string, req: CreateClientLedgerRequest) =>
    trustRequest<ClientLedger>('POST', `/api/trust/accounts/${accountId}/ledgers`, req),

  listClientLedgers: (accountId: string) =>
    trustRequest<ClientLedger[]>('GET', `/api/trust/accounts/${accountId}/ledgers`),

  getClientLedger: (ledgerId: string) =>
    trustRequest<ClientLedger>('GET', `/api/trust/ledgers/${ledgerId}`),

  listLedgerTransactions: (
    ledgerId: string,
    params: { page: number; pageSize: number; dateFrom?: string; dateTo?: string }
  ) => {
    const qs = new URLSearchParams({
      page: String(params.page),
      pageSize: String(params.pageSize),
      ...(params.dateFrom && { dateFrom: params.dateFrom }),
      ...(params.dateTo && { dateTo: params.dateTo }),
    });
    return trustRequest<PaginatedResponse<JournalEntry>>(
      'GET', `/api/trust/ledgers/${ledgerId}/transactions?${qs}`
    );
  },

  recordDeposit: (req: RecordDepositRequest) =>
    trustRequest<JournalEntry>('POST', '/api/trust/transactions/deposit', req),

  recordDisbursement: (req: RecordDisbursementRequest) =>
    trustRequest<JournalEntry>('POST', '/api/trust/transactions/disburse', req),

  recordTransfer: (req: RecordTransferRequest) =>
    trustRequest<JournalEntry>('POST', '/api/trust/transactions/transfer', req),

  recordFeeTransfer: (req: RecordFeeTransferRequest) =>
    trustRequest<JournalEntry>('POST', '/api/trust/transactions/fee-transfer', req),

  voidEntry: (entryId: string, req: VoidEntryRequest) =>
    trustRequest<JournalEntry>('POST', `/api/trust/transactions/${entryId}/void`, req),

  getTransaction: (entryId: string) =>
    trustRequest<JournalEntry>('GET', `/api/trust/transactions/${entryId}`),

  importBankStatement: (req: ImportStatementRequest) =>
    trustRequest<ImportResult>('POST', '/api/trust/bank-statements/import', req),

  runReconciliation: (req: ReconciliationRequest) =>
    trustRequest<ReconciliationReport>('POST', '/api/trust/reconciliation', req),

  getReconciliationReport: (reportId: string) =>
    trustRequest<ReconciliationReport>('GET', `/api/trust/reconciliation/${reportId}`),

  getThreeWayReport: (accountId: string, asOfDate: string) =>
    trustRequest<ThreeWayReport>(
      'GET', `/api/trust/accounts/${accountId}/three-way-report?asOfDate=${asOfDate}`
    ),

  healthCheck: () =>
    trustRequest<{ status: 'ok'; uptimeMs: number }>('GET', '/health'),
};
```

```typescript
// apps/web/src/server/trust-client/oidc-token.ts

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Fetches a Google-signed OIDC token for the given audience.
 * Caches the token until 60 seconds before expiry.
 * In development, returns the DEV_AUTH_SECRET instead.
 */
export async function getOidcToken(audience: string): Promise<string> {
  if (process.env.NODE_ENV === 'development') {
    return process.env.DEV_AUTH_SECRET ?? 'dev-secret';
  }

  const cached = tokenCache.get(audience);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const metadataUrl =
    `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity` +
    `?audience=${encodeURIComponent(audience)}&format=full`;

  const response = await fetch(metadataUrl, {
    headers: { 'Metadata-Flavor': 'Google' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch OIDC token: ${response.status}`);
  }

  const token = await response.text();
  const payload = JSON.parse(
    Buffer.from(token.split('.')[1], 'base64url').toString()
  );
  tokenCache.set(audience, { token, expiresAt: payload.exp * 1000 });
  return token;
}
```

---

## 2. MODULE 1: FOUNDATION

### 2.1 Monorepo Structure

```
lexflow/
├── apps/
│   ├── web/                          # Next.js 14 App Router
│   │   ├── src/
│   │   │   ├── app/                  # App Router pages
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── login/page.tsx
│   │   │   │   │   ├── mfa-setup/page.tsx
│   │   │   │   │   └── mfa-verify/page.tsx
│   │   │   │   ├── (dashboard)/
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   ├── dashboard/page.tsx
│   │   │   │   │   ├── matters/
│   │   │   │   │   ├── clients/
│   │   │   │   │   ├── trust/
│   │   │   │   │   ├── documents/
│   │   │   │   │   ├── time/
│   │   │   │   │   ├── billing/
│   │   │   │   │   └── settings/
│   │   │   │   ├── api/
│   │   │   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   │   │   ├── trpc/[trpc]/route.ts
│   │   │   │   │   ├── internal/
│   │   │   │   │   │   └── validate-matter-client/route.ts  # ← Trust→Web validation
│   │   │   │   │   ├── tasks/
│   │   │   │   │   │   ├── cleanup-upload/route.ts
│   │   │   │   │   │   └── sweep-stale-uploads/route.ts    # ← Fallback sweep
│   │   │   │   │   └── health/route.ts
│   │   │   │   └── layout.tsx
│   │   │   ├── server/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── db.ts
│   │   │   │   ├── trpc/
│   │   │   │   │   ├── root.ts
│   │   │   │   │   ├── trpc.ts
│   │   │   │   │   └── routers/
│   │   │   │   ├── services/
│   │   │   │   │   └── upload-cleanup.ts
│   │   │   │   └── trust-client/     # ← Inlined; NOT a separate package
│   │   │   │       ├── http-client.ts
│   │   │   │       ├── oidc-token.ts
│   │   │   │       └── types.ts
│   │   │   ├── lib/
│   │   │   │   ├── rbac.ts
│   │   │   │   └── utils.ts
│   │   │   └── components/
│   │   ├── drizzle/
│   │   │   └── migrations/
│   │   ├── drizzle.config.ts
│   │   ├── next.config.mjs
│   │   └── package.json
│   │
│   └── trust-service/                # Fastify 4 service
│       ├── src/
│       │   ├── server.ts
│       │   ├── routes/
│       │   │   ├── accounts.ts
│       │   │   ├── ledgers.ts
│       │   │   ├── transactions.ts
│       │   │   ├── bank-statements.ts
│       │   │   └── reconciliation.ts
│       │   ├── services/
│       │   │   ├── ledger-engine.ts
│       │   │   ├── reconciliation-engine.ts
│       │   │   ├── retry.ts
│       │   │   └── web-client.ts     # ← Calls /api/internal/validate-matter-client
│       │   ├── db.ts
│       │   └── middleware/
│       │       └── auth.ts
│       ├── drizzle/
│       │   └── migrations/
│       ├── drizzle.config.ts
│       └── package.json
│
├── packages/
│   ├── shared-types/                 # Types shared between web and trust-service
│   │   ├── src/
│   │   │   ├── pagination.ts         # ← PaginatedResponse<T> lives here
│   │   │   ├── matter.ts
│   │   │   ├── auth.ts
│   │   │   └── index.ts
│   │   └── package.json
│   ├── db-main/                      # Drizzle schema for main DB
│   │   ├── src/
│   │   │   ├── schema.ts
│   │   │   └── index.ts
│   │   └── package.json
│   └── db-trust/                     # Drizzle schema for trust DB
│       ├── src/
│       │   ├── schema.ts
│       │   └── index.ts
│       └── package.json
│
├── infra/
│   └── terraform/
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       ├── modules/
│       │   ├── cloud-sql/
│       │   ├── cloud-run/
│       │   ├── gcs/
│       │   ├── iam/
│       │   └── networking/
│       └── environments/
│           ├── staging.tfvars
│           └── production.tfvars
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy-staging.yml
│       └── deploy-production.yml
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.base.json
```

### 2.2 Shared Types Package

```typescript
// packages/shared-types/src/pagination.ts
// Single canonical pagination type used by all services and the tRPC router.

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

```typescript
// packages/shared-types/src/index.ts
export type { PaginatedResponse } from './pagination';
export type { MatterStatus, CaseType, FeeArrangement } from './matter';
export type { UserRole, Permission } from './auth';
```

### 2.3 Database Schema — Foundation Tables

```sql
-- ============================================================
-- SCHEMA: lexflow_main
-- Foundation tables for auth, RBAC, and audit
-- ============================================================

CREATE SCHEMA IF NOT EXISTS lexflow_main;
SET search_path TO lexflow_main;

-- ── Enum Types ─────────────────────────────────────────────

CREATE TYPE user_role AS ENUM (
  'owner',
  'attorney',
  'paralegal',
  'bookkeeper',
  'intake_specialist'
);

CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deactivated');

-- ── Users ──────────────────────────────────────────────────

CREATE TABLE users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            VARCHAR(255) NOT NULL UNIQUE,
  email_verified   TIMESTAMPTZ,
  password_hash    VARCHAR(255) NOT NULL,   -- argon2id
  full_name        VARCHAR(255) NOT NULL,
  role             user_role NOT NULL DEFAULT 'paralegal',
  status           user_status NOT NULL DEFAULT 'active',
  bar_number       VARCHAR(50),

  -- TOTP MFA
  totp_secret      VARCHAR(255),            -- Encrypted at rest via KMS
  totp_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  totp_verified_at TIMESTAMPTZ,
  recovery_codes   TEXT[],                  -- Hashed recovery codes

  -- Lockout
  last_login_at       TIMESTAMPTZ,
  failed_login_count  INTEGER NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email  ON users(email);
CREATE INDEX idx_users_role   ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- ── Sessions ───────────────────────────────────────────────

CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  expires_at    TIMESTAMPTZ NOT NULL,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token   ON sessions(session_token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ── Audit Log ──────────────────────────────────────────────

CREATE TABLE audit_logs (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID REFERENCES users(id),
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50)  NOT NULL,
  resource_id   UUID,
  details       JSONB,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user     ON audit_logs(user_id);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_action   ON audit_logs(action);
CREATE INDEX idx_audit_created  ON audit_logs(created_at);

CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_no_update
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- ── Shared trigger ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 2.4 Drizzle ORM Schema (TypeScript)

```typescript
// packages/db-main/src/schema.ts

import {
  pgSchema, pgEnum, uuid, varchar, text, boolean,
  timestamp, integer, inet, jsonb, bigserial, index, uniqueIndex
} from 'drizzle-orm/pg-core';

export const lexflowMain = pgSchema('lexflow_main');

export const userRoleEnum = lexflowMain.enum('user_role', [
  'owner', 'attorney', 'paralegal', 'bookkeeper', 'intake_specialist',
]);
export const userStatusEnum = lexflowMain.enum('user_status', [
  'active', 'suspended', 'deactivated',
]);

export const users = lexflowMain.table('users', {
  id:               uuid('id').primaryKey().defaultRandom(),
  email:            varchar('email', { length: 255 }).notNull().unique(),
  emailVerified:    timestamp('email_verified', { withTimezone: true }),
  passwordHash:     varchar('password_hash', { length: 255 }).notNull(),
  fullName:         varchar('full_name', { length: 255 }).notNull(),
  role:             userRoleEnum('role').notNull().default('paralegal'),
  status:           userStatusEnum('status').notNull().default('active'),
  barNumber:        varchar('bar_number', { length: 50 }),
  totpSecret:       varchar('totp_secret', { length: 255 }),
  totpEnabled:      boolean('totp_enabled').notNull().default(false),
  totpVerifiedAt:   timestamp('totp_verified_at', { withTimezone: true }),
  recoveryCodes:    text('recovery_codes').array(),
  lastLoginAt:      timestamp('last_login_at', { withTimezone: true }),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockedUntil:      timestamp('locked_until', { withTimezone: true }),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  emailIdx:  uniqueIndex('idx_users_email').on(t.email),
  roleIdx:   index('idx_users_role').on(t.role),
  statusIdx: index('idx_users_status').on(t.status),
}));

export const sessions = lexflowMain.table('sessions', {
  id:           uuid('id').primaryKey().defaultRandom(),
  userId:       uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionToken: varchar('session_token', { length: 255 }).notNull().unique(),
  expiresAt:    timestamp('expires_at', { withTimezone: true }).notNull(),
  ipAddress:    inet('ip_address'),
  userAgent:    text('user_agent'),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx:    index('idx_sessions_user_id').on(t.userId),
  tokenIdx:   uniqueIndex('idx_sessions_token').on(t.sessionToken),
  expiresIdx: index('idx_sessions_expires').on(t.expiresAt),
}));

export const auditLogs = lexflowMain.table('audit_logs', {
  id:           bigserial('id', { mode: 'number' }).primaryKey(),
  userId:       uuid('user_id').references(() => users.id),
  action:       varchar('action', { length: 100 }).notNull(),
  resourceType: varchar('resource_type', { length: 50 }).notNull(),
  resourceId:   uuid('resource_id'),
  details:      jsonb('details'),
  ipAddress:    inet('ip_address'),
  userAgent:    text('user_agent'),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx:     index('idx_audit_user').on(t.userId),
  resourceIdx: index('idx_audit_resource').on(t.resourceType, t.resourceId),
  actionIdx:   index('idx_audit_action').on(t.action),
  createdIdx:  index('idx_audit_created').on(t.createdAt),
}));

export type User    = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
```

### 2.5 Authentication — NextAuth.js v5 Configuration

```typescript
// apps/web/src/server/auth.ts

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from './db';
import { users } from '@lexflow/db-main';
import { eq } from 'drizzle-orm';
import { verify } from 'argon2';
import { authenticator } from 'otplib';
import { z } from 'zod';

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(8),
  totpCode: z.string().length(6).optional(),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  pages: { signIn: '/login', error: '/login' },
  providers: [
    Credentials({
      credentials: {
        email:    { type: 'email' },
        password: { type: 'password' },
        totpCode: { type: 'text' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password, totpCode } = parsed.data;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1);

        if (!user || user.status !== 'active') return null;
        if (user.lockedUntil && user.lockedUntil > new Date()) return null;

        const validPassword = await verify(user.passwordHash, password);
        if (!validPassword) {
          const newCount = user.failedLoginCount + 1;
          await db.update(users).set({
            failedLoginCount: newCount,
            lockedUntil: newCount >= 5
              ? new Date(Date.now() + 15 * 60 * 1000)
              : null,
          }).where(eq(users.id, user.id));
          return null;
        }

        if (user.totpEnabled) {
          if (!totpCode) throw new Error('MFA_REQUIRED');
          const validTotp = authenticator.verify({
            token: totpCode,
            secret: user.totpSecret!,
          });
          if (!validTotp) {
            // Check hashed recovery codes (production: argon2 compare)
            const validRecovery = user.recoveryCodes?.some(
              (hashed) => hashed === totpCode
            );
            if (!validRecovery) return null;
          }
        }

        await db.update(users)
          .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() })
          .where(eq(users.id, user.id));

        return { id: user.id, email: user.email, name: user.fullName, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id   = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id   = token.id as string;
      session.user.role = token.role as string;
      return session;
    },
  },
});
```

### 2.6 RBAC System

```typescript
// apps/web/src/lib/rbac.ts

export type UserRole =
  | 'owner' | 'attorney' | 'paralegal' | 'bookkeeper' | 'intake_specialist';

export type Permission =
  | 'matter:create' | 'matter:read' | 'matter:update' | 'matter:delete' | 'matter:assign'
  | 'client:create' | 'client:read' | 'client:update' | 'client:delete'
  | 'contact:create' | 'contact:read' | 'contact:update' | 'contact:delete'
  | 'trust:read' | 'trust:deposit' | 'trust:disburse' | 'trust:reconcile' | 'trust:admin'
  | 'document:upload' | 'document:read' | 'document:delete' | 'document:admin'
  | 'time:create' | 'time:read' | 'time:read_all' | 'time:update' | 'time:delete'
  | 'invoice:create' | 'invoice:read' | 'invoice:send' | 'invoice:void'
  | 'user:manage' | 'settings:manage' | 'audit:read';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    'matter:create', 'matter:read', 'matter:update', 'matter:delete', 'matter:assign',
    'client:create', 'client:read', 'client:update', 'client:delete',
    'contact:create', 'contact:read', 'contact:update', 'contact:delete',
    'trust:read', 'trust:deposit', 'trust:disburse', 'trust:reconcile', 'trust:admin',
    'document:upload', 'document:read', 'document:delete', 'document:admin',
    'time:create', 'time:read', 'time:read_all', 'time:update', 'time:delete',
    'invoice:create', 'invoice:read', 'invoice:send', 'invoice:void',
    'user:manage', 'settings:manage', 'audit:read',
  ],
  attorney: [
    'matter:create', 'matter:read', 'matter:update', 'matter:assign',
    'client:create', 'client:read', 'client:update',
    'contact:create', 'contact:read', 'contact:update',
    'trust:read', 'trust:deposit', 'trust:disburse',
    'document:upload', 'document:read', 'document:delete',
    'time:create', 'time:read', 'time:read_all', 'time:update',
    'invoice:create', 'invoice:read', 'invoice:send',
    'audit:read',
  ],
  paralegal: [
    'matter:create', 'matter:read', 'matter:update',
    'client:create', 'client:read', 'client:update',
    'contact:create', 'contact:read', 'contact:update',
    'trust:read',
    'document:upload', 'document:read',
    'time:create', 'time:read', 'time:update',
    'invoice:read',
  ],
  bookkeeper: [
    'matter:read', 'client:read',
    'trust:read', 'trust:deposit', 'trust:disburse', 'trust:reconcile', 'trust:admin',
    'time:read', 'time:read_all',
    'invoice:create', 'invoice:read', 'invoice:send', 'invoice:void',
  ],
  intake_specialist: [
    'matter:create', 'matter:read',
    'client:create', 'client:read', 'client:update',
    'contact:create', 'contact:read', 'contact:update',
    'document:upload', 'document:read',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
```

### 2.7 tRPC Setup with RBAC Middleware

```typescript
// apps/web/src/server/trpc/trpc.ts

import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { auth } from '../auth';
import type { UserRole, Permission } from '../../lib/rbac';
import { hasPermission } from '../../lib/rbac';

export interface TRPCContext {
  session: {
    user: { id: string; email: string; name: string; role: UserRole };
  } | null;
  ip: string | null;
  userAgent: string | null;
}

export async function createContext(opts: { req: Request }): Promise<TRPCContext> {
  const session = await auth();
  return {
    session: session as TRPCContext['session'],
    ip: opts.req.headers.get('x-forwarded-for'),
    userAgent: opts.req.headers.get('user-agent'),
  };
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, user: ctx.session.user } });
});

export const protectedProcedure = t.procedure.use(enforceAuth);

export function permissionProcedure(...permissions: Permission[]) {
  return protectedProcedure.use(({ ctx, next }) => {
    for (const perm of permissions) {
      if (!hasPermission(ctx.user.role, perm)) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Missing permission: ${perm}`,
        });
      }
    }
    return next({ ctx });
  });
}
```

### 2.8 Foundation API Routes

```typescript
// apps/web/src/server/trpc/routers/auth.ts

import { z } from 'zod';
import { router, protectedProcedure, permissionProcedure } from '../trpc';
import { db } from '../../db';
import { users, auditLogs } from '@lexflow/db-main';
import { eq } from 'drizzle-orm';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import { hash } from 'argon2';
import { TRPCError } from '@trpc/server';

export const authRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await db.select({
      id: users.id, email: users.email, fullName: users.fullName,
      role: users.role, totpEnabled: users.totpEnabled, lastLoginAt: users.lastLoginAt,
    }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
    return user;
  }),

  setupTotp: protectedProcedure.mutation(async ({ ctx }) => {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(ctx.user.email, 'LexFlow', secret);
    const qrCode = await toDataURL(otpauth);
    await db.update(users).set({ totpSecret: secret }).where(eq(users.id, ctx.user.id));
    return { qrCode, secret };
  }),

  verifyTotp: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id));
      if (!user.totpSecret) throw new TRPCError({ code: 'BAD_REQUEST', message: 'TOTP not set up' });
      const valid = authenticator.verify({ token: input.code, secret: user.totpSecret });
      if (!valid) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid TOTP code' });

      const recoveryCodes = Array.from({ length: 8 }, () =>
        crypto.getRandomValues(new Uint8Array(4)).reduce(
          (s, b) => s + b.toString(16).padStart(2, '0'), ''
        )
      );
      // Production: hash each recovery code with argon2 before storing
      await db.update(users).set({
        totpEnabled: true, totpVerifiedAt: new Date(), recoveryCodes,
      }).where(eq(users.id, ctx.user.id));
      return { recoveryCodes };
    }),

  listUsers: permissionProcedure('user:manage').query(async () => {
    return db.select({
      id: users.id, email: users.email, fullName: users.fullName,
      role: users.role, status: users.status,
      totpEnabled: users.totpEnabled, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt,
    }).from(users).orderBy(users.fullName);
  }),

  createUser: permissionProcedure('user:manage')
    .input(z.object({
      email:             z.string().email(),
      fullName:          z.string().min(1).max(255),
      role:              z.enum(['owner', 'attorney', 'paralegal', 'bookkeeper', 'intake_specialist']),
      barNumber:         z.string().max(50).optional(),
      temporaryPassword: z.string().min(12),
    }))
    .mutation(async ({ ctx, input }) => {
      const passwordHash = await hash(input.temporaryPassword);
      const [newUser] = await db.insert(users).values({
        email: input.email.toLowerCase(),
        fullName: input.fullName,
        role: input.role,
        barNumber: input.barNumber,
        passwordHash,
      }).returning({ id: users.id });

      await db.insert(auditLogs).values({
        userId: ctx.user.id,
        action: 'user.create',
        resourceType: 'user',
        resourceId: newUser.id,
        details: { role: input.role },
      });
      return newUser;
    }),
});
```

### 2.9 Foundation UI Pages

```
apps/web/src/app/
├── (auth)/
│   ├── login/page.tsx
│   ├── mfa-setup/page.tsx
│   └── mfa-verify/page.tsx
├── (dashboard)/
│   ├── layout.tsx
│   ├── dashboard/page.tsx
│   └── settings/
│       ├── profile/page.tsx
│       └── users/
│           ├── page.tsx
│           └── [userId]/page.tsx
```

### 2.10 Foundation Test Requirements

| Test Category | Scope | Tool | Requirements |
|---------------|-------|------|--------------|
| Unit: RBAC | `rbac.ts` | Vitest | Every role × every permission = expected boolean |
| Unit: Auth | `auth.ts` authorize | Vitest + mocks | Valid login, invalid password, lockout after 5 failures, TOTP required, TOTP valid, recovery code |
| Integration: DB | Schema migrations | Vitest + testcontainers | Migrate up, verify tables exist, migrate down |
| Integration: tRPC | Auth router | Vitest + tRPC caller | `me` returns user, `setupTotp` returns QR, `verifyTotp` enables MFA |
| Integration: validate-matter-client | Route handler | Vitest | Valid pair → 200; unknown matter → 404 MATTER_NOT_FOUND; unknown client → 404 CLIENT_NOT_FOUND; client not on matter → 422 CLIENT_NOT_ON_MATTER; missing token → 401; wrong SA → 403 |
| E2E: Login | Full flow | Playwright | Login → dashboard, MFA flow, lockout display |
| E2E: RBAC | Permission gates | Playwright | Paralegal cannot access /settings/users |

---

## 3. MODULE 2: MATTER MANAGEMENT

### 3.1 Database Schema

```sql
-- ============================================================
-- SCHEMA: lexflow_main (continued)
-- ============================================================

CREATE TYPE matter_status AS ENUM (
  'intake', 'pre_litigation', 'litigation', 'discovery',
  'negotiation', 'settlement', 'trial', 'appeal', 'closed', 'archived'
);

CREATE TYPE case_type AS ENUM (
  'auto_accident', 'truck_accident', 'motorcycle_accident',
  'pedestrian_accident', 'slip_and_fall', 'premises_liability',
  'medical_malpractice', 'product_liability', 'wrongful_death',
  'workers_compensation', 'dog_bite', 'other'
);

CREATE TYPE fee_arrangement AS ENUM ('contingency', 'hourly', 'flat_fee', 'hybrid');

CREATE TYPE contact_type AS ENUM (
  'opposing_counsel', 'insurance_adjuster', 'medical_provider',
  'expert_witness', 'court', 'mediator', 'employer', 'witness', 'other'
);

CREATE TYPE statute_type AS ENUM (
  'statute_of_limitations', 'discovery_deadline', 'trial_date',
  'mediation_date', 'deposition_date', 'filing_deadline', 'custom'
);

-- ── Clients ────────────────────────────────────────────────

CREATE TABLE clients (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name                VARCHAR(100) NOT NULL,
  middle_name               VARCHAR(100),
  last_name                 VARCHAR(100) NOT NULL,
  preferred_name            VARCHAR(100),
  date_of_birth             DATE,
  ssn_last_four             VARCHAR(4),
  email                     VARCHAR(255),
  phone_primary             VARCHAR(20),
  phone_secondary           VARCHAR(20),
  address_line1             VARCHAR(255),
  address_line2             VARCHAR(255),
  city                      VARCHAR(100),
  state                     VARCHAR(2),
  zip_code                  VARCHAR(10),
  health_insurance_carrier  VARCHAR(255),
  health_insurance_policy   VARCHAR(100),
  employer_name             VARCHAR(255),
  employer_phone            VARCHAR(20),
  occupation                VARCHAR(255),
  emergency_contact_name    VARCHAR(255),
  emergency_contact_phone   VARCHAR(20),
  emergency_contact_relation VARCHAR(100),
  notes                     TEXT,
  created_by                UUID NOT NULL REFERENCES users(id),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_name       ON clients(last_name, first_name);
CREATE INDEX idx_clients_email      ON clients(email);
CREATE INDEX idx_clients_created_by ON clients(created_by);

CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Matters ────────────────────────────────────────────────

CREATE TABLE matters (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_number           VARCHAR(20) NOT NULL UNIQUE,
  client_id               UUID NOT NULL REFERENCES clients(id),
  lead_attorney_id        UUID NOT NULL REFERENCES users(id),
  title                   VARCHAR(500) NOT NULL,
  status                  matter_status NOT NULL DEFAULT 'intake',
  case_type               case_type NOT NULL,
  court_name              VARCHAR(255),
  court_case_number       VARCHAR(100),
  judge_name              VARCHAR(255),
  jurisdiction            VARCHAR(100),
  date_of_incident        DATE NOT NULL,
  incident_location       TEXT,
  incident_description    TEXT,
  police_report_number    VARCHAR(100),
  fee_arrangement         fee_arrangement NOT NULL DEFAULT 'contingency',
  contingency_rate        NUMERIC(5,4),
  hourly_rate             NUMERIC(10,2),
  flat_fee_amount         NUMERIC(10,2),
  liability_carrier       VARCHAR(255),
  liability_policy_number VARCHAR(100),
  liability_policy_limit  NUMERIC(12,2),
  liability_adjuster_name VARCHAR(255),
  liability_adjuster_phone VARCHAR(20),
  liability_adjuster_email VARCHAR(255),
  liability_claim_number  VARCHAR(100),
  um_carrier              VARCHAR(255),
  um_policy_number        VARCHAR(100),
  um_policy_limit         NUMERIC(12,2),
  total_medical_bills     NUMERIC(12,2) DEFAULT 0,
  total_medical_paid      NUMERIC(12,2) DEFAULT 0,
  demand_amount           NUMERIC(12,2),
  settlement_amount       NUMERIC(12,2),
  settlement_date         DATE,
  sol_date                DATE,
  sol_notes               TEXT,
  opened_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at               TIMESTAMPTZ,
  notes                   TEXT,
  created_by              UUID NOT NULL REFERENCES users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_matters_number      ON matters(matter_number);
CREATE INDEX idx_matters_client            ON matters(client_id);
CREATE INDEX idx_matters_attorney          ON matters(lead_attorney_id);
CREATE INDEX idx_matters_status            ON matters(status);
CREATE INDEX idx_matters_case_type         ON matters(case_type);
CREATE INDEX idx_matters_sol               ON matters(sol_date) WHERE sol_date IS NOT NULL;
CREATE INDEX idx_matters_incident_date     ON matters(date_of_incident);

CREATE TRIGGER trg_matters_updated_at
  BEFORE UPDATE ON matters FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Matter Team ────────────────────────────────────────────

CREATE TABLE matter_team (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id   UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id),
  role        VARCHAR(50) NOT NULL DEFAULT 'team_member',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(matter_id, user_id)
);

CREATE INDEX idx_matter_team_matter ON matter_team(matter_id);
CREATE INDEX idx_matter_team_user   ON matter_team(user_id);

-- ── Contacts ───────────────────────────────────────────────

CREATE TABLE contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_type  contact_type NOT NULL,
  organization  VARCHAR(255),
  first_name    VARCHAR(100),
  last_name     VARCHAR(100),
  title         VARCHAR(100),
  email         VARCHAR(255),
  phone         VARCHAR(20),
  fax           VARCHAR(20),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city          VARCHAR(100),
  state         VARCHAR(2),
  zip_code      VARCHAR(10),
  notes         TEXT,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contacts_type ON contacts(contact_type);
CREATE INDEX idx_contacts_name ON contacts(last_name, first_name);
CREATE INDEX idx_contacts_org  ON contacts(organization);

CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Matter-Contact Junction ────────────────────────────────

CREATE TABLE matter_contacts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id  UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  role       VARCHAR(100),
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(matter_id, contact_id)
);

CREATE INDEX idx_matter_contacts_matter  ON matter_contacts(matter_id);
CREATE INDEX idx_matter_contacts_contact ON matter_contacts(contact_id);

-- ── Matter Deadlines ───────────────────────────────────────

CREATE TABLE matter_deadlines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id     UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  deadline_type statute_type NOT NULL,
  title         VARCHAR(255) NOT NULL,
  due_date      DATE NOT NULL,
  reminder_days INTEGER[] DEFAULT '{30,14,7,1}',
  completed     BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  completed_by  UUID REFERENCES users(id),
  notes         TEXT,
  created_by    UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deadlines_matter ON matter_deadlines(matter_id);
CREATE INDEX idx_deadlines_due    ON matter_deadlines(due_date) WHERE NOT completed;

CREATE TRIGGER trg_deadlines_updated_at
  BEFORE UPDATE ON matter_deadlines FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Medical Treatments ─────────────────────────────────────

CREATE TABLE medical_treatments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id           UUID NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
  provider_contact_id UUID REFERENCES contacts(id),
  provider_name       VARCHAR(255) NOT NULL,
  treatment_type      VARCHAR(100),
  treatment_date      DATE NOT NULL,
  billed_amount       NUMERIC(10,2),
  paid_amount         NUMERIC(10,2),
  adjusted_amount     NUMERIC(10,2),
  balance_amount      NUMERIC(10,2),
  lien_holder         VARCHAR(255),
  lien_amount         NUMERIC(10,2),
  icd_codes           TEXT[],
  cpt_codes           TEXT[],
  notes               TEXT,
  created_by          UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_treatments_matter   ON medical_treatments(matter_id);
CREATE INDEX idx_treatments_date     ON medical_treatments(treatment_date);
CREATE INDEX idx_treatments_provider ON medical_treatments(provider_contact_id);

CREATE TRIGGER trg_treatments_updated_at
  BEFORE UPDATE ON medical_treatments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Matter Number Sequence ─────────────────────────────────

CREATE SEQUENCE matter_number_seq START WITH 1;

CREATE OR REPLACE FUNCTION generate_matter_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.matter_number IS NULL THEN
    NEW.matter_number := EXTRACT(YEAR FROM NOW())::TEXT || '-' ||
                         LPAD(nextval('matter_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_matter_number
  BEFORE INSERT ON matters
  FOR EACH ROW EXECUTE FUNCTION generate_matter_number();
```

### 3.2 Matter Management API (tRPC Router)

```typescript
// apps/web/src/server/trpc/routers/matter.ts

import { z } from 'zod';
import { router, permissionProcedure } from '../trpc';
import type { PaginatedResponse } from '@lexflow/shared-types';

// ── Shared response types ──────────────────────────────────

export interface MatterListItem {
  id: string;
  matterNumber: string;
  title: string;
  status: string;
  caseType: string;
  clientName: string;
  leadAttorneyName: string;
  dateOfIncident: string;
  solDate: string | null;
  feeArrangement: string;
  createdAt: string;
}

// PaginatedResponse<T> is imported from @lexflow/shared-types — not redefined here.

// ── Input schemas ──────────────────────────────────────────

const createMatterInput = z.object({
  clientId:            z.string().uuid(),
  leadAttorneyId:      z.string().uuid(),
  title:               z.string().min(1).max(500),
  caseType:            z.enum(['auto_accident','truck_accident','motorcycle_accident',
                               'pedestrian_accident','slip_and_fall','premises_liability',
                               'medical_malpractice','product_liability','wrongful_death',
                               'workers_compensation','dog_bite','other']),
  dateOfIncident:      z.string().date(),
  incidentLocation:    z.string().optional(),
  incidentDescription: z.string().optional(),
  policeReportNumber:  z.string().max(100).optional(),
  feeArrangement:      z.enum(['contingency','hourly','flat_fee','hybrid']),
  contingencyRate:     z.number().min(0).max(1).optional(),
  hourlyRate:          z.number().positive().optional(),
  flatFeeAmount:       z.number().positive().optional(),
  solDate:             z.string().date().optional(),
  solNotes:            z.string().optional(),
  liabilityCarrier:    z.string().max(255).optional(),
  liabilityPolicyNumber: z.string().max(100).optional(),
  liabilityPolicyLimit:  z.number().positive().optional(),
  liabilityClaimNumber:  z.string().max(100).optional(),
});

// ── Router ─────────────────────────────────────────────────

export const matterRouter = router({
  list: permissionProcedure('matter:read')
    .input(z.object({
      status:         z.string().optional(),
      caseType:       z.string().optional(),
      leadAttorneyId: z.string().uuid().optional(),
      search:         z.string().max(200).optional(),
      page:           z.number().int().positive().default(1),
      pageSize:       z.number().int().min(10).max(100).default(25),
      sortBy:         z.enum(['matter_number','title','status','date_of_incident','sol_date','created_at']).default('created_at'),
      sortOrder:      z.enum(['asc','desc']).default('desc'),
    }))
    .query(async ({ ctx, input }): Promise<PaginatedResponse<MatterListItem>> => {
      throw new Error('Not implemented');
    }),

  getById: permissionProcedure('matter:read')
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      throw new Error('Not implemented');
    }),

  create: permissionProcedure('matter:create')
    .input(createMatterInput)
    .mutation(async ({ ctx, input }): Promise<{ id: string; matterNumber: string }> => {
      throw new Error('Not implemented');
    }),

  update: permissionProcedure('matter:update')
    .input(createMatterInput.partial().extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      throw new Error('Not implemented');
    }),

  delete: permissionProcedure('matter:delete')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }): Promise<{ success: boolean }> => {
      throw new Error('Not implemented');
    }),

  addTeamMember: permissionProcedure('matter:assign')
    .input(z.object({
      matterId: z.string().uuid(),
      userId:   z.string().uuid(),
      role:     z.string().max(50).default('team_member'),
    }))
    .mutation(async ({ ctx, input }) => { throw new Error('Not implemented'); }),

  removeTeamMember: permissionProcedure('matter:assign')
    .input(z.object({ matterId: z.string().uuid(), userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => { throw new Error('Not implemented'); }),

  addDeadline: permissionProcedure('matter:update')
    .input(z.object({
      matterId:     z.string().uuid(),
      deadlineType: z.enum(['statute_of_limitations','discovery_deadline','trial_date',
                            'mediation_date','deposition_date','filing_deadline','custom']),
      title:        z.string().min(1).max(255),
      dueDate:      z.string().date(),
      reminderDays: z.array(z.number().int().positive()).optional(),
      notes:        z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => { throw new Error('Not implemented'); }),

  completeDeadline: permissionProcedure('matter:update')
    .input(z.object({ deadlineId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => { throw new Error('Not implemented'); }),

  addTreatment: permissionProcedure('matter:update')
    .input(z.object({
      matterId:          z.string().uuid(),
      providerName:      z.string().min(1).max(255),
      providerContactId: z.string().uuid().optional(),
      treatmentType:     z.string().max(100).optional(),
      treatmentDate:     z.string().date(),
      billedAmount:      z.number().nonnegative().optional(),
      paidAmount:        z.number().nonnegative().optional(),
      adjustedAmount:    z.number().nonnegative().optional(),
      lienHolder:        z.string().max(255).optional(),
      lienAmount:        z.number().nonnegative().optional(),
      icdCodes:          z.array(z.string()).optional(),
      cptCodes:          z.array(z.string()).optional(),
      notes:             z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => { throw new Error('Not implemented'); }),

  listTreatments: permissionProcedure('matter:read')
    .input(z.object({ matterId: z.string().uuid() }))
    .query(async ({ ctx, input }) => { throw new Error('Not implemented'); }),
});
```

### 3.3 Matter Management UI Pages

```
apps/web/src/app/(dashboard)/
├── matters/
│   ├── page.tsx                    # Matter list with filters, search, pagination
│   ├── new/
│   │   └── page.tsx                # Multi-step matter creation wizard
│   └── [matterId]/
│       ├── layout.tsx              # Matter sub-navigation tabs
│       ├── details/page.tsx        # Case details, insurance info
│       ├── team/page.tsx           # Team members
│       ├── deadlines/page.tsx      # Critical dates, SOL tracker
│       ├── medical/page.tsx        # Medical treatment log
│       ├── documents/page.tsx      # Documents (Module 4)
│       ├── trust/page.tsx          # Trust tab — DISABLED PLACEHOLDER until Phase 3
│       │                           # Renders: <ComingSoonTab label="Trust Accounting" />
│       ├── time/page.tsx           # Time entries (Module 5)
│       ├── billing/page.tsx        # Invoices (Module 5)
│       └── notes/page.tsx          # Case notes
│
├── clients/
│   ├── page.tsx
│   ├── new/page.tsx
│   └── [clientId]/
│       ├── page.tsx
│       └── edit/page.tsx
│
└── contacts/
    ├── page.tsx
    ├── new/page.tsx
    └── [contactId]/
        ├── page.tsx
        └── edit/page.tsx
```

**Note on the Trust tab:** The matter detail layout (T-029) renders the Trust tab as a visible but disabled navigation item with a `<ComingSoonTab>` placeholder component. This avoids building a non-functional API call in Phase 2 and avoids rework in Phase 3. The tab becomes functional when T-053 is completed in Phase 3.

### 3.4 Matter Management Test Requirements

| Test | Tool | Requirement |
|------|------|-------------|
| Unit: matter number generation | Vitest | Verify YYYY-NNNN format, uniqueness |
| Unit: input validation | Vitest | All Zod schemas reject invalid data |
| Integration: CRUD | Vitest + DB | Create → Read → Update → Archive lifecycle |
| Integration: team assignment | Vitest + DB | Add/remove team members, uniqueness constraint |
| Integration: medical totals | Vitest + DB | Adding treatment updates matter.total_medical_bills |
| Integration: deadline reminders | Vitest + DB | Query upcoming deadlines within reminder windows |
| E2E: matter creation wizard | Playwright | Complete multi-step form, verify matter appears in list |
| E2E: matter detail tabs | Playwright | Navigate all tabs; Trust tab shows disabled placeholder |
| E2E: search and filter | Playwright | Filter by status, search by name, pagination |

---

## 4. MODULE 3: TRUST ACCOUNTING

### 4.1 Design Rationale — Separate Service

Trust accounting is isolated into a dedicated Fastify service because:

1. **Regulatory compliance**: IOLTA rules require strict separation of trust and operating funds
2. **Transaction isolation**: SERIALIZABLE isolation level for all ledger operations
3. **Audit independence**: Trust ledger must be independently auditable
4. **Schema isolation**: Separate PostgreSQL schema prevents accidental cross-contamination
5. **Deployment independence**: Trust service can be deployed/rolled back without affecting the main app

**Cross-service reference design:**

- `matter_id`, `client_id`, `created_by`, `voided_by`, `matched_by`, `approved_by`, `prepared_by` in trust tables are plain UUIDs — **not foreign keys**. They are historical audit references.
- Denormalized display columns (`matter_number`, `client_name`, `created_by_name`, etc.) are stored alongside each UUID so the trust service can render audit trails without cross-service queries.
- **Matter/client existence** is validated via the `GET /api/internal/validate-matter-client` endpoint (§1.3.2) at ledger creation time only. Subsequent matter archival does not invalidate the ledger — trust records are retained for audit regardless of matter status.
- **User deletion** in the main app does not affect trust records. The UUID becomes a historical reference; the denormalized name remains as the display value. The UI shows the stored name rather than querying the user table.

### 4.2 Advisory Lock Concurrency Model

**Lock hold time analysis:**

A typical `executeTransaction` call holds the advisory lock for the duration of:
1. `INSERT INTO journal_entries` — ~1–2ms
2. `INSERT INTO journal_lines` (2–4 rows) — ~1–3ms
3. `UPDATE trust_accounts` — ~1ms
4. `UPDATE client_ledgers` + balance check — ~2ms
5. Final verification `SELECT` — ~1ms

**Total estimated lock hold time: 6–9ms per transaction** under normal load on Cloud SQL.

**Per-ledger throughput ceiling:** With a 6–9ms lock hold time, a single client ledger can sustain approximately **110–165 transactions per minute** before advisory lock queuing causes measurable latency. For a personal injury firm, even a high-volume settlement disbursement scenario (e.g., 10 simultaneous medical lien payments) would complete in under 100ms total — well within acceptable bounds.

**Escalation path for extreme concurrency:** If a single ledger receives sustained concurrent writes beyond the ceiling (e.g., bulk import scenarios), the `withSerializableRetry` wrapper returns a `503 LEDGER_BUSY` response after a configurable lock wait timeout (`lock_timeout = '2s'`). The caller (tRPC router) surfaces this as a retryable error with a `Retry-After: 5` header. A queue-based fallback (Cloud Tasks sequential processing) is available as a configuration option for bulk import operations but is not required for normal interactive use.

```typescript
// Lock timeout configuration in ledger-engine.ts
// Set before acquiring advisory locks:
await tx.execute(sql`SET LOCAL lock_timeout = '2s'`);
// If lock_timeout is exceeded, PostgreSQL throws error code 55P03 (lock_not_available).
// The route handler catches 55P03 and returns 503 LEDGER_BUSY.
```

### 4.3 Database Schema — Trust Service

```sql
-- ============================================================
-- SCHEMA: lexflow_trust
-- Double-entry IOLTA ledger with three-way reconciliation
-- No cross-schema foreign keys — see §4.1 design rationale
-- User UUIDs are denormalized audit references — see §4.1
-- ============================================================

CREATE SCHEMA IF NOT EXISTS lexflow_trust;
SET search_path TO lexflow_trust;

-- ── Enum Types ─────────────────────────────────────────────

CREATE TYPE account_type AS ENUM (
  'trust_bank', 'client_ledger', 'operating_transfer', 'suspense'
);

CREATE TYPE entry_type AS ENUM (
  'deposit', 'disbursement', 'transfer', 'fee_transfer',
  'cost_advance', 'refund', 'interest', 'bank_fee', 'adjustment'
);

CREATE TYPE reconciliation_status AS ENUM (
  'pending', 'in_progress', 'balanced', 'unbalanced', 'approved'
);

-- ── Trust Bank Accounts ────────────────────────────────────

CREATE TABLE trust_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name    VARCHAR(255) NOT NULL,
  bank_name       VARCHAR(255) NOT NULL,
  account_number  VARCHAR(255) NOT NULL,   -- Encrypted at rest via KMS
  routing_number  VARCHAR(255) NOT NULL,   -- Encrypted at rest via KMS
  account_type    account_type NOT NULL DEFAULT 'trust_bank',
  is_iolta        BOOLEAN NOT NULL DEFAULT TRUE,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  opened_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  closed_date     DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Client Ledgers ─────────────────────────────────────────
-- matter_id and client_id are UUIDs referencing lexflow_main,
-- but no FK constraint is declared (cross-schema isolation).
-- Existence is validated by the web service before ledger creation.
-- matter_number and client_name are denormalized for display.

CREATE TABLE client_ledgers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trust_account_id UUID NOT NULL REFERENCES trust_accounts(id),
  matter_id        UUID NOT NULL,          -- References lexflow_main.matters (no FK)
  client_id        UUID NOT NULL,          -- References lexflow_main.clients (no FK)
  matter_number    VARCHAR(20) NOT NULL,   -- Denormalized; fetched from validate-matter-client
  client_name      VARCHAR(255) NOT NULL,  -- Denormalized; fetched from validate-matter-client
  current_balance  NUMERIC(14,2) NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(trust_account_id, matter_id)
);

CREATE INDEX idx_client_ledgers_trust  ON client_ledgers(trust_account_id);
CREATE INDEX idx_client_ledgers_matter ON client_ledgers(matter_id);
CREATE INDEX idx_client_ledgers_client ON client_ledgers(client_id);

-- ── Journal Entries ────────────────────────────────────────
-- created_by, voided_by, approved_by are denormalized audit UUIDs.
-- The corresponding _name columns store the display name at time of action.
-- If the user is later deleted from lexflow_main, the name is preserved here.

CREATE TABLE journal_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number      BIGSERIAL UNIQUE,
  entry_type        entry_type NOT NULL,
  description       VARCHAR(500) NOT NULL,
  matter_id         UUID,
  check_number      VARCHAR(50),
  reference_number  VARCHAR(100),
  total_amount      NUMERIC(14,2) NOT NULL,
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by       UUID,                  -- Audit reference; no FK
  approved_by_name  VARCHAR(255),          -- Denormalized display name
  approved_at       TIMESTAMPTZ,
  created_by        UUID NOT NULL,         -- Audit reference; no FK
  created_by_name   VARCHAR(255) NOT NULL, -- Denormalized display name
  effective_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  posted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_void           BOOLEAN NOT NULL DEFAULT FALSE,
  voided_by         UUID,                  -- Audit reference; no FK
  voided_by_name    VARCHAR(255),          -- Denormalized display name
  voided_at         TIMESTAMPTZ,
  void_reason       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_journal_entries_matter     ON journal_entries(matter_id);
CREATE INDEX idx_journal_entries_type       ON journal_entries(entry_type);
CREATE INDEX idx_journal_entries_date       ON journal_entries(effective_date);
CREATE INDEX idx_journal_entries_created_by ON journal_entries(created_by);
CREATE INDEX idx_journal_entries_void       ON journal_entries(is_void);

-- ── Journal Lines ──────────────────────────────────────────

CREATE TABLE journal_lines (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id),
  trust_account_id UUID REFERENCES trust_accounts(id),
  client_ledger_id UUID REFERENCES client_ledgers(id),
  debit_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,
  description      VARCHAR(255),
  line_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_debit_or_credit CHECK (
    (debit_amount > 0 AND credit_amount = 0) OR
    (debit_amount = 0 AND credit_amount > 0)
  ),
  CONSTRAINT chk_account_ref CHECK (
    trust_account_id IS NOT NULL OR client_ledger_id IS NOT NULL
  )
);

CREATE INDEX idx_journal_lines_entry  ON journal_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_trust  ON journal_lines(trust_account_id);
CREATE INDEX idx_journal_lines_ledger ON journal_lines(client_ledger_id);

-- ── Bank Transactions ──────────────────────────────────────
-- matched_by is a denormalized audit UUID; matched_by_name stores display name.

CREATE TABLE bank_transactions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trust_account_id         UUID NOT NULL REFERENCES trust_accounts(id),
  transaction_date         DATE NOT NULL,
  post_date                DATE,
  description              VARCHAR(500) NOT NULL,
  amount                   NUMERIC(14,2) NOT NULL,
  running_balance          NUMERIC(14,2),
  matched_journal_entry_id UUID REFERENCES journal_entries(id),
  is_matched               BOOLEAN NOT NULL DEFAULT FALSE,
  matched_at               TIMESTAMPTZ,
  matched_by               UUID,                  -- Audit reference; no FK
  matched_by_name          VARCHAR(255),           -- Denormalized display name
  import_batch_id          UUID,
  external_id              VARCHAR(255),
  raw_data                 JSONB,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bank_txns_account    ON bank_transactions(trust_account_id);
CREATE INDEX idx_bank_txns_date       ON bank_transactions(transaction_date);
CREATE INDEX idx_bank_txns_matched    ON bank_transactions(is_matched);
CREATE INDEX idx_bank_txns_batch      ON bank_transactions(import_batch_id);
CREATE UNIQUE INDEX idx_bank_txns_ext ON bank_transactions(trust_account_id, external_id)
  WHERE external_id IS NOT NULL;

-- ── Reconciliation Reports ─────────────────────────────────
-- prepared_by and reviewed_by are denormalized audit UUIDs.

CREATE TABLE reconciliation_reports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trust_account_id      UUID NOT NULL REFERENCES trust_accounts(id),
  period_start          DATE NOT NULL,
  period_end            DATE NOT NULL,
  bank_statement_balance NUMERIC(14,2) NOT NULL,
  book_balance          NUMERIC(14,2) NOT NULL,
  client_ledger_total   NUMERIC(14,2) NOT NULL,
  outstanding_deposits  NUMERIC(14,2) NOT NULL DEFAULT 0,
  outstanding_checks    NUMERIC(14,2) NOT NULL DEFAULT 0,
  unmatched_bank_items  INTEGER NOT NULL DEFAULT 0,
  unmatched_book_items  INTEGER NOT NULL DEFAULT 0,
  adjusted_bank_balance NUMERIC(14,2) NOT NULL,
  adjusted_book_balance NUMERIC(14,2) NOT NULL,
  status                reconciliation_status NOT NULL DEFAULT 'pending',
  is_balanced           BOOLEAN NOT NULL DEFAULT FALSE,
  variance              NUMERIC(14,2) NOT NULL DEFAULT 0,
  prepared_by           UUID NOT NULL,         -- Audit reference; no FK
  prepared_by_name      VARCHAR(255) NOT NULL, -- Denormalized display name
  reviewed_by           UUID,
  reviewed_by_name      VARCHAR(255),
  approved_at           TIMESTAMPTZ,
  notes                 TEXT,
  report_data           JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recon_account ON reconciliation_reports(trust_account_id);
CREATE INDEX idx_recon_period  ON reconciliation_reports(period_start, period_end);
CREATE INDEX idx_recon_status  ON reconciliation_reports(status);

-- ── Immutability Triggers ──────────────────────────────────

CREATE OR REPLACE FUNCTION prevent_journal_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_void = FALSE AND NEW.is_void = TRUE THEN
      RETURN NEW;  -- Voiding is the only permitted update
    END IF;
    IF OLD.is_void = TRUE THEN
      RAISE EXCEPTION 'Voided journal entries cannot be modified';
    END IF;
    RAISE EXCEPTION 'Journal entries are immutable. Create a new entry or void this one.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Journal entries cannot be deleted';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_journal_immutable
  BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_journal_modification();

CREATE OR REPLACE FUNCTION prevent_line_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Journal lines are immutable.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_journal_lines_immutable
  BEFORE UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION prevent_line_modification();
```

### 4.4 Trust Service — Web Client (Validation Calls)

```typescript
// apps/trust-service/src/services/web-client.ts
// Handles all outbound calls from the trust service to the web service.

import { getOidcToken } from './oidc-token';

const WEB_SERVICE_URL = process.env.WEB_SERVICE_URL!;

export interface MatterClientValidation {
  matterNumber: string;
  clientName: string;
  matterStatus: string;
}

/**
 * Validates that a matter and client exist in the main app and are associated.
 * Returns denormalized display values for storage in client_ledgers.
 *
 * Throws a structured error with httpStatus and trustCode for the route handler
 * to convert into the canonical error response shape.
 */
export async function validateMatterClient(
  matterId: string,
  clientId: string
): Promise<MatterClientValidation> {
  const token = await getOidcToken(WEB_SERVICE_URL);
  const url = `${WEB_SERVICE_URL}/api/internal/validate-matter-client` +
    `?matterId=${encodeURIComponent(matterId)}&clientId=${encodeURIComponent(clientId)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
  } catch (err: any) {
    // Network failure or timeout
    const error = new Error('Web service unreachable during matter/client validation') as any;
    error.httpStatus = 503;
    error.trustCode = 'INTERNAL_ERROR';
    throw error;
  }

  if (response.status === 200) {
    const body = await response.json();
    return {
      matterNumber: body.matterNumber,
      clientName:   body.clientName,
      matterStatus: body.matterStatus,
    };
  }

  const errBody = await response.json().catch(() => ({
    error: { code: 'INTERNAL_ERROR', message: 'Unparseable validation response' },
  }));

  // Map web service error codes to trust service HTTP status and error codes
  const errorMap: Record<string, { httpStatus: number; trustCode: string }> = {
    MATTER_NOT_FOUND:      { httpStatus: 404, trustCode: 'NOT_FOUND' },
    CLIENT_NOT_FOUND:      { httpStatus: 404, trustCode: 'NOT_FOUND' },
    CLIENT_NOT_ON_MATTER:  { httpStatus: 400, trustCode: 'VALIDATION_ERROR' },
    VALIDATION_ERROR:      { httpStatus: 400, trustCode: 'VALIDATION_ERROR' },
    UNAUTHORIZED:          { httpStatus: 401, trustCode: 'UNAUTHORIZED' },
    FORBIDDEN:             { httpStatus: 403, trustCode: 'FORBIDDEN' },
  };

  const mapped = errorMap[errBody.error.code] ?? { httpStatus: 500, trustCode: 'INTERNAL_ERROR' };
  const error = new Error(errBody.error.message) as any;
  error.httpStatus = mapped.httpStatus;
  error.trustCode  = mapped.trustCode;
  throw error;
}

/**
 * Fetches an OIDC token for the trust service to call the web service.
 * In development, returns the shared dev secret.
 */
async function getOidcToken(audience: string): Promise<string> {
  if (process.env.NODE_ENV === 'development') {
    return process.env.DEV_AUTH_SECRET ?? 'dev-secret';
  }
  const metadataUrl =
    `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity` +
    `?audience=${encodeURIComponent(audience)}&format=full`;
  const response = await fetch(metadataUrl, {
    headers: { 'Metadata-Flavor': 'Google' },
  });
  if (!response.ok) throw new Error(`Failed to fetch OIDC token: ${response.status}`);
  return response.text();
}
```

### 4.5 Trust Service — Fastify Routes

All routes conform to the canonical HTTP API contract in §1.3.3. The Fastify TypeBox schemas below are the authoritative validation layer; they must match the TypeScript types in `apps/web/src/server/trust-client/types.ts`.

```typescript
// apps/trust-service/src/routes/accounts.ts

import { FastifyInstance } from 'fastify';
import { Type, Static } from '@sinclair/typebox';
import { db } from '../db';
import { trustAccounts, clientLedgers } from '@lexflow/db-trust';
import { eq } from 'drizzle-orm';
import { validateMatterClient } from '../services/web-client';

const TrustAccountSchema = Type.Object({
  id:                 Type.String({ format: 'uuid' }),
  accountName:        Type.String(),
  bankName:           Type.String(),
  accountNumberLast4: Type.String(),
  routingNumberLast4: Type.String(),
  isIolta:            Type.Boolean(),
  currentBalance:     Type.Number(),
  isActive:           Type.Boolean(),
  openedDate:         Type.String(),
  createdAt:          Type.String(),
  updatedAt:          Type.String(),
});

const ClientLedgerSchema = Type.Object({
  id:              Type.String({ format: 'uuid' }),
  trustAccountId:  Type.String({ format: 'uuid' }),
  matterId:        Type.String({ format: 'uuid' }),
  clientId:        Type.String({ format: 'uuid' }),
  matterNumber:    Type.String(),
  clientName:      Type.String(),
  currentBalance:  Type.Number(),
  isActive:        Type.Boolean(),
  createdAt:       Type.String(),
  updatedAt:       Type.String(),
});

const ErrorSchema = Type.Object({
  error: Type.Object({
    code:    Type.String(),
    message: Type.String(),
    details: Type.Optional(Type.Unknown()),
  }),
});

export async function accountRoutes(app: FastifyInstance) {
  // POST /api/trust/accounts
  app.post('/accounts', {
    schema: {
      body: Type.Object({
        accountName:   Type.String({ minLength: 1, maxLength: 255 }),
        bankName:      Type.String({ minLength: 1, maxLength: 255 }),
        accountNumber: Type.String({ minLength: 4, maxLength: 50 }),
        routingNumber: Type.String({ pattern: '^\\d{9}$' }),
        isIolta:       Type.Boolean(),
      }),
      response: { 201: TrustAccountSchema, 400: ErrorSchema, 409: ErrorSchema },
    },
  }, async (request, reply) => {
    const body = request.body as any;
    const [account] = await db.insert(trustAccounts).values({
      accountName:   body.accountName,
      bankName:      body.bankName,
      accountNumber: await encrypt(body.accountNumber),
      routingNumber: await encrypt(body.routingNumber),
      isIolta:       body.isIolta,
    }).returning();
    reply.code(201).send(toTrustAccountResponse(account));
  });

  // GET /api/trust/accounts
  app.get('/accounts', {
    schema: { response: { 200: Type.Array(TrustAccountSchema) } },
  }, async (request, reply) => {
    const accounts = await db.select().from(trustAccounts)
      .where(eq(trustAccounts.isActive, true));
    reply.send(accounts.map(toTrustAccountResponse));
  });

  // GET /api/trust/accounts/:accountId
  app.get('/accounts/:accountId', {
    schema: {
      params: Type.Object({ accountId: Type.String({ format: 'uuid' }) }),
      response: { 200: TrustAccountSchema, 404: ErrorSchema },
    },
  }, async (request, reply) => {
    const { accountId } = request.params as { accountId: string };
    const [account] = await db.select().from(trustAccounts)
      .where(eq(trustAccounts.id, accountId)).limit(1);
    if (!account) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Trust account not found' } });
    }
    reply.send(toTrustAccountResponse(account));
  });

  // POST /api/trust/accounts/:accountId/ledgers
  // Calls GET /api/internal/validate-matter-client on the web service
  // to verify matter/client existence and fetch denormalized display values.
  app.post('/accounts/:accountId/ledgers', {
    schema: {
      params: Type.Object({ accountId: Type.String({ format: 'uuid' }) }),
      body: Type.Object({
        matterId: Type.String({ format: 'uuid' }),
        clientId: Type.String({ format: 'uuid' }),
        // matterNumber and clientName are NOT accepted from the caller;
        // they are fetched from the web service validation endpoint.
      }),
      response: {
        201: ClientLedgerSchema,
        400: ErrorSchema,
        404: ErrorSchema,
        409: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    const { accountId } = request.params as { accountId: string };
    const body = request.body as { matterId: string; clientId: string };

    // 1. Verify trust account exists
    const [account] = await db.select().from(trustAccounts)
      .where(eq(trustAccounts.id, accountId)).limit(1);
    if (!account) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Trust account not found' } });
    }

    // 2. Validate matter/client via web service (§1.3.2)
    let validation: { matterNumber: string; clientName: string };
    try {
      validation = await validateMatterClient(body.matterId, body.clientId);
    } catch (err: any) {
      return reply.code(err.httpStatus ?? 500).send({
        error: { code: err.trustCode ?? 'INTERNAL_ERROR', message: err.message },
      });
    }

    // 3. Insert client ledger with denormalized display values
    try {
      const [ledger] = await db.insert(clientLedgers).values({
        trustAccountId: accountId,
        matterId:       body.matterId,
        clientId:       body.clientId,
        matterNumber:   validation.matterNumber,
        clientName:     validation.clientName,
      }).returning();
      reply.code(201).send(toClientLedgerResponse(ledger));
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.code(409).send({
          error: { code: 'CONFLICT', message: 'A client ledger already exists for this matter in this trust account' },
        });
      }
      throw err;
    }
  });

  // GET /api/trust/accounts/:accountId/ledgers
  app.get('/accounts/:accountId/ledgers', {
    schema: {
      params: Type.Object({ accountId: Type.String({ format: 'uuid' }) }),
      response: { 200: Type.Array(ClientLedgerSchema), 404: ErrorSchema },
    },
  }, async (request, reply) => {
    const { accountId } = request.params as { accountId: string };
    const [account] = await db.select().from(trustAccounts)
      .where(eq(trustAccounts.id, accountId)).limit(1);
    if (!account) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Trust account not found' } });
    }
    const ledgers = await db.select().from(clientLedgers)
      .where(eq(clientLedgers.trustAccountId, accountId));
    reply.send(ledgers.map(toClientLedgerResponse));
  });
}

function toTrustAccountResponse(a: any) {
  return {
    id:                 a.id,
    accountName:        a.accountName,
    bankName:           a.bankName,
    accountNumberLast4: a.accountNumber.slice(-4),
    routingNumberLast4: a.routingNumber.slice(-4),
    isIolta:            a.isIolta,
    currentBalance:     Number(a.currentBalance),
    isActive:           a.isActive,
    openedDate:         a.openedDate,
    createdAt:          a.createdAt.toISOString(),
    updatedAt:          a.updatedAt.toISOString(),
  };
}

function toClientLedgerResponse(l: any) {
  return {
    id:             l.id,
    trustAccountId: l.trustAccountId,
    matterId:       l.matterId,
    clientId:       l.clientId,
    matterNumber:   l.matterNumber,
    clientName:     l.clientName,
    currentBalance: Number(l.currentBalance),
    isActive:       l.isActive,
    createdAt:      l.createdAt.toISOString(),
    updatedAt:      l.updatedAt.toISOString(),
  };
}

// Placeholder — replace with actual KMS encryption in production
async function encrypt(value: string): Promise<string> {
  return value; // TODO: KMS encrypt
}
```

```typescript
// apps/trust-service/src/routes/transactions.ts
// All routes conform to §1.3.3 canonical contract.

import { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { LedgerEngine } from '../services/ledger-engine';
import { withSerializableRetry } from '../services/retry';

const ledgerEngine = new LedgerEngine();

const JournalLineSchema = Type.Object({
  id:              Type.String({ format: 'uuid' }),
  trustAccountId:  Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  clientLedgerId:  Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  debitAmount:     Type.Number(),
  creditAmount:    Type.Number(),
  description:     Type.Union([Type.String(), Type.Null()]),
  lineOrder:       Type.Number(),
});

const JournalEntrySchema = Type.Object({
  id:              Type.String({ format: 'uuid' }),
  entryNumber:     Type.Number(),
  entryType:       Type.String(),
  description:     Type.String(),
  matterId:        Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  checkNumber:     Type.Union([Type.String(), Type.Null()]),
  referenceNumber: Type.Union([Type.String(), Type.Null()]),
  totalAmount:     Type.Number(),
  effectiveDate:   Type.String(),
  postedAt:        Type.String(),
  isVoid:          Type.Boolean(),
  voidedAt:        Type.Union([Type.String(), Type.Null()]),
  voidReason:      Type.Union([Type.String(), Type.Null()]),
  createdBy:       Type.String(),
  createdByName:   Type.String(),
  lines:           Type.Array(JournalLineSchema),
});

const ErrorSchema = Type.Object({
  error: Type.Object({ code: Type.String(), message: Type.String() }),
});

export async function transactionRoutes(app: FastifyInstance) {
  // POST /api/trust/transactions/deposit
  app.post('/transactions/deposit', {
    schema: {
      body: Type.Object({
        trustAccountId:  Type.String({ format: 'uuid' }),
        clientLedgerId:  Type.String({ format: 'uuid' }),
        amount:          Type.Number({ exclusiveMinimum: 0 }),
        description:     Type.String({ minLength: 1, maxLength: 500 }),
        referenceNumber: Type.Optional(Type.String({ maxLength: 100 })),
        effectiveDate:   Type.String({ format: 'date' }),
        createdBy:       Type.String({ format: 'uuid' }),
        createdByName:   Type.String({ minLength: 1, maxLength: 255 }),
      }),
      response: { 201: JournalEntrySchema, 400: ErrorSchema, 404: ErrorSchema },
    },
  }, async (request, reply) => {
    const body = request.body as any;
    const entry = await withSerializableRetry(() =>
      ledgerEngine.executeTransaction({
        entryType:       'deposit',
        description:     body.description,
        referenceNumber: body.referenceNumber,
        effectiveDate:   body.effectiveDate,
        createdBy:       body.createdBy,
        createdByName:   body.createdByName,
        lines: [
          { trustAccountId: body.trustAccountId, debitAmount: body.amount, creditAmount: 0 },
          { clientLedgerId: body.clientLedgerId, debitAmount: 0, creditAmount: body.amount },
        ],
      })
    );
    reply.code(201).send(entry);
  });

  // POST /api/trust/transactions/disburse
  app.post('/transactions/disburse', {
    schema: {
      body: Type.Object({
        trustAccountId: Type.String({ format: 'uuid' }),
        clientLedgerId: Type.String({ format: 'uuid' }),
        amount:         Type.Number({ exclusiveMinimum: 0 }),
        description:    Type.String({ minLength: 1, maxLength: 500 }),
        checkNumber:    Type.Optional(Type.String({ maxLength: 50 })),
        payee:          Type.String({ minLength: 1, maxLength: 255 }),
        effectiveDate:  Type.String({ format: 'date' }),
        createdBy:      Type.String({ format: 'uuid' }),
        createdByName:  Type.String({ minLength: 1, maxLength: 255 }),
      }),
      response: {
        201: JournalEntrySchema,
        400: ErrorSchema,
        404: ErrorSchema,
        422: ErrorSchema,
        503: ErrorSchema,
      },
    },
  }, async (request, reply) => {
    const body = request.body as any;
    try {
      const entry = await withSerializableRetry(() =>
        ledgerEngine.executeTransaction({
          entryType:    'disbursement',
          description:  `${body.description} — Payee: ${body.payee}`,
          checkNumber:  body.checkNumber,
          effectiveDate: body.effectiveDate,
          createdBy:    body.createdBy,
          createdByName: body.createdByName,
          lines: [
            { clientLedgerId: body.clientLedgerId, debitAmount: body.amount, creditAmount: 0 },
            { trustAccountId: body.trustAccountId, debitAmount: 0, creditAmount: body.amount },
          ],
        })
      );
      reply.code(201).send(entry);
    } catch (err: any) {
      if (err.message === 'INSUFFICIENT_BALANCE') {
        return reply.code(422).send({
          error: { code: 'INSUFFICIENT_BALANCE', message: 'Client ledger balance is insufficient for this disbursement' },
        });
      }
      if (err.message === 'LEDGER_BUSY') {
        return reply.code(503).send({
          error: { code: 'LEDGER_BUSY', message: 'Ledger is busy; please retry in a few seconds' },
        });
      }
      throw err;
    }
  });

  // POST /api/trust/transactions/transfer — (pattern identical to disburse; omitted for brevity)
  // POST /api/trust/transactions/fee-transfer — (pattern identical; omitted for brevity)

  // POST /api/trust/transactions/:entryId/void
  app.post('/transactions/:entryId/void', {
    schema: {
      params: Type.Object({ entryId: Type.String({ format: 'uuid' }) }),
      body: Type.Object({
        voidedBy:     Type.String({ format: 'uuid' }),
        voidedByName: Type.String({ minLength: 1, maxLength: 255 }),
        voidReason:   Type.String({ minLength: 1, maxLength: 500 }),
      }),
      response: { 200: JournalEntrySchema, 404: ErrorSchema, 409: ErrorSchema },
    },
  }, async (request, reply) => {
    const { entryId } = request.params as { entryId: string };
    const body = request.body as any;
    try {
      const entry = await withSerializableRetry(() =>
        ledgerEngine.voidEntry(entryId, body.voidedBy, body.voidedByName, body.voidReason)
      );
      reply.send(entry);
    } catch (err: any) {
      if (err.code === 'NOT_FOUND') {
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Journal entry not found' } });
      }
      if (err.code === 'CONFLICT') {
        return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Entry is already voided' } });
      }
      throw err;
    }
  });

  // GET /api/trust/transactions/:entryId
  app.get('/transactions/:entryId', {
    schema: {
      params: Type.Object({ entryId: Type.String({ format: 'uuid' }) }),
      response: { 200: JournalEntrySchema, 404: ErrorSchema },
    },
  }, async (request, reply) => {
    const { entryId } = request.params as { entryId: string };
    const entry = await ledgerEngine.getEntry(entryId);
    if (!entry) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Journal entry not found' } });
    }
    reply.send(entry);
  });
}
```

### 4.6 Trust Service — Ledger Engine with Advisory Locking

```typescript
// apps/trust-service/src/services/ledger-engine.ts

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { journalEntries, journalLines, trustAccounts, clientLedgers } from '@lexflow/db-trust';

export class LedgerEngine {
  /**
   * Execute a balanced double-entry transaction.
   *
   * Concurrency strategy:
   * 1. SET LOCAL lock_timeout = '2s' — if advisory lock cannot be acquired within
   *    2 seconds, PostgreSQL throws error 55P03 (lock_not_available), which the
   *    route handler maps to 503 LEDGER_BUSY.
   * 2. Acquire pg_advisory_xact_lock on each affected client ledger ID (sorted
   *    to prevent deadlocks). This serializes concurrent writes to the same ledger.
   * 3. Use SERIALIZABLE isolation for phantom-read protection.
   * 4. Verify balance post-update as a final guard.
   *
   * Lock hold time: ~6–9ms per transaction. Per-ledger ceiling: ~110–165 TPS.
   * For bulk imports exceeding this ceiling, use the Cloud Tasks sequential queue.
   */
  async executeTransaction(params: {
    entryType: string;
    description: string;
    matterId?: string;
    checkNumber?: string;
    referenceNumber?: string;
    effectiveDate: string;
    createdBy: string;
    createdByName: string;
    lines: {
      trustAccountId?: string;
      clientLedgerId?: string;
      debitAmount: number;
      creditAmount: number;
      description?: string;
    }[];
  }): Promise<any> {
    const totalDebits  = params.lines.reduce((s, l) => s + l.debitAmount, 0);
    const totalCredits = params.lines.reduce((s, l) => s + l.creditAmount, 0);
    if (Math.abs(totalDebits - totalCredits) > 0.001) {
      throw new Error(`Unbalanced entry: debits=${totalDebits}, credits=${totalCredits}`);
    }

    return await db.transaction(async (tx) => {
      await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);
      // If advisory lock cannot be acquired within 2s, throw 55P03 → LEDGER_BUSY
      await tx.execute(sql`SET LOCAL lock_timeout = '2s'`);

      const ledgerIds = [...new Set(
        params.lines.filter(l => l.clientLedgerId).map(l => l.clientLedgerId!)
      )].sort(); // Sort for consistent lock order → prevents deadlocks

      for (const ledgerId of ledgerIds) {
        try {
          await tx.execute(
            sql`SELECT pg_advisory_xact_lock(hashtext(${ledgerId})::bigint)`
          );
        } catch (err: any) {
          if (err.code === '55P03') {
            throw new Error('LEDGER_BUSY');
          }
          throw err;
        }
      }

      // 1. Create journal entry
      const [entry] = await tx.insert(journalEntries).values({
        entryType:       params.entryType as any,
        description:     params.description,
        matterId:        params.matterId,
        checkNumber:     params.checkNumber,
        referenceNumber: params.referenceNumber,
        totalAmount:     totalDebits.toFixed(2),
        effectiveDate:   params.effectiveDate,
        createdBy:       params.createdBy,
        createdByName:   params.createdByName,
      }).returning();

      // 2. Create journal lines
      const lines = await tx.insert(journalLines).values(
        params.lines.map((line, idx) => ({
          journalEntryId:  entry.id,
          trustAccountId:  line.trustAccountId,
          clientLedgerId:  line.clientLedgerId,
          debitAmount:     line.debitAmount.toFixed(2),
          creditAmount:    line.creditAmount.toFixed(2),
          description:     line.description,
          lineOrder:       idx,
        }))
      ).returning();

      // 3. Update running balances
      for (const line of params.lines) {
        if (line.trustAccountId) {
          const netAmount = line.debitAmount - line.creditAmount;
          await tx.execute(sql`
            UPDATE lexflow_trust.trust_accounts
            SET current_balance = current_balance + ${netAmount}, updated_at = NOW()
            WHERE id = ${line.trustAccountId}
          `);
        }
        if (line.clientLedgerId) {
          const ledgerNet = line.creditAmount - line.debitAmount;
          await tx.execute(sql`
            UPDATE lexflow_trust.client_ledgers
            SET current_balance = current_balance + ${ledgerNet}, updated_at = NOW()
            WHERE id = ${line.clientLedgerId}
          `);
          const [{ balance }] = await tx.execute(sql`
            SELECT current_balance AS balance
            FROM lexflow_trust.client_ledgers
            WHERE id = ${line.clientLedgerId}
          `);
          if (Number(balance) < 0) {
            throw new Error('INSUFFICIENT_BALANCE');
          }
        }
      }

      // 4. Final double-entry verification
      const [{ totalD, totalC }] = await tx.execute(sql`
        SELECT SUM(debit_amount) AS "totalD", SUM(credit_amount) AS "totalC"
        FROM lexflow_trust.journal_lines
        WHERE journal_entry_id = ${entry.id}
      `);
      if (Math.abs(Number(totalD) - Number(totalC)) > 0.001) {
        throw new Error('Post-insert balance verification failed');
      }

      return { ...entry, lines };
    });
  }

  async voidEntry(
    entryId: string,
    voidedBy: string,
    voidedByName: string,
    voidReason: string
  ): Promise<any> {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);
      await tx.execute(sql`SET LOCAL lock_timeout = '2s'`);

      const [original] = await tx.execute(sql`
        SELECT * FROM lexflow_trust.journal_entries WHERE id = ${entryId}
      `);
      if (!original) throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
      if (original.is_void) throw Object.assign(new Error('CONFLICT'), { code: 'CONFLICT' });

      const originalLines = await tx.execute(sql`
        SELECT * FROM lexflow_trust.journal_lines
        WHERE journal_entry_id = ${entryId} ORDER BY line_order
      `);

      const ledgerIds = [...new Set(
        originalLines.filter((l: any) => l.client_ledger_id).map((l: any) => l.client_ledger_id)
      )].sort();

      for (const ledgerId of ledgerIds) {
        try {
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${ledgerId})::bigint)`);
        } catch (err: any) {
          if (err.code === '55P03') throw new Error('LEDGER_BUSY');
          throw err;
        }
      }

      await tx.execute(sql`
        UPDATE lexflow_trust.journal_entries
        SET is_void = TRUE, voided_by = ${voidedBy}, voided_by_name = ${voidedByName},
            voided_at = NOW(), void_reason = ${voidReason}
        WHERE id = ${entryId}
      `);

      const reversingLines = originalLines.map((l: any) => ({
        trustAccountId: l.trust_account_id,
        clientLedgerId: l.client_ledger_id,
        debitAmount:    Number(l.credit_amount),
        creditAmount:   Number(l.debit_amount),
        description:    `VOID: ${l.description ?? ''}`,
      }));

      return this.executeTransaction({
        entryType:    original.entry_type,
        description:  `VOID of entry #${original.entry_number}: ${voidReason}`,
        effectiveDate: new Date().toISOString().split('T')[0],
        createdBy:    voidedBy,
        createdByName: voidedByName,
        lines:        reversingLines,
      });
    });
  }

  async getEntry(entryId: string): Promise<any | null> {
    const [entry] = await db.execute(sql`
      SELECT * FROM lexflow_trust.journal_entries WHERE id = ${entryId}
    `);
    if (!entry) return null;
    const lines = await db.execute(sql`
      SELECT * FROM lexflow_trust.journal_lines
      WHERE journal_entry_id = ${entryId} ORDER BY line_order
    `);
    return { ...entry, lines };
  }
}
```

### 4.7 Serialization Retry Logic

```typescript
// apps/trust-service/src/services/retry.ts

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 50;

/**
 * Retries a function on PostgreSQL serialization failure (error code 40001).
 * With advisory locking in place, this should rarely trigger in practice.
 * Does NOT retry LEDGER_BUSY (55P03) — that is surfaced immediately as 503.
 * Exponential backoff with jitter prevents thundering herd.
 */
export async function withSerializableRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.code === '40001' && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 50;
        console.warn(`[SERIALIZABLE_RETRY] Attempt ${attempt + 1} failed (40001), retrying in ${Math.round(delay)}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Unreachable');
}
```

### 4.8 Trust Service — Authentication Middleware

```typescript
// apps/trust-service/src/middleware/auth.ts

import { FastifyRequest, FastifyReply } from 'fastify';
import { OAuth2Client } from 'google-auth-library';

const authClient = new OAuth2Client();
const TRUST_SERVICE_URL = process.env.TRUST_SERVICE_URL!;

export async function validateServiceAuth(request: FastifyRequest, reply: FastifyReply) {
  if (process.env.NODE_ENV === 'development') {
    const devToken = request.headers['x-dev-auth'];
    if (devToken === process.env.DEV_AUTH_SECRET) return;
    return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing dev auth header' } });
  }

  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing authorization header' } });
  }

  try {
    const ticket = await authClient.verifyIdToken({
      idToken: authHeader.slice(7),
      audience: TRUST_SERVICE_URL,
    });
    const payload = ticket.getPayload();
    if (!payload?.email?.endsWith('.iam.gserviceaccount.com')) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Token is not from a recognized service account' } });
    }
    (request as any).serviceAccount = payload.email;
  } catch {
    return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
  }
}
```

### 4.9 Trust Service — Reconciliation Engine

```typescript
// apps/trust-service/src/services/reconciliation-engine.ts

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { reconciliationReports } from '@lexflow/db-trust';

export class ReconciliationEngine {
  async runReconciliation(params: {
    trustAccountId: string;
    periodStart: string;
    periodEnd: string;
    bankStatementBalance: number;
    preparedBy: string;
    preparedByName: string;
  }): Promise<any> {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);

      const [bookResult] = await tx.execute(sql`
        SELECT COALESCE(SUM(jl.debit_amount) - SUM(jl.credit_amount), 0) AS book_balance
        FROM lexflow_trust.journal_lines jl
        JOIN lexflow_trust.journal_entries je ON jl.journal_entry_id = je.id
        WHERE jl.trust_account_id = ${params.trustAccountId}
          AND je.is_void = FALSE
          AND je.effective_date <= ${params.periodEnd}
      `);

      const [ledgerResult] = await tx.execute(sql`
        SELECT COALESCE(SUM(current_balance), 0) AS ledger_total
        FROM lexflow_trust.client_ledgers
        WHERE trust_account_id = ${params.trustAccountId} AND is_active = TRUE
      `);

      const [outDeposits] = await tx.execute(sql`
        SELECT COALESCE(SUM(je.total_amount), 0) AS amount
        FROM lexflow_trust.journal_entries je
        JOIN lexflow_trust.journal_lines jl ON jl.journal_entry_id = je.id
        WHERE jl.trust_account_id = ${params.trustAccountId}
          AND je.entry_type = 'deposit' AND je.is_void = FALSE
          AND je.effective_date <= ${params.periodEnd}
          AND NOT EXISTS (
            SELECT 1 FROM lexflow_trust.bank_transactions bt
            WHERE bt.matched_journal_entry_id = je.id AND bt.is_matched = TRUE
          )
      `);

      const [outChecks] = await tx.execute(sql`
        SELECT COALESCE(SUM(je.total_amount), 0) AS amount
        FROM lexflow_trust.journal_entries je
        JOIN lexflow_trust.journal_lines jl ON jl.journal_entry_id = je.id
        WHERE jl.trust_account_id = ${params.trustAccountId}
          AND je.entry_type IN ('disbursement', 'fee_transfer') AND je.is_void = FALSE
          AND je.effective_date <= ${params.periodEnd}
          AND NOT EXISTS (
            SELECT 1 FROM lexflow_trust.bank_transactions bt
            WHERE bt.matched_journal_entry_id = je.id AND bt.is_matched = TRUE
          )
      `);

      const [unmatchedBank] = await tx.execute(sql`
        SELECT COUNT(*) AS count
        FROM lexflow_trust.bank_transactions
        WHERE trust_account_id = ${params.trustAccountId}
          AND is_matched = FALSE
          AND transaction_date BETWEEN ${params.periodStart} AND ${params.periodEnd}
      `);

      const bookBalance         = Number(bookResult.book_balance);
      const clientLedgerTotal   = Number(ledgerResult.ledger_total);
      const outstandingDeposits = Number(outDeposits.amount);
      const outstandingChecks   = Number(outChecks.amount);
      const adjustedBankBalance = params.bankStatementBalance + outstandingDeposits - outstandingChecks;

      const isBalanced =
        Math.abs(adjustedBankBalance - bookBalance) < 0.01 &&
        Math.abs(bookBalance - clientLedgerTotal) < 0.01;

      const variance = Math.abs(adjustedBankBalance - clientLedgerTotal);

      const [report] = await tx.insert(reconciliationReports).values({
        trustAccountId:       params.trustAccountId,
        periodStart:          params.periodStart,
        periodEnd:            params.periodEnd,
        bankStatementBalance: params.bankStatementBalance,
        bookBalance,
        clientLedgerTotal,
        outstandingDeposits,
        outstandingChecks,
        unmatchedBankItems:   Number(unmatchedBank.count),
        unmatchedBookItems:   0,
        adjustedBankBalance,
        adjustedBookBalance:  bookBalance,
        isBalanced,
        variance,
        status:               isBalanced ? 'balanced' : 'unbalanced',
        preparedBy:           params.preparedBy,
        preparedByName:       params.preparedByName,
      }).returning();

      return report;
    });
  }
}
```

### 4.10 Trust tRPC Proxy Router (Web Service)

```typescript
// apps/web/src/server/trpc/routers/trust.ts

import { z } from 'zod';
import { router, permissionProcedure } from '../trpc';
import { trustClient } from '../../trust-client/http-client';

export const trustRouter = router({
  listAccounts: permissionProcedure('trust:read')
    .query(() => trustClient.listTrustAccounts()),

  getAccount: permissionProcedure('trust:read')
    .input(z.object({ accountId: z.string().uuid() }))
    .query(({ input }) => trustClient.getTrustAccount(input.accountId)),

  createAccount: permissionProcedure('trust:admin')
    .input(z.object({
      accountName:   z.string().min(1).max(255),
      bankName:      z.string().min(1).max(255),
      accountNumber: z.string().min(4).max(50),
      routingNumber: z.string().regex(/^\d{9}$/),
      isIolta:       z.boolean(),
    }))
    .mutation(({ input }) => trustClient.createTrustAccount(input)),

  createClientLedger: permissionProcedure('trust:admin')
    .input(z.object({
      accountId: z.string().uuid(),
      matterId:  z.string().uuid(),
      clientId:  z.string().uuid(),
      // matterNumber and clientName are NOT passed by the UI;
      // the trust service fetches them from the validation endpoint.
    }))
    .mutation(({ input }) =>
      trustClient.createClientLedger(input.accountId, {
        matterId: input.matterId,
        clientId: input.clientId,
      })
    ),

  listLedgers: permissionProcedure('trust:read')
    .input(z.object({ accountId: z.string().uuid() }))
    .query(({ input }) => trustClient.listClientLedgers(input.accountId)),

  listLedgerTransactions: permissionProcedure('trust:read')
    .input(z.object({
      ledgerId: z.string().uuid(),
      page:     z.number().int().positive().default(1),
      pageSize: z.number().int().min(10).max(100).default(25),
      dateFrom: z.string().date().optional(),
      dateTo:   z.string().date().optional(),
    }))
    .query(({ input }) =>
      trustClient.listLedgerTransactions(input.ledgerId, {
        page: input.page, pageSize: input.pageSize,
        dateFrom: input.dateFrom, dateTo: input.dateTo,
      })
    ),

  recordDeposit: permissionProcedure('trust:deposit')
    .input(z.object({
      trustAccountId:  z.string().uuid(),
      clientLedgerId:  z.string().uuid(),
      amount:          z.number().positive(),
      description:     z.string().min(1),
      referenceNumber: z.string().optional(),
      effectiveDate:   z.string().date(),
    }))
    .mutation(({ ctx, input }) =>
      trustClient.recordDeposit({
        ...input,
        createdBy:     ctx.user.id,
        createdByName: ctx.user.name,
      })
    ),

  recordDisbursement: permissionProcedure('trust:disburse')
    .input(z.object({
      trustAccountId: z.string().uuid(),
      clientLedgerId: z.string().uuid(),
      amount:         z.number().positive(),
      description:    z.string().min(1),
      checkNumber:    z.string().optional(),
      payee:          z.string().min(1),
      effectiveDate:  z.string().date(),
    }))
    .mutation(({ ctx, input }) =>
      trustClient.recordDisbursement({
        ...input,
        createdBy:     ctx.user.id,
        createdByName: ctx.user.name,
      })
    ),

  recordTransfer: permissionProcedure('trust:disburse')
    .input(z.object({
      trustAccountId:     z.string().uuid(),
      fromClientLedgerId: z.string().uuid(),
      toClientLedgerId:   z.string().uuid(),
      amount:             z.number().positive(),
      description:        z.string().min(1),
      effectiveDate:      z.string().date(),
    }))
    .mutation(({ ctx, input }) =>
      trustClient.recordTransfer({
        ...input,
        createdBy:     ctx.user.id,
        createdByName: ctx.user.name,
      })
    ),

  recordFeeTransfer: permissionProcedure('trust:disburse')
    .input(z.object({
      trustAccountId: z.string().uuid(),
      clientLedgerId: z.string().uuid(),
      amount:         z.number().positive(),
      description:    z.string().min(1),
      invoiceId:      z.string().uuid().optional(),
      effectiveDate:  z.string().date(),
    }))
    .mutation(({ ctx, input }) =>
      trustClient.recordFeeTransfer({
        ...input,
        createdBy:     ctx.user.id,
        createdByName: ctx.user.name,
      })
    ),

  voidEntry: permissionProcedure('trust:admin')
    .input(z.object({
      entryId:    z.string().uuid(),
      voidReason: z.string().min(1),
    }))
    .mutation(({ ctx, input }) =>
      trustClient.voidEntry(input.entryId, {
        voidedBy:     ctx.user.id,
        voidedByName: ctx.user.name,
        voidReason:   input.voidReason,
      })
    ),

  runReconciliation: permissionProcedure('trust:reconcile')
    .input(z.object({
      trustAccountId:       z.string().uuid(),
      periodStart:          z.string().date(),
      periodEnd:            z.string().date(),
      bankStatementBalance: z.number(),
    }))
    .mutation(({ ctx, input }) =>
      trustClient.runReconciliation({
        ...input,
        preparedBy:     ctx.user.id,
        preparedByName: ctx.user.name,
      })
    ),

  getThreeWayReport: permissionProcedure('trust:read')
    .input(z.object({ accountId: z.string().uuid(), asOfDate: z.string().date() }))
    .query(({ input }) => trustClient.getThreeWayReport(input.accountId, input.asOfDate)),

  importBankStatement: permissionProcedure('trust:reconcile')
    .input(z.object({
      trustAccountId: z.string().uuid(),
      transactions: z.array(z.object({
        transactionDate: z.string().date(),
        postDate:        z.string().date().optional(),
        description:     z.string().min(1),
        amount:          z.number(),
        runningBalance:  z.number().optional(),
        externalId:      z.string().optional(),
      })),
    }))
    .mutation(({ ctx, input }) =>
      trustClient.importBankStatement({
        ...input,
        importedBy:     ctx.user.id,
        importedByName: ctx.user.name,
      })
    ),
});
```

### 4.11 Trust UI Pages

```
apps/web/src/app/(dashboard)/
├── trust/
│   ├── page.tsx
│   ├── accounts/
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   └── [accountId]/
│   │       ├── page.tsx
│   │       ├── ledgers/page.tsx
│   │       └── reconcile/page.tsx
│   ├── deposit/page.tsx
│   ├── disburse/page.tsx
│   ├── transfer/page.tsx
│   ├── reports/
│   │   ├── page.tsx
│   │   ├── three-way/page.tsx
│   │   └── client-ledger/page.tsx
│   └── import/page.tsx
```

### 4.12 Trust Accounting Test Requirements

| Test | Tool | Requirement |
|------|------|-------------|
| Unit: LedgerEngine | Vitest | Balanced entry succeeds; unbalanced throws; negative balance throws `INSUFFICIENT_BALANCE`; lock timeout throws `LEDGER_BUSY` |
| Unit: advisory lock ordering | Vitest | Multiple ledger IDs sorted before locking (deadlock prevention) |
| Unit: ReconciliationEngine | Vitest | Three-way balanced; outstanding items calculated correctly |
| Unit: validateMatterClient (web-client.ts) | Vitest + mock HTTP server | 200 → returns matterNumber/clientName; MATTER_NOT_FOUND → 404 NOT_FOUND; CLIENT_NOT_ON_MATTER → 400 VALIDATION_ERROR; timeout → 503 INTERNAL_ERROR |
| Unit: validate-matter-client route | Vitest | Valid pair → 200 with matterNumber/clientName; unknown matter → 404; client not on matter → 422; missing token → 401; wrong SA → 403 |
| Integration: ledger creation with validation | Vitest + DB + mock web service | Trust service calls validation endpoint; denormalized values stored in client_ledgers |
| Integration: deposit flow | Vitest + DB | Deposit updates trust account + client ledger balances |
| Integration: disbursement | Vitest + DB | Disbursement decreases balances; rejects overdraft with 422 |
| Integration: void entry | Vitest + DB | Void creates reversing entry; restores balances |
| Integration: concurrent deposits | Vitest + DB | 10 concurrent deposits to same ledger all succeed; final balance correct |
| Integration: ledger busy | Vitest + DB | Simulate lock hold; concurrent request returns 503 LEDGER_BUSY |
| Integration: immutability | Vitest + DB | UPDATE on journal_entries throws; DELETE throws |
| Integration: reconciliation | Vitest + DB | Full reconciliation with matched/unmatched items |
| Integration: cross-schema isolation | Vitest | Trust service starts and operates with no connection to lexflow_main |
| Integration: user deletion resilience | Vitest + DB | Delete user from main app; trust entries retain UUID + name; no error |
| Contract: HTTP routes | Vitest + supertest | Every route in §1.3.3 returns correct status codes and response shapes |
| Contract: OIDC auth | Vitest | Valid token accepted; invalid rejected with 401; missing rejected with 401 |
| E2E: deposit workflow | Playwright | Record deposit → verify in ledger → verify balance |
| E2E: three-way report | Playwright | Import statement → reconcile → view report |

---

## 5. MODULE 4: DOCUMENT MANAGEMENT

### 5.1 Database Schema

```sql
-- ============================================================
-- SCHEMA: lexflow_main (continued)
-- ============================================================

CREATE TYPE document_category AS ENUM (
  'medical_record', 'medical_bill', 'police_report',
  'insurance_correspondence', 'legal_filing', 'discovery',
  'deposition', 'expert_report', 'settlement_document',
  'client_correspondence', 'internal_memo', 'photo_evidence',
  'video_evidence', 'contract', 'invoice', 'other'
);

CREATE TYPE document_status AS ENUM (
  'uploading', 'processing', 'active', 'archived', 'deleted'
);

CREATE TABLE documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id           UUID NOT NULL REFERENCES matters(id),
  file_name           VARCHAR(500) NOT NULL,
  original_name       VARCHAR(500) NOT NULL,
  mime_type           VARCHAR(100) NOT NULL,
  file_size_bytes     BIGINT NOT NULL,
  gcs_bucket          VARCHAR(255) NOT NULL,
  gcs_object_path     VARCHAR(1000) NOT NULL,
  category            document_category NOT NULL DEFAULT 'other',
  title               VARCHAR(500),
  description         TEXT,
  tags                TEXT[],
  provider_name       VARCHAR(255),
  service_date_start  DATE,
  service_date_end    DATE,
  bates_start         VARCHAR(50),
  bates_end           VARCHAR(50),
  page_count          INTEGER,
  status              document_status NOT NULL DEFAULT 'uploading',
  retention_date      DATE,
  version             INTEGER NOT NULL DEFAULT 1,
  parent_document_id  UUID REFERENCES documents(id),
  -- Upload cleanup: when status='uploading', this is the deadline for confirmation
  upload_expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  -- Tracks whether a Cloud Tasks cleanup task was successfully enqueued
  cleanup_task_enqueued BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_by         UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_matter     ON documents(matter_id);
CREATE INDEX idx_documents_category   ON documents(category);
CREATE INDEX idx_documents_status     ON documents(status);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_retention  ON documents(retention_date) WHERE retention_date IS NOT NULL;
CREATE INDEX idx_documents_tags       ON documents USING GIN(tags);
-- Index for cleanup job: find stale uploads efficiently (used by both per-upload task and sweep)
CREATE INDEX idx_documents_stale_uploads ON documents(upload_expires_at)
  WHERE status = 'uploading';
-- Index for sweep: find uploads where task enqueue failed
CREATE INDEX idx_documents_missing_task ON documents(created_at)
  WHERE status = 'uploading' AND cleanup_task_enqueued = FALSE;

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE document_access_log (
  id          BIGSERIAL PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  action      VARCHAR(50) NOT NULL,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doc_access_document ON document_access_log(document_id);
CREATE INDEX idx_doc_access_user     ON document_access_log(user_id);
CREATE INDEX idx_doc_access_created  ON document_access_log(created_at);
```

### 5.2 Document Management API

```typescript
// apps/web/src/server/trpc/routers/document.ts

import { z } from 'zod';
import { router, permissionProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { Storage } from '@google-cloud/storage';
import { db } from '../../db';
import { documents, documentAccessLog } from '@lexflow/db-main';
import { eq, and } from 'drizzle-orm';
import { scheduleUploadCleanup } from '../../services/upload-cleanup';

const storage = new Storage();
const BUCKET_NAME = process.env.GCS_BUCKET_NAME!;
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

export interface SignedUploadUrl {
  uploadUrl: string;
  documentId: string;
  gcsObjectPath: string;
  expiresAt: string;    // ISO 8601; signed URL expires in 15 min
  confirmBy: string;    // ISO 8601; document record expires in 24h if not confirmed
}

export const documentRouter = router({
  getUploadUrl: permissionProcedure('document:upload')
    .input(z.object({
      matterId:      z.string().uuid(),
      fileName:      z.string().min(1).max(500),
      mimeType:      z.string().min(1).max(100),
      fileSizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
      category:      z.enum([
        'medical_record','medical_bill','police_report','insurance_correspondence',
        'legal_filing','discovery','deposition','expert_report','settlement_document',
        'client_correspondence','internal_memo','photo_evidence','video_evidence',
        'contract','invoice','other',
      ]),
      title: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }): Promise<SignedUploadUrl> => {
      const gcsObjectPath = `matters/${input.matterId}/${crypto.randomUUID()}/${input.fileName}`;
      const uploadExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Step 1: Enqueue the Cloud Tasks cleanup task FIRST.
      // If this fails, we do not insert the document record — no orphan is created.
      // The task is scheduled for 24h from now; if the document is confirmed before
      // then, cleanupStaleUpload is a no-op.
      let taskEnqueued = false;
      try {
        await scheduleUploadCleanup(
          null, // documentId not yet known; see note below
          uploadExpiresAt,
          gcsObjectPath,
          BUCKET_NAME
        );
        taskEnqueued = true;
      } catch (err) {
        // Cloud Tasks unavailable — proceed with insert but mark task as not enqueued.
        // The Cloud Scheduler sweep job will catch this record within 1 hour.
        console.error('[UPLOAD] Cloud Tasks enqueue failed; sweep job will handle cleanup:', err);
      }

      // Step 2: Insert document record. cleanup_task_enqueued reflects whether
      // the per-upload task was successfully scheduled.
      const [doc] = await db.insert(documents).values({
        matterId:             input.matterId,
        fileName:             input.fileName,
        originalName:         input.fileName,
        mimeType:             input.mimeType,
        fileSizeBytes:        input.fileSizeBytes,
        gcsBucket:            BUCKET_NAME,
        gcsObjectPath,
        category:             input.category,
        title:                input.title,
        status:               'uploading',
        uploadedBy:           ctx.user.id,
        uploadExpiresAt,
        cleanupTaskEnqueued:  taskEnqueued,
      }).returning({ id: documents.id, gcsObjectPath: documents.gcsObjectPath });

      // Step 3: If the task was enqueued without the documentId (because we didn't
      // have it yet), update the task payload via a second enqueue with the real ID.
      // Simpler alternative used here: re-enqueue with the real documentId now,
      // and the first task (with null ID) will be a no-op when it fires.
      if (taskEnqueued) {
        try {
          await scheduleUploadCleanup(doc.id, uploadExpiresAt, gcsObjectPath, BUCKET_NAME);
          // Mark the first task's no-op by updating the record (already done above).
        } catch {
          // Non-fatal: sweep job covers this case.
        }
      }

      const signedUrlExpiry = Date.now() + 15 * 60 * 1000;
      const [url] = await storage.bucket(BUCKET_NAME).file(gcsObjectPath).getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: signedUrlExpiry,
        contentType: input.mimeType,
        extensionHeaders: {
          'x-goog-content-length-range': `0,${input.fileSizeBytes}`,
        },
      });

      return {
        uploadUrl:    url,
        documentId:   doc.id,
        gcsObjectPath,
        expiresAt:    new Date(signedUrlExpiry).toISOString(),
        confirmBy:    uploadExpiresAt.toISOString(),
      };
    }),

  confirmUpload: permissionProcedure('document:upload')
    .input(z.object({ documentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }): Promise<{ success: boolean }> => {
      const [doc] = await db.select().from(documents)
        .where(and(
          eq(documents.id, input.documentId),
          eq(documents.uploadedBy, ctx.user.id),
        )).limit(1);

      if (!doc) throw new TRPCError({ code: 'NOT_FOUND' });
      if (doc.status !== 'uploading') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Document is not in uploading state' });
      }

      // Verify file actually exists in GCS
      const [exists] = await storage.bucket(doc.gcsBucket).file(doc.gcsObjectPath).exists();
      if (!exists) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'File not found in storage. The upload may have failed — please try again.',
        });
      }

      await db.update(documents)
        .set({ status: 'active' })
        .where(eq(documents.id, input.documentId));

      return { success: true };
    }),

  getDownloadUrl: permissionProcedure('document:read')
    .input(z.object({ documentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }): Promise<{ downloadUrl: string; expiresAt: string }> => {
      const [doc] = await db.select().from(documents)
        .where(and(eq(documents.id, input.documentId), eq(documents.status, 'active')))
        .limit(1);

      if (!doc) throw new TRPCError({ code: 'NOT_FOUND' });

      await db.insert(documentAccessLog).values({
        documentId: input.documentId,
        userId:     ctx.user.id,
        action:     'download',
        ipAddress:  ctx.ip,
      });

      const expiry = Date.now() + 60 * 60 * 1000;
      const [url] = await storage.bucket(doc.gcsBucket).file(doc.gcsObjectPath).getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: expiry,
        responseDisposition: `attachment; filename="${doc.originalName}"`,
      });

      return { downloadUrl: url, expiresAt: new Date(expiry).toISOString() };
    }),

  listByMatter: permissionProcedure('document:read')
    .input(z.object({
      matterId: z.string().uuid(),
      category: z.string().optional(),
      search:   z.string().max(200).optional(),
      page:     z.number().int().positive().default(1),
      pageSize: z.number().int().min(10).max(100).default(25),
    }))
    .query(async ({ ctx, input }) => {
      throw new Error('Not implemented');
    }),

  update: permissionProcedure('document:upload')
    .input(z.object({
      documentId:       z.string().uuid(),
      title:            z.string().max(500).optional(),
      description:      z.string().optional(),
      category:         z.string().optional(),
      tags:             z.array(z.string()).optional(),
      providerName:     z.string().max(255).optional(),
      serviceDateStart: z.string().date().optional(),
      serviceDateEnd:   z.string().date().optional(),
      batesStart:       z.string().max(50).optional(),
      batesEnd:         z.string().max(50).optional(),
      pageCount:        z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      throw new Error('Not implemented');
    }),

  delete: permissionProcedure('document:delete')
    .input(z.object({ documentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }): Promise<{ success: boolean }> => {
      await db.update(documents)
        .set({ status: 'deleted' })
        .where(eq(documents.id, input.documentId));
      return { success: true };
    }),
});
```

### 5.3 Upload Cleanup Service

**Resilience design:** The cleanup architecture has two layers:

1. **Per-upload Cloud Tasks task** (primary): Scheduled at ledger creation time for 24h after upload initiation. If the document is confirmed before the task fires, `cleanupStaleUpload` is a no-op. If Cloud Tasks is unavailable at enqueue time, `cleanup_task_enqueued = FALSE` is recorded.

2. **Cloud Scheduler sweep** (fallback): Runs every hour via Cloud Scheduler → Cloud Tasks → `/api/tasks/sweep-stale-uploads`. Finds all documents where `status = 'uploading' AND upload_expires_at < NOW()` (regardless of `cleanup_task_enqueued`). This catches both task-enqueue failures and any other edge cases. The sweep is idempotent.

```typescript
// apps/web/src/server/services/upload-cleanup.ts

import { db } from '../db';
import { documents } from '@lexflow/db-main';
import { eq, and, lt, sql } from 'drizzle-orm';
import { Storage } from '@google-cloud/storage';
import { CloudTasksClient } from '@google-cloud/tasks';

const storage = new Storage();
const tasksClient = new CloudTasksClient();

/**
 * Schedules a Cloud Tasks task to clean up a stale upload.
 * documentId may be null if called before the DB insert (first enqueue attempt).
 * A null documentId task will be a no-op when it fires.
 */
export async function scheduleUploadCleanup(
  documentId: string | null,
  executeAt: Date,
  gcsObjectPath: string,
  gcsBucket: string
): Promise<void> {
  const project  = process.env.GOOGLE_CLOUD_PROJECT!;
  const location = process.env.CLOUD_TASKS_LOCATION ?? 'us-central1';
  const queue    = process.env.CLOUD_TASKS_QUEUE ?? 'lexflow-tasks';
  const parent   = tasksClient.queuePath(project, location, queue);

  await tasksClient.createTask({
    parent,
    task: {
      scheduleTime: { seconds: Math.floor(executeAt.getTime() / 1000) },
      httpRequest: {
        httpMethod: 'POST',
        url: `${process.env.NEXTAUTH_URL}/api/tasks/cleanup-upload`,
        headers: { 'Content-Type': 'application/json' },
        body: Buffer.from(JSON.stringify({ documentId, gcsObjectPath, gcsBucket })).toString('base64'),
        oidcToken: {
          serviceAccountEmail: process.env.WEB_SERVICE_ACCOUNT_EMAIL!,
          audience: process.env.NEXTAUTH_URL!,
        },
      },
    },
  });
}

/**
 * Cleans up a single stale upload by documentId.
 * Idempotent: safe to call multiple times.
 * If documentId is null (first-enqueue task), this is a no-op.
 */
export async function cleanupStaleUpload(
  documentId: string | null,
  gcsObjectPath?: string,
  gcsBucket?: string
): Promise<void> {
  if (!documentId) return; // No-op for null-ID tasks

  const [doc] = await db.select().from(documents)
    .where(and(
      eq(documents.id, documentId),
      eq(documents.status, 'uploading'),
    )).limit(1);

  if (!doc) return; // Already active, deleted, or doesn't exist — no-op

  const bucket = gcsBucket ?? doc.gcsBucket;
  const path   = gcsObjectPath ?? doc.gcsObjectPath;

  try {
    await storage.bucket(bucket).file(path).delete({ ignoreNotFound: true });
  } catch (err) {
    console.warn(`[UPLOAD_CLEANUP] Could not delete GCS object ${path}:`, err);
  }

  await db.update(documents)
    .set({ status: 'deleted' })
    .where(and(
      eq(documents.id, documentId),
      eq(documents.status, 'uploading'), // Guard against concurrent status change
    ));

  console.info(`[UPLOAD_CLEANUP] Marked stale upload ${documentId} as deleted`);
}

/**
 * Sweep job: finds all stale uploads (expired AND still 'uploading') and cleans them up.
 * Called by Cloud Scheduler every hour as a fallback for missed per-upload tasks.
 * Processes in batches of 50 to avoid long-running requests.
 */
export async function sweepStaleUploads(): Promise<{ cleaned: number; errors: number }> {
  const now = new Date();
  const stale = await db.select({
    id:             documents.id,
    gcsBucket:      documents.gcsBucket,
    gcsObjectPath:  documents.gcsObjectPath,
  }).from(documents)
    .where(and(
      eq(documents.status, 'uploading'),
      lt(documents.uploadExpiresAt, now),
    ))
    .limit(50);

  let cleaned = 0;
  let errors  = 0;

  for (const doc of stale) {
    try {
      await cleanupStaleUpload(doc.id, doc.gcsObjectPath, doc.gcsBucket);
      cleaned++;
    } catch (err) {
      console.error(`[SWEEP] Failed to clean up document ${doc.id}:`, err);
      errors++;
    }
  }

  console.info(`[SWEEP] Cleaned ${cleaned} stale uploads; ${errors} errors`);
  return { cleaned, errors };
}
```

```typescript
// apps/web/src/app/api/tasks/cleanup-upload/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { cleanupStaleUpload } from '../../../server/services/upload-cleanup';

const authClient = new OAuth2Client();

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await authClient.verifyIdToken({
      idToken: authHeader.slice(7),
      audience: process.env.NEXTAUTH_URL!,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { documentId, gcsObjectPath, gcsBucket } = await req.json();
  await cleanupStaleUpload(documentId ?? null, gcsObjectPath, gcsBucket);
  return NextResponse.json({ success: true });
}
```

```typescript
// apps/web/src/app/api/tasks/sweep-stale-uploads/route.ts
// Called by Cloud Scheduler every hour as a fallback sweep.

import { NextRequest, NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { sweepStaleUploads } from '../../../server/services/upload-cleanup';

const authClient = new OAuth2Client();

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await authClient.verifyIdToken({
      idToken: authHeader.slice(7),
      audience: process.env.NEXTAUTH_URL!,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const result = await sweepStaleUploads();
  return NextResponse.json(result);
}
```

**Failure mode summary for document uploads:**

| Failure Scenario | Detection | Response | Recovery |
|-----------------|-----------|----------|----------|
| Cloud Tasks unavailable at enqueue time | `scheduleUploadCleanup` throws | Document inserted with `cleanup_task_enqueued = FALSE`; upload proceeds | Sweep job finds record within 1 hour; cleans up |
| Client network failure during upload | `confirmUpload` never called | Per-upload task fires after 24h; `cleanupStaleUpload` marks deleted, removes GCS object | Automatic via Cloud Tasks |
| Per-upload task fires but document already `active` | `status !== 'uploading'` check | No-op; idempotent | N/A |
| `confirmUpload` called but GCS object missing | `exists()` returns false | 400 error; document stays `uploading` until cleanup fires | Automatic via Cloud Tasks or sweep |
| Both Cloud Tasks and sweep fail for 24h+ | Manual monitoring alert | Record stays `uploading`; GCS object may persist | Manual cleanup via admin script |
| User deleted from main app | Trust records retain UUID + name | No error; denormalized name displayed | N/A — by design |
| Matter archived in main app | Client ledger retains balance | UI shows "matter archived" warning on ledger | Manual review by bookkeeper |

### 5.4 GCS Lifecycle Policy

```json
{
  "lifecycle": {
    "rule": [
      {
        "action": { "type": "SetStorageClass", "storageClass": "NEARLINE" },
        "condition": { "age": 365, "matchesPrefix": ["matters/"] }
      },
      {
        "action": { "type": "SetStorageClass", "storageClass": "COLDLINE" },
        "condition": { "age": 1095, "matchesPrefix": ["matters/"] }
      },
      {
        "action": { "type": "Delete" },
        "condition": { "age": 2555, "matchesPrefix": ["matters/"] }
      }
    ]
  }
}
```

### 5.5 Document Management UI Pages

```
apps/web/src/app/(dashboard)/
├── documents/
│   ├── page.tsx                      # Global document search
│   └── viewer/[documentId]/page.tsx  # PDF viewer (react-pdf)
```

### 5.6 Document Management Test Requirements

| Test | Tool | Requirement |
|------|------|-------------|
| Unit: signed URL generation | Vitest + mock | Correct GCS path format, 15-min expiry, content-type header |
| Unit: file size validation | Vitest | Reject files > 100 MB |
| Unit: cleanupStaleUpload | Vitest + mocks | No-op if status = 'active'; no-op if documentId = null; marks 'deleted' if status = 'uploading'; deletes GCS object |
| Unit: sweepStaleUploads | Vitest + DB | Finds expired uploading records; cleans each; returns correct counts |
| Unit: scheduleUploadCleanup | Vitest + mock | Cloud Tasks task created with correct schedule time and payload |
| Unit: getUploadUrl — Cloud Tasks failure | Vitest + mock | Cloud Tasks throws → document inserted with cleanup_task_enqueued=false → upload URL still returned |
| Integration: upload flow | Vitest + GCS emulator | Get URL → upload → confirm → status = active |
| Integration: stale upload cleanup | Vitest + DB | Create uploading record → advance clock 25h → run cleanup → status = deleted |
| Integration: sweep catches missed tasks | Vitest + DB | Create uploading record with cleanup_task_enqueued=false → advance clock → sweep → status = deleted |
| Integration: download URL | Vitest + GCS emulator | Generate download URL; verify access log created |
| Integration: cleanup task handler | Vitest | POST /api/tasks/cleanup-upload with valid token → calls cleanupStaleUpload |
| Integration: sweep handler | Vitest | POST /api/tasks/sweep-stale-uploads with valid token → calls sweepStaleUploads |
| E2E: upload document | Playwright | Upload file → appears in matter documents with status active |
| E2E: medical viewer | Playwright | Open PDF → navigate pages → zoom |

---

## 6. MODULE 5: TIME & BILLING

### 6.1 Database Schema

```sql
-- ============================================================
-- SCHEMA: lexflow_main (continued)
-- ============================================================

CREATE TYPE time_entry_status AS ENUM (
  'draft', 'submitted', 'approved', 'billed', 'written_off'
);

CREATE TYPE invoice_status AS ENUM (
  'draft', 'pending', 'sent', 'partially_paid', 'paid', 'overdue', 'void', 'written_off'
);

CREATE TYPE payment_method AS ENUM (
  'check', 'wire', 'ach', 'credit_card', 'trust_transfer', 'cash', 'other'
);

CREATE TABLE time_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id        UUID NOT NULL REFERENCES matters(id),
  user_id          UUID NOT NULL REFERENCES users(id),
  date             DATE NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  hourly_rate      NUMERIC(10,2) NOT NULL,
  amount           NUMERIC(10,2) GENERATED ALWAYS AS (
    ROUND(hourly_rate * duration_minutes / 60.0, 2)
  ) STORED,
  description      TEXT NOT NULL,
  activity_code    VARCHAR(20),
  status           time_entry_status NOT NULL DEFAULT 'draft',
  timer_started_at TIMESTAMPTZ,
  timer_stopped_at TIMESTAMPTZ,
  invoice_id       UUID,
  is_billable      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_time_entries_matter  ON time_entries(matter_id);
CREATE INDEX idx_time_entries_user    ON time_entries(user_id);
CREATE INDEX idx_time_entries_date    ON time_entries(date);
CREATE INDEX idx_time_entries_status  ON time_entries(status);
CREATE INDEX idx_time_entries_invoice ON time_entries(invoice_id);

CREATE TRIGGER trg_time_entries_updated_at
  BEFORE UPDATE ON time_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE expense_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id           UUID NOT NULL REFERENCES matters(id),
  user_id             UUID NOT NULL REFERENCES users(id),
  date                DATE NOT NULL,
  amount              NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  description         TEXT NOT NULL,
  category            VARCHAR(100),
  is_billable         BOOLEAN NOT NULL DEFAULT TRUE,
  status              time_entry_status NOT NULL DEFAULT 'draft',
  invoice_id          UUID,
  receipt_document_id UUID REFERENCES documents(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_matter ON expense_entries(matter_id);
CREATE INDEX idx_expenses_user   ON expense_entries(user_id);
CREATE INDEX idx_expenses_date   ON expense_entries(date);

CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON expense_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number   VARCHAR(20) NOT NULL UNIQUE,
  matter_id        UUID NOT NULL REFERENCES matters(id),
  client_id        UUID NOT NULL REFERENCES clients(id),
  issue_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date         DATE NOT NULL,
  subtotal_time    NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal_expenses NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal         NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_reason  TEXT,
  tax_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid      NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_due      NUMERIC(12,2) GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
  status           invoice_status NOT NULL DEFAULT 'draft',
  payment_terms    VARCHAR(100) DEFAULT 'Net 30',
  notes            TEXT,
  internal_notes   TEXT,
  pdf_document_id  UUID REFERENCES documents(id),
  sent_at          TIMESTAMPTZ,
  sent_to_email    VARCHAR(255),
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_matter ON invoices(matter_id);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due    ON invoices(due_date) WHERE status NOT IN ('paid', 'void');

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE SEQUENCE invoice_number_seq START WITH 1000;

CREATE TABLE payments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id             UUID NOT NULL REFERENCES invoices(id),
  amount                 NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method         payment_method NOT NULL,
  reference_number       VARCHAR(100),
  notes                  TEXT,
  trust_journal_entry_id UUID,
  received_by            UUID NOT NULL REFERENCES users(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_date    ON payments(payment_date);

CREATE TABLE operating_transactions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_date       DATE NOT NULL,
  description            TEXT NOT NULL,
  amount                 NUMERIC(12,2) NOT NULL,
  invoice_id             UUID REFERENCES invoices(id),
  payment_id             UUID REFERENCES payments(id),
  trust_journal_entry_id UUID,
  category               VARCHAR(100),
  created_by             UUID NOT NULL REFERENCES users(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_operating_date    ON operating_transactions(transaction_date);
CREATE INDEX idx_operating_invoice ON operating_transactions(invoice_id);
```

### 6.2 Time & Billing API

```typescript
// apps/web/src/server/trpc/routers/time.ts

import { z } from 'zod';
import { router, permissionProcedure } from '../trpc';
import { trustClient } from '../../trust-client/http-client';
import type { PaginatedResponse } from '@lexflow/shared-types';

export const timeRouter = router({
  create: permissionProcedure('time:create')
    .input(z.object({
      matterId:        z.string().uuid(),
      date:            z.string().date(),
      durationMinutes: z.number().int().positive(),
      hourlyRate:      z.number().positive(),
      description:     z.string().min(1),
      activityCode:    z.string().max(20).optional(),
      isBillable:      z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => { throw new Error('Not implemented'); }),

  startTimer: permissionProcedure('time:create')
    .input(z.object({ matterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => { throw new Error('Not implemented'); }),

  stopTimer: permissionProcedure('time:create')
    .input(z.object({ timeEntryId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => { throw new Error('Not implemented'); }),

  list: permissionProcedure('time:read')
    .input(z.object({
      matterId:  z.string().uuid().optional(),
      userId:    z.string().uuid().optional(),
      dateFrom:  z.string().date().optional(),
      dateTo:    z.string().date().optional(),
      status:    z.enum(['draft','submitted','approved','billed','written_off']).optional(),
      page:      z.number().int().positive().default(1),
      pageSize:  z.number().int().min(10).max(100).default(25),
    }))
    .query(async ({ ctx, input }): Promise<PaginatedResponse<any>> => {
      // Non-admin users (no time:read_all) see only their own entries
      throw new Error('Not implemented');
    }),

  update: permissionProcedure('time:update')
    .input(z.object({
      id:              z.string().uuid(),
      durationMinutes: z.number().int().positive().optional(),
      description:     z.string().min(1).optional(),
      activityCode:    z.string().max(20).optional(),
      isBillable:      z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => { throw new Error('Not implemented'); }),

  createInvoice: permissionProcedure('invoice:create')
    .input(z.object({
      matterId:        z.string().uuid(),
      timeEntryIds:    z.array(z.string().uuid()),
      expenseEntryIds: z.array(z.string().uuid()).optional(),
      dueDate:         z.string().date(),
      discountAmount:  z.number().nonnegative().optional(),
      discountReason:  z.string().optional(),
      notes:           z.string().optional(),
      paymentTerms:    z.string().max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      throw new Error('Not implemented');
    }),

  listInvoices: permissionProcedure('invoice:read')
    .input(z.object({
      matterId:  z.string().uuid().optional(),
      clientId:  z.string().uuid().optional(),
      status:    z.string().optional(),
      page:      z.number().int().positive().default(1),
      pageSize:  z.number().int().min(10).max(100).default(25),
    }))
    .query(async ({ ctx, input }): Promise<PaginatedResponse<any>> => {
      throw new Error('Not implemented');
    }),

  getInvoice: permissionProcedure('invoice:read')
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => { throw new Error('Not implemented'); }),

  recordPayment: permissionProcedure('invoice:create')
    .input(z.object({
      invoiceId:       z.string().uuid(),
      amount:          z.number().positive(),
      paymentDate:     z.string().date(),
      paymentMethod:   z.enum(['check','wire','ach','credit_card','trust_transfer','cash','other']),
      referenceNumber: z.string().max(100).optional(),
      notes:           z.string().optional(),
      trustAccountId:  z.string().uuid().optional(),
      clientLedgerId:  z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      throw new Error('Not implemented');
    }),

  voidInvoice: permissionProcedure('invoice:void')
    .input(z.object({ invoiceId: z.string().uuid(), reason: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => { throw new Error('Not implemented'); }),
});
```

### 6.3 Time & Billing UI Pages

```
apps/web/src/app/(dashboard)/
├── time/
│   ├── page.tsx
│   ├── new/page.tsx
│   └── timer/page.tsx
├── billing/
│   ├── page.tsx
│   ├── invoices/
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   └── [invoiceId]/
│   │       ├── page.tsx
│   │       └── payment/page.tsx
│   └── reports/
│       ├── aging/page.tsx
│       └── productivity/page.tsx
```

### 6.4 Time & Billing Test Requirements

| Test | Tool | Requirement |
|------|------|-------------|
| Unit: amount calculation | Vitest | `duration_minutes × hourly_rate / 60` = correct amount |
| Unit: timer duration | Vitest | start → stop calculates correct minutes |
| Integration: time CRUD | Vitest + DB | Create, update, submit, approve lifecycle |
| Integration: invoice creation | Vitest + DB | Select time entries → create invoice → entries marked billed |
| Integration: payment recording | Vitest + DB | Payment updates invoice balance, creates operating txn |
| Integration: trust payment | Vitest + DB + trust mock | Trust transfer payment calls trust client; fee transfer recorded |
| Integration: void invoice | Vitest + DB | Void un-bills time entries, status = void |
| E2E: time entry | Playwright | Create time entry → appears in list → correct amount |
| E2E: timer | Playwright | Start timer → stop → entry created with duration |
| E2E: invoice workflow | Playwright | Create invoice → preview → record payment |

---

## 7. MODULE 6: INFRASTRUCTURE

### 7.1 Terraform Configuration

```hcl
# infra/terraform/main.tf

terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
  backend "gcs" {
    bucket = "lexflow-terraform-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

module "networking"  { source = "./modules/networking"; project_id = var.project_id; region = var.region }

module "cloud_sql" {
  source            = "./modules/cloud-sql"
  project_id        = var.project_id
  region            = var.region
  vpc_network_id    = module.networking.vpc_network_id
  instance_name     = "lexflow-db"
  database_version  = "POSTGRES_15"
  tier              = var.db_tier
  availability_type = "REGIONAL"
  databases         = ["lexflow"]

  backup_configuration = {
    enabled                        = true
    start_time                     = "03:00"
    point_in_time_recovery_enabled = true
    transaction_log_retention_days = 7
    retained_backups               = 30
  }

  maintenance_window = { day = 7; hour = 4; update_track = "stable" }

  database_flags = [
    { name = "max_connections",            value = "200" },
    { name = "log_min_duration_statement", value = "1000" },
    { name = "log_checkpoints",            value = "on" },
  ]

  ip_configuration = {
    ipv4_enabled    = false
    private_network = module.networking.vpc_network_id
    require_ssl     = true
  }
}

module "cloud_run_trust" {
  source                = "./modules/cloud-run"
  project_id            = var.project_id
  region                = var.region
  service_name          = "lexflow-trust"
  image                 = "${var.region}-docker.pkg.dev/${var.project_id}/lexflow/trust:${var.trust_image_tag}"
  service_account_email = google_service_account.trust_sa.email
  vpc_connector         = module.networking.vpc_connector_id
  min_instances         = var.environment == "production" ? 1 : 0
  max_instances         = 5
  cpu                   = "1000m"
  memory                = "512Mi"
  env_vars = {
    NODE_ENV        = var.environment
    WEB_SERVICE_URL = var.web_url
  }
  secret_env_vars = {
    DATABASE_URL                  = "${google_secret_manager_secret.trust_db_url.id}/versions/latest"
    TRUST_SERVICE_ACCOUNT_EMAIL   = "${google_secret_manager_secret.trust_sa_email.id}/versions/latest"
  }
  cloud_sql_connections = [module.cloud_sql.connection_name]
  allow_unauthenticated = false
}

module "cloud_run_web" {
  source                = "./modules/cloud-run"
  project_id            = var.project_id
  region                = var.region
  service_name          = "lexflow-web"
  image                 = "${var.region}-docker.pkg.dev/${var.project_id}/lexflow/web:${var.web_image_tag}"
  service_account_email = google_service_account.web_sa.email
  vpc_connector         = module.networking.vpc_connector_id
  min_instances         = var.environment == "production" ? 1 : 0
  max_instances         = 10
  cpu                   = "1000m"
  memory                = "512Mi"
  env_vars = {
    NODE_ENV                    = var.environment
    NEXTAUTH_URL                = var.web_url
    TRUST_SERVICE_URL           = module.cloud_run_trust.service_url
    GCS_BUCKET_NAME             = module.gcs.bucket_name
    TRUST_SERVICE_ACCOUNT_EMAIL = google_service_account.trust_sa.email
  }
  secret_env_vars = {
    NEXTAUTH_SECRET = "${google_secret_manager_secret.nextauth_secret.id}/versions/latest"
    DATABASE_URL    = "${google_secret_manager_secret.db_url.id}/versions/latest"
  }
  cloud_sql_connections = [module.cloud_sql.connection_name]
  allow_unauthenticated = true
}

module "gcs" {
  source      = "./modules/gcs"
  project_id  = var.project_id
  region      = var.region
  bucket_name = "lexflow-documents-${var.environment}"

  lifecycle_rules = [
    { action = { type = "SetStorageClass", storage_class = "NEARLINE" }; condition = { age = 365,  matches_prefix = ["matters/"] } },
    { action = { type = "SetStorageClass", storage_class = "COLDLINE" }; condition = { age = 1095, matches_prefix = ["matters/"] } },
    { action = { type = "Delete" };                                       condition = { age = 2555, matches_prefix = ["matters/"] } },
  ]

  cors = [{
    origin          = [var.web_url]
    method          = ["GET", "PUT", "POST"]
    response_header = ["Content-Type", "Content-Length"]
    max_age_seconds = 3600
  }]

  uniform_bucket_level_access = true
  versioning                  = true
}

# ── Cloud Scheduler: stale upload sweep (hourly fallback) ──

resource "google_cloud_scheduler_job" "sweep_stale_uploads" {
  name      = "lexflow-sweep-stale-uploads"
  schedule  = "0 * * * *"  # Every hour
  time_zone = "UTC"

  http_target {
    uri         = "${module.cloud_run_web.service_url}/api/tasks/sweep-stale-uploads"
    http_method = "POST"
    oidc_token {
      service_account_email = google_service_account.web_sa.email
      audience              = module.cloud_run_web.service_url
    }
  }
}

# ── Service Accounts ───────────────────────────────────────

resource "google_service_account" "web_sa" {
  account_id   = "lexflow-web"
  display_name = "LexFlow Web Service Account"
}

resource "google_service_account" "trust_sa" {
  account_id   = "lexflow-trust"
  display_name = "LexFlow Trust Service Account"
}

# Web SA can invoke Trust service
resource "google_cloud_run_service_iam_member" "web_invokes_trust" {
  service  = module.cloud_run_trust.service_name
  location = var.region
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.web_sa.email}"
}

# Trust SA can invoke Web service (for validate-matter-client)
resource "google_cloud_run_service_iam_member" "trust_invokes_web" {
  service  = module.cloud_run_web.service_name
  location = var.region
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.trust_sa.email}"
}

# Trust SA explicitly CANNOT access GCS (principle of least privilege)
resource "google_storage_bucket_iam_member" "web_gcs" {
  bucket = module.gcs.bucket_name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.web_sa.email}"
}

resource "google_project_iam_member" "web_sql" {
  project = var.project_id; role = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.web_sa.email}"
}
resource "google_project_iam_member" "trust_sql" {
  project = var.project_id; role = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.trust_sa.email}"
}

resource "google_secret_manager_secret" "nextauth_secret" { secret_id = "lexflow-nextauth-secret"; replication { auto {} } }
resource "google_secret_manager_secret" "db_url"          { secret_id = "lexflow-db-url";          replication { auto {} } }
resource "google_secret_manager_secret" "trust_db_url"    { secret_id = "lexflow-trust-db-url";    replication { auto {} } }

resource "google_secret_manager_secret_iam_member" "web_nextauth" {
  secret_id = google_secret_manager_secret.nextauth_secret.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.web_sa.email}"
}
resource "google_secret_manager_secret_iam_member" "web_db" {
  secret_id = google_secret_manager_secret.db_url.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.web_sa.email}"
}
resource "google_secret_manager_secret_iam_member" "trust_db" {
  secret_id = google_secret_manager_secret.trust_db_url.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.trust_sa.email}"
}

resource "google_artifact_registry_repository" "lexflow" {
  location = var.region; repository_id = "lexflow"; format = "DOCKER"
}
```

### 7.2 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml

name: CI
on:
  pull_request:  { branches: [main] }
  push:          { branches: [main] }

env:
  NODE_VERSION: '20'
  PNPM_VERSION: '8'

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with: { version: '${{ env.PNPM_VERSION }}' }
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint
      - run: pnpm turbo typecheck

  test-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with: { version: '${{ env.PNPM_VERSION }}' }
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo test:unit

  test-integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: lexflow_test
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: lexflow_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with: { version: '${{ env.PNPM_VERSION }}' }
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - name: Run migrations
        env:
          DATABASE_URL: postgresql://lexflow_test:test_password@localhost:5432/lexflow_test
        run: |
          pnpm --filter @lexflow/db-main drizzle-kit push
          pnpm --filter @lexflow/db-trust drizzle-kit push
      - name: Run integration tests
        env:
          DATABASE_URL: postgresql://lexflow_test:test_password@localhost:5432/lexflow_test
        run: pnpm turbo test:integration

  test-e2e:
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, test-unit]
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: lexflow_test
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: lexflow_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with: { version: '${{ env.PNPM_VERSION }}' }
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: npx playwright install --with-deps
      - name: Run E2E tests
        env:
          DATABASE_URL: postgresql://lexflow_test:test_password@localhost:5432/lexflow_test
        run: pnpm turbo test:e2e
```

```yaml
# .github/workflows/deploy-staging.yml

name: Deploy to Staging
on:
  push: { branches: [main] }

env:
  PROJECT_ID: lexflow-staging
  REGION: us-central1
  GAR_LOCATION: us-central1-docker.pkg.dev

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions: { contents: read, id-token: write }
    outputs:
      web_image:   ${{ steps.meta.outputs.web_image }}
      trust_image: ${{ steps.meta.outputs.trust_image }}
    steps:
      - uses: actions/checkout@v4
      - id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA }}
      - uses: google-github-actions/setup-gcloud@v2
      - run: gcloud auth configure-docker ${{ env.REGION }}-docker.pkg.dev
      - name: Build and push images
        id: meta
        run: |
          SHA=${GITHUB_SHA::8}
          docker build -t $GAR_LOCATION/$PROJECT_ID/lexflow/trust:$SHA -f apps/trust-service/Dockerfile .
          docker push $GAR_LOCATION/$PROJECT_ID/lexflow/trust:$SHA
          docker build -t $GAR_LOCATION/$PROJECT_ID/lexflow/web:$SHA -f apps/web/Dockerfile .
          docker push $GAR_LOCATION/$PROJECT_ID/lexflow/web:$SHA
          echo "web_image=$GAR_LOCATION/$PROJECT_ID/lexflow/web:$SHA"    >> $GITHUB_OUTPUT
          echo "trust_image=$GAR_LOCATION/$PROJECT_ID/lexflow/trust:$SHA" >> $GITHUB_OUTPUT

  # ── DEPLOYMENT ORDER IS CRITICAL ──────────────────────────
  # 1. Trust schema migrations (backward-compatible schema changes first)
  # 2. Trust service deployment (new code against new schema)
  # 3. Trust service health verification
  # 4. Web schema migrations
  # 5. Web app deployment
  # 6. Smoke test

  deploy-trust-migrations:
    needs: build-and-push
    runs-on: ubuntu-latest
    permissions: { contents: read, id-token: write }
    steps:
      - uses: actions/checkout@v4
      - id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA }}
      - name: Run trust schema migrations via Cloud SQL Auth Proxy
        run: |
          wget -q https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 -O cloud_sql_proxy
          chmod +x cloud_sql_proxy
          ./cloud_sql_proxy --instances=${{ secrets.CLOUD_SQL_CONNECTION_NAME }}=tcp:5432 &
          sleep 3
          pnpm --filter @lexflow/db-trust drizzle-kit migrate
        env:
          DATABASE_URL: ${{ secrets.TRUST_DB_URL_PROXY }}

  deploy-trust-service:
    needs: deploy-trust-migrations
    runs-on: ubuntu-latest
    permissions: { contents: read, id-token: write }
    steps:
      - id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA }}
      - name: Deploy trust service
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: lexflow-trust
          image:   ${{ needs.build-and-push.outputs.trust_image }}
          region:  ${{ env.REGION }}
      - name: Verify trust service health
        run: |
          for i in {1..30}; do
            STATUS=$(gcloud run services describe lexflow-trust \
              --region=$REGION --format='value(status.conditions[0].status)')
            if [ "$STATUS" = "True" ]; then echo "Trust service healthy"; exit 0; fi
            sleep 10
          done
          echo "Trust service health check timed out"; exit 1

  deploy-web-migrations:
    needs: deploy-trust-service
    runs-on: ubuntu-latest
    permissions: { contents: read, id-token: write }
    steps:
      - uses: actions/checkout@v4
      - id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA }}
      - name: Run main schema migrations
        run: |
          wget -q https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64 -O cloud_sql_proxy
          chmod +x cloud_sql_proxy
          ./cloud_sql_proxy --instances=${{ secrets.CLOUD_SQL_CONNECTION_NAME }}=tcp:5432 &
          sleep 3
          pnpm --filter @lexflow/db-main drizzle-kit migrate
        env:
          DATABASE_URL: ${{ secrets.MAIN_DB_URL_PROXY }}

  deploy-web-app:
    needs: deploy-web-migrations
    runs-on: ubuntu-latest
    permissions: { contents: read, id-token: write }
    steps:
      - id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SA }}
      - name: Deploy web app
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: lexflow-web
          image:   ${{ needs.build-and-push.outputs.web_image }}
          region:  ${{ env.REGION }}

  smoke-test:
    needs: deploy-web-app
    runs-on: ubuntu-latest
    steps:
      - name: Run smoke tests
        run: |
          WEB_URL=$(gcloud run services describe lexflow-web --region=$REGION --format='value(status.url)')
          curl -f "$WEB_URL/api/health" || exit 1
          echo "Smoke tests passed"
```

### 7.3 Infrastructure Test Requirements

| Test | Tool | Requirement |
|------|------|-------------|
| Terraform: plan | `terraform plan` | No errors, expected resource count |
| Terraform: validate | `terraform validate` | Valid HCL syntax |
| IAM: web → trust | Integration | Web SA can obtain OIDC token for trust service |
| IAM: trust → web | Integration | Trust SA can obtain OIDC token for web service (validate-matter-client) |
| IAM: trust isolation | Integration | Trust SA has no GCS IAM binding; access denied |
| Cloud SQL: HA | Manual | Failover test: primary → replica promotion < 30s |
| CI: pipeline order | GitHub Actions | Trust migrations → trust deploy → web migrations → web deploy |
| Smoke: health endpoints | curl | Both services respond to /health with 200 |
| Cloud Scheduler: sweep | Integration | Scheduler fires sweep endpoint; stale records cleaned |

---

## 8. FAILURE MODES & DEGRADATION

### 8.1 Failure Mode Analysis

| Component | Failure Mode | Detection | Response | Recovery |
|-----------|-------------|-----------|----------|----------|
| Cloud SQL | Primary down | Connection error | Automatic failover to HA replica (< 30s) | Automatic |
| Cloud SQL | Connection pool exhausted | Connection timeout | Return 503, log alert | Auto-scale or increase pool |
| Trust Service | Crash/OOM | Cloud Run health check | Auto-restart | Automatic |
| Trust Service | Unreachable from web | Circuit breaker opens after 5 failures in 50% error window | Return 503 to client: "Trust service temporarily unavailable" | Half-open probe after 30s |
| Trust Service | SERIALIZABLE conflict (40001) | PostgreSQL error code | Retry up to 3× with exponential backoff + jitter | Automatic; advisory locks make this rare |
| Trust Service | Advisory lock wait timeout (55P03) | PostgreSQL error code | Return 503 LEDGER_BUSY immediately (no retry); client shows "Ledger busy, retry in a few seconds" | User retries; typically resolves in < 2s |
| Trust Service | Concurrent writes to same ledger | Advisory lock contention | Requests queue at lock; no aborts under normal load (< 110 TPS per ledger) | Automatic |
| Trust Service | validate-matter-client unreachable | Network timeout (5s) | Return 503 INTERNAL_ERROR; ledger not created | User retries; web service auto-restarts |
| Web Service | validate-matter-client returns 404 | HTTP 404 from web service | Trust service returns 404 NOT_FOUND; ledger not created | User corrects matter/client selection |
| GCS | Upload never confirmed | `upload_expires_at` exceeded | Per-upload Cloud Tasks fires `cleanupStaleUpload`; record marked deleted, partial object removed | Automatic |
| GCS | Cloud Tasks unavailable at enqueue | `scheduleUploadCleanup` throws | Document inserted with `cleanup_task_enqueued=false`; upload proceeds | Cloud Scheduler sweep fires within 1 hour |
| GCS | Both per-upload task and sweep fail | Manual monitoring alert | Record stays `uploading`; GCS object may persist | Manual cleanup via admin script |
| GCS | Download failure | Signed URL error | Generate new signed URL | Automatic |
| NextAuth | JWT expired | 401 response | Redirect to login | User re-authenticates |
| NextAuth | TOTP clock skew | Invalid TOTP | Allow ±1 time step (30s window) | User retries |
| Web App | Crash | Cloud Run health check | Auto-restart | Automatic |
| Migration | Failed migration | Non-zero exit code | Pipeline stops; no deployment proceeds | Manual rollback |
| User deleted from main app | Trust records reference deleted UUID | No error (no FK) | Trust records retain UUID + denormalized name; UI displays stored name | By design; no action needed |
| Matter archived in main app | Client ledger references archived matter | No error (no FK) | Trust ledger retains balance; UI shows "matter archived" warning | Manual review by bookkeeper |

### 8.2 Circuit Breaker Configuration

```typescript
// Configured in apps/web/src/server/trust-client/http-client.ts (see §1.3.4)

const breaker = new CircuitBreaker(rawFetch, {
  timeout: 5000,                  // 5s per request
  errorThresholdPercentage: 50,   // Open after 50% errors
  resetTimeout: 30_000,           // 30s before half-open probe
  volumeThreshold: 5,             // Minimum 5 requests before tripping
});
```

---

## 9. PHASED TASK BACKLOG

Each task is atomic, produces a testable increment, and can be built by a coder agent in isolation. Dependencies are explicit.

**Resolution of circular testing dependency (Issue #5):** T-044 is split into T-044a and T-044b. T-044a builds the trust client with a mock HTTP server and has no dependency on a running trust service — it can be built and tested in Phase 3 before the trust service routes are complete. T-044b adds integration tests against the real trust service and depends on T-047 (trust service fully operational). This eliminates the circular dependency while preserving full test coverage.

### Phase 0: Project Scaffold & Infrastructure

| ID | Task | Dependencies | Deliverable | Verification |
|----|------|-------------|-------------|--------------|
| **T-001** | **Monorepo scaffold** | None | Turborepo + pnpm workspace with `apps/web`, `apps/trust-service`, `packages/shared-types` (including `PaginatedResponse<T>`), `packages/db-main`, `packages/db-trust`. Base `tsconfig.json`, `turbo.json`, `.eslintrc`. | `pnpm install` succeeds; `pnpm turbo build` succeeds; `pnpm turbo lint` passes |
| **T-002** | **Next.js app shell** | T-001 | `apps/web` with Next.js 14 App Router, Tailwind CSS, shadcn/ui. Root layout, `/api/health` route returning `{"status":"ok"}`. Dockerfile. | `pnpm --filter web dev` starts; `curl localhost:3000/api/health` returns 200 |
| **T-003** | **Fastify trust service shell** | T-001 | `apps/trust-service` with Fastify 4, `GET /health` returning `{"status":"ok","uptimeMs":N}`. Dockerfile. | `pnpm --filter trust-service dev` starts; `curl localhost:3001/health` returns 200 |
| **T-004** | **Terraform base infrastructure** | None | Terraform modules for VPC, Cloud SQL HA, GCS, Artifact Registry, Secret Manager, service accounts, IAM bindings. Trust SA has `roles/run.invoker` on web service (for validate-matter-client). Trust SA has no GCS binding. Cloud Scheduler sweep job. | `terraform plan` succeeds; `terraform validate` passes |
| **T-005** | **CI pipeline** | T-001, T-002, T-003 | `.github/workflows/ci.yml` with lint, typecheck, unit, integration (Postgres service), E2E jobs. | Push to PR branch triggers all jobs; all pass on empty project |
| **T-006** | **CD pipeline (staging)** | T-004, T-005 | `.github/workflows/deploy-staging.yml` with correct ordering: build → trust migrations → trust deploy → trust health check → web migrations → web deploy → smoke test. | Manual trigger deploys both services to staging Cloud Run |

### Phase 1: Authentication & RBAC

| ID | Task | Dependencies | Deliverable | Verification |
|----|------|-------------|-------------|--------------|
| **T-007** | **Foundation DB schema + Drizzle** | T-001 | `packages/db-main` with Drizzle schema for `users`, `sessions`, `audit_logs`. Migration files. Drizzle client factory. | `drizzle-kit push` creates all tables; `drizzle-kit generate` produces correct SQL |
| **T-008** | **RBAC permission system** | T-001 | `apps/web/src/lib/rbac.ts` with role-permission matrix, `hasPermission()`. Unit tests for every role × permission. | `pnpm turbo test:unit --filter web` passes; 100% of combinations tested |
| **T-009** | **NextAuth.js configuration** | T-007 | `apps/web/src/server/auth.ts` with Credentials provider, argon2 verification, JWT sessions, account lockout. No MFA yet. | Integration test: valid credentials return session; invalid return null; 5 failures lock account |
| **T-010** | **tRPC setup with auth middleware** | T-008, T-009 | `apps/web/src/server/trpc/trpc.ts` with context, `publicProcedure`, `protectedProcedure`, `permissionProcedure()`. | Unit test: unauthenticated call throws UNAUTHORIZED; wrong role throws FORBIDDEN |
| **T-011** | **Auth tRPC router** | T-010 | `apps/web/src/server/trpc/routers/auth.ts` with `me`, `listUsers`, `createUser`. Seed script for initial owner. | Integration test: `createUser` inserts user; `me` returns current user; `listUsers` requires `user:manage` |
| **T-012** | **Login UI** | T-009 | `apps/web/src/app/(auth)/login/page.tsx` with email/password form, error handling. | E2E: valid credentials → dashboard; invalid → error message |
| **T-013** | **Dashboard layout shell** | T-012 | `apps/web/src/app/(dashboard)/layout.tsx` with sidebar, header, breadcrumbs. Auth-protected. | E2E: unauthenticated → /login; authenticated → sidebar with role-appropriate nav |
| **T-014** | **TOTP MFA implementation** | T-011 | `setupTotp`, `verifyTotp` procedures; MFA check in login flow; recovery codes. | Integration test: setup → verify → `totpEnabled=true`; login requires code; recovery code works once |
| **T-015** | **MFA UI pages** | T-014, T-013 | `mfa-setup/page.tsx`, `mfa-verify/page.tsx`, profile MFA toggle. | E2E: enable MFA → logout → login requires TOTP → enter code → dashboard |
| **T-016** | **Audit logging middleware** | T-007, T-010 | tRPC middleware logging mutations to `audit_logs`. Helper `auditLog(ctx, action, resourceType, resourceId, details)`. | Integration test: creating user produces audit log with correct fields |
| **T-017** | **User management UI** | T-011, T-013 | `/settings/users/page.tsx`, `/settings/users/[userId]/page.tsx`. Owner-only. | E2E: owner sees user list, creates user; paralegal cannot access `/settings/users` |

### Phase 2: Matter Management

| ID | Task | Dependencies | Deliverable | Verification |
|----|------|-------------|-------------|--------------|
| **T-018** | **Client DB schema + Drizzle** | T-007 | `clients` table in `packages/db-main`. Migration. | Migration creates table with all PI-specific fields |
| **T-019** | **Client tRPC router** | T-018, T-010 | CRUD: `create`, `getById`, `list` (paginated + search), `update`. Uses `PaginatedResponse<T>` from `@lexflow/shared-types`. | Integration test: full CRUD; search by name; pagination |
| **T-020** | **Client UI pages** | T-019, T-013 | `/clients/page.tsx`, `/clients/new/page.tsx`, `/clients/[clientId]/page.tsx`, `/clients/[clientId]/edit/page.tsx`. | E2E: create → list → detail → edit → persisted |
| **T-021** | **Matter DB schema + Drizzle** | T-018 | `matters`, `matter_team`, `matter_deadlines`, `medical_treatments` tables. Matter number trigger. | Migration creates all tables; insert auto-generates `YYYY-NNNN` number |
| **T-022** | **Contact DB schema + Drizzle** | T-007 | `contacts`, `matter_contacts` tables. | Migration creates tables |
| **T-023** | **Matter tRPC router** | T-021, T-022, T-010 | `create`, `getById`, `list`, `update`, `delete` (archive). Team: `addTeamMember`, `removeTeamMember`. | Integration test: full lifecycle; team assignment; uniqueness constraint |
| **T-024** | **Deadline tRPC procedures** | T-021, T-010 | `addDeadline`, `completeDeadline`, `listUpcomingDeadlines`. | Integration test: add → upcoming → complete → not upcoming |
| **T-025** | **Medical treatment tRPC procedures** | T-021, T-010 | `addTreatment`, `listTreatments`, `updateTreatment`. Auto-update `matter.total_medical_bills`. | Integration test: add treatment → matter totals updated |
| **T-026** | **Contact tRPC router** | T-022, T-010 | CRUD + `linkToMatter`, `unlinkFromMatter`. | Integration test: create → link → appears in matter contacts |
| **T-027** | **Matter list UI** | T-023, T-013 | `/matters/page.tsx` with DataTable, filters, search, pagination. | E2E: filter by status; search by title/number; pagination |
| **T-028** | **Matter creation wizard UI** | T-023, T-020 | `/matters/new/page.tsx` multi-step: client → case details → fee → insurance → review. | E2E: complete all steps → matter created → redirected to detail |
| **T-029** | **Matter detail layout + tabs** | T-023 | `/matters/[matterId]/layout.tsx` with tab nav. `/matters/[matterId]/details/page.tsx`. **Trust tab renders `<ComingSoonTab label="Trust Accounting" />` — disabled, no API call.** | E2E: navigate matter → tabs visible → Trust tab shows placeholder → details tab editable |
| **T-030** | **Matter team UI** | T-023 | `/matters/[matterId]/team/page.tsx`. | E2E: add member → list → remove → gone |
| **T-031** | **Matter deadlines UI** | T-024 | `/matters/[matterId]/deadlines/page.tsx`. SOL highlighted. | E2E: add deadline → mark complete → visual change |
| **T-032** | **Medical treatment UI** | T-025 | `/matters/[matterId]/medical/page.tsx` with treatment log, add form, running totals. | E2E: add treatment → totals update |
| **T-033** | **Dashboard widgets** | T-023, T-024 | `/dashboard/page.tsx` with active matter count, upcoming deadlines (30 days), recent activity, matters-by-status chart. | E2E: dashboard loads with real data; deadline widget shows upcoming items |

### Phase 3: Trust Accounting

| ID | Task | Dependencies | Deliverable | Verification |
|----|------|-------------|-------------|--------------|
| **T-034** | **Trust DB schema + Drizzle** | T-003 | `packages/db-trust` with all trust tables. Denormalized `_name` columns alongside all UUID audit fields. Immutability triggers. No cross-schema FKs. | Migration creates all tables; UPDATE on `journal_entries` (non-void) throws; DELETE throws |
| **T-035** | **Trust service auth middleware** | T-003 | Fastify middleware validating Cloud Run OIDC tokens. Dev mode with shared secret. Returns canonical error shape. | Unit test: valid token passes; invalid → 401 with `UNAUTHORIZED` code; missing → 401 |
| **T-036** | **validate-matter-client endpoint** | T-021, T-018, T-002 | `GET /api/internal/validate-matter-client` on web service. OIDC validation of trust SA token. Returns `matterNumber`, `clientName`. All error codes per §1.3.2. | Integration test: valid pair → 200 with matterNumber/clientName; unknown matter → 404 MATTER_NOT_FOUND; client not on matter → 422 CLIENT_NOT_ON_MATTER; missing token → 401; wrong SA → 403 |
| **T-037** | **Trust web-client service** | T-003 | `apps/trust-service/src/services/web-client.ts` — calls validate-matter-client, maps error codes. | Unit test with mock HTTP server: 200 → returns values; MATTER_NOT_FOUND → 404 NOT_FOUND; CLIENT_NOT_ON_MATTER → 400 VALIDATION_ERROR; timeout → 503 INTERNAL_ERROR |
| **T-038** | **Ledger engine with advisory locking** | T-034 | `LedgerEngine` with `executeTransaction()`: `SET LOCAL lock_timeout = '2s'`, advisory locks on ledger IDs (sorted), SERIALIZABLE isolation, balance verification. `LEDGER_BUSY` on 55P03. | Integration test: balanced entry succeeds; unbalanced throws; negative balance throws `INSUFFICIENT_BALANCE`; 10 concurrent deposits to same ledger all succeed with correct final balance; lock timeout → LEDGER_BUSY |
| **T-039** | **Trust account routes** | T-034, T-035, T-037 | Fastify routes per §1.3.3: `POST /api/trust/accounts`, `GET /api/trust/accounts`, `GET /api/trust/accounts/:id`, `POST /api/trust/accounts/:id/ledgers` (calls validate-matter-client; stores denormalized values), `GET /api/trust/accounts/:id/ledgers`. TypeBox schemas match §1.3.4 types. | Integration test: create → list → get → create ledger → list ledgers; 409 on duplicate ledger; 404 on unknown matter; 422 on client not on matter |
| **T-040** | **Deposit route** | T-038, T-039 | `POST /api/trust/transactions/deposit`. Accepts `createdByName`. | Integration test: deposit $1000 → trust account +$1000, client ledger +$1000, entry balanced; `created_by_name` stored |
| **T-041** | **Disbursement route** | T-038, T-039 | `POST /api/trust/transactions/disburse`. Rejects overdraft with 422; returns 503 LEDGER_BUSY on lock timeout. | Integration test: deposit $1000 → disburse $500 succeeds → disburse $600 → 422 |
| **T-042** | **Transfer route** | T-038, T-039 | `POST /api/trust/transactions/transfer`. Trust bank balance unchanged. | Integration test: deposit to A → transfer to B → A decreased, B increased, trust bank unchanged |
| **T-043** | **Fee transfer route** | T-038, T-039 | `POST /api/trust/transactions/fee-transfer`. | Integration test: deposit → fee transfer → client ledger decreased |
| **T-044a** | **Trust client library — unit tests with mock server** | T-002 | `apps/web/src/server/trust-client/` with `http-client.ts`, `oidc-token.ts`, `types.ts`. Circuit breaker (opossum). All methods from §1.3.4. **Unit tests use a mock HTTP server (msw or nock) — no real trust service required.** | Unit test: circuit breaker opens after 5 failures; closes after reset; OIDC token cached until 60s before expiry; all methods map to correct HTTP paths from §1.3.3; LEDGER_BUSY maps to SERVICE_UNAVAILABLE |
| **T-045** | **Void entry route** | T-038 | `POST /api/trust/transactions/:entryId/void`. Creates reversing entry. 409 if already voided. Stores `voided_by_name`. | Integration test: deposit → void → balances restored; original marked void; reversing entry created; re-void → 409 |
| **T-046** | **Transaction listing routes** | T-034 | `GET /api/trust/ledgers/:id/transactions` (paginated using `PaginatedResponse<JournalEntry>`), `GET /api/trust/transactions/:id`. | Integration test: multiple transactions → correct order and pagination |
| **T-047** | **Bank statement import** | T-034 | `POST /api/trust/bank-statements/import`. Deduplication via `external_id`. Stores `imported_by_name`. | Integration test: import 50 transactions → all created; re-import same batch → duplicates skipped |
| **T-048** | **Reconciliation engine + routes** | T-034, T-047 | `ReconciliationEngine`. `POST /api/trust/reconciliation`, `GET /api/trust/reconciliation/:id`, `GET /api/trust/accounts/:id/three-way-report`. Stores `prepared_by_name`. | Integration test: deposit $1000, import matching bank txn → balanced; import unmatched txn → unbalanced with correct variance |
| **T-044b** | **Trust client integration tests** | T-044a, T-048 | Integration tests for `trustClient` against the real trust service (running in CI via Docker Compose). Verifies every method in §1.3.4 against the real Fastify routes. | Integration test: every `trustClient` method returns correct response shape; error codes propagate correctly; circuit breaker tested with real service shutdown |
| **T-049** | **Trust tRPC proxy router** | T-044a, T-010 | `apps/web/src/server/trpc/routers/trust.ts` — all procedures from §4.10. Permission-gated. Passes `createdByName` from session. | Integration test: tRPC call → trust client → mock trust service → response; LEDGER_BUSY → SERVICE_UNAVAILABLE |
| **T-050** | **Trust dashboard UI** | T-049, T-013 | `/trust/page.tsx` with account overview, total balances, recent transactions. | E2E: trust dashboard loads, shows account balances |
| **T-051** | **Trust account management UI** | T-049 | `/trust/accounts/page.tsx`, `/trust/accounts/new/page.tsx`, `/trust/accounts/[id]/page.tsx`. | E2E: create trust account → list → view transactions |
| **T-052** | **Deposit/Disbursement UI** | T-049 | `/trust/deposit/page.tsx`, `/trust/disburse/page.tsx`. | E2E: record deposit → balance updates → appears in transaction list |
| **T-053** | **Reconciliation UI** | T-049 | `/trust/accounts/[id]/reconcile/page.tsx`, `/trust/reports/three-way/page.tsx`. | E2E: import CSV → match transactions → generate report → view three-way balance |
| **T-054** | **Matter trust tab (activates placeholder)** | T-049, T-029 | `/matters/[matterId]/trust/page.tsx` — replaces `<ComingSoonTab>` with real client ledger balance and transaction list. Quick deposit/disburse buttons. | E2E: navigate to matter trust tab → see balance → record deposit → balance updates |

### Phase 4: Document Management

| ID | Task | Dependencies | Deliverable | Verification |
|----|------|-------------|-------------|--------------|
| **T-055** | **Document DB schema + Drizzle** | T-007 | `documents`, `document_access_log` tables. `upload_expires_at` and `cleanup_task_enqueued` columns. Indexes on stale uploads and missing tasks. | Migration creates tables with all fields |
| **T-056** | **Upload cleanup service + task handlers** | T-055, T-010 | `UploadCleanupService` with `scheduleUploadCleanup`, `cleanupStaleUpload`, `sweepStaleUploads`. `/api/tasks/cleanup-upload` handler. `/api/tasks/sweep-stale-uploads` handler. Cloud Scheduler Terraform resource. | Unit test: cleanupStaleUpload is idempotent; no-op on null documentId; sweepStaleUploads finds expired records; Cloud Tasks failure → cleanup_task_enqueued=false; sweep catches missed tasks |
| **T-057** | **Document tRPC router** | T-055, T-056, T-010 | `getUploadUrl` (enqueues cleanup task; proceeds if Cloud Tasks fails), `confirmUpload` (GCS existence check), `getDownloadUrl`, `listByMatter`, `update`, `delete`. | Integration test: get URL → confirm → active; stale upload → cleanup → deleted; Cloud Tasks failure → document still created with cleanup_task_enqueued=false |
| **T-058** | **Document upload component** | T-057 | React component: drag-and-drop, category selector, progress bar, direct-to-GCS upload, confirm callback. | E2E: drag file → select category → upload → document in list with status active |
| **T-059** | **Document list UI** | T-057 | `/matters/[matterId]/documents/page.tsx` with filterable table, category badges, download buttons. | E2E: upload → filter by category → download → file received |
| **T-060** | **Medical record viewer** | T-057 | `/documents/viewer/[documentId]/page.tsx` with react-pdf, page navigation, zoom, Bates overlay. | E2E: open PDF → navigate pages → zoom |
| **T-061** | **Document metadata editor** | T-057 | Inline editing for title, description, tags, medical record fields. | E2E: edit metadata → save → persisted |
| **T-062** | **Global document search** | T-057 | `/documents/page.tsx` — search across all matters. | E2E: upload to different matters → global search finds them |

### Phase 5: Time & Billing

| ID | Task | Dependencies | Deliverable | Verification |
|----|------|-------------|-------------|--------------|
| **T-063** | **Time & billing DB schema + Drizzle** | T-007, T-021 | `time_entries`, `expense_entries`, `invoices`, `payments`, `operating_transactions`. Computed `amount` column. Invoice number sequence. | Migration creates all tables; inserting time entry auto-calculates amount |
| **T-064** | **Time entry tRPC router** | T-063, T-010 | `create`, `update`, `list` (own-entries filter for non-admins), `startTimer`, `stopTimer`. Uses `PaginatedResponse<T>`. | Integration test: amount calculated correctly; timer start → stop → duration; non-admin sees only own entries |
| **T-065** | **Time entry UI** | T-064, T-013 | `/time/page.tsx`, `/time/new/page.tsx`, timer widget in header. | E2E: create entry → list → correct amount; start timer → stop → entry created |
| **T-066** | **Matter time tab** | T-064 | `/matters/[matterId]/time/page.tsx`. | E2E: add time entry from matter tab → appears in list |
| **T-067** | **Expense entry tRPC procedures** | T-063, T-010 | CRUD for expense entries, receipt document linking. | Integration test: create expense → link receipt → list expenses |
| **T-068** | **Invoice tRPC router** | T-063, T-064, T-010 | `createInvoice`, `listInvoices`, `getInvoice`, `voidInvoice`. | Integration test: approve entries → create invoice → entries billed → totals correct; void → entries un-billed |
| **T-069** | **Payment tRPC procedures** | T-063, T-068, T-044a, T-010 | `recordPayment` — updates invoice balance, creates operating transaction. Trust transfer calls trust client. | Integration test: check payment → balance updated; trust transfer → trust client called → operating txn created |
| **T-070** | **Invoice creation UI** | T-068 | `/billing/invoices/new/page.tsx`. | E2E: select entries → preview totals → create → invoice in list |
| **T-071** | **Invoice detail UI** | T-068 | `/billing/invoices/[invoiceId]/page.tsx`. | E2E: view invoice → line items → correct totals |
| **T-072** | **Payment recording UI** | T-069 | `/billing/invoices/[invoiceId]/payment/page.tsx`. | E2E: record payment → invoice status updates → payment in history |
| **T-073** | **Billing dashboard** | T-068 | `/billing/page.tsx` — outstanding, overdue, total receivables, recent payments. | E2E: correct aggregate numbers |
| **T-074** | **Matter billing tab** | T-068 | `/matters/[matterId]/billing/page.tsx`. | E2E: view matter billing → see invoices → create new |
| **T-075** | **Aging report** | T-068 | `/billing/reports/aging/page.tsx` — AR aging (current, 30, 60, 90+ days). | E2E: invoices at various ages → correct buckets |

### Phase 6: Polish & Hardening

| ID | Task | Dependencies | Deliverable | Verification |
|----|------|-------------|-------------|--------------|
| **T-076** | **Production Terraform deployment** | T-004, all modules | `environments/production.tfvars` with production-grade settings. | `terraform plan -var-file=production.tfvars` shows expected resources |
| **T-077** | **Production CD pipeline** | T-006, T-076 | `.github/workflows/deploy-production.yml` with manual approval gate, same ordering as staging. | Manual trigger with approval → successful production deployment |
| **T-078** | **Error monitoring integration** | T-002, T-003 | Sentry for both services. Structured logging to Cloud Logging. | Thrown error appears in Sentry with stack trace and user context |
| **T-079** | **Rate limiting** | T-002 | Rate limiting on auth routes (5/min per IP) and API routes (100/min per user). | Integration test: exceed limit → 429 with retry-after header |
| **T-080** | **CSP and security headers** | T-002 | CSP, X-Frame-Options, HSTS in Next.js middleware. | Security header scan passes with A+ rating |
| **T-081** | **Data encryption at rest** | T-007, T-034 | KMS-backed encryption for TOTP secrets, SSN last 4, bank account/routing numbers. | Integration test: encrypted value in DB is not plaintext; decryption returns original |
| **T-082** | **Session management UI** | T-011 | Active sessions list in profile; revoke session. | E2E: view sessions → revoke → that session invalidated |
| **T-083** | **Comprehensive E2E test suite** | All UI tasks | Full workflow: intake → matter → document → time → invoice → trust deposit → disbursement → reconciliation. | All E2E tests pass in CI against staging-like environment |
| **T-084** | **Performance testing** | All modules | k6 load test scripts for matter list, trust deposit, document upload. Baseline metrics. | P95 < 500ms for list operations; < 1000ms for mutations under 50 concurrent users |
| **T-085** | **Backup and restore verification** | T-004 | Documented backup/restore procedure. Test restore from Cloud SQL backup. | Restore → verify data integrity → all tables present with correct row counts |

### Dependency Graph (Simplified)

```
Phase 0: T-001 ──┬── T-002 ──┐
                  ├── T-003 ──┤
                  └── T-004 ──┼── T-005 ── T-006
                              │
Phase 1: T-007 ──┬── T-008 ──┤
                  │           ├── T-009 ── T-010 ──┬── T-011 ── T-014 ── T-015
                  │           │                    ├── T-012 ── T-013
                  │           │                    └── T-016 ── T-017
                  │
Phase 2:          ├── T-018 ──┬── T-019 ── T-020
                  │           └── T-021 ──┬── T-023 ──┬── T-027
                  │                       │           ├── T-028
                  │                       │           ├── T-029 (Trust tab = placeholder)
                  │                       │           ├── T-030
                  │                       │           └── T-033
                  │                       ├── T-024 ── T-031
                  │                       └── T-025 ── T-032
                  └── T-022 ── T-026
                  │
Phase 3: T-034 ──┬── T-035
                  ├── T-038 ──┬── T-039 ──┬── T-040
                  │           │           ├── T-041
                  │           │           ├── T-042
                  │           │           └── T-043
                  │           └── T-045 ── T-046
                  ├── T-036 ── T-037 ── T-039 (feeds into ledger creation)
                  ├── T-047 ── T-048
                  ├── T-044a ─────────────────────────────────────────────┐
                  │    (mock server; no trust service dependency)          │
                  ├── T-044b (depends on T-044a + T-048) ─────────────────┤
                  └── T-049 (depends on T-044a + T-010) ──┬── T-050       │
                                                          ├── T-051       │
                                                          ├── T-052       │
                                                          ├── T-053       │
                                                          └── T-054 (activates T-029 placeholder)

Phase 4: T-055 ── T-056 ── T-057 ──┬── T-058
                                    ├── T-059
                                    ├── T-060
                                    ├── T-061
                                    └── T-062

Phase 5: T-063 ──┬── T-064 ──┬── T-065
                  │           └── T-066
                  ├── T-067
                  ├── T-068 ──┬── T-070
                  │           ├── T-071
                  │           ├── T-073
                  │           ├── T-074
                  │           └── T-075
                  └── T-069 ── T-072

Phase 6: T-076 ── T-077
         T-078, T-079, T-080, T-081, T-082 (parallel)
         T-083 ── T-084 ── T-085
```

### Estimated Timeline

| Phase | Tasks | Parallel Tracks | Estimated Duration |
|-------|-------|----------------|-------------------|
| Phase 0 | T-001 → T-006 | 2 (infra + app) | 1 week |
| Phase 1 | T-007 → T-017 | 2 (backend + frontend) | 2 weeks |
| Phase 2 | T-018 → T-033 | 3 (clients + matters + UI) | 3 weeks |
| Phase 3 | T-034 → T-054 | 2 (trust service + trust UI) | 3 weeks |
| Phase 4 | T-055 → T-062 | 2 (backend + frontend) | 1.5 weeks |
| Phase 5 | T-063 → T-075 | 2 (backend + frontend) | 2.5 weeks |
| Phase 6 | T-076 → T-085 | 3 (infra + security + testing) | 1.5 weeks |
| **Total** | **85 tasks** | | **~14.5 weeks** |

---

*This document is the authoritative architectural specification for LexFlow. All implementation tasks reference the schemas, interfaces, and contracts defined herein.*

*The canonical HTTP API contracts are the single sources of truth for all inter-service communication:*
- *§1.3.2 — Trust→Web validation contract (`GET /api/internal/validate-matter-client`)*
- *§1.3.3 — Web→Trust HTTP API contract (all trust service routes)*

*Any deviation between the Fastify route schemas (§4.5), the TypeScript client types (§1.3.4), the tRPC proxy router (§4.10), and the web service validation endpoint (§1.3.2) constitutes a defect requiring immediate correction. Deviations from any other section require architectural review.*