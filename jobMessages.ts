import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// List messages for a job
export const listJobMessages = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Get the job
    const job = await ctx.db.get(args.jobId);
    if (!job) return [];

    // Verify user is customer or courier for this job
    const isCustomer = job.customerId === userId;
    const isCourier = job.courierId === userId;

    if (!isCustomer && !isCourier) {
      return [];
    }

    const messages = await ctx.db
      .query("jobMessages")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .order("asc")
      .collect();

    // Get sender names
    const messagesWithNames = await Promise.all(
      messages.map(async (msg) => {
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", msg.senderUserId))
          .unique();
        return {
          ...msg,
          senderName: profile?.name || "Unknown",
        };
      })
    );

    return messagesWithNames;
  },
});

// Send a message for a job
export const sendJobMessage = mutation({
  args: {
    jobId: v.id("jobs"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in to send a message");
    }

    if (!args.body.trim()) {
      throw new Error("Message cannot be empty");
    }

    // Get the job
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    // Verify user is customer or courier for this job
    const isCustomer = job.customerId === userId;
    const isCourier = job.courierId === userId;

    if (!isCustomer && !isCourier) {
      throw new Error("You are not authorized to message on this job");
    }

    // Courier must be assigned
    if (!job.courierId) {
      throw new Error("No courier assigned to this job yet");
    }

    const senderRole = isCustomer ? "customer" : "courier";
    const now = Date.now();

    await ctx.db.insert("jobMessages", {
      jobId: args.jobId,
      senderRole,
      senderUserId: userId,
      body: args.body.trim(),
      createdAt: now,
    });

    // Create notification for the other party
    if (isCustomer && job.courierId) {
      await ctx.db.insert("courierNotifications", {
        courierId: job.courierId,
        type: "job_message",
        title: "New Message",
        message: `Customer sent a message: "${args.body.trim().substring(0, 50)}..."`,
        isRead: false,
        createdAt: now,
      });

      // Send push notification to courier
      await ctx.scheduler.runAfter(0, internal.notificationsActions.sendPushToUser, {
        userId: job.courierId,
        title: "New Message 💬",
        message: `Customer: "${args.body.trim().substring(0, 50)}${args.body.length > 50 ? '...' : ''}"`,
        url: `/courier/active-job`,
        data: { jobId: args.jobId, type: "job_message" },
      });
    } else if (isCourier) {
      await ctx.db.insert("customerNotifications", {
        customerId: job.customerId,
        jobId: args.jobId,
        type: "job_message",
        title: "New Message from Courier",
        message: `Courier sent a message: "${args.body.trim().substring(0, 50)}..."`,
        isRead: false,
        createdAt: now,
      });

      // Send push notification to customer
      await ctx.scheduler.runAfter(0, internal.notificationsActions.sendPushToUser, {
        userId: job.customerId,
        title: "New Message from Courier 💬",
        message: `${args.body.trim().substring(0, 50)}${args.body.length > 50 ? '...' : ''}`,
        url: `/customer/tracking/${args.jobId}`,
        data: { jobId: args.jobId, type: "job_message" },
      });
    }

    return { success: true };
  },
});

// Mark job messages as read
export const markJobRead = mutation({
  args: {
    jobId: v.id("jobs"),
    viewerRole: v.union(v.literal("customer"), v.literal("courier")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in");
    }

    const job = await ctx.db.get(args.jobId);
    if (!job) return { success: false };

    // Verify access
    const isCustomer = job.customerId === userId;
    const isCourier = job.courierId === userId;

    if (args.viewerRole === "customer" && !isCustomer) {
      return { success: false };
    }
    if (args.viewerRole === "courier" && !isCourier) {
      return { success: false };
    }

    const now = Date.now();
    const messages = await ctx.db
      .query("jobMessages")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    for (const msg of messages) {
      if (args.viewerRole === "customer" && msg.senderRole === "courier" && !msg.readByCustomerAt) {
        await ctx.db.patch(msg._id, { readByCustomerAt: now });
      }
      if (args.viewerRole === "courier" && msg.senderRole === "customer" && !msg.readByCourierAt) {
        await ctx.db.patch(msg._id, { readByCourierAt: now });
      }
    }

    return { success: true };
  },
});

// Get unread count for a job
export const getUnreadCount = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;

    const job = await ctx.db.get(args.jobId);
    if (!job) return 0;

    const isCustomer = job.customerId === userId;
    const isCourier = job.courierId === userId;

    if (!isCustomer && !isCourier) return 0;

    const messages = await ctx.db
      .query("jobMessages")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();

    if (isCustomer) {
      return messages.filter((m) => m.senderRole === "courier" && !m.readByCustomerAt).length;
    } else {
      return messages.filter((m) => m.senderRole === "customer" && !m.readByCourierAt).length;
    }
  },
});
