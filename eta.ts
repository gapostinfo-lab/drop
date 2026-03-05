import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Internal mutation to save ETA to job
export const saveJobETA = internalMutation({
  args: {
    jobId: v.id("jobs"),
    etaSeconds: v.number(),
    distanceMeters: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      etaSeconds: args.etaSeconds,
      etaUpdatedAt: Date.now(),
      distanceMeters: args.distanceMeters,
    });
  },
});

// Internal query to get job data for ETA calculation
export const getJobForETA = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

// Internal query to get courier location for ETA calculation
export const getCourierLocationForETA = query({
  args: { courierId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("courierLocations")
      .withIndex("by_courier", (q) => q.eq("courierId", args.courierId))
      .unique();
  },
});

// Public query to get job ETA for frontend
export const getJobETA = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      return null;
    }

    // Check if ETA exists
    if (job.etaSeconds === undefined || job.etaUpdatedAt === undefined) {
      return {
        hasETA: false,
        etaSeconds: null,
        etaMinutes: null,
        distanceMeters: null,
        distanceMiles: null,
        updatedAt: null,
        isStale: true,
      };
    }

    // Check if ETA is stale (older than 60 seconds)
    const isStale = Date.now() - job.etaUpdatedAt > 60 * 1000;

    // Convert distance to miles
    const distanceMiles = job.distanceMeters 
      ? Math.round((job.distanceMeters / 1609.34) * 10) / 10 
      : null;

    return {
      hasETA: true,
      etaSeconds: job.etaSeconds,
      etaMinutes: Math.ceil(job.etaSeconds / 60),
      distanceMeters: job.distanceMeters ?? null,
      distanceMiles,
      updatedAt: job.etaUpdatedAt,
      isStale,
    };
  },
});
