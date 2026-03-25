---
id: HND-DEF-007
title: "Handoff: NextAuth v4 Auth Fix — Frontend Agent"
type: handoff
status: active
from: architect
to: frontend
created: 2025-03-25
priority: critical
tags: [authentication, nextauth, breaking-change, frontend]
---

# Handoff: NextAuth v4 Auth Fix

**From:** Architect Agent
**To:** Frontend Agent
**Date:** 2025-03-25
**Priority:** CRITICAL — read before writing any auth-related code

---

## What Happened

During E2E testing on lexflow-prod, login returned HTTP 500. The root cause was a NextAuth **v4/v5 API mismatch**: the codebase used v5 patterns (`{ handlers, auth } = NextAuth(...)`) against the installed `next-auth@4.24.13`.

**Fix commit:** `e2f4924` on `lexflow-frontend` main

---

## Breaking Changes to `@/lib/auth`

> [!CAUTION]
> The auth module API has changed. Any new code importing from `@/lib/auth` must use the v4 pattern shown below.

### Before (v5 — REMOVED)

```typescript
import { auth } from "@/lib/auth";
const session = await auth();

import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;

import { signIn, signOut } from "@/lib/auth";
```

### After (v4 — CURRENT)

```typescript
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
const session = await getServerSession(authOptions);

// Route handler
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

---

## Files Changed

| File | Summary |
|:-----|:--------|
| `src/lib/auth.ts` | Exports `authOptions: NextAuthOptions` (not `handlers`/`auth`) |
| `src/app/api/auth/[...nextauth]/route.ts` | Standard v4 route handler |
| `src/server/trpc.ts` | `getServerSession(authOptions)` for tRPC context |
| `src/app/(dashboard)/layout.tsx` | `getServerSession(authOptions)` for layout auth |

---

## Rules Going Forward

1. **Do NOT use v5 patterns** — `next-auth@4.24.13` is installed
2. **Server-side session:** Always use `getServerSession(authOptions)` from `"next-auth"`
3. **Client-side session:** Use `useSession()` from `"next-auth/react"` (unchanged in v4)
4. **New route handlers:** Never import `handlers` from `@/lib/auth` — it doesn't exist
5. **If upgrading to v5:** File an `EVO-` proposal first — it requires changes across the entire codebase

---

## Should We Upgrade to v5?

**Not now.** Here's the trade-off:

| Factor | v4 (current) | v5 (Auth.js) |
|:-------|:-------------|:-------------|
| Stability | Stable, production-proven | RC/beta, API still shifting |
| Next.js 16 compat | Works fine with App Router | Designed for App Router |
| Migration effort | None | ~20 files, new middleware pattern |
| Edge runtime | Not supported | Supported |
| Features | Sufficient for SPR-002 scope | Better middleware, providers |

**Recommendation:** Stay on v4 for sprints 2-8. Evaluate v5 upgrade as a separate `EVO-` proposal during SPR-008 (Polish & Hardening) if needed.

---

## Action Items for Frontend Agent

- [x] Pull latest `main` — auth fix is already merged
- [ ] Verify any new auth-related code uses v4 patterns
- [ ] Any server component needing auth: `getServerSession(authOptions)`
- [ ] Any API route needing auth: `getServerSession(authOptions)`
- [ ] Do NOT add `import { auth } from "@/lib/auth"` anywhere

---

## Reference

- **Defect:** [DEF-007](file:///home/bdavidriggins/Documents/lexflow/lexflow-codex/CODEX/50_DEFECTS/DEF-007_NextAuth_v4v5_Mismatch.md)
- **Commit:** `e2f4924` on `lexflow-frontend` main
- **Tested on:** lexflow-prod (`34.73.108.242`) — login → dashboard verified
