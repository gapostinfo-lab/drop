import { mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ============================================
// MUTATION: Save OneSignal subscription ID to user profile
// ============================================
export const saveOneSignalId = mutation({
  args: {
    oneSignalId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in to enable notifications");
    }

    // Find user's profile
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("User profile not found");
    }

    // Update profile with OneSignal ID
    await ctx.db.patch(profile._id, {
      oneSignalId: args.oneSignalId,
    });

    console.log("[notifications] Saved OneSignal ID for user:", userId, "->", args.oneSignalId.substring(0, 8) + "...");

    return { success: true };
  },
});

// ============================================
// MUTATION: Remove OneSignal ID (for logout/unsubscribe)
// ============================================
export const removeOneSignalId = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { success: false };

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (profile && profile.oneSignalId) {
      await ctx.db.patch(profile._id, {
        oneSignalId: undefined,
      });
    }

    return { success: true };
  },
});

// ============================================
// INTERNAL QUERIES: Helper queries for actions
// ============================================

export const getProfileByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

export const getProfilesByUserIds = internalQuery({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    const profiles = await Promise.all(
      args.userIds.map((userId) =>
        ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique()
      )
    );
    return profiles.filter((p): p is NonNullable<typeof p> => p !== null);
  },
});

export const getOnlineCouriers = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Get approved, online courier applications
    const applications = await ctx.db
      .query("courierApplications")
      .withIndex("by_online", (q) => q.eq("isOnline", true).eq("status", "approved"))
      .collect();

    // Get their profiles with OneSignal IDs
    const profiles = await Promise.all(
      applications.map((app) =>
        ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", app.userId))
          .unique()
      )
    );

    return profiles.filter((p): p is NonNullable<typeof p> => p !== null);
  },
});
