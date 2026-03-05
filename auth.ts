import { QueryCtx, MutationCtx } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "../_generated/dataModel";

export type AuthUser = {
  userId: Id<"users">;
  // Add identity info for debugging
  tokenIdentifier?: string;
};

/**
 * Get the authenticated user's ID with detailed logging for debugging.
 * Returns null if not authenticated (never throws).
 */
export async function getAuthUser(
  ctx: QueryCtx | MutationCtx
): Promise<AuthUser | null> {
  try {
    const userId = await getAuthUserId(ctx);
    
    if (!userId) {
      console.log("[AUTH] No authenticated user");
      return null;
    }
    
    console.log("[AUTH] User authenticated:", { userId: userId.toString() });
    
    return {
      userId,
    };
  } catch (error) {
    console.error("[AUTH] Error getting user:", error);
    return null;
  }
}

/**
 * Require authentication - throws if not authenticated.
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<AuthUser> {
  const user = await getAuthUser(ctx);
  if (!user) {
    throw new Error("UNAUTHORIZED: Please sign in");
  }
  return user;
}
