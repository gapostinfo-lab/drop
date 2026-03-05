import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAdmin, requireAdminStrict } from "./lib/adminAuth";

export const createTransaction = internalMutation({
  args: {
    jobId: v.optional(v.id("jobs")),
    type: v.union(
      v.literal("payment"),
      v.literal("payout"),
      v.literal("refund"),
      v.literal("commission")
    ),
    amount: v.number(),
    customerId: v.optional(v.id("users")),
    courierId: v.optional(v.id("users")),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("transactions", {
      jobId: args.jobId,
      type: args.type,
      amount: args.amount,
      customerId: args.customerId,
      courierId: args.courierId,
      status: args.status,
      createdAt: Date.now(),
      completedAt: args.status === "completed" ? Date.now() : undefined,
      metadata: args.metadata,
    });
  },
});

export const listTransactions = query({
  args: {
    type: v.optional(
      v.union(
        v.literal("payment"),
        v.literal("payout"),
        v.literal("refund"),
        v.literal("commission")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verify admin access
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      return [];
    }

    const limit = args.limit ?? 100;

    if (args.type) {
      return await ctx.db
        .query("transactions")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db.query("transactions").order("desc").take(limit);
  },
});

export const getTransactionsByJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in to view transactions");
    }

    // Get the job to check permissions
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    // Allow customer, courier, or admin
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const isAdmin = profile?.role === "admin";
    const isCustomer = job.customerId === userId;
    const isCourier = job.courierId === userId;

    if (!isAdmin && !isCustomer && !isCourier) {
      throw new Error("You don't have permission to view these transactions");
    }

    return await ctx.db
      .query("transactions")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .collect();
  },
});

export const getMyTransactions = query({
  args: {
    type: v.optional(
      v.union(
        v.literal("payment"),
        v.literal("payout"),
        v.literal("refund"),
        v.literal("commission")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const limit = args.limit ?? 50;

    // Get transactions where user is customer or courier
    const customerTransactions = await ctx.db
      .query("transactions")
      .withIndex("by_customer", (q) => q.eq("customerId", userId))
      .order("desc")
      .take(limit);

    const courierTransactions = await ctx.db
      .query("transactions")
      .withIndex("by_courier", (q) => q.eq("courierId", userId))
      .order("desc")
      .take(limit);

    // Merge and sort by createdAt
    const all = [...customerTransactions, ...courierTransactions];
    all.sort((a, b) => b.createdAt - a.createdAt);

    // Filter by type if specified
    const filtered = args.type ? all.filter((t) => t.type === args.type) : all;

    return filtered.slice(0, limit);
  },
});

export const issueRefund = mutation({
  args: {
    jobId: v.id("jobs"),
    amount: v.optional(v.number()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdminStrict(ctx);

    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    const refundAmount = args.amount ?? job.totalPrice;

    if (refundAmount > job.totalPrice) {
      throw new Error("Refund amount cannot exceed the total price");
    }

    // Update job payment status
    await ctx.db.patch(args.jobId, {
      paymentStatus: "refunded",
    });

    // Create refund transaction
    const refundId = await ctx.db.insert("transactions", {
      jobId: args.jobId,
      type: "refund",
      amount: refundAmount,
      customerId: job.customerId,
      status: "completed",
      createdAt: Date.now(),
      completedAt: Date.now(),
      metadata: { reason: args.reason, issuedBy: adminId },
    });

    // Log admin action
    await ctx.scheduler.runAfter(0, internal.adminLogs.logAdminAction, {
      adminId,
      action: "refund_issued",
      targetType: "transaction",
      targetId: args.jobId,
      details: {
        refundAmount,
        reason: args.reason,
        originalAmount: job.totalPrice,
        customerId: job.customerId,
        refundTransactionId: refundId,
      },
    });

    return refundId;
  },
});

export const updateTransactionStatus = mutation({
  args: {
    transactionId: v.id("transactions"),
    status: v.union(
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdminStrict(ctx);

    const transaction = await ctx.db.get(args.transactionId);
    if (!transaction) {
      throw new Error("Transaction not found");
    }

    const previousStatus = transaction.status;

    const updates: Record<string, unknown> = { status: args.status };
    if (args.status === "completed") {
      updates.completedAt = Date.now();
    }

    await ctx.db.patch(args.transactionId, updates);

    // Log admin action
    await ctx.scheduler.runAfter(0, internal.adminLogs.logAdminAction, {
      adminId,
      action: "transaction_status_updated",
      targetType: "transaction",
      targetId: args.transactionId,
      details: {
        previousStatus,
        newStatus: args.status,
        transactionType: transaction.type,
        amount: transaction.amount,
      },
    });

    return args.transactionId;
  },
});
