---
id: DEF-007
title: "Missing msw Dev Dependency in Frontend"
type: reference
status: OPEN
owner: frontend
agents: [frontend]
tags: [defect, dependency, testing, SPR-005]
related: [SPR-005, VER-005, DEF-001]
created: 2026-03-24
updated: 2026-03-24
version: 1.0.0
---

> **BLUF:** `src/lib/trust-client/index.test.ts` imports `msw` and `msw/node` but `msw` is not in `package.json`. Test file fails to load. Same pattern as DEF-001 (SPR-001).

# DEF-007: Missing `msw` Dev Dependency

## Details

- **File:** `src/lib/trust-client/index.test.ts`
- **Symptom:** Test file fails with `Cannot find module 'msw'`
- **Root cause:** `msw` (Mock Service Worker) used in test but not installed
- **Severity:** 4 — MINOR (tests affected, not runtime)
- **Sprint:** SPR-005

## Fix

```bash
npm install -D msw
npm test  # verify index.test.ts passes
```

## Pattern

This is the same defect pattern as DEF-001 (SPR-001): dependency imported but not in package.json. The governance scan checks for `any`, `console.log`, and `throw new Error` but does not verify `import` statements resolve to installed packages.

**Recommendation:** Add `tsc --noEmit` as a blocking gate in `/governance_scan` (it already runs in `/git_commit` but was not added to the scan).
