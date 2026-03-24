---
id: HND-SPR-007
title: "Frontend Agent Handoff — SPR-007 Time & Billing"
type: reference
status: ACTIVE
owner: architect
agents: [frontend]
tags: [handoff, sprint, time-billing, frontend]
related: [SPR-007, SPR-006, VER-006]
created: 2026-03-24
updated: 2026-03-24
version: 1.0.0
---

> **BLUF:** SPR-006 audit passed — zero defects, merged, deployed to prod. Start SPR-007 (Time & Billing) immediately. 13 tasks, currency as integer cents, invoice void-only (never delete).

# Frontend Agent Handoff — SPR-007

---

## SPR-006 Audit Result

**FULL PASS — zero defects.** First sprint with no defect filings. Merged to main, branch deleted, deployed to `lexflow-prod`.

---

## Your Next Sprint: SPR-007 Time & Billing

**Sprint doc:** `CODEX/05_PROJECT/SPR-007_TimeBilling.md`

### Before You Start

```bash
git checkout main && git pull origin main
git submodule update --remote
git checkout -b feature/SPR-007-time-billing
```

### 13 Tasks (T-063 → T-075)

| Task | Summary | Key Constraint |
|:-----|:--------|:---------------|
| T-063 | Billing schema (6 tables) | Currency as integer cents — **never float** |
| T-064 | Time entry tRPC router + timer | Running timer, CRUD, permission-gated |
| T-065 | Time entry UI + timer widget | Timer in header, manual entry, HH:MM display |
| T-066 | Matter time tab | Matter-scoped entries with running totals |
| T-067 | Expense entry procedures | CRUD, receipt linking to documents (T-055) |
| T-068 | Invoice tRPC router | Auto-number (INV-YYYY-NNNN), status machine, void-only |
| T-069 | Payment procedures | Trust transfer calls trust-client `feeTransfer` |
| T-070 | Invoice creation wizard | Select matter → pick unbilled time/expenses → create |
| T-071 | Invoice detail UI | Line items, payment history, void button |
| T-072 | Payment recording UI | Amount, method, trust transfer option |
| T-073 | Billing dashboard | KPI cards (outstanding, overdue, revenue), chart |
| T-074 | Matter billing tab | Invoice list for matter, unbilled summary |
| T-075 | Aging report | 0-30/31-60/61-90/90+ buckets, sortable |

### Critical Rules

1. **Currency = integer cents.** `amountCents: number`. Never `amount: 0.01`. GOV-003.
2. **Invoices void, never delete.** `status: 'void'`, set `voidedAt`. GOV-004.
3. **One commit per task.** `feat(SPR-007): T-0XX description`. GOV-005 v1.1.
4. **Trust integration:** T-069 payment recording calls `trustClient.feeTransfer()` for trust transfers.
5. **Test billing math.** Rounding, tax calculation, partial payments — unit test all of it.

### Commit Pattern

```
feat(SPR-007): T-063 billing schema
feat(SPR-007): T-064 time entry router
feat(SPR-007): T-065 time entry UI
...
feat(SPR-007): T-075 aging report
```

### When Done

Push branch. Notify architect for audit. Do not merge.

---

## After SPR-007

SPR-008 has frontend tasks remaining (T-078–T-084, T-086–T-088):
- Error boundaries + Sentry
- Rate limiting
- Security headers
- E2E test suite (Playwright)
- Performance testing (k6)
- ESLint code quality rules
- Coverage threshold gate
- Persistent log output

We'll hand those off after SPR-007 audit.
