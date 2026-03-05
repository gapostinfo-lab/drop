import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { pricingConfig, calculateTotalCents, calculatePayoutSplit } from "./lib/pricing";

// Create a booking draft (before payment)
export const createDraft = mutation({
  args: {
    pickupAddress: v.string(),
    pickupNotes: v.optional(v.string()),
    pickupPhotoId: v.optional(v.id("_storage")),
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
    smallQty: v.optional(v.number()),
    mediumQty: v.optional(v.number()),
    largeQty: v.optional(v.number()),
    oversizedQty: v.optional(v.number()),
    serviceType: v.optional(v.union(v.literal("amazon_return"), v.literal("carrier_dropoff"))),
    dropoffLocationType: v.optional(v.string()),
    dropoffLocationId: v.optional(v.id("hubLocations")),
    dropoffLocationName: v.optional(v.string()),
    dropoffLocationAddress: v.optional(v.string()),
    dropoffLatitude: v.optional(v.number()),
    dropoffLongitude: v.optional(v.number()),
    amazonLabelConfirmed: v.optional(v.boolean()),
    labelPhotoId: v.optional(v.id("_storage")),
    expectedTrackingNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // DEBUG: Log incoming request
    console.log("createDraft called with args:", {
      pickupAddress: args.pickupAddress?.substring(0, 50),
      carrier: args.carrier,
      packageCount: args.packageCount,
      packageSize: args.packageSize,
      serviceType: args.serviceType,
      dropoffLocationId: args.dropoffLocationId,
      isAsap: args.isAsap,
    });

    const userId = await getAuthUserId(ctx);
    console.log("createDraft userId:", userId);
    
    if (!userId) {
      console.log("createDraft: AUTH FAILED - no userId");
      throw new Error("AUTH_REQUIRED: Please sign in to book a pickup. Your session may have expired.");
    }

    // Validate required fields
    if (!args.pickupAddress || args.pickupAddress.trim().length < 5) {
      throw new Error("VALIDATION_ERROR: Please enter a valid pickup address.");
    }

    if (!args.isAsap && (!args.scheduledDate || !args.scheduledTime)) {
      throw new Error("VALIDATION_ERROR: Please select a date and time for scheduled pickups.");
    }

    const totalPackages = (args.smallQty || 0) + (args.mediumQty || 0) + (args.largeQty || 0) + (args.oversizedQty || 0);
    if (totalPackages < 1) {
      throw new Error("VALIDATION_ERROR: Please add at least one package.");
    }

    // Validate drop-off location for carrier_dropoff
    if (args.serviceType === "carrier_dropoff" && !args.dropoffLocationId && !args.dropoffLocationName) {
      throw new Error("HUB_NOT_SELECTED: Please select a drop-off location.");
    }

    // Validate Amazon returns
    if (args.serviceType === "amazon_return") {
      if (!args.amazonLabelConfirmed) {
        throw new Error("VALIDATION_ERROR: Please confirm your Amazon return label is attached.");
      }
      if (!args.dropoffLocationId) {
        throw new Error("HUB_NOT_SELECTED: Please select a drop-off location for your Amazon return.");
      }
    }

    // Validate hub location if provided
    if (args.dropoffLocationId) {
      const location = await ctx.db.get(args.dropoffLocationId);
      if (!location) {
        throw new Error("HUB_NOT_FOUND: Selected drop-off location not found.");
      }
      if (!location.isActive) {
        throw new Error("HUB_INACTIVE: Selected drop-off location is no longer available.");
      }
    }

    // Calculate pricing
    const totalPriceCents = calculateTotalCents({
      smallQty: args.smallQty || 0,
      mediumQty: args.mediumQty || 0,
      largeQty: args.largeQty || 0,
      oversizedQty: args.oversizedQty || 0,
    });

    if (totalPriceCents <= 0) {
      throw new Error("VALIDATION_ERROR: Invalid order total.");
    }

    const now = Date.now();
    const expiresAt = now + 30 * 60 * 1000; // 30 minutes

    const draftId = await ctx.db.insert("bookingDrafts", {
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
      isManualAddress: args.isManualAddress,
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
      totalPriceCents,
      serviceType: args.serviceType,
      dropoffLocationType: args.dropoffLocationType,
      dropoffLocationId: args.dropoffLocationId,
      dropoffLocationName: args.dropoffLocationName,
      dropoffLocationAddress: args.dropoffLocationAddress,
      dropoffLatitude: args.dropoffLatitude,
      dropoffLongitude: args.dropoffLongitude,
      amazonLabelConfirmed: args.amazonLabelConfirmed,
      labelPhotoId: args.labelPhotoId,
      expectedTrackingNumber: args.expectedTrackingNumber,
      paymentStatus: "pending",
      createdAt: now,
      expiresAt,
    });

    return { draftId, totalPriceCents };
  },
});

// Get a draft by ID
export const getDraft = query({
  args: { draftId: v.id("bookingDrafts") },
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (!draft) return null;
    
    // Check if expired
    if (draft.expiresAt < Date.now() && draft.paymentStatus === "pending") {
      return { ...draft, isExpired: true };
    }
    
    return { ...draft, isExpired: false };
  },
});

// Update draft with checkout session info
export const updateCheckoutSession = mutation({
  args: {
    draftId: v.id("bookingDrafts"),
    checkoutSessionId: v.string(),
    checkoutUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("AUTH_REQUIRED: Please sign in. Your session may have expired.");
    }

    const draft = await ctx.db.get(args.draftId);
    if (!draft) {
      throw new Error("DRAFT_NOT_FOUND: Booking draft not found.");
    }
    if (draft.customerId !== userId) {
      throw new Error("AUTH_REQUIRED: Not authorized to access this booking.");
    }

    await ctx.db.patch(args.draftId, {
      checkoutSessionId: args.checkoutSessionId,
      checkoutUrl: args.checkoutUrl,
      paymentStatus: "processing",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Create job from draft after payment success
export const createJobFromDraft = mutation({
  args: {
    draftId: v.id("bookingDrafts"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("AUTH_REQUIRED: Please sign in. Your session may have expired.");
    }

    const draft = await ctx.db.get(args.draftId);
    if (!draft) {
      throw new Error("DRAFT_NOT_FOUND: Booking draft not found.");
    }
    if (draft.customerId !== userId) {
      throw new Error("AUTH_REQUIRED: Not authorized to access this booking.");
    }

    // Idempotency: if job already created, return it
    if (draft.jobId) {
      return { jobId: draft.jobId, alreadyCreated: true };
    }

    // Check if draft is expired
    if (draft.expiresAt < Date.now() && draft.paymentStatus !== "paid") {
      throw new Error("DRAFT_EXPIRED: This booking has expired. Please start over.");
    }

    // Calculate pricing
    const totalCents = draft.totalPriceCents;
    const { platformFeeCents, courierPayoutCents } = calculatePayoutSplit(totalCents);
    
    const totalPrice = totalCents / 100;
    const platformCommission = platformFeeCents / 100;
    const courierPayout = courierPayoutCents / 100;
    const packagesCents = totalCents - pricingConfig.pickupFeeCents;
    const baseFee = pricingConfig.pickupFeeCents / 100;
    const additionalFee = packagesCents / 100;

    // Create the job
    const jobId = await ctx.db.insert("jobs", {
      customerId: userId,
      pickupAddress: draft.pickupAddress,
      pickupNotes: draft.pickupNotes,
      pickupPhotoId: draft.pickupPhotoId,
      pickupStreet1: draft.pickupStreet1,
      pickupStreet2: draft.pickupStreet2,
      pickupCity: draft.pickupCity,
      pickupState: draft.pickupState,
      pickupZipCode: draft.pickupZipCode,
      pickupCountry: draft.pickupCountry,
      pickupLatitude: draft.pickupLatitude,
      pickupLongitude: draft.pickupLongitude,
      pickupPlaceId: draft.pickupPlaceId,
      isManualAddress: draft.isManualAddress || false,
      isAsap: draft.isAsap,
      scheduledDate: draft.scheduledDate,
      scheduledTime: draft.scheduledTime,
      carrier: draft.carrier,
      packageCount: draft.packageCount,
      packageSize: draft.packageSize,
      smallQty: draft.smallQty,
      mediumQty: draft.mediumQty,
      largeQty: draft.largeQty,
      oversizedQty: draft.oversizedQty,
      baseFee,
      additionalFee,
      totalPrice,
      platformCommission,
      courierPayout,
      status: "requested", // Already paid, so go straight to requested
      createdAt: Date.now(),
      paymentStatus: "paid",
      paymentId: draft.checkoutSessionId,
      paymentAmount: totalPrice,
      paymentCurrency: "USD",
      paidAt: Date.now(),
      serviceType: draft.serviceType,
      dropoffLocationType: draft.dropoffLocationType as "ups" | "fedex" | "usps" | "dhl" | "amazon_hub" | "amazon_locker" | "amazon_counter" | "amazon_wholefoods" | "amazon_kohls" | "other" | undefined,
      dropoffLocationId: draft.dropoffLocationId,
      dropoffLocationName: draft.dropoffLocationName,
      dropoffLocationAddress: draft.dropoffLocationAddress,
      dropoffLatitude: draft.dropoffLatitude,
      dropoffLongitude: draft.dropoffLongitude,
      amazonLabelConfirmed: draft.amazonLabelConfirmed,
      labelPhotoId: draft.labelPhotoId,
      expectedTrackingNumber: draft.expectedTrackingNumber,
    });

    // Update draft with job reference
    await ctx.db.patch(args.draftId, {
      jobId,
      paymentStatus: "paid",
      paidAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Send booking confirmation notification
    await ctx.db.insert("customerNotifications", {
      customerId: userId,
      jobId,
      type: "booking_confirmed",
      title: "Booking Confirmed!",
      message: "Your pickup has been booked and paid. We're finding a courier for you.",
      isRead: false,
      createdAt: Date.now(),
    });

    // Create payment transaction record
    await ctx.db.insert("transactions", {
      jobId,
      type: "payment",
      amount: totalPrice,
      customerId: userId,
      status: "completed",
      createdAt: Date.now(),
      completedAt: Date.now(),
      metadata: {
        draftId: args.draftId,
        checkoutSessionId: draft.checkoutSessionId,
      },
    });

    // Notify online couriers about new job via push notification
    await ctx.scheduler.runAfter(0, internal.notificationsActions.notifyOnlineCouriers, {
      title: "New Pickup Available! 📦",
      message: `${draft.packageCount} package${draft.packageCount > 1 ? 's' : ''} • ${draft.pickupCity || 'Nearby'}`,
      jobId,
    });

    // Create in-app notifications for all online approved couriers
    const onlineCouriers = await ctx.db
      .query("courierApplications")
      .withIndex("by_online", (q) => q.eq("isOnline", true).eq("status", "approved"))
      .collect();

    for (const courier of onlineCouriers) {
      await ctx.db.insert("courierNotifications", {
        courierId: courier.userId,
        type: "new_job_available",
        title: "New Pickup Available!",
        message: `${draft.packageCount} package${draft.packageCount > 1 ? 's' : ''} ready for pickup in ${draft.pickupCity || 'your area'}`,
        isRead: false,
        createdAt: Date.now(),
      });
    }

    return { jobId, alreadyCreated: false };
  },
});

// Mark draft as cancelled
export const cancelDraft = mutation({
  args: { draftId: v.id("bookingDrafts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("AUTH_REQUIRED: Please sign in. Your session may have expired.");
    }

    const draft = await ctx.db.get(args.draftId);
    if (!draft) {
      throw new Error("DRAFT_NOT_FOUND: Booking draft not found.");
    }
    if (draft.customerId !== userId) {
      throw new Error("AUTH_REQUIRED: Not authorized to access this booking.");
    }

    if (draft.paymentStatus === "pending" || draft.paymentStatus === "processing") {
      await ctx.db.patch(args.draftId, {
        paymentStatus: "cancelled",
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});
