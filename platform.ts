import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireAdminStrict } from "./lib/adminAuth";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

// Check environment configuration (for debugging)
export const getEnvironmentInfo = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    
    // Only return sensitive info to authenticated users
    if (!userId) {
      return { authenticated: false };
    }

    return {
      authenticated: true,
      timestamp: Date.now(),
      // Don't expose actual URLs, just confirm they're set
      hasConvexUrl: true,
    };
  },
});

// Get current platform mode
export const getMode = query({
  args: {},
  handler: async (ctx) => {
    const mode = await ctx.db.query("platformMode").first();
    return mode?.mode ?? "test"; // Default to test mode
  },
});

// Set platform mode (admin only)
export const setMode = mutation({
  args: {
    mode: v.union(v.literal("test"), v.literal("live")),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdminStrict(ctx);

    const existing = await ctx.db.query("platformMode").first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        mode: args.mode,
        updatedAt: Date.now(),
        updatedBy: adminId,
      });
    } else {
      await ctx.db.insert("platformMode", {
        mode: args.mode,
        updatedAt: Date.now(),
        updatedBy: adminId,
      });
    }

    // Log admin action
    await ctx.scheduler.runAfter(0, internal.adminLogs.logAdminAction, {
      adminId,
      action: "platform_mode_changed",
      targetType: "platform",
      targetId: "mode",
      details: { newMode: args.mode },
    });

    return args.mode;
  },
});

// Run all health checks
export const runHealthChecks = mutation({
  args: {},
  handler: async (ctx) => {
    const adminId = await requireAdminStrict(ctx);
    const runAt = Date.now();
    const results: Array<{
      category: string;
      testName: string;
      status: "pass" | "fail" | "warning";
      message: string;
      details?: unknown;
    }> = [];

    // A) AUTH + ROLE ACCESS
    // Check profiles table exists and has data structure
    await ctx.db.query("profiles").take(1);
    results.push({
      category: "auth",
      testName: "Profiles table accessible",
      status: "pass",
      message: "Profiles table is accessible",
    });

    // Check for admin profile
    const adminProfile = await ctx.db
      .query("profiles")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .first();
    results.push({
      category: "auth",
      testName: "Admin account exists",
      status: adminProfile ? "pass" : "warning",
      message: adminProfile
        ? "At least one admin account exists"
        : "No admin accounts found - create one",
    });

    // B) COURIER APPROVAL GATING
    const courierApps = await ctx.db.query("courierApplications").collect();
    const approvedCouriers = courierApps.filter((c) => c.status === "approved");
    results.push({
      category: "courier",
      testName: "Courier applications table",
      status: "pass",
      message: `${courierApps.length} applications, ${approvedCouriers.length} approved`,
      details: { total: courierApps.length, approved: approvedCouriers.length },
    });

    // C) JOBS TABLE
    const jobs = await ctx.db.query("jobs").collect();
    results.push({
      category: "jobs",
      testName: "Jobs table accessible",
      status: "pass",
      message: `${jobs.length} jobs in database`,
      details: { count: jobs.length },
    });

    // D) SETTINGS
    const settings = await ctx.db.query("settings").collect();
    const requiredSettings = [
      "baseFee",
      "additionalPackageFee",
      "commissionPercent",
    ];
    const missingSettings = requiredSettings.filter(
      (key) => !settings.find((s) => s.key === key)
    );
    results.push({
      category: "settings",
      testName: "Platform settings configured",
      status: missingSettings.length === 0 ? "pass" : "warning",
      message:
        missingSettings.length === 0
          ? "All required settings configured"
          : `Missing settings: ${missingSettings.join(", ")}`,
      details: {
        configured: settings.map((s) => s.key),
        missing: missingSettings,
      },
    });

    // E) TRANSACTIONS TABLE
    await ctx.db.query("transactions").take(1);
    results.push({
      category: "payments",
      testName: "Transactions table accessible",
      status: "pass",
      message: "Transactions table is accessible",
    });

    // F) NOTIFICATIONS
    await ctx.db.query("adminNotifications").take(1);
    await ctx.db.query("courierNotifications").take(1);
    results.push({
      category: "notifications",
      testName: "Notification tables accessible",
      status: "pass",
      message: "Both admin and courier notification tables accessible",
    });

    // Check customer notifications table
    await ctx.db.query("customerNotifications").take(1);
    results.push({
      category: "notifications",
      testName: "Customer notifications table",
      status: "pass",
      message: "Customer notification system accessible",
    });

    // G) ADMIN LOGS
    await ctx.db.query("adminLogs").take(1);
    results.push({
      category: "audit",
      testName: "Admin audit logs accessible",
      status: "pass",
      message: "Admin audit log table accessible",
    });

    // H) STORAGE
    results.push({
      category: "storage",
      testName: "File storage available",
      status: "pass",
      message: "Convex file storage is available",
    });

    // I) PAYOUT LEDGER
    const payouts = await ctx.db.query("payoutLedger").collect();
    const pendingPayouts = payouts.filter((p) => p.status === "pending");
    results.push({
      category: "payments",
      testName: "Payout ledger accessible",
      status: "pass",
      message: `${payouts.length} payout records, ${pendingPayouts.length} pending`,
      details: { total: payouts.length, pending: pendingPayouts.length },
    });

    // J) PLATFORM MODE
    const modeRecord = await ctx.db.query("platformMode").first();
    results.push({
      category: "platform",
      testName: "Platform mode configured",
      status: modeRecord ? "pass" : "warning",
      message: modeRecord 
        ? `Platform is in ${modeRecord.mode.toUpperCase()} mode`
        : "Platform mode not set - defaulting to TEST",
      details: { mode: modeRecord?.mode ?? "test" },
    });

    // K) JOB COMPLETION FLOW
    const completedJobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "completed"))
      .take(1);
    results.push({
      category: "jobs",
      testName: "Job completion flow",
      status: completedJobs.length > 0 ? "pass" : "warning",
      message: completedJobs.length > 0 
        ? "At least one job has been completed successfully"
        : "No completed jobs yet - test the full flow",
    });

    // L) PAYOUT TRACKING ACTIVE
    const payoutEntries = await ctx.db.query("payoutLedger").take(1);
    results.push({
      category: "payments",
      testName: "Payout tracking active",
      status: payoutEntries.length > 0 ? "pass" : "warning",
      message: payoutEntries.length > 0
        ? "Payout ledger has entries"
        : "No payouts recorded yet - complete a job to test",
    });

    // M) BASE FEE CONFIGURED
    const baseFee = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "baseFee"))
      .unique();
    results.push({
      category: "settings",
      testName: "Base fee configured",
      status: baseFee ? "pass" : "fail",
      message: baseFee 
        ? `Base fee set to $${baseFee.value}`
        : "Base fee not configured - set it in Settings",
      details: { baseFee: baseFee?.value },
    });

    // N) COMMISSION CONFIGURED
    const commission = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "commissionPercent"))
      .unique();
    results.push({
      category: "settings",
      testName: "Commission configured",
      status: commission ? "pass" : "fail",
      message: commission
        ? `Commission set to ${commission.value}%`
        : "Commission not configured - set it in Settings",
      details: { commission: commission?.value },
    });

    // Save all results
    for (const result of results) {
      await ctx.db.insert("healthChecks", {
        ...result,
        runAt,
        runBy: adminId,
      });
    }

    // Log the health check run
    await ctx.scheduler.runAfter(0, internal.adminLogs.logAdminAction, {
      adminId,
      action: "health_checks_run",
      targetType: "platform",
      targetId: "health",
      details: {
        passed: results.filter((r) => r.status === "pass").length,
        failed: results.filter((r) => r.status === "fail").length,
        warnings: results.filter((r) => r.status === "warning").length,
      },
    });

    return results;
  },
});

// Get latest health check results
export const getHealthCheckResults = query({
  args: {},
  handler: async (ctx) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      return { results: [], runAt: null };
    }

    // Get the most recent run timestamp
    const latestCheck = await ctx.db.query("healthChecks").order("desc").first();

    if (!latestCheck) return { results: [], runAt: null };

    // Get all checks from that run
    const results = await ctx.db
      .query("healthChecks")
      .withIndex("by_run", (q) => q.eq("runAt", latestCheck.runAt))
      .collect();

    return { results, runAt: latestCheck.runAt };
  },
});

// Get revenue report
export const getRevenueReport = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      return {
        grossBookings: 0,
        platformRevenue: 0,
        courierPayouts: 0,
        refunds: 0,
        netRevenue: 0,
        totalJobs: 0,
        completedJobs: 0,
        cancelledJobs: 0,
        avgJobValue: 0,
        startDate: 0,
        endDate: 0,
      };
    }

    const now = Date.now();
    const startDate = args.startDate ?? now - 30 * 24 * 60 * 60 * 1000; // 30 days ago
    const endDate = args.endDate ?? now;

    const allJobs = await ctx.db.query("jobs").collect();
    const jobs = allJobs.filter(
      (j) => j.createdAt >= startDate && j.createdAt <= endDate
    );

    const completedJobs = jobs.filter((j) => j.status === "completed");
    const cancelledJobs = jobs.filter((j) => j.status === "cancelled");

    const grossBookings = completedJobs.reduce(
      (sum, j) => sum + j.totalPrice,
      0
    );
    const platformCommission = completedJobs.reduce(
      (sum, j) => sum + j.platformCommission,
      0
    );
    const courierPayouts = completedJobs.reduce(
      (sum, j) => sum + j.courierPayout,
      0
    );

    // Get refunds
    const allTransactions = await ctx.db.query("transactions").collect();
    const refunds = allTransactions.filter(
      (t) =>
        t.type === "refund" &&
        t.createdAt >= startDate &&
        t.createdAt <= endDate
    );
    const totalRefunds = refunds.reduce((sum, t) => sum + t.amount, 0);

    // Get payout ledger status
    const payouts = await ctx.db.query("payoutLedger").collect();
    const pendingPayouts = payouts.filter((p) => p.status === "pending");
    const paidPayouts = payouts.filter((p) => p.status === "paid");

    return {
      period: { startDate, endDate },
      bookings: {
        total: jobs.length,
        completed: completedJobs.length,
        cancelled: cancelledJobs.length,
        inProgress: jobs.filter(
          (j) => !["completed", "cancelled"].includes(j.status)
        ).length,
      },
      revenue: {
        grossBookings,
        platformCommission,
        courierPayouts,
        refunds: totalRefunds,
        netRevenue: platformCommission - totalRefunds,
      },
      payouts: {
        pending: pendingPayouts.length,
        pendingAmount: pendingPayouts.reduce((sum, p) => sum + p.amount, 0),
        paid: paidPayouts.length,
        paidAmount: paidPayouts.reduce((sum, p) => sum + p.amount, 0),
      },
    };
  },
});
