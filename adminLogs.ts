import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/adminAuth";

// Log an admin action (internal use)
export const logAdminAction = internalMutation({
  args: {
    adminId: v.union(v.id("users"), v.id("adminCredentials")), // Support both auth systems
    action: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    details: v.optional(v.any()),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("adminLogs", {
      adminId: args.adminId,
      action: args.action,
      targetType: args.targetType,
      targetId: args.targetId,
      details: args.details,
      ipAddress: args.ipAddress,
      timestamp: Date.now(),
    });
  },
});

// Query admin logs (admin only)
export const listAdminLogs = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      return [];
    }

    const limit = args.limit ?? 100;
    return await ctx.db.query("adminLogs").order("desc").take(limit);
  },
});
