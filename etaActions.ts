"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

// Calculate ETA using Google Distance Matrix API
export const calculateETA = internalAction({
  args: {
    originLat: v.number(),
    originLng: v.number(),
    destLat: v.number(),
    destLng: v.number(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.log("[calculateETA] GOOGLE_MAPS_API_KEY not configured");
      throw new Error("ETA_UNAVAILABLE: Server configuration error");
    }

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${args.originLat},${args.originLng}&destinations=${args.destLat},${args.destLng}&mode=driving&key=${apiKey}`;

    console.log("[calculateETA] Calculating ETA from", { originLat: args.originLat, originLng: args.originLng }, "to", { destLat: args.destLat, destLng: args.destLng });

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK" || !data.rows?.[0]?.elements?.[0]) {
      console.log("[calculateETA] API error:", data.status, data.error_message);
      throw new Error("ETA_CALCULATION_FAILED: Unable to calculate route");
    }

    const element = data.rows[0].elements[0];
    if (element.status !== "OK") {
      console.log("[calculateETA] Route error:", element.status);
      throw new Error("ETA_ROUTE_NOT_FOUND: No route found between locations");
    }

    console.log("[calculateETA] Success:", {
      durationSeconds: element.duration.value,
      distanceMeters: element.distance.value,
      durationText: element.duration.text,
      distanceText: element.distance.text,
    });

    return {
      durationSeconds: element.duration.value as number,
      distanceMeters: element.distance.value as number,
      durationText: element.duration.text as string,
      distanceText: element.distance.text as string,
    };
  },
});

// Internal action to update job ETA based on courier location
export const updateJobETA = internalAction({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args) => {
    // Get the job
    const job = await ctx.runQuery(api.eta.getJobForETA, { jobId: args.jobId });
    if (!job) {
      console.log("[updateJobETA] Job not found:", args.jobId);
      return;
    }

    // Only calculate ETA for active jobs with a courier
    const activeStatuses = ["matched", "en_route", "arrived", "picked_up"];
    if (!activeStatuses.includes(job.status) || !job.courierId) {
      console.log("[updateJobETA] Job not active or no courier:", { status: job.status, courierId: job.courierId });
      return;
    }

    // Get courier's current location
    const courierLocation = await ctx.runQuery(api.eta.getCourierLocationForETA, { courierId: job.courierId });
    if (!courierLocation) {
      console.log("[updateJobETA] No courier location found for:", job.courierId);
      return;
    }

    // Determine destination based on job status
    let destLat: number | undefined;
    let destLng: number | undefined;

    if (job.status === "matched" || job.status === "en_route" || job.status === "arrived") {
      // Courier is heading to pickup
      destLat = job.pickupLatitude;
      destLng = job.pickupLongitude;
    } else if (job.status === "picked_up") {
      // Courier is heading to dropoff
      destLat = job.dropoffLatitude;
      destLng = job.dropoffLongitude;
    }

    if (!destLat || !destLng) {
      console.log("[updateJobETA] No destination coordinates for job:", args.jobId, { status: job.status });
      return;
    }

    try {
      // Calculate ETA
      const etaResult = await ctx.runAction(internal.etaActions.calculateETA, {
        originLat: courierLocation.latitude,
        originLng: courierLocation.longitude,
        destLat,
        destLng,
      });

      // Save ETA to job
      await ctx.runMutation(internal.eta.saveJobETA, {
        jobId: args.jobId,
        etaSeconds: etaResult.durationSeconds,
        distanceMeters: etaResult.distanceMeters,
      });

      console.log("[updateJobETA] Updated ETA for job:", args.jobId, {
        etaSeconds: etaResult.durationSeconds,
        distanceMeters: etaResult.distanceMeters,
      });
    } catch (error) {
      console.log("[updateJobETA] Failed to calculate ETA:", error);
      // Don't throw - ETA calculation failure shouldn't break location updates
    }
  },
});
