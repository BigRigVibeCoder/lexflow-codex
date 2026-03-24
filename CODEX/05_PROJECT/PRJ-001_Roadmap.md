---
id: PRJ-001
title: "LexFlow Project Roadmap"
type: planning
status: APPROVED
owner: human
agents: [all]
tags: [roadmap, project-management, vision]
related: [BCK-001, GOV-007, GOV-008, BLU-ARCH-001, RES-002]
created: 2026-03-22
updated: 2026-03-24
version: 1.1.0
---

> **BLUF:** LexFlow is a single-tenant personal injury practice management system replacing Clio. Built by AI agents at machine speed. Target: production-ready in under a week.

# LexFlow Project Roadmap

---

## 1. Vision

Build a complete practice management system for a personal injury law firm that:
- Manages matters, clients, contacts, deadlines, and medical treatments (PI-specific)
- Handles IOLTA-compliant trust accounting with double-entry ledgers and three-way reconciliation
- Manages legal documents with medical record viewing capability
- Tracks time and generates invoices with trust account integration
- Enforces RBAC with MFA for multi-user access
- Deploys to a controlled GCP VM — no cloud-managed services

---

## 2. Technology Stack (per RES-002)

| Layer | Technology |
|:------|:-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, tRPC |
| Backend | Fastify 4, TypeScript, Drizzle ORM |
| Database | PostgreSQL 15 (self-managed) |
| Auth | NextAuth.js + TOTP MFA + argon2 |
| File Storage | Local disk (`/var/lexflow/documents/`) |
| Deployment | GCP VM, nginx, PM2 |

---

## 3. Architecture (per BLU-ARCH-001)

Two services, one VM:
- **Web Service** (Next.js) — UI, tRPC API, auth, matter/doc/billing logic
- **Trust Service** (Fastify) — IOLTA ledger engine, bank reconciliation, isolated for compliance

---

## 4. Development Model (per GOV-007, GOV-008)

| Role | Agent | Repository |
|:-----|:------|:-----------|
| Architect (PM) | This agent | `lexflow-codex` |
| Frontend Developer | `lexflow-architect` VM | `lexflow-frontend` |
| Backend Developer | `lexflow-backend` VM | `lexflow-backend` |
| Human | Final authority | All repos |

Communication via CODEX submodule. AI-agent pace development.

---

## 5. Delivery Phases

| Phase | Module | Sprint | Tasks | Est. Duration |
|:------|:-------|:-------|:-----:|:--------------|
| 0 | Project Scaffold + Infrastructure | SPR-001 | 6 | 2-4 hours |
| 1 | Authentication + RBAC | SPR-002 | 11 | 6-12 hours |
| 2 | Matter Management | SPR-003 | 16 | 12-24 hours |
| 3 | Trust Accounting | SPR-004/005 | 21 | 12-24 hours |
| 4 | Document Management | SPR-006 | 8 | 4-8 hours |
| 5 | Time & Billing | SPR-007 | 13 | 8-16 hours |
| 6 | Polish & Hardening | SPR-008 | 10 | 6-12 hours |
| | **Total** | **8 sprints** | **85** | **~3-6 days** |

---

## 6. Compliance From Day One

Every sprint task is governed by:

| Doc | Enforces |
|:----|:---------|
| GOV-001 | Documentation standards — all code documented |
| GOV-002 | Testing protocol — 17-tier cascade, IaC → unit → integration → E2E → UAT |
| GOV-003 | Coding standards — TypeScript strict, naming, complexity limits |
| GOV-004 | Error handling — structured errors, no unhandled rejections |
| GOV-005 | Development lifecycle — branch → test → audit → merge |
| GOV-006 | Logging — structured JSON, correlation IDs, audit trails |
| GOV-007 | Project management — CODEX-driven, contract-first |
| GOV-008 | Infrastructure — multi-repo, VM deployment, agent communication |

---

## 7. Success Criteria

- [ ] All 85 tasks complete and Architect-audited
- [x] Both services running on `lexflow-prod` VM
- [ ] Full matter lifecycle works (create → manage → close)
- [/] Trust accounting with three-way reconciliation balanced
- [x] Document upload/download/viewing functional
- [ ] Time tracking and invoicing operational
- [x] MFA-protected login with RBAC enforcement
- [ ] All GOV-002 testing tiers 1-12 passing
