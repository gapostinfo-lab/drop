import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminStrict } from "./lib/adminAuth";

// Migration: Update jobs with "Staples" carrier to "Other"
// Run this once to fix existing data after carrier options update
export const migrateStaplesCarrier = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Find all jobs - we need to check carrier field manually since schema validation
    // prevents querying with the old value
    const allJobs = await ctx.db.query("jobs").collect();
    
    let migratedCount = 0;
    for (const job of allJobs) {
      // Check if carrier is "Staples" (using type assertion since schema changed)
      if ((job.carrier as string) === "Staples") {
        await ctx.db.patch(job._id, { carrier: "Other" });
        migratedCount++;
      }
    }
    
    // Also check bookingDrafts
    const allDrafts = await ctx.db.query("bookingDrafts").collect();
    let draftsMigrated = 0;
    for (const draft of allDrafts) {
      if ((draft.carrier as string) === "Staples") {
        await ctx.db.patch(draft._id, { carrier: "Other" });
        draftsMigrated++;
      }
    }
    
    return { 
      jobsMigrated: migratedCount, 
      draftsMigrated,
      message: `Migrated ${migratedCount} jobs and ${draftsMigrated} drafts from Staples to Other carrier`
    };
  },
});

// Migration: Remove staples hub locations or convert to other type
// Run this once to fix existing data after removing staples from schema
export const migrateStaplesHubLocations = mutation({
  args: {},
  handler: async (ctx) => {
    // Find all hub locations with staples or amazon_staples type
    const allLocations = await ctx.db.query("hubLocations").collect();
    
    let deletedCount = 0;
    let migratedJobsCount = 0;
    
    for (const location of allLocations) {
      const locationType = location.type as string;
      if (locationType === "staples" || locationType === "amazon_staples") {
        // Delete the staples location
        await ctx.db.delete(location._id);
        deletedCount++;
      }
    }
    
    // Also update any jobs that reference staples dropoff types
    const allJobs = await ctx.db.query("jobs").collect();
    for (const job of allJobs) {
      const dropoffType = job.dropoffLocationType as string | undefined;
      if (dropoffType === "staples" || dropoffType === "amazon_staples") {
        await ctx.db.patch(job._id, { dropoffLocationType: "other" });
        migratedJobsCount++;
      }
    }
    
    return { 
      deletedLocations: deletedCount,
      migratedJobs: migratedJobsCount,
      message: `Deleted ${deletedCount} staples locations and migrated ${migratedJobsCount} jobs`
    };
  },
});

// Generate demo data
export const generateDemoData = mutation({
  args: {
    includeCustomer: v.boolean(),
    includeCourier: v.boolean(),
    includeJobs: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdminStrict(ctx);
    const results: string[] = [];

    // Check platform mode
    const modeRecord = await ctx.db.query("platformMode").first();
    const mode = modeRecord?.mode ?? "test";

    if (mode !== "test") {
      throw new Error("Demo data can only be generated in Test Mode");
    }

    if (args.includeCustomer) {
      // Create demo customer profile (user must already exist via auth)
      results.push(
        "Demo customer profile ready - sign up as customer to test"
      );
    }

    if (args.includeCourier) {
      results.push(
        "Demo courier profile ready - sign up as courier and complete onboarding to test"
      );
    }

    if (args.includeJobs) {
      // Get an existing customer
      const customerProfile = await ctx.db
        .query("profiles")
        .withIndex("by_role", (q) => q.eq("role", "customer"))
        .first();

      if (!customerProfile) {
        results.push("No customer found - create a customer account first");
      } else {
        // Get settings for pricing
        const baseFeeSetting = await ctx.db
          .query("settings")
          .withIndex("by_key", (q) => q.eq("key", "baseFee"))
          .unique();
        const additionalFeeSetting = await ctx.db
          .query("settings")
          .withIndex("by_key", (q) => q.eq("key", "additionalPackageFee"))
          .unique();
        const commissionSetting = await ctx.db
          .query("settings")
          .withIndex("by_key", (q) => q.eq("key", "commissionPercent"))
          .unique();

        const baseFee = (baseFeeSetting?.value as number) ?? 15;
        const additionalFee = (additionalFeeSetting?.value as number) ?? 3;
        const commissionPercent = (commissionSetting?.value as number) ?? 25;

        // Create sample jobs in different statuses
        const sampleJobs = [
          { status: "requested", carrier: "UPS", packages: 1 },
          { status: "requested", carrier: "FedEx", packages: 2 },
          { status: "requested", carrier: "USPS", packages: 1 },
        ];

        for (const sample of sampleJobs) {
          const totalAdditional =
            Math.max(0, sample.packages - 1) * additionalFee;
          const totalPrice = baseFee + totalAdditional;
          const platformCommission =
            Math.round(((totalPrice * commissionPercent) / 100) * 100) / 100;
          const courierPayout = totalPrice - platformCommission;

          await ctx.db.insert("jobs", {
            customerId: customerProfile.userId,
            pickupAddress: "123 Demo Street, Test City, TC 12345",
            pickupNotes: "Demo job - ring doorbell",
            isAsap: true,
            carrier: sample.carrier as "UPS" | "FedEx" | "USPS" | "DHL" | "Other",
            packageCount: sample.packages,
            packageSize: "M",
            baseFee,
            additionalFee: totalAdditional,
            totalPrice,
            platformCommission,
            courierPayout,
            status: sample.status as
              | "requested"
              | "matched"
              | "en_route"
              | "arrived"
              | "picked_up"
              | "dropped_off"
              | "completed"
              | "cancelled",
            createdAt: Date.now(),
            paymentStatus: "pending",
          });
        }

        results.push(`Created ${sampleJobs.length} demo jobs`);
      }
    }

    return results;
  },
});

// Create a full test lifecycle job
export const createTestLifecycleJob = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminStrict(ctx);

    // Check test mode
    const modeRecord = await ctx.db.query("platformMode").first();
    if (modeRecord?.mode !== "test") {
      throw new Error("Test lifecycle can only run in Test Mode");
    }

    // Get a customer
    const customerProfile = await ctx.db
      .query("profiles")
      .withIndex("by_role", (q) => q.eq("role", "customer"))
      .first();

    if (!customerProfile) {
      throw new Error("No customer account found - create one first");
    }

    // Get an approved courier
    const approvedCourier = await ctx.db
      .query("courierApplications")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .first();

    // Create the job
    const jobId = await ctx.db.insert("jobs", {
      customerId: customerProfile.userId,
      pickupAddress: "456 Test Avenue, Demo City, DC 67890",
      pickupNotes: "Test lifecycle job",
      isAsap: true,
      carrier: "UPS",
      packageCount: 2,
      packageSize: "M",
      baseFee: 15,
      additionalFee: 3,
      totalPrice: 18,
      platformCommission: 4.5,
      courierPayout: 13.5,
      status: "requested",
      createdAt: Date.now(),
      paymentStatus: "paid",
    });

    return {
      jobId,
      message:
        "Test job created. " +
        (approvedCourier
          ? "An approved courier can now accept it."
          : "Approve a courier first to test the full flow."),
      hasApprovedCourier: !!approvedCourier,
    };
  },
});

// Clean up test data
export const cleanupTestData = mutation({
  args: {
    cleanJobs: v.boolean(),
    cleanTransactions: v.boolean(),
    cleanHealthChecks: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdminStrict(ctx);

    // Check test mode
    const modeRecord = await ctx.db.query("platformMode").first();
    if (modeRecord?.mode !== "test") {
      throw new Error("Cleanup can only run in Test Mode");
    }

    const results: string[] = [];

    if (args.cleanJobs) {
      const jobs = await ctx.db.query("jobs").collect();
      for (const job of jobs) {
        await ctx.db.delete(job._id);
      }
      results.push(`Deleted ${jobs.length} jobs`);
    }

    if (args.cleanTransactions) {
      const transactions = await ctx.db.query("transactions").collect();
      for (const t of transactions) {
        await ctx.db.delete(t._id);
      }
      results.push(`Deleted ${transactions.length} transactions`);

      const payouts = await ctx.db.query("payoutLedger").collect();
      for (const p of payouts) {
        await ctx.db.delete(p._id);
      }
      results.push(`Deleted ${payouts.length} payout records`);
    }

    if (args.cleanHealthChecks) {
      const checks = await ctx.db.query("healthChecks").collect();
      for (const c of checks) {
        await ctx.db.delete(c._id);
      }
      results.push(`Deleted ${checks.length} health checks`);
    }

    return results;
  },
});
