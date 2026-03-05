import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireAdminStrict } from "./lib/adminAuth";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

// List all payouts
export const listPayouts = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("paid"),
        v.literal("failed")
      )
    ),
    courierId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      return [];
    }

    let payouts = await ctx.db.query("payoutLedger").order("desc").collect();

    if (args.status) {
      payouts = payouts.filter((p) => p.status === args.status);
    }
    if (args.courierId) {
      payouts = payouts.filter((p) => p.courierId === args.courierId);
    }

    const payoutsWithDetails = await Promise.all(
      payouts.map(async (p) => {
        const courier = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", p.courierId))
          .unique();
        
        // Fetch courier application for payout method details
        const courierApplication = await ctx.db
          .query("courierApplications")
          .withIndex("by_user", (q) => q.eq("userId", p.courierId))
          .unique();
        
        // Format payout details based on method
        let courierPayoutDetails: string | null = null;
        if (courierApplication?.payoutMethod) {
          switch (courierApplication.payoutMethod) {
            case "zelle":
              courierPayoutDetails = courierApplication.payoutEmail || courierApplication.payoutPhone || null;
              break;
            case "cashapp":
              courierPayoutDetails = courierApplication.payoutHandle 
                ? `$${courierApplication.payoutHandle.replace(/^\$/, '')}` 
                : null;
              break;
            case "bank_transfer":
              if (courierApplication.payoutBankName && courierApplication.payoutAccountLast4) {
                courierPayoutDetails = `${courierApplication.payoutBankName} ****${courierApplication.payoutAccountLast4}`;
              }
              break;
          }
        }
        
        return {
          ...p,
          courierName: courier?.name || "Unknown Courier",
          courierEmail: courier?.email || "Unknown Email",
          courierPayoutMethod: courierApplication?.payoutMethod || null,
          courierPayoutDetails,
          courierPayoutSetupComplete: courierApplication?.payoutSetupStatus === "complete",
        };
      })
    );

    return payoutsWithDetails;
  },
});

// Get payout summary by courier
export const getPayoutSummaryByCourier = query({
  args: {},
  handler: async (ctx) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      return {};
    }

    const payouts = await ctx.db.query("payoutLedger").collect();
    const courierSummary: Record<
      string,
      { pending: number; paid: number; total: number }
    > = {};

    for (const payout of payouts) {
      const courierId = payout.courierId;
      if (!courierSummary[courierId]) {
        courierSummary[courierId] = { pending: 0, paid: 0, total: 0 };
      }
      courierSummary[courierId].total += payout.amount;
      if (payout.status === "pending" || payout.status === "processing") {
        courierSummary[courierId].pending += payout.amount;
      } else if (payout.status === "paid") {
        courierSummary[courierId].paid += payout.amount;
      }
    }

    return courierSummary;
  },
});

// Mark payout as paid (manual)
export const markPayoutPaid = mutation({
  args: {
    payoutId: v.id("payoutLedger"),
    paymentMethod: v.string(),
    paymentReference: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdminStrict(ctx);

    const payout = await ctx.db.get(args.payoutId);
    if (!payout) throw new Error("Payout not found");

    if (payout.status === "paid") {
      throw new Error("Payout already marked as paid");
    }

    await ctx.db.patch(args.payoutId, {
      status: "paid",
      paidAt: Date.now(),
      paidBy: adminId,
      paymentMethod: args.paymentMethod,
      paymentReference: args.paymentReference,
      notes: args.notes,
    });

    // Log admin action
    await ctx.scheduler.runAfter(0, internal.adminLogs.logAdminAction, {
      adminId,
      action: "payout_marked_paid",
      targetType: "payout",
      targetId: args.payoutId,
      details: {
        courierId: payout.courierId,
        amount: payout.amount,
        paymentMethod: args.paymentMethod,
        paymentReference: args.paymentReference,
      },
    });

    return args.payoutId;
  },
});

// Batch mark payouts as paid
export const batchMarkPayoutsPaid = mutation({
  args: {
    payoutIds: v.array(v.id("payoutLedger")),
    paymentMethod: v.string(),
    paymentReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdminStrict(ctx);

    for (const payoutId of args.payoutIds) {
      const payout = await ctx.db.get(payoutId);
      if (payout && payout.status !== "paid") {
        await ctx.db.patch(payoutId, {
          status: "paid",
          paidAt: Date.now(),
          paidBy: adminId,
          paymentMethod: args.paymentMethod,
          paymentReference: args.paymentReference,
        });
      }
    }

    // Log admin action
    await ctx.scheduler.runAfter(0, internal.adminLogs.logAdminAction, {
      adminId,
      action: "batch_payouts_marked_paid",
      targetType: "payout",
      targetId: "batch",
      details: {
        count: args.payoutIds.length,
        paymentMethod: args.paymentMethod,
      },
    });

    return args.payoutIds.length;
  },
});

// ============================================
// Courier Payout Setup (Whop Connected Accounts)
// ============================================

// Query: Get courier's payout status
export const getPayoutStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const application = await ctx.db
      .query("courierApplications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!application) return null;

    return {
      status: application.payoutSetupStatus || "not_started",
      whopConnectedAccountId: application.whopConnectedAccountId,
      lastPayoutSetupAt: application.lastPayoutSetupAt,
      isApproved: application.status === "approved",
      canGoOnline: application.status === "approved" && application.payoutSetupStatus === "complete",
      // Manual payout info
      payoutMethod: application.payoutMethod,
      payoutEmail: application.payoutEmail,
      payoutPhone: application.payoutPhone,
      payoutBankName: application.payoutBankName,
      payoutAccountLast4: application.payoutAccountLast4,
      payoutHandle: application.payoutHandle,
    };
  },
});

// Internal query to get courier application by auth subject
export const getCourierApplicationInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Method 1: Try to find profile by matching userId string directly
    const profiles = await ctx.db.query("profiles").collect();
    
    let profile = profiles.find((p) => p.userId.toString() === args.userId);
    
    // Method 2: If not found, try matching the tokenIdentifier format
    // Convex Auth stores the user ID in format like "https://xyz.convex.cloud|userId"
    if (!profile) {
      profile = profiles.find((p) => {
        const userIdStr = p.userId.toString();
        return args.userId.includes(userIdStr) || userIdStr.includes(args.userId);
      });
    }
    
    // Method 3: Try extracting ID from tokenIdentifier format
    if (!profile && args.userId.includes('|')) {
      const parts = args.userId.split('|');
      const extractedId = parts[parts.length - 1];
      profile = profiles.find((p) => p.userId.toString() === extractedId);
    }
    
    if (!profile) {
      return null;
    }
    
    if (profile.role !== "courier") {
      return null;
    }
    
    // Now find the courier application
    const application = await ctx.db
      .query("courierApplications")
      .withIndex("by_user", (q) => q.eq("userId", profile.userId))
      .unique();
    
    return application;
  },
});

// Internal mutation to save Whop company ID
export const saveWhopCompanyId = internalMutation({
  args: {
    applicationId: v.id("courierApplications"),
    whopConnectedAccountId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.applicationId, {
      whopConnectedAccountId: args.whopConnectedAccountId,
      payoutSetupStatus: "pending",
      lastPayoutSetupAt: Date.now(),
    });
  },
});

// Internal mutation to update payout status
export const updatePayoutStatus = internalMutation({
  args: {
    applicationId: v.id("courierApplications"),
    status: v.union(v.literal("not_started"), v.literal("pending"), v.literal("complete")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.applicationId, {
      payoutSetupStatus: args.status,
      lastPayoutSetupAt: Date.now(),
    });
  },
});

// Mutation: Mark payout setup as complete (called when returning from portal - legacy)
export const completePayoutSetup = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please sign in");

    const application = await ctx.db
      .query("courierApplications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!application) throw new Error("No courier application found");

    // Only update if they have a Whop account
    if (!application.whopConnectedAccountId) {
      throw new Error("Please complete payout setup first");
    }

    await ctx.db.patch(application._id, {
      payoutSetupStatus: "complete",
      lastPayoutSetupAt: Date.now(),
    });

    return { success: true };
  },
});

// Save manual payout method (MVP)
export const savePayoutMethod = mutation({
  args: {
    method: v.union(
      v.literal("bank_transfer"),
      v.literal("cashapp"),
      v.literal("zelle")
    ),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    bankName: v.optional(v.string()),
    accountLast4: v.optional(v.string()),
    handle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please sign in");

    const application = await ctx.db
      .query("courierApplications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!application) throw new Error("No courier application found");

    // Validate required fields based on method
    if (args.method === "cashapp" && !args.handle) {
      throw new Error("Cash App $cashtag is required");
    }
    if (args.method === "zelle" && !args.email && !args.phone) {
      throw new Error("Zelle email or phone number is required");
    }
    if (args.method === "bank_transfer" && (!args.bankName || !args.accountLast4)) {
      throw new Error("Bank name and last 4 digits of account are required");
    }

    await ctx.db.patch(application._id, {
      payoutMethod: args.method,
      payoutEmail: args.email,
      payoutPhone: args.phone,
      payoutBankName: args.bankName,
      payoutAccountLast4: args.accountLast4,
      payoutHandle: args.handle,
      payoutSetupStatus: "complete",
      lastPayoutSetupAt: Date.now(),
    });

    return { success: true };
  },
});

// ============================================
// Courier Payout History (Self-Service)
// ============================================

// Get payout history for the current courier
export const getMyCourierPayouts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const payouts = await ctx.db
      .query("payoutLedger")
      .withIndex("by_courier", (q) => q.eq("courierId", userId))
      .order("desc")
      .collect();

    // Join with jobs to get job details
    const payoutsWithDetails = await Promise.all(
      payouts.map(async (payout) => {
        const job = await ctx.db.get(payout.jobId);
        return {
          ...payout,
          jobPickupAddress: job?.pickupAddress || "Unknown",
          jobDropoffLocation: job?.dropoffLocationName || "Unknown",
          jobCompletedAt: job?.completedAt,
        };
      })
    );

    return payoutsWithDetails;
  },
});

// Get earnings summary for current courier
export const getMyCourierEarningsSummary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const payouts = await ctx.db
      .query("payoutLedger")
      .withIndex("by_courier", (q) => q.eq("courierId", userId))
      .collect();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const pending = payouts.filter(p => p.status === "pending" || p.status === "processing");
    const paid = payouts.filter(p => p.status === "paid");
    const paidToday = paid.filter(p => p.paidAt && p.paidAt >= startOfToday);
    const paidThisWeek = paid.filter(p => p.paidAt && p.paidAt >= startOfWeek);
    const paidThisMonth = paid.filter(p => p.paidAt && p.paidAt >= startOfMonth);

    return {
      pendingAmount: pending.reduce((sum, p) => sum + p.amount, 0),
      pendingCount: pending.length,
      paidTotalAmount: paid.reduce((sum, p) => sum + p.amount, 0),
      paidTotalCount: paid.length,
      paidTodayAmount: paidToday.reduce((sum, p) => sum + p.amount, 0),
      paidThisWeekAmount: paidThisWeek.reduce((sum, p) => sum + p.amount, 0),
      paidThisMonthAmount: paidThisMonth.reduce((sum, p) => sum + p.amount, 0),
      lastPayout: paid.length > 0 ? paid.sort((a, b) => (b.paidAt || 0) - (a.paidAt || 0))[0] : null,
    };
  },
});
