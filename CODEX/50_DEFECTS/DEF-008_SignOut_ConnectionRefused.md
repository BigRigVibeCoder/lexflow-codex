---
id: DEF-008
title: "Sign Out Causes ERR_CONNECTION_REFUSED"
type: defect
status: OPEN
severity: medium
priority: P2
owner: frontend
agents: [frontend]
tags: [defect, auth, nextauth, production]
related: [DEF-007, SPR-008, T-094]
created: 2026-03-25
updated: 2026-03-25
version: 1.0.0
---

# DEF-008: Sign Out Causes ERR_CONNECTION_REFUSED

## Summary

Clicking "Sign Out" on the dashboard triggers `net::ERR_CONNECTION_REFUSED` in the browser. The signout POST succeeds server-side but the redirect fails because `NEXTAUTH_URL=http://localhost:3000` inside the Docker container doesn't resolve to the public-facing URL.

## Root Cause (Hypothesis)

NextAuth v4's `signOut()` client-side call POSTs to `/api/auth/signout` and then redirects to `NEXTAUTH_URL`. Inside the Docker container, `NEXTAUTH_URL=http://localhost:3000`, which is correct for server-side operations but wrong for client-side redirects — the browser can't reach `localhost:3000` on the server.

## Steps to Reproduce

1. Login to `http://34.26.122.46` as admin
2. Click "Sign Out" button in top-right
3. Browser shows `ERR_CONNECTION_REFUSED`

## Expected Behavior

User is redirected to `/login` after signing out.

## Fix Options

1. **Set `NEXTAUTH_URL` to the public URL** (`http://34.26.122.46`) in the Docker container environment
2. **Use `callbackUrl` parameter** in `signOut({ callbackUrl: '/login' })` to force redirect to relative path
3. **Configure separate `NEXTAUTH_URL_INTERNAL`** (NextAuth v4 supports this for server-side, with `NEXTAUTH_URL` for client-side)

## Discovered By

Architect E2E test run (2026-03-25), Flow 1 test 4.

## Evidence

```
Error: page.waitForURL: net::ERR_CONNECTION_REFUSED
=========================== logs ===========================
waiting for navigation to "**/login**" until "load"
============================================================
```
