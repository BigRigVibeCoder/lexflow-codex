---
id: DEF-007
title: "NextAuth v4/v5 API Mismatch — 500 on Login"
type: defect
status: resolved
severity: critical
sprint: SPR-002
owner: architect
created: 2025-03-25
resolved: 2025-03-25
tags: [authentication, nextauth, production, frontend]
---

# DEF-007: NextAuth v4/v5 API Mismatch — 500 on Login

## Summary

Production login returned HTTP 500 on `/api/auth/providers` and `/api/auth/callback/credentials`. The frontend codebase used NextAuth **v5** API patterns against a **v4.24.13** dependency.

## Root Cause

`next-auth@4.24.13` is installed in `package.json`, but 4 source files used the NextAuth v5 (Auth.js) destructuring pattern:

```typescript
// v5 pattern (WRONG for v4)
export const { handlers, auth, signIn, signOut } = NextAuth({...});
```

In v4, `NextAuth()` returns a single handler function, not an object with `{ handlers, auth, signIn, signOut }`. This caused `handlers` to be `undefined`, crashing every auth-related request.

## Affected Files

| File | v5 pattern (broken) | v4 pattern (fixed) |
|:-----|:-------------------|:-------------------|
| `src/lib/auth.ts` | `export const { handlers, auth } = NextAuth(...)` | `export const authOptions: NextAuthOptions = {...}` |
| `src/app/api/auth/[...nextauth]/route.ts` | `handlers.GET` / `handlers.POST` | `const handler = NextAuth(authOptions)` |
| `src/server/trpc.ts` | `import { auth }` → `auth()` | `getServerSession(authOptions)` |
| `src/app/(dashboard)/layout.tsx` | `import("@/lib/auth")` → `auth()` | `getServerSession(authOptions)` |

## Server Error Logs

```
TypeError: Cannot read properties of undefined (reading 'GET')
TypeError: Cannot read properties of undefined (reading 'POST')
TypeError: g is not a function
```

## Resolution

Fixed all 4 files to use the NextAuth v4 API pattern. Docker image rebuilt and deployed to lexflow-prod. Login verified working.

**Commit:** `e2f4924` on `lexflow-frontend` main

## Impact

- **BREAKING:** `@/lib/auth` no longer exports `handlers`, `auth`, `signIn`, `signOut`
- **New export:** `authOptions: NextAuthOptions`
- **Session access:** Use `getServerSession(authOptions)` from `"next-auth"` instead of `auth()` from `"@/lib/auth"`

## Lessons Learned

1. The frontend agent likely generated code using v5 documentation while v4 was installed. Always verify the installed package version matches the API patterns used.
2. NextAuth v4 and v5 have fundamentally incompatible APIs — this is not a minor version difference.
3. The build passed in some configurations because Turbopack can defer module evaluation, but runtime always fails when `NextAuth()` doesn't return the expected shape.
