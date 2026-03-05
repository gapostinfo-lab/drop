import { action } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { calculateTotalCents } from "./lib/pricing";
import Whop from "@whop/sdk";

// Main action: Create checkout session
// This handles everything: auth check, draft creation, Whop checkout, all in one call
export const createCheckoutSession = action({
  args: {
    siteUrl: v.string(), // Client passes window.location.origin
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
    smallQty: v.number(),
    mediumQty: v.number(),
    largeQty: v.number(),
    oversizedQty: v.number(),
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
  handler: async (ctx, args): Promise<{
    success: boolean;
    checkoutUrl?: string;
    draftId?: string;
    error?: { code: string; message: string };
  }> => {
    try {
      console.log("[payments:createCheckoutSession] Starting with args:", {
        pickupAddress: args.pickupAddress?.substring(0, 30),
        siteUrl: args.siteUrl,
        carrier: args.carrier,
        totalPackages: args.smallQty + args.mediumQty + args.largeQty + args.oversizedQty,
      });

      // 1. Auth check
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        console.log("[payments:createCheckoutSession] AUTH_REQUIRED - no identity");
        throw new ConvexError("AUTH_REQUIRED: Please sign in to book a pickup.");
      }

      // Extract userId from identity.subject (format: "userId|sessionId")
      const userId = identity.subject.split("|")[0] as Id<"users">;
      console.log("[payments:createCheckoutSession] userId:", userId, "from subject:", identity.subject);

      // 2. Validate inputs
      if (!args.pickupAddress || args.pickupAddress.trim().length < 5) {
        throw new ConvexError("VALIDATION_ERROR: Please enter a valid pickup address.");
      }

      const totalPackages = args.smallQty + args.mediumQty + args.largeQty + args.oversizedQty;
      if (totalPackages < 1) {
        throw new ConvexError("VALIDATION_ERROR: Please add at least one package.");
      }

      // Validate Amazon returns require drop-off location
      if (args.serviceType === "amazon_return" && !args.dropoffLocationId) {
        throw new ConvexError("HUB_NOT_SELECTED: Please select a drop-off location for your Amazon return.");
      }

      // 3. Calculate pricing
      const totalPriceCents = calculateTotalCents({
        smallQty: args.smallQty,
        mediumQty: args.mediumQty,
        largeQty: args.largeQty,
        oversizedQty: args.oversizedQty,
      });

      if (totalPriceCents <= 0) {
        throw new ConvexError("PRICING_ERROR: Invalid order total.");
      }

      // 4. Create draft
      let draftId: Id<"bookingDrafts">;
      try {
        const result = await ctx.runMutation(internal.payments.createDraftInternal, {
          userId,
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
          packageCount: totalPackages,
          packageSize: args.smallQty > 0 ? "S" : args.mediumQty > 0 ? "M" : "L",
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
          expectedTrackingNumber: args.expectedTrackingNumber,
        });
        draftId = result.draftId;
        console.log("[payments:createCheckoutSession] Draft created:", draftId);
      } catch (draftErr: any) {
        console.error("[payments:createCheckoutSession] Draft creation failed:", {
          message: draftErr?.message,
          stack: draftErr?.stack,
        });
        throw new ConvexError("DRAFT_ERROR: Failed to save booking - " + (draftErr?.message ?? "unknown"));
      }

      // 5. Get SITE_URL for return URLs (passed from client)
      const successUrl = `${args.siteUrl}/payment/success?draft=${draftId}`;
      const cancelUrl = `${args.siteUrl}/payment/cancel?draft=${draftId}`;

      console.log("[payments:createCheckoutSession] URLs:", { siteUrl: args.siteUrl, successUrl, cancelUrl });

      // 6. Create Whop checkout with dynamic pricing
      const whopApiKey = process.env.WHOP_API_KEY;
      const whopCompanyId = process.env.WHOP_PARENT_COMPANY_ID;

      if (!whopApiKey || !whopCompanyId) {
        console.error("[payments:createCheckoutSession] Missing Whop credentials");
        throw new ConvexError("PAYMENT_ERROR: Payment system not configured.");
      }

      // Convert cents to dollars for Whop API
      const amountDollars = totalPriceCents / 100;

      console.log("[payments:createCheckoutSession] CHARGING AMOUNT (cents):", totalPriceCents, "dollars:", amountDollars);

      let checkoutUrl: string;
      let checkoutSessionId: string;

      try {
        const whop = new Whop({ apiKey: whopApiKey });
        
        // Create a checkout configuration with dynamic price
        const checkoutConfig = await whop.checkoutConfigurations.create({
          plan: {
            company_id: whopCompanyId,
            currency: "usd",
            initial_price: amountDollars,
            plan_type: "one_time",
          },
          redirect_url: successUrl,
          metadata: {
            draftId: draftId,
            totalCents: String(totalPriceCents),
          },
        });

        if (!checkoutConfig.purchase_url) {
          throw new Error("No purchase URL returned from Whop");
        }

        checkoutUrl = checkoutConfig.purchase_url;
        checkoutSessionId = checkoutConfig.id || `checkout_${Date.now()}`;

        console.log("[payments:createCheckoutSession] Whop checkout created:", {
          checkoutSessionId,
          checkoutUrl,
          amountDollars,
        });
      } catch (whopErr: any) {
        console.error("[payments:createCheckoutSession] Whop checkout failed:", {
          message: whopErr?.message,
          status: whopErr?.status,
          body: whopErr?.body,
        });
        throw new ConvexError("CHECKOUT_FAILED: " + (whopErr?.message ?? "Failed to create checkout"));
      }

      // 7. Update draft with checkout info
      try {
        await ctx.runMutation(internal.payments.updateDraftCheckout, {
          draftId,
          checkoutSessionId,
          checkoutUrl,
        });
      } catch (updateErr: any) {
        console.error("[payments:createCheckoutSession] updateDraftCheckout failed:", {
          message: updateErr?.message,
        });
        // Don't fail here - checkout was already created, just log the error
      }

      return {
        success: true,
        checkoutUrl,
        draftId: draftId as string,
      };

    } catch (err: any) {
      // Final catch-all error handler
      console.error("CHECKOUT ERROR:", {
        message: err?.message,
        stack: err?.stack,
        data: err?.data, // ConvexError data
      });

      // If it's already a ConvexError, rethrow it
      if (err instanceof ConvexError) {
        throw err;
      }

      // Otherwise wrap in ConvexError
      throw new ConvexError("CHECKOUT_FAILED: " + (err?.message ?? "unknown error"));
    }
  },
});

// Verify payment status (called from success page)
export const verifyPayment = action({
  args: {
    draftId: v.id("bookingDrafts"),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    status: "pending" | "paid" | "failed" | "not_found";
    jobId?: string;
    error?: string;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { success: false, status: "failed", error: "Please sign in." };
    }

    // Get draft
    const draft = await ctx.runQuery(api.bookingDrafts.getDraft, { draftId: args.draftId });
    
    if (!draft) {
      return { success: false, status: "not_found", error: "Booking not found." };
    }

    // If job already created, return it
    if (draft.jobId) {
      return { success: true, status: "paid", jobId: draft.jobId as string };
    }

    // For now, assume payment is successful if we reached the success page
    // In production, you'd verify with Whop API here
    // The createJobFromDraft mutation will handle the actual job creation
    
    return { success: true, status: "paid" };
  },
});
