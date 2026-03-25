import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { verify } from "argon2";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { logger } from "@/lib/logger";

const MAX_FAIL = 5, LOCK_MS = 15 * 60 * 1000;
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8), totpCode: z.string().length(6).optional() });

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  providers: [Credentials({
    credentials: { email: { type: "email" }, password: { type: "password" }, totpCode: { type: "text" } },
    async authorize(credentials) {
      const parsed = loginSchema.safeParse(credentials);
      if (!parsed.success) return null;
      const { email, password } = parsed.data;
      const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
      if (!user || user.status !== "active") { logger.warn({ email }, "auth.login.rejected"); return null; }
      if (user.lockedUntil && user.lockedUntil > new Date()) { logger.warn({ email }, "auth.login.locked"); return null; }
      const valid = await verify(user.passwordHash, password);
      if (!valid) {
        const n = user.failedLoginCount + 1;
        await db.update(users).set({ failedLoginCount: n, lockedUntil: n >= MAX_FAIL ? new Date(Date.now() + LOCK_MS) : null }).where(eq(users.id, user.id));
        logger.warn({ email, attempt: n }, "auth.login.failed"); return null;
      }
      if (user.totpEnabled) logger.debug({ email }, "auth.mfa.required");
      await db.update(users).set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, user.id));
      logger.info({ email, userId: user.id }, "auth.login.success");
      return { id: user.id, email: user.email, name: user.fullName, role: user.role };
    },
  })],
  callbacks: {
    async jwt({ token, user }) { if (user) { token.id = user.id; token.role = (user as unknown as { role: string }).role; } return token; },
    async session({ session, token }) { if (session.user) { session.user.id = token.id as string; (session.user as { role: string }).role = token.role as string; } return session; },
  },
};
