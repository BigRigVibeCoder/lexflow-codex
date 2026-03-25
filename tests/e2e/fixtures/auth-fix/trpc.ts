import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, type UserRole, type Permission } from "@/lib/rbac";

export interface TRPCContext {
  session: { user: { id: string; email: string; name: string; role: UserRole } } | null;
  ip: string | null; userAgent: string | null;
}

export async function createContext(opts: { req: Request }): Promise<TRPCContext> {
  const session = await getServerSession(authOptions);
  return { session: session as TRPCContext["session"], ip: opts.req.headers.get("x-forwarded-for"), userAgent: opts.req.headers.get("user-agent") };
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) { return { ...shape, data: { ...shape.data, zodError: error.cause instanceof ZodError ? error.cause.flatten() : null } }; },
});

export const router = t.router;
export const publicProcedure = t.procedure;
const enforceAuth = t.middleware(({ ctx, next }) => { if (!ctx.session?.user) throw new TRPCError({ code: "UNAUTHORIZED" }); return next({ ctx: { ...ctx, user: ctx.session.user } }); });
export const protectedProcedure = t.procedure.use(enforceAuth);

export function permissionProcedure(...permissions: Permission[]) {
  return protectedProcedure.use(({ ctx, next }) => {
    for (const perm of permissions) if (!hasPermission(ctx.user.role, perm)) throw new TRPCError({ code: "FORBIDDEN", message: "Missing permission: " + perm });
    return next({ ctx });
  });
}
