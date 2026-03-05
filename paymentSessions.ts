import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAdmin } from "./lib/adminAuth";

// Generate a unique session ID
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `ps_${timestamp}_${random}`;
}

// Create a new payment session
export const createSession = mutation({
  args: {
    jobId: v.id("jobs"),
    amount: v.number(),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in to continue");
    }

    // Verify the job exists and belongs to this user
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }
    if (job.customerId !== userId) {
      throw new Error("Not authorized");
    }
    if (job.status !== "draft") {
      throw new Error("Job is not in draft status");
    }

    // Check for existing pending session for this job
    const existingSession = await ctx.db
      .query("paymentSessions")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingSession) {
      // Return existing session if still valid (less than 30 min old)
      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
      if (existingSession.createdAt > thirtyMinutesAgo) {
        return {
          sessionId: existingSession.sessionId,
          _id: existingSession._id,
        };
      }
      // Mark old session as expired
      await ctx.db.patch(existingSession._id, { status: "expired" });
    }

    const sessionId = generateSessionId();

    const id = await ctx.db.insert("paymentSessions", {
      customerId: userId,
      jobId: args.jobId,
      sessionId,
      amount: args.amount,
      currency: args.currency || "USD",
      status: "pending",
      createdAt: Date.now(),
    });

    return { sessionId, _id: id };
  },
});

// Update session with checkout URL
export const updateCheckoutUrl = mutation({
  args: {
    sessionId: v.string(),
    checkoutId: v.string(),
    checkoutUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in to continue");
    }

    const session = await ctx.db
      .query("paymentSessions")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) {
      throw new Error("Session not found");
    }
    if (session.customerId !== userId) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(session._id, {
      checkoutId: args.checkoutId,
      checkoutUrl: args.checkoutUrl,
      status: "processing",
      processedAt: Date.now(),
    });

    return session._id;
  },
});

// Get session by ID (for verification on return)
export const getSession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("paymentSessions")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) return null;

    // Get associated job
    const job = await ctx.db.get(session.jobId);

    return {
      ...session,
      job,
    };
  },
});

// Verify and complete payment (called on success return)
export const verifyAndComplete = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in to continue");
    }

    const session = await ctx.db
      .query("paymentSessions")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) {
      throw new Error("Payment session not found");
    }
    if (session.customerId !== userId) {
      throw new Error("Not authorized");
    }

    // Check if already completed (idempotency)
    if (session.status === "paid") {
      return { success: true, jobId: session.jobId, alreadyCompleted: true };
    }

    // Check if session is expired
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    if (session.createdAt < thirtyMinutesAgo) {
      await ctx.db.patch(session._id, { status: "expired" });
      throw new Error("Payment session has expired. Please try again.");
    }

    // Mark session as paid
    await ctx.db.patch(session._id, {
      status: "paid",
      completedAt: Date.now(),
      verifiedAt: Date.now(),
      verificationMethod: "redirect",
    });

    // Update job to requested status
    const job = await ctx.db.get(session.jobId);
    if (job && job.status === "draft") {
      await ctx.db.patch(session.jobId, {
        status: "requested",
        paymentStatus: "paid",
        paymentId: session.checkoutId || session.sessionId,
        paymentAmount: session.amount,
        paymentCurrency: session.currency,
        paidAt: Date.now(),
      });

      // Send booking confirmation notification
      await ctx.db.insert("customerNotifications", {
        customerId: userId,
        jobId: session.jobId,
        type: "booking_confirmed",
        title: "Booking Confirmed! 📋",
        message:
          "Your pickup has been booked and paid. We're finding a courier for you.",
        isRead: false,
        createdAt: Date.now(),
      });

      // Create payment transaction record
      await ctx.db.insert("transactions", {
        jobId: session.jobId,
        type: "payment",
        amount: session.amount,
        customerId: userId,
        status: "completed",
        createdAt: Date.now(),
        completedAt: Date.now(),
        metadata: {
          sessionId: session.sessionId,
          checkoutId: session.checkoutId,
        },
      });
    }

    return { success: true, jobId: session.jobId, alreadyCompleted: false };
  },
});

// Mark session as cancelled
export const cancelSession = mutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in to continue");
    }

    const session = await ctx.db
      .query("paymentSessions")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();

    if (!session) {
      throw new Error("Session not found");
    }
    if (session.customerId !== userId) {
      throw new Error("Not authorized");
    }

    // Only cancel if still pending/processing
    if (session.status === "pending" || session.status === "processing") {
      await ctx.db.patch(session._id, {
        status: "cancelled",
        completedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Admin: List all payment sessions
export const listSessions = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      return [];
    }

    let sessions = await ctx.db
      .query("paymentSessions")
      .order("desc")
      .collect();

    if (args.status) {
      sessions = sessions.filter((s) => s.status === args.status);
    }

    if (args.limit) {
      sessions = sessions.slice(0, args.limit);
    }

    // Enrich with customer and job info
    const enriched = await Promise.all(
      sessions.map(async (session) => {
        const customer = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", session.customerId))
          .unique();
        const job = await ctx.db.get(session.jobId);

        return {
          ...session,
          customerName: customer?.name || "Unknown",
          customerEmail: customer?.email || "Unknown",
          jobStatus: job?.status,
        };
      })
    );

    return enriched;
  },
});

// Admin: Get session stats
export const getSessionStats = query({
  args: {},
  handler: async (ctx) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      return {
        total: 0,
        pending: 0,
        processing: 0,
        paid: 0,
        failed: 0,
        cancelled: 0,
        expired: 0,
      };
    }

    const sessions = await ctx.db.query("paymentSessions").collect();

    const stats = {
      total: sessions.length,
      pending: sessions.filter((s) => s.status === "pending").length,
      processing: sessions.filter((s) => s.status === "processing").length,
      paid: sessions.filter((s) => s.status === "paid").length,
      failed: sessions.filter((s) => s.status === "failed").length,
      cancelled: sessions.filter((s) => s.status === "cancelled").length,
      expired: sessions.filter((s) => s.status === "expired").length,
    };

    return stats;
  },
});
