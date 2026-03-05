import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/adminAuth";
import { Id } from "./_generated/dataModel";

// Get revenue data by day for the last N days
export const getRevenueByDay = query({
  args: { days: v.optional(v.number()) }, // default 7
  handler: async (ctx, args) => {
    try {
      const adminId = await requireAdmin(ctx);
      if (!adminId) {
        return [];
      }
      const days = args.days || 7;

      // Get all completed jobs from the last N days
      const now = Date.now();
      const startTime = now - days * 24 * 60 * 60 * 1000;

      const jobs = await ctx.db
        .query("jobs")
        .withIndex("by_created")
        .filter((q) => q.gte(q.field("createdAt"), startTime))
        .collect();

      // Group by day and sum platformCommission (revenue)
      const revenueByDay: Record<
        string,
        { revenue: number; jobCount: number; payouts: number }
      > = {};

      // Initialize all days
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now - i * 24 * 60 * 60 * 1000);
        const dayKey = date.toLocaleDateString("en-US", { weekday: "short" });
        revenueByDay[dayKey] = { revenue: 0, jobCount: 0, payouts: 0 };
      }

      // Fill in actual data
      for (const job of jobs) {
        if (job.status === "completed" && job.paymentStatus === "paid") {
          const date = new Date(job.createdAt);
          const dayKey = date.toLocaleDateString("en-US", { weekday: "short" });
          if (revenueByDay[dayKey]) {
            revenueByDay[dayKey].revenue += job.platformCommission || 0;
            revenueByDay[dayKey].jobCount += 1;
            revenueByDay[dayKey].payouts += job.courierPayout || 0;
          }
        }
      }

      // Convert to array format for charts
      return Object.entries(revenueByDay).map(([name, data]) => ({
        name,
        revenue: Math.round(data.revenue * 100) / 100,
        jobs: data.jobCount,
        payouts: Math.round(data.payouts * 100) / 100,
      }));
    } catch (err: unknown) {
      const error = err as Error;
      console.error("ANALYTICS_REVENUE_BY_DAY_ERROR", {
        message: error?.message,
        stack: error?.stack,
      });
      
      // Return safe fallback
      return [];
    }
  },
});

// Get overall platform stats
export const getPlatformStats = query({
  args: {},
  handler: async (ctx) => {
    try {
      const adminId = await requireAdmin(ctx);
      if (!adminId) {
        return {
          revenue: { total: 0, today: 0, week: 0, month: 0 },
          jobs: { total: 0, active: 0, completedTotal: 0, completedToday: 0, todayNew: 0, avgValue: 0 },
          customers: { total: 0, newToday: 0 },
          couriers: { approved: 0, online: 0, pending: 0 },
          payouts: { pendingCount: 0, pendingAmount: 0 },
        };
      }

      const now = Date.now();
      const startOfToday = new Date().setHours(0, 0, 0, 0);
      const startOfWeek = now - 7 * 24 * 60 * 60 * 1000;
      const startOfMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
      ).getTime();

      // Get all jobs (safely)
      const allJobs = await ctx.db.query("jobs").collect() || [];
      const completedJobs = allJobs.filter(
        (j) => j.status === "completed" && j.paymentStatus === "paid"
      );

      // Revenue calculations (with safe defaults)
      const totalRevenue = completedJobs.reduce(
        (sum, j) => sum + (j.platformCommission || 0),
        0
      );
      const todayRevenue = completedJobs
        .filter((j) => j.completedAt && j.completedAt >= startOfToday)
        .reduce((sum, j) => sum + (j.platformCommission || 0), 0);
      const weekRevenue = completedJobs
        .filter((j) => j.completedAt && j.completedAt >= startOfWeek)
        .reduce((sum, j) => sum + (j.platformCommission || 0), 0);
      const monthRevenue = completedJobs
        .filter((j) => j.completedAt && j.completedAt >= startOfMonth)
        .reduce((sum, j) => sum + (j.platformCommission || 0), 0);

      // Job counts
      const totalJobs = allJobs.length;
      const activeJobs = allJobs.filter(
        (j) => !["completed", "cancelled", "draft"].includes(j.status)
      ).length;
      const todayJobs = allJobs.filter((j) => j.createdAt >= startOfToday).length;
      const completedToday = completedJobs.filter(
        (j) => j.completedAt && j.completedAt >= startOfToday
      ).length;

      // Customer counts
      const uniqueCustomers = new Set(allJobs.map((j) => j.customerId)).size;
      const newCustomersToday = new Set(
        allJobs.filter((j) => j.createdAt >= startOfToday).map((j) => j.customerId)
      ).size;

      // Courier stats (safely)
      const courierApps = await ctx.db.query("courierApplications").collect() || [];
      const approvedCouriers = courierApps.filter(
        (c) => c.status === "approved"
      ).length;
      const onlineCouriers = courierApps.filter(
        (c) => c.status === "approved" && c.isOnline
      ).length;
      const pendingCouriers = courierApps.filter(
        (c) => c.status === "pending_review"
      ).length;

      // Payout stats (safely)
      const payouts = await ctx.db.query("payoutLedger").collect() || [];
      const pendingPayouts = payouts.filter(
        (p) => p.status === "pending" || p.status === "processing"
      );
      const pendingPayoutAmount = pendingPayouts.reduce(
        (sum, p) => sum + (p.amount || 0),
        0
      );

      // Average job value (safe division)
      const avgJobValue =
        completedJobs.length > 0
          ? completedJobs.reduce((sum, j) => sum + (j.totalPrice || 0), 0) /
            completedJobs.length
          : 0;

      return {
        revenue: {
          total: totalRevenue,
          today: todayRevenue,
          week: weekRevenue,
          month: monthRevenue,
        },
        jobs: {
          total: totalJobs,
          active: activeJobs,
          completedTotal: completedJobs.length,
          completedToday,
          todayNew: todayJobs,
          avgValue: avgJobValue,
        },
        customers: {
          total: uniqueCustomers,
          newToday: newCustomersToday,
        },
        couriers: {
          approved: approvedCouriers,
          online: onlineCouriers,
          pending: pendingCouriers,
        },
        payouts: {
          pendingCount: pendingPayouts.length,
          pendingAmount: pendingPayoutAmount,
        },
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.error("ANALYTICS_STATS_ERROR", {
        message: error?.message,
        stack: error?.stack,
      });
      
      // Return safe fallback instead of crashing
      return {
        revenue: { total: 0, today: 0, week: 0, month: 0 },
        jobs: { total: 0, active: 0, completedTotal: 0, completedToday: 0, todayNew: 0, avgValue: 0 },
        customers: { total: 0, newToday: 0 },
        couriers: { approved: 0, online: 0, pending: 0 },
        payouts: { pendingCount: 0, pendingAmount: 0 },
      };
    }
  },
});

// Get job status breakdown
export const getJobStatusBreakdown = query({
  args: {},
  handler: async (ctx) => {
    try {
      const adminId = await requireAdmin(ctx);
      if (!adminId) {
        return [];
      }

      const jobs = await ctx.db.query("jobs").collect();

      const statusCounts: Record<string, number> = {};
      for (const job of jobs) {
        statusCounts[job.status] = (statusCounts[job.status] || 0) + 1;
      }

      return Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
      }));
    } catch (err: unknown) {
      const error = err as Error;
      console.error("ANALYTICS_JOB_STATUS_ERROR", {
        message: error?.message,
        stack: error?.stack,
      });
      
      // Return safe fallback
      return [];
    }
  },
});

// Get top performing couriers
export const getTopCouriers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    try {
      const adminId = await requireAdmin(ctx);
      if (!adminId) {
        return [];
      }
      const limit = args.limit || 5;

      const jobs = await ctx.db.query("jobs").collect();
      const completedJobs = jobs.filter(
        (j) => j.status === "completed" && j.courierId
      );

      // Group by courier
      const courierStats: Record<
        string,
        {
          jobCount: number;
          earnings: number;
          ratings: number[];
          courierId: Id<"users">;
        }
      > = {};

      for (const job of completedJobs) {
        const courierId = job.courierId!;
        const courierIdStr = courierId.toString();
        if (!courierStats[courierIdStr]) {
          courierStats[courierIdStr] = {
            jobCount: 0,
            earnings: 0,
            ratings: [],
            courierId,
          };
        }
        courierStats[courierIdStr].jobCount += 1;
        courierStats[courierIdStr].earnings += job.courierPayout || 0;
        if (job.rating) {
          courierStats[courierIdStr].ratings.push(job.rating);
        }
      }

      // Get courier names
      const topCouriers = await Promise.all(
        Object.values(courierStats)
          .sort((a, b) => b.jobCount - a.jobCount)
          .slice(0, limit)
          .map(async (stats) => {
            const profile = await ctx.db
              .query("profiles")
              .withIndex("by_user", (q) => q.eq("userId", stats.courierId))
              .unique();

            const avgRating =
              stats.ratings.length > 0
                ? stats.ratings.reduce((a, b) => a + b, 0) / stats.ratings.length
                : 0;

            return {
              courierId: stats.courierId,
              name: profile?.name || "Unknown",
              jobCount: stats.jobCount,
              earnings: stats.earnings,
              avgRating: Math.round(avgRating * 10) / 10,
            };
          })
      );

      return topCouriers;
    } catch (err: unknown) {
      const error = err as Error;
      console.error("ANALYTICS_TOP_COURIERS_ERROR", {
        message: error?.message,
        stack: error?.stack,
      });
      
      // Return safe fallback
      return [];
    }
  },
});
