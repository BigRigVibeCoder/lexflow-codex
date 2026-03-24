---
id: SPR-002-ARCH
title: "Architect Sprint — Docker Migration (Parallel with SPR-002/004)"
type: sprint
status: ACTIVE
owner: architect
agents: [architect]
tags: [sprint, architect, docker, infrastructure, deployment]
related: [BCK-002, SPR-002, SPR-004, GOV-008]
created: 2026-03-24
updated: 2026-03-24
version: 1.0.0
---

> **BLUF:** While developer agents execute SPR-002 (Auth & RBAC) and SPR-004 (Trust Accounting), the Architect migrates production from PM2 bare-metal to Docker Compose. End state: all services (frontend, backend, postgres, nginx) run in Docker containers with zero downtime on `lexflow-prod`.

# SPR-002-ARCH: Docker Migration

**Parallel with:** SPR-002 (Frontend), SPR-004 (Backend)
**Target:** Complete before both agents finish their sprints

---

## Tasks

### D-001: Write Frontend Dockerfile
- **Deliverable:** `Dockerfile` in `lexflow-frontend/` root
- **Strategy:** Multi-stage build (deps → build → production)
- **Status:** [ ] Not Started

### D-002: Write Backend Dockerfile
- **Deliverable:** `Dockerfile` in `lexflow-backend/` root
- **Strategy:** Multi-stage build (deps → build → production)
- **Status:** [ ] Not Started

### D-003: Write docker-compose.yml
- **Deliverable:** `docker-compose.yml` in `lexflow-codex/deploy/`
- **Services:** lexflow-web, lexflow-trust, postgres, nginx
- **Status:** [ ] Not Started

### D-004: Write nginx Container Config
- **Deliverable:** `deploy/nginx/nginx.conf` and `deploy/nginx/default.conf`
- **Status:** [ ] Not Started

### D-005: Install Docker on lexflow-prod
- **Status:** [ ] Not Started

### D-006: Clean Up PM2 on lexflow-prod
- **Deliverable:** Stop PM2, remove bare-metal Node.js processes
- **Status:** [ ] Not Started

### D-007: Deploy via Docker Compose
- **Status:** [ ] Not Started

### D-008: Verify Health Endpoints in Docker
- **Status:** [ ] Not Started

### D-009: Update Deploy and Health Scripts
- **Deliverable:** Update `scripts/deploy.sh` and `scripts/health-check.sh` for Docker
- **Status:** [ ] Not Started

---

## Sprint Checklist

| Task | Status | Priority |
|:-----|:-------|:---------|
| D-001 | [ ] | Do now |
| D-002 | [ ] | Do now |
| D-003 | [ ] | Do now |
| D-004 | [ ] | Do now |
| D-005 | [ ] | After D-001→004 |
| D-006 | [ ] | After D-005 |
| D-007 | [ ] | After D-006 |
| D-008 | [ ] | After D-007 |
| D-009 | [ ] | After D-008 |
