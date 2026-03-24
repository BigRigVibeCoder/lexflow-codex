---
id: DEF-001
title: "Frontend Missing .env.example File"
type: reference
status: OPEN
owner: architect
agents: [coder]
tags: [bug, governance, sprint]
related: [SPR-001, GOV-008, VER-001-SPR-001]
created: 2026-03-24
updated: 2026-03-24
version: 1.0.0
---

> **BLUF:** The `lexflow-frontend` repo is missing a `.env.example` file, violating GOV-008. The backend has one; the frontend does not.

# DEF-001: Frontend Missing `.env.example`

**Severity:** Minor
**Sprint:** SPR-001
**Repo:** `lexflow-frontend`
**Branch:** `feature/SPR-001-T001-nextjs-scaffold`
**Filed by:** Architect Agent
**Assigned to:** Frontend Developer Agent

---

## Problem

GOV-008 requires every service repo to include a `.env.example` file documenting all required environment variables. The backend repo includes this file; the frontend does not.

## Expected

```
# .env.example
DATABASE_URL=postgresql://user:password@localhost:5432/lexflow_web
LOG_LEVEL=info
SERVICE_NAME=lexflow-web
```

## Fix Required

1. Create `.env.example` in the frontend repo root
2. Include all environment variables used in the codebase (at minimum: `DATABASE_URL`, `LOG_LEVEL`, `SERVICE_NAME`)
3. Commit with message: `fix(DEF-001): add .env.example per GOV-008`

## Governance Reference

- GOV-008 §3: Every service repo must include `.env.example`
