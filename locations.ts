import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAdmin } from "./lib/adminAuth";
import { internal } from "./_generated/api";

// Update courier's current location (called frequently by courier app)
export const updateCourierLocation = mutation({
  args: {
    latitude: v.number(),
    longitude: v.number(),
    heading: v.optional(v.number()),
    speed: v.optional(v.number()),
    accuracy: v.optional(v.number()),
    jobId: v.optional(v.id("jobs")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in to update location");
    }

    // Verify user is an approved courier
    const application = await ctx.db
      .query("courierApplications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!application || application.status !== "approved") {
      throw new Error("Only approved couriers can update location");
    }

    // If jobId provided, verify courier is assigned to this job
    if (args.jobId) {
      const job = await ctx.db.get(args.jobId);
      if (!job) {
        throw new Error("Job not found");
      }
      if (job.courierId !== userId) {
        throw new Error("You are not assigned to this job");
      }
    }

    // Check if location record exists for this courier
    const existingLocation = await ctx.db
      .query("courierLocations")
      .withIndex("by_courier", (q) => q.eq("courierId", userId))
      .unique();

    const locationData = {
      courierId: userId,
      jobId: args.jobId,
      latitude: args.latitude,
      longitude: args.longitude,
      heading: args.heading,
      speed: args.speed,
      accuracy: args.accuracy,
      updatedAt: Date.now(),
    };

    let locationId;
    if (existingLocation) {
      // Update existing record
      await ctx.db.patch(existingLocation._id, locationData);
      locationId = existingLocation._id;
    } else {
      // Insert new record
      locationId = await ctx.db.insert("courierLocations", locationData);
    }

    // Schedule ETA update if courier has an active job
    if (args.jobId) {
      await ctx.scheduler.runAfter(0, internal.etaActions.updateJobETA, { jobId: args.jobId });
    }

    return locationId;
  },
});

// Get courier location for a specific job (for customer tracking)
export const getCourierLocationForJob = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    // Get the job
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      return null;
    }

    // Verify user is the customer for this job
    if (job.customerId !== userId) {
      // Also allow admin access
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();

      if (profile?.role !== "admin") {
        return null;
      }
    }

    // Only return location for active jobs (not completed/cancelled)
    const activeStatuses = ["matched", "en_route", "arrived", "picked_up", "dropped_off"];
    if (!activeStatuses.includes(job.status)) {
      return null;
    }

    // No courier assigned yet
    if (!job.courierId) {
      return null;
    }

    // Get courier's current location
    const location = await ctx.db
      .query("courierLocations")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .unique();

    // If no location found by job, try by courier ID
    // (courier might have updated location before associating with job)
    if (!location) {
      const courierLocation = await ctx.db
        .query("courierLocations")
        .withIndex("by_courier", (q) => q.eq("courierId", job.courierId!))
        .unique();

      if (!courierLocation) {
        return null;
      }

      // Return location but check if it's recent (within last 5 minutes)
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      if (courierLocation.updatedAt < fiveMinutesAgo) {
        return null; // Location is stale
      }

      return {
        latitude: courierLocation.latitude,
        longitude: courierLocation.longitude,
        heading: courierLocation.heading,
        speed: courierLocation.speed,
        accuracy: courierLocation.accuracy,
        updatedAt: courierLocation.updatedAt,
      };
    }

    return {
      latitude: location.latitude,
      longitude: location.longitude,
      heading: location.heading,
      speed: location.speed,
      accuracy: location.accuracy,
      updatedAt: location.updatedAt,
    };
  },
});

// Get courier location by courier ID (for admin use)
export const getCourierLocation = query({
  args: { courierId: v.id("users") },
  handler: async (ctx, args) => {
    // Verify admin access
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      return null;
    }

    const location = await ctx.db
      .query("courierLocations")
      .withIndex("by_courier", (q) => q.eq("courierId", args.courierId))
      .unique();

    if (!location) {
      return null;
    }

    return {
      latitude: location.latitude,
      longitude: location.longitude,
      heading: location.heading,
      speed: location.speed,
      accuracy: location.accuracy,
      updatedAt: location.updatedAt,
      jobId: location.jobId,
    };
  },
});

// Clear courier location (when going offline)
export const clearCourierLocation = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in");
    }

    const existingLocation = await ctx.db
      .query("courierLocations")
      .withIndex("by_courier", (q) => q.eq("courierId", userId))
      .unique();

    if (existingLocation) {
      await ctx.db.delete(existingLocation._id);
    }

    return { success: true };
  },
});

// Haversine formula to calculate distance between two coordinates
function calculateDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // Round to 1 decimal place
}

// Get nearby online couriers for customer view
export const getNearbyCouriers = query({
  args: {
    latitude: v.number(),
    longitude: v.number(),
    radiusMiles: v.optional(v.number()), // Default 5 miles
  },
  handler: async (ctx, args) => {
    const radiusMiles = args.radiusMiles ?? 5;
    const staleThresholdMs = 120 * 1000; // 120 seconds
    const now = Date.now();

    // Get all online, approved couriers
    const onlineCouriers = await ctx.db
      .query("courierApplications")
      .withIndex("by_online", (q) => q.eq("isOnline", true).eq("status", "approved"))
      .collect();

    if (onlineCouriers.length === 0) {
      return { couriers: [], count: 0, nearestDistance: null, estimatedPickupMinutes: null };
    }

    // Get location data for each online courier
    const couriersWithLocation = await Promise.all(
      onlineCouriers.map(async (courier) => {
        const location = await ctx.db
          .query("courierLocations")
          .withIndex("by_courier", (q) => q.eq("courierId", courier.userId))
          .unique();

        if (!location) return null;

        // Check if location is stale (older than 120 seconds)
        if (now - location.updatedAt > staleThresholdMs) return null;

        // Calculate distance
        const distanceMiles = calculateDistanceMiles(
          args.latitude,
          args.longitude,
          location.latitude,
          location.longitude
        );

        // Filter by radius
        if (distanceMiles > radiusMiles) return null;

        return {
          courierId: courier.userId,
          firstName: courier.fullName.split(' ')[0],
          vehicleType: `${courier.vehicleMake} ${courier.vehicleModel}`,
          latitude: location.latitude,
          longitude: location.longitude,
          distanceMiles,
          lastUpdated: location.updatedAt,
          heading: location.heading,
        };
      })
    );

    // Filter out nulls and sort by distance
    const validCouriers = couriersWithLocation
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => a.distanceMiles - b.distanceMiles);

    // Calculate estimated pickup time (rough estimate: 2 min per mile + 3 min buffer)
    const nearestDistance = validCouriers.length > 0 ? validCouriers[0].distanceMiles : null;
    const estimatedPickupMinutes = nearestDistance !== null 
      ? Math.round(nearestDistance * 2 + 3) 
      : null;

    return {
      couriers: validCouriers,
      count: validCouriers.length,
      nearestDistance,
      estimatedPickupMinutes,
    };
  },
});

// Get all online couriers for admin map view
export const getAllOnlineCouriers = query({
  args: {},
  handler: async (ctx) => {
    // Verify admin access
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      return [];
    }

    const staleThresholdMs = 120 * 1000; // 120 seconds
    const now = Date.now();

    // Get all online, approved couriers
    const onlineCouriers = await ctx.db
      .query("courierApplications")
      .withIndex("by_online", (q) => q.eq("isOnline", true).eq("status", "approved"))
      .collect();

    // Get location data for each
    const couriersWithLocation = await Promise.all(
      onlineCouriers.map(async (courier) => {
        const location = await ctx.db
          .query("courierLocations")
          .withIndex("by_courier", (q) => q.eq("courierId", courier.userId))
          .unique();

        const isStale = !location || (now - location.updatedAt > staleThresholdMs);

        return {
          courierId: courier.userId,
          fullName: courier.fullName,
          email: courier.email,
          phone: courier.phone,
          vehicleType: `${courier.vehicleMake} ${courier.vehicleModel}`,
          vehiclePlate: courier.vehiclePlate,
          latitude: location?.latitude ?? null,
          longitude: location?.longitude ?? null,
          lastUpdated: location?.updatedAt ?? null,
          isStale,
          currentJobId: location?.jobId ?? null,
        };
      })
    );

    return couriersWithLocation;
  },
});
