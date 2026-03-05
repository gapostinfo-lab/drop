import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Internal mutation to create draft (called from action)
export const createDraftInternal = internalMutation({
  args: {
    userId: v.id("users"),
    pickupAddress: v.string(),
    pickupNotes: v.optional(v.string()),
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
    totalPriceCents: v.number(),
    serviceType: v.optional(v.union(v.literal("amazon_return"), v.literal("carrier_dropoff"))),
    dropoffLocationType: v.optional(v.string()),
    dropoffLocationId: v.optional(v.id("hubLocations")),
    dropoffLocationName: v.optional(v.string()),
    dropoffLocationAddress: v.optional(v.string()),
    dropoffLatitude: v.optional(v.number()),
    dropoffLongitude: v.optional(v.number()),
    amazonLabelConfirmed: v.optional(v.boolean()),
    expectedTrackingNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = now + 30 * 60 * 1000; // 30 minutes

    const draftId = await ctx.db.insert("bookingDrafts", {
      customerId: args.userId,
      pickupAddress: args.pickupAddress,
      pickupNotes: args.pickupNotes,
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
      packageCount: args.packageCount,
      packageSize: args.packageSize,
      smallQty: args.smallQty,
      mediumQty: args.mediumQty,
      largeQty: args.largeQty,
      oversizedQty: args.oversizedQty,
      totalPriceCents: args.totalPriceCents,
      serviceType: args.serviceType,
      dropoffLocationType: args.dropoffLocationType,
      dropoffLocationId: args.dropoffLocationId,
      dropoffLocationName: args.dropoffLocationName,
      dropoffLocationAddress: args.dropoffLocationAddress,
      dropoffLatitude: args.dropoffLatitude,
      dropoffLongitude: args.dropoffLongitude,
      amazonLabelConfirmed: args.amazonLabelConfirmed,
      expectedTrackingNumber: args.expectedTrackingNumber,
      paymentStatus: "pending",
      createdAt: now,
      expiresAt,
    });

    return { draftId };
  },
});

// Internal mutation to update draft with checkout info
export const updateDraftCheckout = internalMutation({
  args: {
    draftId: v.id("bookingDrafts"),
    checkoutSessionId: v.string(),
    checkoutUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.draftId, {
      checkoutSessionId: args.checkoutSessionId,
      checkoutUrl: args.checkoutUrl,
      paymentStatus: "processing",
      updatedAt: Date.now(),
    });
  },
});

// Cancel a draft payment
export const cancelPayment = mutation({
  args: {
    draftId: v.id("bookingDrafts"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in.");
    }

    const draft = await ctx.db.get(args.draftId);
    if (!draft) {
      throw new Error("Booking not found.");
    }
    if (draft.customerId !== userId) {
      throw new Error("Not authorized.");
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
