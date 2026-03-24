---
id: SPR-002
title: "Authentication & RBAC Sprint"
type: sprint
status: PLANNING
owner: architect
agents: [frontend]
tags: [sprint, phase-1, auth, rbac, mfa]
related: [BCK-001, SPR-001, GOV-007, GOV-008, BLU-ARCH-001]
created: 2026-03-24
updated: 2026-03-24
version: 1.0.0
---

> **BLUF:** Complete auth system for the Web Service. NextAuth.js with credentials provider, RBAC permission matrix, TOTP MFA, audit logging, tRPC auth middleware, and all auth UI pages. End state: users can register, login, manage MFA, and access role-gated routes. **Backend Agent is idle during this sprint — use time to begin T-034 (trust schema) early.**

# SPR-002: Authentication & RBAC

**Phase:** 1 — Authentication & RBAC
**Target:** 6-12 hours (AI-agent pace)
**Agent:** Frontend only
**Dependencies:** SPR-001 complete (scaffold + health endpoints working)
**Contracts:** None consumed yet — this sprint CREATES the auth foundation

---

## ⚠️ Mandatory Compliance — Every Task

| Governance Doc | Sprint Requirement |
|:---------------|:-------------------|
| **GOV-001** | TSDoc on all exported functions/types. README update with auth architecture. |
| **GOV-002** | Vitest unit tests for RBAC logic, auth middleware. Integration tests for login flow. |
| **GOV-003** | TypeScript strict. No `any`. argon2 for passwords (never bcrypt). |
| **GOV-004** | Structured error responses for auth failures (401, 403). Account lockout on repeated failures. |
| **GOV-005** | Branch: `feature/SPR-002-TXXX-description`. Commit: `feat(SPR-002): description`. |
| **GOV-006** | Auth events logged: login success/fail, MFA verify, user create, permission denied. |
| **GOV-007** | Task status updated. Blockers → `DEF-` doc. |
| **GOV-008** | PostgreSQL on localhost. `.env.example` updated with auth vars. |

---

## Frontend Agent Tasks (lexflow-frontend)

### T-007: Foundation DB Schema + Drizzle
- **Branch:** `feature/SPR-002-T007-foundation-schema`
- **Dependencies:** T-001
- **Blueprints:** BLU-ARCH-001 §1.3 (User Management)
- **Deliverable:**
  - Drizzle schema: `users` (id, email, passwordHash, role, isActive, mfaSecret, mfaEnabled, failedLoginAttempts, lockedUntil, createdAt, updatedAt)
  - `sessions` table (NextAuth managed)
  - `audit_logs` (id, userId, action, entityType, entityId, metadata, ipAddress, timestamp)
  - Drizzle migration files
  - Seed script: creates initial OWNER user
- **Acceptance criteria:**
  - `npx drizzle-kit migrate` runs clean
  - Seed script creates owner user in DB
  - `SELECT * FROM users` returns seeded owner
- **Status:** [ ] Not Started

### T-008: RBAC Permission System
- **Branch:** `feature/SPR-002-T008-rbac-permissions`
- **Dependencies:** T-001
- **Blueprints:** BLU-ARCH-001 §1.3.2 (Role-Permission Matrix)
- **Deliverable:**
  - `src/lib/rbac.ts` — Role enum (OWNER, ADMIN, ATTORNEY, PARALEGAL, BILLING_CLERK, READ_ONLY)
  - Permission enum (full list from BLU-ARCH-001)
  - `ROLE_PERMISSIONS` matrix mapping roles → permissions
  - `hasPermission(role, permission)` helper
  - `requirePermission(permission)` tRPC middleware helper
  - Unit tests: every role/permission combination tested
- **Acceptance criteria:**
  - `hasPermission('ATTORNEY', 'matter:create')` returns true
  - `hasPermission('READ_ONLY', 'matter:create')` returns false
  - 100% of role/permission combinations covered by tests
- **Status:** [ ] Not Started

### T-009: NextAuth.js Configuration
- **Branch:** `feature/SPR-002-T009-nextauth-config`
- **Dependencies:** T-007
- **Deliverable:**
  - `src/app/api/auth/[...nextauth]/route.ts`
  - Credentials provider with email/password
  - argon2 password hashing (cost factor 3, memory 65536)
  - JWT session strategy
  - Account lockout: 5 failed attempts → 15 min lock
  - Session callback adding role, userId to JWT
- **Acceptance criteria:**
  - Login with seeded owner credentials succeeds → JWT returned
  - 5 wrong passwords → account locked → subsequent correct password rejected for 15 min
  - JWT contains `role` and `userId`
- **Status:** [ ] Not Started

### T-010: tRPC Setup with Auth Middleware
- **Branch:** `feature/SPR-002-T010-trpc-auth-middleware`
- **Dependencies:** T-008, T-009
- **Deliverable:**
  - `src/server/trpc.ts` — base tRPC setup
  - `publicProcedure` — no auth required
  - `protectedProcedure` — requires valid session
  - `permissionProcedure(permission)` — requires specific permission
  - Error handling: 401 for unauthenticated, 403 for unauthorized
- **Acceptance criteria:**
  - `protectedProcedure` rejects requests without session
  - `permissionProcedure('user:manage')` allows OWNER, rejects PARALEGAL
  - Error responses match GOV-004 structured format
- **Status:** [ ] Not Started

### T-011: Auth tRPC Router
- **Branch:** `feature/SPR-002-T011-auth-router`
- **Dependencies:** T-010
- **Deliverable:**
  - `src/server/routers/auth.ts`
  - Procedures: `me` (get current user), `listUsers` (paginated, OWNER/ADMIN only), `createUser` (OWNER/ADMIN only), `updateUser`, `deactivateUser`
  - Seed script for initial OWNER user (if not in T-007)
- **Acceptance criteria:**
  - `me` returns current user profile
  - `listUsers` returns paginated results
  - `createUser` hashes password with argon2
  - Permission checks enforced on all procedures
- **Status:** [ ] Not Started

### T-012: Login UI
- **Branch:** `feature/SPR-002-T012-login-ui`
- **Dependencies:** T-009
- **Deliverable:**
  - `src/app/(auth)/login/page.tsx` — login form
  - Email + password fields, submit button, error display
  - Redirect to dashboard on success
  - Account locked message display
  - shadcn/ui components (Input, Button, Card)
- **Acceptance criteria:**
  - Login form renders, submits, redirects on success
  - Error messages display for wrong password, locked account
  - Page is responsive
- **Status:** [ ] Not Started

### T-013: Dashboard Layout Shell
- **Branch:** `feature/SPR-002-T013-dashboard-layout`
- **Dependencies:** T-012
- **Deliverable:**
  - `src/app/(dashboard)/layout.tsx` — authenticated layout
  - Sidebar navigation (Dashboard, Clients, Matters, Documents, Billing, Trust, Settings)
  - Header with user info, logout button
  - Breadcrumb component
  - Auth redirect: unauthenticated users → login page
- **Acceptance criteria:**
  - Unauthenticated access redirects to `/login`
  - Sidebar renders with all nav items
  - Logout button clears session
- **Status:** [ ] Not Started

### T-014: TOTP MFA Implementation
- **Branch:** `feature/SPR-002-T014-totp-mfa`
- **Dependencies:** T-011
- **Deliverable:**
  - `src/server/routers/mfa.ts`
  - Procedures: `setupTotp` (generates secret + QR data URL), `verifyTotp` (validates code, enables MFA), `disableTotp`, `generateRecoveryCodes`
  - Uses `otpauth` library
  - Recovery codes: 10 single-use codes
- **Acceptance criteria:**
  - `setupTotp` returns base32 secret and QR data
  - `verifyTotp` with correct code → MFA enabled on user
  - Login flow requires MFA code when enabled
  - Recovery codes work as one-time bypass
- **Status:** [ ] Not Started

### T-015: MFA UI Pages
- **Branch:** `feature/SPR-002-T015-mfa-ui`
- **Dependencies:** T-014, T-013
- **Deliverable:**
  - `src/app/(dashboard)/settings/mfa/page.tsx` — MFA setup wizard
  - QR code display, code entry, recovery codes display
  - MFA verification step in login flow
  - Toggle MFA on/off in user profile
- **Acceptance criteria:**
  - Full MFA enrollment flow works end-to-end
  - MFA verify page appears during login when MFA enabled
  - Recovery code login works
- **Status:** [ ] Not Started

### T-016: Audit Logging Middleware
- **Branch:** `feature/SPR-002-T016-audit-logging`
- **Dependencies:** T-007, T-010
- **Deliverable:**
  - tRPC middleware that logs all mutations to `audit_logs` table
  - Captures: userId, action, entityType, entityId, metadata (before/after), IP address
  - Does NOT log read operations (queries)
- **Acceptance criteria:**
  - Creating a user → audit_logs entry with action='user.create'
  - Login → audit_logs entry with action='auth.login'
  - `SELECT COUNT(*) FROM audit_logs` increases with each mutation
- **Status:** [ ] Not Started

### T-017: User Management UI
- **Branch:** `feature/SPR-002-T017-user-management-ui`
- **Dependencies:** T-011, T-013
- **Deliverable:**
  - `src/app/(dashboard)/settings/users/page.tsx` — user list
  - `src/app/(dashboard)/settings/users/[id]/page.tsx` — user detail/edit
  - Create user form (OWNER/ADMIN only)
  - Role assignment dropdown
  - Deactivate user button
- **Acceptance criteria:**
  - User list renders with all users
  - Role changes persist
  - Non-OWNER/ADMIN users cannot access the page
- **Status:** [ ] Not Started

---

## Backend Agent Note

> **Backend Agent is idle during SPR-002.** If SPR-001 tasks are complete, the Backend Agent SHOULD begin T-034 (Trust DB Schema) from SPR-004 early. This parallelism is intentional — see BCK-001 Phase 3 notes.

---

## Sprint Checklist

| Task | Agent | Status | Branch | Audited |
|:-----|:------|:-------|:-------|:--------|
| T-007 | Frontend | [ ] | `feature/SPR-002-T007-foundation-schema` | [ ] |
| T-008 | Frontend | [ ] | `feature/SPR-002-T008-rbac-permissions` | [ ] |
| T-009 | Frontend | [ ] | `feature/SPR-002-T009-nextauth-config` | [ ] |
| T-010 | Frontend | [ ] | `feature/SPR-002-T010-trpc-auth-middleware` | [ ] |
| T-011 | Frontend | [ ] | `feature/SPR-002-T011-auth-router` | [ ] |
| T-012 | Frontend | [ ] | `feature/SPR-002-T012-login-ui` | [ ] |
| T-013 | Frontend | [ ] | `feature/SPR-002-T013-dashboard-layout` | [ ] |
| T-014 | Frontend | [ ] | `feature/SPR-002-T014-totp-mfa` | [ ] |
| T-015 | Frontend | [ ] | `feature/SPR-002-T015-mfa-ui` | [ ] |
| T-016 | Frontend | [ ] | `feature/SPR-002-T016-audit-logging` | [ ] |
| T-017 | Frontend | [ ] | `feature/SPR-002-T017-user-management-ui` | [ ] |

---

## Sprint Completion Criteria

- [ ] All 11 tasks pass acceptance criteria
- [ ] Login → dashboard flow works end-to-end
- [ ] MFA enrollment and verification works
- [ ] RBAC prevents unauthorized access to protected routes
- [ ] Audit logs capture all mutations
- [ ] All GOV compliance checks pass (Architect audit)
- [ ] All tests pass: `npm run lint && npm run typecheck && npm run test`
