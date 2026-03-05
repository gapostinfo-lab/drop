import { QueryCtx, MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export type AdminId = Id<"adminCredentials">;

/**
 * Check if any admin exists in the system.
 * This is used for admin dashboard queries.
 * 
 * IMPORTANT: This function should NOT throw errors for queries.
 * Throwing causes the query to fail and UI shows skeleton forever.
 * 
 * For queries: Returns admin ID if exists, null otherwise
 * For mutations: Can throw if needed for security
 */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx,
  options?: { throwOnMissing?: boolean }
): Promise<AdminId | null> {
  // Check if any admin exists
  const admin = await ctx.db.query("adminCredentials").first();
  
  if (!admin) {
    console.log("[requireAdmin] No admin exists in system");
    
    // Only throw if explicitly requested (for mutations)
    if (options?.throwOnMissing) {
      throw new Error("AUTH_REQUIRED: No admin configured");
    }
    
    return null;
  }
  
  // Return the admin ID (client handles session validation)
  return admin._id;
}

/**
 * Strict version that throws - use for mutations that require admin
 */
export async function requireAdminStrict(
  ctx: QueryCtx | MutationCtx
): Promise<AdminId> {
  const adminId = await requireAdmin(ctx, { throwOnMissing: true });
  if (!adminId) {
    throw new Error("AUTH_REQUIRED: No admin configured");
  }
  return adminId;
}

/**
 * Validate admin session token
 */
export async function validateAdminSession(
  ctx: QueryCtx | MutationCtx,
  token: string | null
): Promise<{ valid: boolean; adminId?: AdminId; email?: string }> {
  if (!token) {
    return { valid: false };
  }
  
  const session = await ctx.db
    .query("adminSessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  
  if (!session || session.expiresAt < Date.now()) {
    return { valid: false };
  }
  
  return {
    valid: true,
    adminId: session.adminId,
    email: session.email,
  };
}
