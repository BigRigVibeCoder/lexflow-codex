---
id: HND-COV-001
title: "Backend Agent Handoff — Coverage Ramp to 80%"
type: reference
status: ACTIVE
owner: architect
agents: [backend]
tags: [handoff, testing, coverage, backend, hardening]
related: [SPR-008, VER-008, GOV-002]
created: 2026-03-24
updated: 2026-03-24
version: 1.0.0
---

> **BLUF:** SPR-008 backend hardening passed — zero defects, merged, deployed. Coverage gate is installed at 80% but current coverage is 42.87%. Your job: write integration tests to close the gap. No new features — just tests.

# Backend Agent Handoff — Coverage Ramp

---

## SPR-008 Audit Result

**FULL PASS — zero defects.** Coverage gate, deploy automation, backup/restore all verified. Merged to main, branch deleted, deployed to `lexflow-prod`.

---

## Your Assignment: Coverage Ramp

**Goal:** Get line coverage from 42.87% → 80% so `npm run test:coverage` passes.

### Before You Start

```bash
git checkout main && git pull origin main
git submodule update --remote
git checkout -b feature/coverage-ramp
```

### What Needs Tests

Run `npm run test:coverage` to see the coverage report. Focus on these high-value areas:

| File/Area | Why | Priority |
|:----------|:----|:---------|
| `src/routes/trust-accounts.ts` | Core trust CRUD — 17 CON-002 routes | 🔴 High |
| `src/routes/trust-transactions.ts` | Deposit/disburse/transfer/fee | 🔴 High |
| `src/routes/trust-ledgers.ts` | Ledger CRUD, balance tracking | 🔴 High |
| `src/routes/reconciliation.ts` | 3-way reconciliation | 🟡 Medium |
| `src/services/ledger-engine.ts` | Double-entry engine | 🟡 Medium |
| `src/plugins/auth.ts` | Auth middleware edge cases | 🟢 Have tests |
| `src/routes/health.ts` | Health endpoint | 🟢 Have tests |

### Test Strategy

1. **Use the existing test patterns.** Look at `trust-accounts.test.ts` and `auth.test.ts` — they use Fastify's `inject()` for HTTP testing.
2. **Test against a real DB.** Set `DATABASE_URL` to the Docker PostgreSQL. Run `drizzle-kit push` before tests.
3. **Test the happy path first** for each route, then add edge cases.
4. **Test error paths:** invalid input (400), unauthorized (401), not found (404), business logic violations (e.g., disburse more than balance → 422).

### Commit Pattern

```
test(SPR-008): trust account CRUD integration tests
test(SPR-008): deposit and disburse integration tests
test(SPR-008): ledger engine unit tests
test(SPR-008): reconciliation integration tests
```

### Constraints

- **No feature changes.** This is test-only work.
- **GOV-003 applies to tests too.** TypeScript strict, no `any` in test files.
- **Target: 80% lines + 80% functions.** That's the threshold in `vitest.config.ts`.

### When Done

Push branch. Notify architect for review. Do not merge.

### Database for Integration Tests

Docker PostgreSQL is running on `lexflow-prod` at `127.0.0.1:5432`. For local dev:

```bash
DATABASE_URL="postgresql://lexflow:lexflow_dev_password@127.0.0.1:5432/lexflow_trust"
```

If running locally, start Docker: `cd deploy && docker compose up -d postgres`
