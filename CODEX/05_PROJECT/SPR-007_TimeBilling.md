---
id: SPR-007
title: "Time & Billing Sprint"
type: sprint
status: PLANNING
owner: architect
agents: [frontend]
tags: [sprint, phase-5, time-tracking, billing, invoicing]
related: [BCK-001, SPR-003, SPR-005, CON-001]
created: 2026-03-24
updated: 2026-03-24
version: 1.0.0
---

> **BLUF:** Complete time tracking, expense recording, invoicing, and payment system. Timer widget, billing dashboard with AR aging, invoice creation wizard, payment recording with trust fund integration. End state: full billing lifecycle from time entry to invoice to payment.

# SPR-007: Time & Billing

**Phase:** 5 — Time & Billing
**Target:** 8-16 hours (AI-agent pace)
**Agent:** Frontend only
**Dependencies:** SPR-003 (matters exist), SPR-005 (trust client for payment recording)

---

## ⚠️ Mandatory Compliance — Every Task

| Governance Doc | Sprint Requirement |
|:---------------|:-------------------|
| **GOV-001** | TSDoc on all billing models, routers, components. |
| **GOV-002** | Unit tests for billing calculations. Integration tests for invoice generation. |
| **GOV-003** | TypeScript strict. Currency as integer cents (never float). |
| **GOV-004** | Invoice void (never delete). Payment recording validates against invoice total. |
| **GOV-005** | Branch: `feature/SPR-007-time-billing`. One commit per task. | |
| **GOV-006** | Invoice creation, payment recording, void operations logged. |

---

## Frontend Agent Tasks (lexflow-frontend)

### T-063: Time & Billing DB Schema + Drizzle
- **Commit:** `feat(SPR-007): T-063-billing-schema`
- **Dependencies:** T-007, T-021
- **Deliverable:**
  - `time_entries` (id, matterId, userId, description, durationMinutes, hourlyRateCents, isBillable, date, createdAt)
  - `expense_entries` (id, matterId, userId, description, amountCents, category, receiptDocumentId, date, createdAt)
  - `invoices` (id, matterId, invoiceNumber auto-gen, status [draft/sent/paid/void/partial], subtotalCents, taxCents, totalCents, dueDate, paidAmountCents, issuedAt, paidAt, voidedAt)
  - `invoice_line_items` (id, invoiceId, timeEntryId, expenseEntryId, description, amountCents, type [time/expense/flat_fee])
  - `payments` (id, invoiceId, amountCents, method [check/ach/credit_card/trust_transfer], referenceNumber, trustTransactionId, receivedAt)
  - `operating_transactions` (id, type, amountCents, description, relatedInvoiceId, createdAt)
- **Acceptance:** Migrations run. All FKs enforced. Currency stored as integer cents.
- **Status:** [ ] Not Started

### T-064: Time Entry tRPC Router
- **Commit:** `feat(SPR-007): T-064-time-entry-router`
- **Dependencies:** T-063, T-010
- **Deliverable:** CRUD + running timer. Users see own entries by default. Permissions for viewing all.
- **Acceptance:** Create time entry, start/stop timer, list by matter.
- **Status:** [ ] Not Started

### T-065: Time Entry UI
- **Commit:** `feat(SPR-007): T-065-time-entry-ui`
- **Dependencies:** T-064, T-013
- **Deliverable:** Time list, new entry form (matter, description, duration or timer), timer widget in header.
- **Acceptance:** Timer starts/stops. Manual entry works. Duration displays as HH:MM.
- **Status:** [ ] Not Started

### T-066: Matter Time Tab
- **Commit:** `feat(SPR-007): T-066-matter-time-tab`
- **Dependencies:** T-064
- **Deliverable:** Time entries for a specific matter. Total hours, total billable amount.
- **Acceptance:** Tab shows matter-scoped time entries with running totals.
- **Status:** [ ] Not Started

### T-067: Expense Entry tRPC Procedures
- **Commit:** `feat(SPR-007): T-067-expense-procedures`
- **Dependencies:** T-063, T-010
- **Deliverable:** CRUD for expenses. Receipt linking to documents (T-055).
- **Acceptance:** Create expense with receipt link. List by matter.
- **Status:** [ ] Not Started

### T-068: Invoice tRPC Router
- **Commit:** `feat(SPR-007): T-068-invoice-router`
- **Dependencies:** T-063, T-064, T-010
- **Deliverable:** Create (from uninvoiced time entries + expenses), list, get, void. Invoice number auto-generation (INV-YYYY-NNNN). Status transitions: draft → sent → paid/partial/void.
- **Acceptance:** Create invoice from time entries. Void marks as voided. Never deletes.
- **Status:** [ ] Not Started

### T-069: Payment tRPC Procedures
- **Commit:** `feat(SPR-007): T-069-payment-procedures`
- **Dependencies:** T-063, T-068, T-044a
- **Deliverable:** Record payments. Trust transfer payments call trust-client fee-transfer. Update invoice paid amount. Mark invoice as paid when fully paid.
- **Acceptance:** Payment reduces outstanding balance. Trust transfer creates trust transaction.
- **Status:** [ ] Not Started

### T-070: Invoice Creation UI
- **Commit:** `feat(SPR-007): T-070-invoice-creation-ui`
- **Dependencies:** T-068
- **Deliverable:** Invoice wizard: select matter → select uninvoiced time entries + expenses → review → create. Include flat fee option.
- **Acceptance:** Wizard creates invoice with selected line items. Total calculated correctly.
- **Status:** [ ] Not Started

### T-071: Invoice Detail UI
- **Commit:** `feat(SPR-007): T-071-invoice-detail-ui`
- **Dependencies:** T-068
- **Deliverable:** Invoice view with header (client, matter, dates), line items table, payment history, status badge, void button.
- **Acceptance:** Invoice renders with all details. Void button works (confirmation dialog).
- **Status:** [ ] Not Started

### T-072: Payment Recording UI
- **Commit:** `feat(SPR-007): T-072-payment-ui`
- **Dependencies:** T-069
- **Deliverable:** Payment form: amount, method, reference. Trust transfer option shows trust accounts.
- **Acceptance:** Recording payment updates invoice status. Trust transfer triggers trust service.
- **Status:** [ ] Not Started

### T-073: Billing Dashboard
- **Commit:** `feat(SPR-007): T-073-billing-dashboard`
- **Dependencies:** T-068
- **Deliverable:** KPI cards: total outstanding, total overdue, monthly revenue. Invoice list by status. Revenue chart (bar, monthly).
- **Acceptance:** Dashboard shows real billing data. Charts render.
- **Status:** [ ] Not Started

### T-074: Matter Billing Tab
- **Commit:** `feat(SPR-007): T-074-matter-billing-tab`
- **Dependencies:** T-068
- **Deliverable:** Per-matter billing view: invoices, payments, outstanding balance.
- **Acceptance:** Tab shows matter-scoped billing with running totals.
- **Status:** [ ] Not Started

### T-075: Aging Report
- **Commit:** `feat(SPR-007): T-075-aging-report`
- **Dependencies:** T-068
- **Deliverable:** AR aging buckets: Current, 1-30, 31-60, 61-90, 90+ days. Table and summary cards.
- **Acceptance:** Aging buckets calculate correctly based on invoice due dates.
- **Status:** [ ] Not Started

---

## Sprint Checklist

| Task | Agent | Status | Branch | Audited |
|:-----|:------|:-------|:-------|:--------|
| T-063 | Frontend | [ ] | `feature/SPR-007-T063-billing-schema` | [ ] |
| T-064 | Frontend | [ ] | `feature/SPR-007-T064-time-entry-router` | [ ] |
| T-065 | Frontend | [ ] | `feature/SPR-007-T065-time-entry-ui` | [ ] |
| T-066 | Frontend | [ ] | `feature/SPR-007-T066-matter-time-tab` | [ ] |
| T-067 | Frontend | [ ] | `feature/SPR-007-T067-expense-procedures` | [ ] |
| T-068 | Frontend | [ ] | `feature/SPR-007-T068-invoice-router` | [ ] |
| T-069 | Frontend | [ ] | `feature/SPR-007-T069-payment-procedures` | [ ] |
| T-070 | Frontend | [ ] | `feature/SPR-007-T070-invoice-creation-ui` | [ ] |
| T-071 | Frontend | [ ] | `feature/SPR-007-T071-invoice-detail-ui` | [ ] |
| T-072 | Frontend | [ ] | `feature/SPR-007-T072-payment-ui` | [ ] |
| T-073 | Frontend | [ ] | `feature/SPR-007-T073-billing-dashboard` | [ ] |
| T-074 | Frontend | [ ] | `feature/SPR-007-T074-matter-billing-tab` | [ ] |
| T-075 | Frontend | [ ] | `feature/SPR-007-T075-aging-report` | [ ] |

---

## Sprint Completion Criteria

- [ ] All 13 tasks pass acceptance criteria
- [ ] Time entry → invoice → payment lifecycle works end-to-end
- [ ] Timer widget functional in dashboard header
- [ ] Trust transfer payments reach trust service
- [ ] Aging report calculates correctly
- [ ] Currency stored/displayed correctly (cents internally, dollars in UI)
- [ ] All GOV compliance checks pass
- [ ] All tests pass: `npm run lint && npm run typecheck && npm run test`
