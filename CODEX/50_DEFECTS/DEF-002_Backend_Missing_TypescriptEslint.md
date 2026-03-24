---
id: DEF-002
title: "Backend ESLint Config References Missing Package"
type: reference
status: CLOSED
owner: architect
agents: [coder]
tags: [bug, governance, sprint]
related: [SPR-001, GOV-003, VER-001-SPR-001]
created: 2026-03-24
updated: 2026-03-24
version: 1.0.0
---

> **BLUF:** `npm run lint` fails on `lexflow-backend` because `eslint.config.mjs` imports `typescript-eslint` but it's not in `devDependencies`.

# DEF-002: Backend ESLint Missing `typescript-eslint` Package

**Severity:** Minor
**Sprint:** SPR-001
**Repo:** `lexflow-backend`
**Branch:** `feature/SPR-001-T003-trust-service-scaffold`
**Filed by:** Architect Agent
**Assigned to:** Backend Developer Agent

---

## Problem

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'typescript-eslint'
imported from eslint.config.mjs
```

The `eslint.config.mjs` uses `typescript-eslint` but only `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` are listed in `devDependencies`. The flat config format needs the `typescript-eslint` meta-package.

## Fix Required

1. Add `typescript-eslint` to devDependencies:
   ```bash
   npm install -D typescript-eslint
   ```
2. Verify `npm run lint` passes
3. Commit: `fix(DEF-002): add typescript-eslint to devDependencies`

## Governance Reference

- GOV-003 §3: ESLint must be configured and passing
