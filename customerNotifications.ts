import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get customer notifications
export const getMyNotifications = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("customerNotifications")
      .withIndex("by_customer", (q) => q.eq("customerId", userId))
      .order("desc")
      .take(args.limit ?? 20);
  },
});

// Mark notification as read
export const markNotificationRead = mutation({
  args: { notificationId: v.id("customerNotifications") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please sign in");

    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.customerId !== userId) {
      throw new Error("Notification not found");
    }

    await ctx.db.patch(args.notificationId, { isRead: true });
  },
});

// Count unread notifications
export const countUnread = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;

    const unread = await ctx.db
      .query("customerNotifications")
      .withIndex("by_customer_read", (q) => 
        q.eq("customerId", userId).eq("isRead", false)
      )
      .collect();
    
    return unread.length;
  },
});

// Mark all notifications as read
export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please sign in");

    const unread = await ctx.db
      .query("customerNotifications")
      .withIndex("by_customer_read", (q) => 
        q.eq("customerId", userId).eq("isRead", false)
      )
      .collect();

    await Promise.all(
      unread.map((n) => ctx.db.patch(n._id, { isRead: true }))
    );

    return { marked: unread.length };
  },
});
