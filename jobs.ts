import { query, mutation, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAdmin, requireAdminStrict } from "./lib/adminAuth";
import { pricingConfig, calculateTotalCents, calculatePayoutSplit } from "./lib/pricing";
import { logJobEvent, isValidTransition, getTransitionError } from "./lib/jobHelpers";

// Location type validator (reusable)
const dropoffLocationTypeValidator = v.union(
  v.literal("ups"),
  v.literal("fedex"),
  v.literal("usps"),
  v.literal("dhl"),
  v.literal("amazon_hub"),
  v.literal("amazon_locker"),
  v.literal("amazon_counter"),
  v.literal("amazon_wholefoods"),
  v.literal("amazon_kohls"),
  v.literal("other")
);

// Haversine distance calculation (returns miles)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // Round to 1 decimal
}

export const createJob = mutation({
  args: {
    // Idempotency key to prevent duplicate jobs
    clientRequestId: v.optional(v.string()),
    pickupAddress: v.string(),
    pickupNotes: v.optional(v.string()),
    pickupPhotoId: v.optional(v.id("_storage")),
    // Structured address fields
    pickupStreet1: v.optional(v.string()),
    pickupStreet2: v.optional(v.string()),
    pickupCity: v.optional(v.string()),
    pickupState: v.optional(v.string()),
    pickupZipCode: v.optional(v.string()),
    pickupCountry: v.optional(v.string()),
    pickupLatitude: v.optional(v.number()),
    pickupLongitude: v.optional(v.number()),
    pickupPlaceId: v.optional(v.string()),
    isManualAddress: v.optional(v.boolean()),
    isAsap: v.boolean(),
    scheduledDate: v.optional(v.string()),
    scheduledTime: v.optional(v.string()),
    carrier: v.union(
      v.literal("UPS"),
      v.literal("FedEx"),
      v.literal("USPS"),
      v.literal("DHL"),
      v.literal("Other")
    ),
    packageCount: v.number(),
    packageSize: v.union(v.literal("S"), v.literal("M"), v.literal("L")),
    // Package quantities by size
    smallQty: v.optional(v.number()),
    mediumQty: v.optional(v.number()),
    largeQty: v.optional(v.number()),
    oversizedQty: v.optional(v.number()),
    // Service type and drop-off location
    serviceType: v.optional(v.union(v.literal("amazon_return"), v.literal("carrier_dropoff"))),
    dropoffLocationType: v.optional(dropoffLocationTypeValidator),
    dropoffLocationId: v.optional(v.id("hubLocations")),
    dropoffLocationName: v.optional(v.string()),
    dropoffLocationAddress: v.optional(v.string()),
    dropoffLatitude: v.optional(v.number()),
    dropoffLongitude: v.optional(v.number()),
    // Amazon specific
    amazonLabelConfirmed: v.optional(v.boolean()),
    labelPhotoId: v.optional(v.id("_storage")),
    // Optional: Customer-provided tracking number for validation
    expectedTrackingNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // ============================================
    // 1. AUTHENTICATION CHECK
    // ============================================
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("AUTH_REQUIRED: Please sign in to book a pickup. Your session may have expired.");
    }

    // ============================================
    // 2. IDEMPOTENCY CHECK - Prevent duplicate jobs
    // ============================================
    if (args.clientRequestId) {
      // Check if a job with this clientRequestId already exists for this user
      const existingJobs = await ctx.db
        .query("jobs")
        .withIndex("by_customer", (q) => q.eq("customerId", userId))
        .filter((q) => q.gte(q.field("createdAt"), Date.now() - 30 * 60 * 1000)) // Last 30 mins
        .collect();
      
      // Check metadata or use a simple time-based check
      const recentDraft = existingJobs.find(
        (job) => job.status === "draft" && 
        job.pickupAddress === args.pickupAddress &&
        job.createdAt > Date.now() - 60 * 1000 // Within last minute
      );
      
      if (recentDraft) {
        // Return existing job instead of creating duplicate
        return recentDraft._id;
      }
    }

    // ============================================
    // 3. VALIDATE REQUIRED FIELDS
    // ============================================
    
    // Pickup address validation
    if (!args.pickupAddress || args.pickupAddress.trim().length < 5) {
      throw new Error("VALIDATION_ERROR: Please enter a valid pickup address.");
    }

    // Scheduled pickup validation
    if (!args.isAsap && (!args.scheduledDate || !args.scheduledTime)) {
      throw new Error("VALIDATION_ERROR: Please select a date and time for scheduled pickups.");
    }

    // Structured address validation (if provided)
    if (args.pickupStreet1) {
      if (!args.pickupCity || !args.pickupState || !args.pickupZipCode) {
        throw new Error("VALIDATION_ERROR: Please provide a complete address with city, state, and ZIP code.");
      }
    }

    // Package quantity validation
    const totalPackages = (args.smallQty || 0) + (args.mediumQty || 0) + (args.largeQty || 0) + (args.oversizedQty || 0);
    if (totalPackages < 1) {
      throw new Error("VALIDATION_ERROR: Please add at least one package to your order.");
    }

    // ============================================
    // 4. SERVICE-SPECIFIC VALIDATION
    // ============================================
    
    // Amazon return validation
    if (args.serviceType === "amazon_return") {
      if (!args.amazonLabelConfirmed) {
        throw new Error("VALIDATION_ERROR: Please confirm your Amazon return label is attached to the package.");
      }
      if (!args.dropoffLocationId) {
        throw new Error("HUB_NOT_SELECTED: Please select a drop-off location for your Amazon return.");
      }
    }

    // Carrier drop-off validation - require hub selection
    if (args.serviceType === "carrier_dropoff") {
      if (!args.dropoffLocationId && !args.dropoffLocationName) {
        throw new Error("HUB_NOT_SELECTED: Please select a drop-off location for your package.");
      }
    }

    // ============================================
    // 5. HUB LOCATION VALIDATION (if provided)
    // ============================================
    let verifiedLocation = null;
    if (args.dropoffLocationId) {
      verifiedLocation = await ctx.db.get(args.dropoffLocationId);
      
      if (!verifiedLocation) {
        throw new Error("HUB_NOT_FOUND: The selected drop-off location was not found. Please select a different location.");
      }
      
      if (!verifiedLocation.isActive) {
        throw new Error("HUB_INACTIVE: The selected drop-off location is no longer available. Please select a different location.");
      }
    }

    // ============================================
    // 6. CALCULATE PRICING
    // ============================================
    let totalCents: number;
    let platformFeeCents: number;
    let courierPayoutCents: number;
    
    try {
      totalCents = calculateTotalCents({
        smallQty: args.smallQty || 0,
        mediumQty: args.mediumQty || 0,
        largeQty: args.largeQty || 0,
        oversizedQty: args.oversizedQty || 0,
      });
      
      const split = calculatePayoutSplit(totalCents);
      platformFeeCents = split.platformFeeCents;
      courierPayoutCents = split.courierPayoutCents;
    } catch (pricingError) {
      throw new Error("PRICING_ERROR: Unable to calculate pricing. Please try again or contact support.");
    }

    if (totalCents <= 0) {
      throw new Error("PRICING_ERROR: Invalid order total. Please add packages to your order.");
    }

    // ============================================
    // 7. PREPARE DROP-OFF DATA
    // ============================================
    let dropoffLocationType = args.dropoffLocationType;
    if (args.serviceType === "carrier_dropoff" && !dropoffLocationType) {
      const carrierToType: Record<string, "ups" | "fedex" | "usps" | "dhl" | "other"> = {
        "UPS": "ups",
        "FedEx": "fedex",
        "USPS": "usps",
        "DHL": "dhl",
        "Other": "other",
      };
      dropoffLocationType = carrierToType[args.carrier];
    }

    // Use verified location data if available
    const dropoffLocationName = verifiedLocation?.name || args.dropoffLocationName;
    const dropoffLocationAddress = verifiedLocation 
      ? `${verifiedLocation.address}, ${verifiedLocation.city}, ${verifiedLocation.state} ${verifiedLocation.zipCode}`
      : args.dropoffLocationAddress;
    const dropoffLatitude = verifiedLocation?.latitude || args.dropoffLatitude;
    const dropoffLongitude = verifiedLocation?.longitude || args.dropoffLongitude;

    // ============================================
    // 8. CREATE THE JOB
    // ============================================
    const totalPrice = totalCents / 100;
    const platformCommission = platformFeeCents / 100;
    const courierPayout = courierPayoutCents / 100;
    const packagesCents = totalCents - pricingConfig.pickupFeeCents;
    const baseFee = pricingConfig.pickupFeeCents / 100;
    const additionalFee = packagesCents / 100;

    const jobId = await ctx.db.insert("jobs", {
      customerId: userId,
      pickupAddress: args.pickupAddress,
      pickupNotes: args.pickupNotes,
      pickupPhotoId: args.pickupPhotoId,
      pickupStreet1: args.pickupStreet1,
      pickupStreet2: args.pickupStreet2,
      pickupCity: args.pickupCity,
      pickupState: args.pickupState,
      pickupZipCode: args.pickupZipCode,
      pickupCountry: args.pickupCountry,
      pickupLatitude: args.pickupLatitude,
      pickupLongitude: args.pickupLongitude,
      pickupPlaceId: args.pickupPlaceId,
      isManualAddress: args.isManualAddress || false,
      isAsap: args.isAsap,
      scheduledDate: args.scheduledDate,
      scheduledTime: args.scheduledTime,
      carrier: args.carrier,
      packageCount: totalPackages,
      packageSize: args.packageSize,
      smallQty: args.smallQty,
      mediumQty: args.mediumQty,
      largeQty: args.largeQty,
      oversizedQty: args.oversizedQty,
      baseFee,
      additionalFee,
      totalPrice,
      platformCommission,
      courierPayout,
      status: "draft",
      createdAt: Date.now(),
      paymentStatus: "pending",
      serviceType: args.serviceType,
      dropoffLocationType: dropoffLocationType,
      dropoffLocationId: args.dropoffLocationId,
      dropoffLocationName: dropoffLocationName,
      dropoffLocationAddress: dropoffLocationAddress,
      dropoffLatitude: dropoffLatitude,
      dropoffLongitude: dropoffLongitude,
      amazonLabelConfirmed: args.amazonLabelConfirmed,
      labelPhotoId: args.labelPhotoId,
      expectedTrackingNumber: args.expectedTrackingNumber,
    });

    return jobId;
  },
});

export const getMyJobs = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_customer", (q) => q.eq("customerId", userId))
      .order("desc")
      .collect();

    // Filter out expired drafts (older than 30 minutes)
    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    return jobs.filter((job) => {
      if (job.status === "draft" && job.createdAt < thirtyMinutesAgo) {
        return false; // Hide expired drafts
      }
      return true;
    });
  },
});

export const getCourierJobs = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("matched"),
        v.literal("en_route"),
        v.literal("arrived"),
        v.literal("picked_up"),
        v.literal("dropped_off"),
        v.literal("completed")
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_courier", (q) => q.eq("courierId", userId))
      .order("desc")
      .collect();

    if (args.status) {
      return jobs.filter((job) => job.status === args.status);
    }

    return jobs;
  },
});

export const listAllJobs = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("requested"),
        v.literal("matched"),
        v.literal("en_route"),
        v.literal("arrived"),
        v.literal("picked_up"),
        v.literal("dropped_off"),
        v.literal("completed"),
        v.literal("cancelled")
      )
    ),
  },
  handler: async (ctx, args) => {
    // Verify admin access
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      return [];
    }

    if (args.status) {
      return await ctx.db
        .query("jobs")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
    }

    return await ctx.db.query("jobs").order("desc").collect();
  },
});

export const getAvailableJobs = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Check courier is approved and online
    const application = await ctx.db
      .query("courierApplications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!application || application.status !== "approved" || !application.isOnline) {
      return [];
    }

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_status", (q) => q.eq("status", "requested"))
      .order("desc")
      .collect();

    // Only return jobs that have been paid
    return jobs.filter((job) => job.paymentStatus === "paid");
  },
});

export const getJobById = query({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in to view this job");
    }

    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    // Allow customer, assigned courier, or admin
    const isAuthorized = job.customerId === userId || job.courierId === userId;
    
    if (!isAuthorized) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();

      if (profile?.role !== "admin") {
        throw new Error("You don't have permission to view this job");
      }
    }

    // Get proof photo URLs
    const pickupProofUrl = job.pickupProofId 
      ? await ctx.storage.getUrl(job.pickupProofId) 
      : null;
    const dropoffProofUrl = job.dropoffProofId 
      ? await ctx.storage.getUrl(job.dropoffProofId) 
      : null;

    // Mask the scan value for privacy (show last 6 chars)
    const pickupLabelScanValueMasked = job.pickupLabelScanValue 
      ? `***${job.pickupLabelScanValue.slice(-6)}` 
      : null;

    return {
      ...job,
      pickupProofUrl,
      dropoffProofUrl,
      pickupProofTimestamp: job.pickupProofTimestamp,
      pickupProofLocation: job.pickupProofLocation,
      dropoffProofTimestamp: job.dropoffProofTimestamp,
      dropoffProofLocation: job.dropoffProofLocation,
      pickupLabelScanValueMasked,
    };
  },
});

export const acceptJob = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    console.log("[acceptJob] START", { jobId: args.jobId, timestamp: startTime });
    
    try {
      const userId = await getAuthUserId(ctx);
      if (!userId) {
        console.log("[acceptJob] ERROR: AUTH_REQUIRED");
        throw new ConvexError("AUTH_REQUIRED");
      }

      // Get user's profile to verify role
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
      
      console.log("[acceptJob] Profile check:", { 
        userId: userId.toString(), 
        hasProfile: !!profile, 
        role: profile?.role 
      });

      // Check courier application
      const application = await ctx.db
        .query("courierApplications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();

      if (!application) {
        console.log("[acceptJob] ERROR: COURIER_NOT_FOUND", { userId: userId.toString() });
        throw new ConvexError("COURIER_NOT_FOUND");
      }

      // Check approval - support both old and new fields
      const isApproved = application.verificationStatus === "approved" || application.status === "approved";
      console.log("[acceptJob] Approval check:", { 
        status: application.status, 
        verificationStatus: application.verificationStatus, 
        isApproved 
      });
      
      if (!isApproved) {
        throw new ConvexError("COURIER_NOT_APPROVED");
      }

      if (!application.isOnline) {
        console.log("[acceptJob] ERROR: COURIER_OFFLINE");
        throw new ConvexError("COURIER_OFFLINE");
      }

      // Payout check - warn but don't block for MVP
      if (application.payoutSetupStatus !== "complete") {
        console.log("[acceptJob] WARNING: Payout not complete, allowing for MVP");
      }

      const job = await ctx.db.get(args.jobId);
      if (!job) {
        console.log("[acceptJob] ERROR: JOB_NOT_FOUND", { jobId: args.jobId });
        throw new ConvexError("JOB_NOT_FOUND");
      }

      console.log("[acceptJob] Job check:", { 
        jobId: args.jobId, 
        status: job.status, 
        hasCourier: !!job.courierId 
      });

      if (job.status !== "requested") {
        throw new ConvexError("JOB_NOT_AVAILABLE");
      }

      if (job.courierId) {
        throw new ConvexError("JOB_ALREADY_TAKEN");
      }

      // Atomic update - claim the job
      await ctx.db.patch(args.jobId, {
        status: "matched",
        courierId: userId,
        courierAcceptedAt: Date.now(),
        matchedAt: Date.now(),
      });

      console.log("[acceptJob] Job claimed successfully");

      // Log the job acceptance
      await logJobEvent(ctx, {
        jobId: args.jobId,
        courierId: userId,
        customerId: job.customerId,
        eventType: "job_accepted",
        previousStatus: "requested",
        newStatus: "matched",
      });

      // Notify customer
      await ctx.db.insert("customerNotifications", {
        customerId: job.customerId,
        jobId: args.jobId,
        type: "courier_matched",
        title: "Courier Matched! 🚗",
        message: "A courier has accepted your pickup and is on the way.",
        isRead: false,
        createdAt: Date.now(),
      });

      // Schedule push notification (don't await - fire and forget)
      try {
        await ctx.scheduler.runAfter(0, internal.notificationsActions.sendPushToUser, {
          userId: job.customerId,
          title: "Courier Matched! 🚗",
          message: "A courier has accepted your pickup and is on the way.",
          url: `/customer/tracking/${args.jobId}`,
          data: { jobId: args.jobId, type: "courier_matched" },
        });
      } catch (pushError) {
        // Don't fail the whole mutation if push fails
        console.log("[acceptJob] Push notification failed (non-fatal):", pushError);
      }

      const duration = Date.now() - startTime;
      console.log("[acceptJob] SUCCESS", { 
        jobId: args.jobId, 
        courierId: userId.toString(),
        durationMs: duration 
      });

      const updatedJob = await ctx.db.get(args.jobId);
      return { success: true, jobId: args.jobId, job: updatedJob };
      
    } catch (error: unknown) {
      // Re-throw ConvexError as-is
      if (error instanceof ConvexError) {
        console.log("[acceptJob] ConvexError:", error.data);
        throw error;
      }
      
      // Log and wrap other errors
      console.error("[acceptJob] UNEXPECTED ERROR:", {
        jobId: args.jobId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      throw new ConvexError("INTERNAL_ERROR");
    }
  },
});

export const updateJobStatus = mutation({
  args: {
    jobId: v.id("jobs"),
    status: v.union(
      v.literal("en_route"),
      v.literal("arrived"),
      v.literal("picked_up"),
      v.literal("dropped_off")
    ),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    console.log("[updateJobStatus] Starting:", { jobId: args.jobId, targetStatus: args.status });
    
    try {
      const userId = await getAuthUserId(ctx);
      if (!userId) {
        throw new Error("Session expired. Please sign in again.");
      }
      console.log("[updateJobStatus] Auth OK, userId:", userId);

      const job = await ctx.db.get(args.jobId);
      if (!job) {
        throw new Error("Job not found. It may have been cancelled.");
      }
      console.log("[updateJobStatus] Job found, current status:", job.status);

      if (job.courierId !== userId) {
        throw new Error("You are not assigned to this job.");
      }

      // Validate status transition
      if (!isValidTransition(job.status, args.status)) {
        const errorMsg = getTransitionError(job.status, args.status);
        console.log("[updateJobStatus] Invalid transition:", errorMsg);
        throw new Error(errorMsg);
      }
      console.log("[updateJobStatus] Transition valid:", job.status, "->", args.status);

      // Skip requirements check for dropped_off (only check for picked_up)
      if (args.status === "picked_up") {
        if (!job.pickupLabelScanVerified) {
          throw new Error("Please scan the package label before marking as picked up");
        }
        if (!job.pickupProofId) {
          throw new Error("Please take a pickup proof photo before marking as picked up");
        }
      }

      const previousStatus = job.status;
      const updates: Record<string, unknown> = { status: args.status };

      // Add timestamp for specific statuses
      if (args.status === "arrived") {
        updates.arrivedAt = Date.now();
      } else if (args.status === "picked_up") {
        updates.pickedUpAt = Date.now();
      } else if (args.status === "dropped_off") {
        updates.droppedOffAt = Date.now();
      }

      console.log("[updateJobStatus] Patching job with:", updates);
      await ctx.db.patch(args.jobId, updates);
      console.log("[updateJobStatus] Job patched successfully");

      // Log successful status change
      try {
        await logJobEvent(ctx, {
          jobId: args.jobId,
          courierId: userId,
          customerId: job.customerId,
          eventType: "status_change",
          previousStatus,
          newStatus: args.status,
          latitude: args.latitude,
          longitude: args.longitude,
        });
        console.log("[updateJobStatus] Job event logged");
      } catch (logError) {
        console.error("[updateJobStatus] Failed to log event:", logError);
        // Don't fail the mutation for logging errors
      }

      // Add notification based on status
      const notifications: Record<string, { title: string; message: string; type: string }> = {
        en_route: {
          type: "courier_en_route",
          title: "Courier En Route",
          message: "Your courier is heading to the pickup location.",
        },
        arrived: {
          type: "courier_arrived", 
          title: "Courier Arrived! 📍",
          message: "Your courier has arrived at the pickup location.",
        },
        picked_up: {
          type: "package_picked_up",
          title: "Package Picked Up! 📦",
          message: "Your package has been picked up and is on the way to the carrier.",
        },
        dropped_off: {
          type: "package_dropped_off",
          title: "Package Dropped Off! ✅",
          message: "Your package has been dropped off at the carrier location.",
        },
      };

      if (notifications[args.status]) {
        const notif = notifications[args.status];
        
        // Insert customer notification
        try {
          await ctx.db.insert("customerNotifications", {
            customerId: job.customerId,
            jobId: args.jobId,
            type: notif.type,
            title: notif.title,
            message: notif.message,
            isRead: false,
            createdAt: Date.now(),
          });
          console.log("[updateJobStatus] Customer notification inserted");
        } catch (notifError) {
          console.error("[updateJobStatus] Failed to insert notification:", notifError);
        }

        // Send push notification - wrap in try-catch to not fail the mutation
        try {
          await ctx.scheduler.runAfter(0, internal.notificationsActions.sendPushToUser, {
            userId: job.customerId,
            title: notif.title,
            message: notif.message,
            url: `/customer/tracking/${args.jobId}`,
            data: { jobId: args.jobId, type: notif.type, status: args.status },
          });
          console.log("[updateJobStatus] Push notification scheduled");
        } catch (pushError) {
          console.error("[updateJobStatus] Failed to schedule push:", pushError);
          // Don't fail the mutation for push notification errors
        }
      }

      console.log("[updateJobStatus] Success!");
      return { success: true, jobId: args.jobId, newStatus: args.status };
    } catch (error) {
      console.error("[updateJobStatus] FAILED:", {
        jobId: args.jobId,
        targetStatus: args.status,
        error: error instanceof Error ? error.message : String(error),
      });
      
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to update job status");
    }
  },
});

export const recordScan = mutation({
  args: {
    jobId: v.id("jobs"),
    type: v.union(v.literal("pickup"), v.literal("dropoff")),
    latitude: v.number(),
    longitude: v.number(),
    barcodeData: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Session expired. Please sign in again.");
    }

    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found.");
    }

    if (job.courierId !== userId) {
      throw new Error("You are not assigned to this job.");
    }

    const scanData = {
      timestamp: Date.now(),
      latitude: args.latitude,
      longitude: args.longitude,
      barcodeData: args.barcodeData,
    };

    if (args.type === "pickup") {
      if (!["arrived", "picked_up"].includes(job.status)) {
        throw new Error(`Cannot scan for pickup. Current status is "${job.status}". You must arrive at the pickup location first.`);
      }
      await ctx.db.patch(args.jobId, { pickupScan: scanData });
    } else {
      if (job.status !== "dropped_off") {
        throw new Error(`Cannot scan for dropoff. Current status is "${job.status}". You must mark the package as dropped off first.`);
      }
      await ctx.db.patch(args.jobId, { dropoffScan: scanData });
    }

    // Log the scan event
    await logJobEvent(ctx, {
      jobId: args.jobId,
      courierId: userId,
      eventType: `scan_${args.type}`,
      latitude: args.latitude,
      longitude: args.longitude,
      metadata: { barcodeData: args.barcodeData },
    });

    return { success: true, type: args.type };
  },
});

export const completeJob = mutation({
  args: {
    jobId: v.id("jobs"),
    dropoffProofId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in to complete jobs");
    }

    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    // Idempotency check: if job is already completed, return success without creating duplicates
    if (job.status === "completed") {
      return args.jobId;
    }

    if (job.courierId !== userId) {
      throw new Error("Only the assigned courier can complete this job");
    }

    if (job.status !== "dropped_off") {
      throw new Error("Job must be marked as dropped off before completing");
    }

    if (!job.pickupScan) {
      throw new Error("Pickup scan is required to complete the job");
    }

    if (!job.dropoffScan) {
      throw new Error("Dropoff scan is required to complete the job");
    }

    if (!job.dropoffProofId) {
      throw new Error("Drop-off proof photo is required to complete the job. Please take a photo of the package at the drop-off location.");
    }

    // Verify proximity to selected drop-off location (warning only for MVP)
    if (job.dropoffLatitude && job.dropoffLongitude && job.dropoffScan) {
      const distance = calculateDistance(
        job.dropoffScan.latitude,
        job.dropoffScan.longitude,
        job.dropoffLatitude,
        job.dropoffLongitude
      );
      
      // Warn if more than 0.5 miles away (but don't block for MVP)
      if (distance > 0.5) {
        console.log(`Warning: Drop-off scan ${distance} miles from selected location for job ${args.jobId}`);
      }
    }

    await ctx.db.patch(args.jobId, {
      status: "completed",
      completedAt: Date.now(),
      dropoffProofId: args.dropoffProofId,
    });

    // Create transaction records
    await ctx.db.insert("transactions", {
      jobId: args.jobId,
      type: "payment",
      amount: job.totalPrice,
      customerId: job.customerId,
      status: "completed",
      createdAt: Date.now(),
      completedAt: Date.now(),
    });

    await ctx.db.insert("transactions", {
      jobId: args.jobId,
      type: "commission",
      amount: job.platformCommission,
      customerId: job.customerId,
      status: "completed",
      createdAt: Date.now(),
      completedAt: Date.now(),
    });

    await ctx.db.insert("transactions", {
      jobId: args.jobId,
      type: "payout",
      amount: job.courierPayout,
      courierId: job.courierId,
      status: "pending",
      createdAt: Date.now(),
    });

    // Create payout ledger entry for courier (with idempotency check)
    const existingPayout = await ctx.db
      .query("payoutLedger")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .unique();

    if (!existingPayout) {
      await ctx.db.insert("payoutLedger", {
        courierId: job.courierId!,
        jobId: args.jobId,
        amount: job.courierPayout,
        status: "pending",
        createdAt: Date.now(),
      });
    }

    // Notify customer of job completion
    await ctx.db.insert("customerNotifications", {
      customerId: job.customerId,
      jobId: args.jobId,
      type: "job_completed",
      title: "Delivery Complete! 🎉",
      message: "Your package has been successfully delivered. Thank you for using Droppit!",
      isRead: false,
      createdAt: Date.now(),
    });

    // Send push notification to customer
    await ctx.scheduler.runAfter(0, internal.notificationsActions.sendPushToUser, {
      userId: job.customerId,
      title: "Delivery Complete! 🎉",
      message: "Your package has been successfully delivered. Thank you for using Droppit!",
      url: `/customer/order/${args.jobId}`,
      data: { jobId: args.jobId, type: "job_completed" },
    });

    // Send push notification to courier
    if (job.courierId) {
      await ctx.scheduler.runAfter(0, internal.notificationsActions.sendPushToUser, {
        userId: job.courierId,
        title: "Job Complete! 💰",
        message: `You earned $${(job.courierPayout || 0).toFixed(2)} for this delivery.`,
        url: `/courier/earnings`,
        data: { jobId: args.jobId, type: "job_completed" },
      });
    }

    return args.jobId;
  },
});

export const cancelJob = mutation({
  args: {
    jobId: v.id("jobs"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in to cancel jobs");
    }

    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    // Allow customer to cancel if not yet picked up
    // Allow admin to cancel anytime
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const isAdmin = profile?.role === "admin";
    const isCustomer = job.customerId === userId;

    if (!isAdmin && !isCustomer) {
      throw new Error("You don't have permission to cancel this job");
    }

    if (!isAdmin && job.status !== "requested" && job.status !== "matched" && job.status !== "en_route") {
      throw new Error("This job can no longer be cancelled. Please contact support");
    }

    const previousStatus = job.status;

    await ctx.db.patch(args.jobId, {
      status: "cancelled",
      cancelledAt: Date.now(),
      paymentStatus: job.paymentStatus === "paid" ? "refunded" : job.paymentStatus,
    });

    // Create refund transaction if payment was paid
    if (job.paymentStatus === "paid") {
      await ctx.db.insert("transactions", {
        jobId: args.jobId,
        type: "refund",
        amount: job.totalPrice,
        customerId: job.customerId,
        status: "completed",
        createdAt: Date.now(),
        completedAt: Date.now(),
        metadata: { reason: args.reason, cancelledBy: userId },
      });
    }

    // Log admin action if cancelled by admin
    if (isAdmin) {
      await ctx.scheduler.runAfter(0, internal.adminLogs.logAdminAction, {
        adminId: userId,
        action: "job_cancelled",
        targetType: "job",
        targetId: args.jobId,
        details: {
          previousStatus,
          reason: args.reason,
          customerId: job.customerId,
          courierId: job.courierId,
          totalPrice: job.totalPrice,
          wasRefunded: job.paymentStatus === "paid",
        },
      });
    }

    return args.jobId;
  },
});

// Admin-only job cancellation (uses admin auth, not customer auth)
export const adminCancelJob = mutation({
  args: {
    jobId: v.id("jobs"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Use admin auth, not customer auth
    const adminId = await requireAdminStrict(ctx);
    
    console.log("[adminCancelJob] Admin action", {
      adminId,
      jobId: args.jobId,
      reason: args.reason,
    });

    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    const previousStatus = job.status;

    // Admin can cancel any job regardless of status
    await ctx.db.patch(args.jobId, {
      status: "cancelled",
      cancelledAt: Date.now(),
      paymentStatus: job.paymentStatus === "paid" ? "refunded" : job.paymentStatus,
    });

    // Create refund transaction if payment was paid
    if (job.paymentStatus === "paid") {
      await ctx.db.insert("transactions", {
        jobId: args.jobId,
        type: "refund",
        amount: job.totalPrice,
        customerId: job.customerId,
        status: "completed",
        createdAt: Date.now(),
        completedAt: Date.now(),
        metadata: { reason: args.reason, cancelledBy: "admin", adminId },
      });
    }

    // Log admin action
    await ctx.scheduler.runAfter(0, internal.adminLogs.logAdminAction, {
      adminId,
      action: "job_cancelled",
      targetType: "job",
      targetId: args.jobId,
      details: {
        previousStatus,
        reason: args.reason,
        customerId: job.customerId,
        courierId: job.courierId,
        totalPrice: job.totalPrice,
        wasRefunded: job.paymentStatus === "paid",
      },
    });

    // Notify customer
    await ctx.db.insert("customerNotifications", {
      customerId: job.customerId,
      jobId: args.jobId,
      type: "job_cancelled",
      title: "Job Cancelled",
      message: args.reason || "Your job has been cancelled by an administrator.",
      isRead: false,
      createdAt: Date.now(),
    });

    return { success: true, jobId: args.jobId };
  },
});

export const assignCourier = mutation({
  args: {
    jobId: v.id("jobs"),
    courierId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdminStrict(ctx);

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");

    // Can only assign if requested or matched (re-assigning)
    if (job.status !== "requested" && job.status !== "matched") {
      throw new Error(`Cannot assign courier to job with status: ${job.status}`);
    }

    const previousCourierId = job.courierId;
    const previousStatus = job.status;

    // Update job
    await ctx.db.patch(args.jobId, {
      status: "matched",
      courierId: args.courierId,
      matchedAt: Date.now(),
    });

    // Log event
    await logJobEvent(ctx, {
      jobId: args.jobId,
      courierId: args.courierId,
      customerId: job.customerId,
      eventType: "job_assigned_by_admin",
      previousStatus,
      newStatus: "matched",
      metadata: { adminId, previousCourierId },
    });

    // Notify courier
    await ctx.db.insert("courierNotifications", {
      courierId: args.courierId,
      type: "job_assigned",
      title: "New Job Assigned! 📦",
      message: "An administrator has assigned a new delivery job to you.",
      isRead: false,
      createdAt: Date.now(),
    });

    // Notify customer
    await ctx.db.insert("customerNotifications", {
      customerId: job.customerId,
      jobId: args.jobId,
      type: "courier_matched",
      title: "Courier Assigned! 🚗",
      message: "An administrator has assigned a courier to your pickup.",
      isRead: false,
      createdAt: Date.now(),
    });

    // Log admin action
    await ctx.scheduler.runAfter(0, internal.adminLogs.logAdminAction, {
      adminId,
      action: "job_assigned",
      targetType: "job",
      targetId: args.jobId,
      details: {
        courierId: args.courierId,
        previousCourierId,
      },
    });

    return { success: true };
  },
});

export const saveProofPhoto = mutation({
  args: {
    jobId: v.id("jobs"),
    type: v.union(v.literal("pickup"), v.literal("dropoff")),
    photoId: v.id("_storage"),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in to save proof photos");
    }

    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    if (job.courierId !== userId) {
      throw new Error("Only the assigned courier can upload proof photos");
    }

    const timestamp = Date.now();
    const location = (args.latitude !== undefined && args.longitude !== undefined) 
      ? { latitude: args.latitude, longitude: args.longitude }
      : undefined;

    // Validate job status for proof type
    if (args.type === "pickup") {
      if (!["arrived", "picked_up"].includes(job.status)) {
        throw new Error("Cannot upload pickup proof at this stage");
      }
      await ctx.db.patch(args.jobId, { 
        pickupProofId: args.photoId,
        pickupProofTimestamp: timestamp,
        pickupProofLocation: location,
      });
    } else {
      if (!["picked_up", "dropped_off", "completed"].includes(job.status)) {
        throw new Error("Cannot upload dropoff proof at this stage");
      }
      await ctx.db.patch(args.jobId, { 
        dropoffProofId: args.photoId,
        dropoffProofTimestamp: timestamp,
        dropoffProofLocation: location,
      });
    }

    // Log the proof upload event
    await logJobEvent(ctx, {
      jobId: args.jobId,
      courierId: userId,
      eventType: `proof_${args.type}_uploaded`,
      latitude: args.latitude,
      longitude: args.longitude,
      metadata: { photoId: args.photoId, timestamp },
    });

    return { success: true, type: args.type, timestamp };
  },
});

// Save pickup label scan verification
export const savePickupLabelScan = mutation({
  args: {
    jobId: v.id("jobs"),
    scanValue: v.string(),
    scanType: v.union(v.literal("qr"), v.literal("barcode"), v.literal("manual"), v.literal("ocr")),
    photoId: v.optional(v.id("_storage")), // For OCR scans
  },
  handler: async (ctx, args) => {
    // Auth check
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("UNAUTHENTICATED: Please sign in to record scan");
    }

    // Validate scan value
    const trimmedValue = args.scanValue.trim();
    if (!trimmedValue || trimmedValue.length < 4) {
      throw new Error("INVALID_SCAN_VALUE: Scan value must be at least 4 characters");
    }
    if (trimmedValue.length > 100) {
      throw new Error("INVALID_SCAN_VALUE: Scan value is too long");
    }

    // Get job
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("JOB_NOT_FOUND: Job not found");
    }

    // Check courier assignment
    if (job.courierId !== userId) {
      throw new Error("NOT_ASSIGNED_COURIER: Only the assigned courier can scan packages");
    }

    // Can only scan when arrived at pickup
    if (!["arrived", "picked_up"].includes(job.status)) {
      throw new Error("INVALID_STATUS: You must arrive at the pickup location before scanning");
    }

    // Check if scan matches expected tracking number (if provided)
    let scanMatchesExpected: boolean | undefined = undefined;
    if (job.expectedTrackingNumber) {
      const normalizedScan = trimmedValue.toUpperCase().replace(/\s/g, '');
      const normalizedExpected = job.expectedTrackingNumber.toUpperCase().replace(/\s/g, '');
      scanMatchesExpected = normalizedScan.includes(normalizedExpected) || normalizedExpected.includes(normalizedScan);
    }

    // Build update object
    const updates: Record<string, unknown> = {
      pickupLabelScanValue: trimmedValue,
      pickupLabelScanType: args.scanType,
      pickupLabelScanTimestamp: Date.now(),
      pickupLabelScanVerified: true,
      scanMatchesExpected,
    };

    // Add photo ID for OCR scans
    if (args.scanType === "ocr" && args.photoId) {
      updates.pickupLabelPhotoId = args.photoId;
      updates.pickupLabelPhotoTimestamp = Date.now();
    }

    await ctx.db.patch(args.jobId, updates);

    // Log the scan event
    await logJobEvent(ctx, {
      jobId: args.jobId,
      courierId: userId,
      eventType: "pickup_label_scanned",
      metadata: { 
        scanType: args.scanType, 
        scanValueLength: trimmedValue.length,
        scanMatchesExpected,
        hasPhoto: !!args.photoId,
      },
    });

    return { 
      success: true, 
      scanValue: trimmedValue,
      scanMatchesExpected,
      hasExpectedTracking: !!job.expectedTrackingNumber,
    };
  },
});

export const rateJob = mutation({
  args: {
    jobId: v.id("jobs"),
    rating: v.number(),
    feedback: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in to rate jobs");
    }

    if (args.rating < 1 || args.rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    if (job.customerId !== userId) {
      throw new Error("Only the customer can rate this job");
    }

    if (job.status !== "completed") {
      throw new Error("You can only rate completed jobs");
    }

    if (job.rating !== undefined) {
      throw new Error("You have already rated this job");
    }

    await ctx.db.patch(args.jobId, {
      rating: args.rating,
      ratingFeedback: args.feedback,
    });

    return args.jobId;
  },
});

// Confirm payment and activate job
export const confirmPayment = mutation({
  args: {
    jobId: v.id("jobs"),
    paymentId: v.string(),
    paymentAmount: v.number(),
    paymentCurrency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please sign in");

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    if (job.customerId !== userId) throw new Error("Not authorized");
    if (job.status !== "draft") throw new Error("Job already processed");

    // Update job to requested status
    await ctx.db.patch(args.jobId, {
      status: "requested",
      paymentStatus: "paid",
      paymentId: args.paymentId,
      paymentAmount: args.paymentAmount,
      paymentCurrency: args.paymentCurrency || "USD",
      paidAt: Date.now(),
    });

    // NOW send the booking confirmation notification
    await ctx.db.insert("customerNotifications", {
      customerId: userId,
      jobId: args.jobId,
      type: "booking_confirmed",
      title: "Booking Confirmed! 📋",
      message: "Your pickup has been booked and paid. We're finding a courier for you.",
      isRead: false,
      createdAt: Date.now(),
    });

    // Notify online couriers about new job
    await ctx.scheduler.runAfter(0, internal.notificationsActions.notifyOnlineCouriers, {
      title: "New Pickup Available! 📦",
      message: "A new delivery job is available in your area.",
      jobId: args.jobId,
    });

    // Create payment transaction record
    await ctx.db.insert("transactions", {
      jobId: args.jobId,
      type: "payment",
      amount: args.paymentAmount,
      customerId: userId,
      status: "completed",
      createdAt: Date.now(),
      completedAt: Date.now(),
      metadata: { paymentId: args.paymentId },
    });

    return args.jobId;
  },
});

// Cancel a draft job (for payment failure or user abandonment)
export const cancelDraftJob = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please sign in");

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    if (job.customerId !== userId) throw new Error("Not authorized");
    if (job.status !== "draft") throw new Error("Can only cancel draft jobs");

    // Delete the draft job
    await ctx.db.delete(args.jobId);
  },
});

// Admin: Get payment statistics
export const getPaymentStats = query({
  args: {},
  handler: async (ctx) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      return {
        totalPaid: 0,
        totalFailed: 0,
        totalRefunded: 0,
        revenueToday: 0,
        revenueWeek: 0,
        revenueMonth: 0,
        totalRevenue: 0,
      };
    }

    const allJobs = await ctx.db.query("jobs").collect();
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    const paidJobs = allJobs.filter((j) => j.paymentStatus === "paid");
    const failedJobs = allJobs.filter((j) => j.paymentStatus === "failed");
    const refundedJobs = allJobs.filter((j) => j.paymentStatus === "refunded");

    const revenueToday = paidJobs
      .filter((j) => j.paidAt && j.paidAt > dayAgo)
      .reduce((sum, j) => sum + (j.paymentAmount || j.totalPrice), 0);

    const revenueWeek = paidJobs
      .filter((j) => j.paidAt && j.paidAt > weekAgo)
      .reduce((sum, j) => sum + (j.paymentAmount || j.totalPrice), 0);

    const revenueMonth = paidJobs
      .filter((j) => j.paidAt && j.paidAt > monthAgo)
      .reduce((sum, j) => sum + (j.paymentAmount || j.totalPrice), 0);

    return {
      totalPaid: paidJobs.length,
      totalFailed: failedJobs.length,
      totalRefunded: refundedJobs.length,
      revenueToday,
      revenueWeek,
      revenueMonth,
      totalRevenue: paidJobs.reduce((sum, j) => sum + (j.paymentAmount || j.totalPrice), 0),
    };
  },
});

// Admin: List payments with optional filtering
export const listPayments = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("paid"),
        v.literal("failed"),
        v.literal("refunded"),
        v.literal("pending")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      return [];
    }

    let jobs = await ctx.db.query("jobs").order("desc").collect();

    // Filter by payment status if specified
    if (args.status) {
      jobs = jobs.filter((j) => j.paymentStatus === args.status);
    } else {
      // By default, show all jobs that have payment activity (not drafts without payment attempt)
      jobs = jobs.filter((j) => j.paymentStatus !== "pending" || j.status !== "draft");
    }

    // Apply limit
    if (args.limit) {
      jobs = jobs.slice(0, args.limit);
    }

    // Enrich with customer info
    const enrichedJobs = await Promise.all(
      jobs.map(async (job) => {
        const customer = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", job.customerId))
          .unique();

        return {
          ...job,
          customerName: customer?.name || "Unknown",
          customerEmail: customer?.email || "Unknown",
        };
      })
    );

    return enrichedJobs;
  },
});

// Extract tracking number candidates from label photo
// NOTE: This is a placeholder that returns mock candidates
// In production, integrate with Google Cloud Vision, AWS Textract, or similar
export const extractTrackingFromPhoto = action({
  args: {
    jobId: v.id("jobs"),
    photoId: v.id("_storage"),
  },
  handler: async (_ctx, args): Promise<{ candidates: string[], error?: string }> => {
    // For MVP: Return a message that OCR is not yet configured
    // The courier should use manual entry as fallback
    console.log("[OCR] Photo extraction requested for job:", args.jobId);
    
    // In production, you would:
    // 1. Get the image URL from storage
    // 2. Send to OCR service (Google Vision, AWS Textract, etc.)
    // 3. Parse response for tracking number patterns
    // 4. Return top candidates
    
    return {
      candidates: [],
      error: "OCR_NOT_CONFIGURED: Please use manual entry to input the tracking number",
    };
  },
});
