import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAdmin, requireAdminStrict } from "./lib/adminAuth";
import { internal } from "./_generated/api";

// Helper to get stable auth identity
// Uses getAuthUserId from @convex-dev/auth as primary source
async function getStableAuthIdentity(ctx: any) {
  // Primary: Use getAuthUserId from @convex-dev/auth/server (this works reliably)
  const userId = await getAuthUserId(ctx);
  
  // Secondary: Also try ctx.auth.getUserIdentity for email/name
  const identity = await ctx.auth.getUserIdentity();
  
  console.log("[AUTH_IDENTITY] Auth check:", {
    userId: userId?.toString() || "null",
    identitySubject: identity?.subject,
    identityEmail: identity?.email,
  });
  
  // If we have a userId, we're authenticated
  if (userId) {
    return {
      authId: userId.toString(),
      userId, // Keep the actual Id for lookups
      email: identity?.email as string | undefined,
      name: identity?.name as string | undefined,
    };
  }
  
  // Fallback: Try identity subject/tokenIdentifier
  if (identity?.subject || identity?.tokenIdentifier) {
    return {
      authId: (identity.subject ?? identity.tokenIdentifier) as string,
      userId: null,
      email: identity.email as string | undefined,
      name: identity.name as string | undefined,
    };
  }
  
  console.log("[AUTH_IDENTITY] No valid auth found");
  return null;
}

// Helper to find courier by multiple strategies
async function findCourierByIdentity(ctx: any, identity: { authId: string; userId?: any; email?: string }) {
  // Strategy 1: Try by userId directly (most reliable)
  if (identity.userId) {
    const byUserId = await ctx.db
      .query("courierApplications")
      .withIndex("by_user", (q: any) => q.eq("userId", identity.userId))
      .unique();
    
    if (byUserId) {
      console.log("[FIND_COURIER] Found by userId:", byUserId._id.toString());
      return byUserId;
    }
  }
  
  // Strategy 2: Try by email
  if (identity.email) {
    const byEmail = await ctx.db
      .query("courierApplications")
      .filter((q: any) => q.eq(q.field("email"), identity.email))
      .first();
    
    if (byEmail) {
      console.log("[FIND_COURIER] Found by email:", byEmail._id.toString());
      return byEmail;
    }
  }
  
  console.log("[FIND_COURIER] Courier not found by any strategy");
  return null;
}

// Get courier application status (for auth redirect)
export const getApplicationStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const application = await ctx.db
      .query("courierApplications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!application) {
      return { exists: false, status: null, isOnline: false };
    }

    return {
      exists: true,
      status: application.status,
      isOnline: application.isOnline,
      isComplete: application.status !== "draft",
    };
  },
});

// Save draft application (can be called multiple times)
export const saveDraft = mutation({
  args: {
    fullName: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    homeAddress: v.optional(v.string()),
    profilePhotoId: v.optional(v.id("_storage")),
    licenseFrontId: v.optional(v.id("_storage")),
    licenseBackId: v.optional(v.id("_storage")),
    insuranceId: v.optional(v.id("_storage")),
    // License details
    licenseNumber: v.optional(v.string()),
    licenseState: v.optional(v.string()),
    licenseExpiresAt: v.optional(v.string()),
    vehicleMake: v.optional(v.string()),
    vehicleModel: v.optional(v.string()),
    vehicleYear: v.optional(v.string()),
    vehicleColor: v.optional(v.string()),
    vehiclePlate: v.optional(v.string()),
    applicantNotes: v.optional(v.string()),
    agreedToContractor: v.optional(v.boolean()),
    agreedToLicenseInsurance: v.optional(v.boolean()),
    agreedToBackgroundCheck: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please sign in");

    const existing = await ctx.db
      .query("courierApplications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      // Only allow updates if draft or denied (reapplying)
      if (existing.status !== "draft" && existing.status !== "denied") {
        throw new Error("Cannot modify application after submission");
      }
      await ctx.db.patch(existing._id, {
        ...args,
        status: "draft",
      });

      // If profilePhotoId is being set, also update the user's profile
      if (args.profilePhotoId) {
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique();

        if (profile) {
          await ctx.db.patch(profile._id, {
            profileImageId: args.profilePhotoId,
          });
        }
      }

      return existing._id;
    }

    const applicationId = await ctx.db.insert("courierApplications", {
      userId,
      status: "draft",
      fullName: args.fullName ?? "",
      phone: args.phone ?? "",
      email: args.email ?? "",
      dateOfBirth: args.dateOfBirth,
      homeAddress: args.homeAddress,
      profilePhotoId: args.profilePhotoId,
      licenseFrontId: args.licenseFrontId,
      licenseBackId: args.licenseBackId,
      insuranceId: args.insuranceId,
      vehicleMake: args.vehicleMake ?? "",
      vehicleModel: args.vehicleModel ?? "",
      vehicleYear: args.vehicleYear ?? "",
      vehicleColor: args.vehicleColor ?? "",
      vehiclePlate: args.vehiclePlate ?? "",
      applicantNotes: args.applicantNotes,
      agreedToContractor: args.agreedToContractor ?? false,
      agreedToLicenseInsurance: args.agreedToLicenseInsurance ?? false,
      agreedToBackgroundCheck: args.agreedToBackgroundCheck ?? false,
      isOnline: false,
      createdAt: Date.now(),
    });

    // If profilePhotoId is being set, also update the user's profile
    if (args.profilePhotoId) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();

      if (profile) {
        await ctx.db.patch(profile._id, {
          profileImageId: args.profilePhotoId,
        });
      }
    }

    return applicationId;
  },
});

// Submit application for review
export const submitApplication = mutation({
  args: {
    fullName: v.string(),
    phone: v.string(),
    email: v.string(),
    dateOfBirth: v.string(),
    homeAddress: v.string(),
    profilePhotoId: v.id("_storage"),
    licenseFrontId: v.id("_storage"),
    licenseBackId: v.id("_storage"),
    insuranceId: v.optional(v.id("_storage")),
    // License details (required for submission)
    licenseNumber: v.string(),
    licenseState: v.string(),
    licenseExpiresAt: v.string(),
    vehicleMake: v.string(),
    vehicleModel: v.string(),
    vehicleYear: v.string(),
    vehicleColor: v.string(),
    vehiclePlate: v.string(),
    agreedToContractor: v.boolean(),
    agreedToLicenseInsurance: v.boolean(),
    agreedToBackgroundCheck: v.boolean(),
    applicantNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please sign in");

    // Validate all agreements are accepted
    if (!args.agreedToContractor || !args.agreedToLicenseInsurance || !args.agreedToBackgroundCheck) {
      throw new Error("You must accept all agreements to submit");
    }

    // Validate license fields are provided
    if (!args.licenseNumber || !args.licenseState || !args.licenseExpiresAt) {
      throw new Error("License number, state, and expiration date are required");
    }

    const existing = await ctx.db
      .query("courierApplications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const applicationData = {
      userId,
      status: "pending_review" as const,
      fullName: args.fullName,
      phone: args.phone,
      email: args.email,
      dateOfBirth: args.dateOfBirth,
      homeAddress: args.homeAddress,
      profilePhotoId: args.profilePhotoId,
      licenseFrontId: args.licenseFrontId,
      licenseBackId: args.licenseBackId,
      insuranceId: args.insuranceId,
      // License details
      licenseNumber: args.licenseNumber,
      licenseState: args.licenseState,
      licenseExpiresAt: args.licenseExpiresAt,
      vehicleMake: args.vehicleMake,
      vehicleModel: args.vehicleModel,
      vehicleYear: args.vehicleYear,
      vehicleColor: args.vehicleColor,
      vehiclePlate: args.vehiclePlate,
      agreedToContractor: args.agreedToContractor,
      agreedToLicenseInsurance: args.agreedToLicenseInsurance,
      agreedToBackgroundCheck: args.agreedToBackgroundCheck,
      applicantNotes: args.applicantNotes,
      isOnline: false,
      createdAt: existing?.createdAt ?? Date.now(),
      submittedAt: Date.now(),
      backgroundCheckStatus: "not_started" as const,
      licenseCheckStatus: "not_started" as const,
      // Set verification status to pending on submission
      verificationStatus: "pending" as const,
    };

    let applicationId;
    if (existing) {
      if (existing.status !== "draft" && existing.status !== "denied") {
        throw new Error("Application already submitted");
      }
      await ctx.db.patch(existing._id, applicationData);
      applicationId = existing._id;
    } else {
      applicationId = await ctx.db.insert("courierApplications", applicationData);
    }

    // Notify admin of new application
    await ctx.db.insert("adminNotifications", {
      type: "new_courier_application",
      title: "New Courier Application",
      message: `${args.fullName} has submitted a courier application`,
      targetId: applicationId,
      targetType: "courierApplication",
      isRead: false,
      createdAt: Date.now(),
    });

    return applicationId;
  },
});

// Get courier's own application (excludes admin-only fields)
export const getMyApplication = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const application = await ctx.db
      .query("courierApplications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!application) return null;

    // Return application WITHOUT admin-only fields
    const {
      adminNotes,
      backgroundCheckStatus,
      licenseCheckStatus,
      ...publicFields
    } = application;

    return publicFields;
  },
});

// Get public courier info for customers (privacy-safe)
export const getCourierPublicProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please sign in");

    const application = await ctx.db
      .query("courierApplications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!application || application.status !== "approved") {
      return null;
    }

    // Get profile for image (may have updated profile image)
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    // Only return first name for privacy
    const firstName = application.fullName.split(' ')[0];

    return {
      firstName,
      vehicleType: `${application.vehicleMake} ${application.vehicleModel}`,
      vehicleColor: application.vehicleColor,
      profileImageId: profile?.profileImageId ?? application.profilePhotoId,
      // NO phone number returned
    };
  },
});

// Get full application details (admin only)
export const getApplicationById = query({
  args: { applicationId: v.id("courierApplications") },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      return null;
    }
    return await ctx.db.get(args.applicationId);
  },
});

// List applications (admin only)
export const listApplications = query({
  args: {
    status: v.optional(v.union(
      v.literal("draft"),
      v.literal("pending_review"),
      v.literal("approved"),
      v.literal("denied"),
      v.literal("suspended")
    )),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      return [];
    }

    if (args.status) {
      return await ctx.db
        .query("courierApplications")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
    }

    return await ctx.db.query("courierApplications").order("desc").collect();
  },
});

// Count pending applications (admin only)
export const countPendingApplications = query({
  args: {},
  handler: async (ctx) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      return 0;
    }
    const pending = await ctx.db
      .query("courierApplications")
      .withIndex("by_status", (q) => q.eq("status", "pending_review"))
      .collect();
    return pending.length;
  },
});

// Update verification status (admin only)
export const updateVerificationStatus = mutation({
  args: {
    applicationId: v.id("courierApplications"),
    backgroundCheckStatus: v.optional(v.union(
      v.literal("not_started"),
      v.literal("in_progress"),
      v.literal("cleared"),
      v.literal("flagged")
    )),
    licenseCheckStatus: v.optional(v.union(
      v.literal("not_started"),
      v.literal("verified"),
      v.literal("expired"),
      v.literal("mismatch")
    )),
    adminNotes: v.optional(v.string()),
    licenseVerified: v.optional(v.boolean()),
    insuranceVerified: v.optional(v.boolean()),
    manualScreeningComplete: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdminStrict(ctx);

    const application = await ctx.db.get(args.applicationId);
    if (!application) throw new Error("Application not found");

    const updates: Record<string, unknown> = {};
    if (args.backgroundCheckStatus) updates.backgroundCheckStatus = args.backgroundCheckStatus;
    if (args.licenseCheckStatus) updates.licenseCheckStatus = args.licenseCheckStatus;
    if (args.adminNotes !== undefined) updates.adminNotes = args.adminNotes;
    if (args.licenseVerified !== undefined) updates.licenseVerified = args.licenseVerified;
    if (args.insuranceVerified !== undefined) updates.insuranceVerified = args.insuranceVerified;
    if (args.manualScreeningComplete !== undefined) updates.manualScreeningComplete = args.manualScreeningComplete;

    await ctx.db.patch(args.applicationId, updates);

    // Log admin action
    await ctx.scheduler.runAfter(0, internal.adminLogs.logAdminAction, {
      adminId,
      action: "verification_status_updated",
      targetType: "courierApplication",
      targetId: args.applicationId,
      details: updates,
    });

    return args.applicationId;
  },
});

// Approve/Deny/Suspend courier (admin only)
export const updateApplicationStatus = mutation({
  args: {
    applicationId: v.id("courierApplications"),
    status: v.union(
      v.literal("approved"),
      v.literal("denied"),
      v.literal("suspended"),
      v.literal("pending_review")
    ),
    adminNotes: v.optional(v.string()),
    internalReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdminStrict(ctx);

    const application = await ctx.db.get(args.applicationId);
    if (!application) throw new Error("Application not found");

    const previousStatus = application.status;

    const updates: Record<string, unknown> = {
      status: args.status,
      verificationStatus: args.status, // Sync verificationStatus with status
      reviewedAt: Date.now(),
      reviewedBy: adminId,
    };

    if (args.adminNotes) {
      updates.adminNotes = (application.adminNotes ? application.adminNotes + "\n\n" : "") + 
        `[${new Date().toISOString()}] ${args.adminNotes}`;
    }

    if (args.status === "denied") {
      updates.denialReason = args.internalReason;
      updates.isOnline = false;
    } else if (args.status === "suspended") {
      updates.suspensionReason = args.internalReason;
      updates.isOnline = false;
    }

    await ctx.db.patch(args.applicationId, updates);

    // If approved, update the user's profile role to courier
    if (args.status === "approved") {
      const courierProfile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", application.userId))
        .unique();

      if (courierProfile) {
        await ctx.db.patch(courierProfile._id, { role: "courier" });
      } else {
        // Create profile if doesn't exist
        await ctx.db.insert("profiles", {
          userId: application.userId,
          role: "courier",
          name: application.fullName,
          email: application.email,
          phone: application.phone,
          createdAt: Date.now(),
        });
      }
    }

    // Notify courier
    let notificationTitle = "";
    let notificationMessage = "";
    
    if (args.status === "approved") {
      notificationTitle = "Application Approved!";
      notificationMessage = "Congratulations! Your courier application has been approved. You can now go online and start accepting deliveries.";
    } else if (args.status === "denied") {
      notificationTitle = "Application Update";
      notificationMessage = "Your application was not approved at this time. Please contact support for more information.";
    } else if (args.status === "suspended") {
      notificationTitle = "Account Suspended";
      notificationMessage = "Your courier account has been suspended. Please contact support for more information.";
    }

    await ctx.db.insert("courierNotifications", {
      courierId: application.userId,
      type: `application_${args.status}`,
      title: notificationTitle,
      message: notificationMessage,
      isRead: false,
      createdAt: Date.now(),
    });

    // Log admin action
    await ctx.scheduler.runAfter(0, internal.adminLogs.logAdminAction, {
      adminId,
      action: `courier_${args.status}`,
      targetType: "courierApplication",
      targetId: args.applicationId,
      details: {
        previousStatus,
        newStatus: args.status,
        internalReason: args.internalReason,
        adminNotes: args.adminNotes,
        courierUserId: application.userId,
      },
    });

    return args.applicationId;
  },
});

// Toggle online status (approved couriers only)
// Uses robust identity lookup
export const toggleOnline = mutation({
  args: {
    isOnline: v.boolean(), // REQUIRED - explicit online state
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get auth identity
    const identity = await getStableAuthIdentity(ctx);
    
    console.log("[toggleOnline] Identity:", {
      authId: identity?.authId?.slice(0, 20) || "null",
      email: identity?.email || "null",
      requestedOnline: args.isOnline,
    });

    if (!identity || !identity.authId) {
      console.log("[toggleOnline] UNAUTHENTICATED");
      throw new ConvexError("UNAUTHENTICATED");
    }

    // Find courier using multiple strategies
    const courier = await findCourierByIdentity(ctx, identity);

    console.log("[toggleOnline] Courier lookup:", {
      found: !!courier,
      applicationId: courier?._id?.toString() || "none",
      status: courier?.status,
    });

    // If courier not found, auto-create in pending state
    if (!courier) {
      console.log("[toggleOnline] Auto-creating courier record");
      
      // Get userId for the new record
      const userId = await getAuthUserId(ctx);
      if (!userId) {
        throw new ConvexError("UNAUTHENTICATED");
      }
      
      // Create courier application in draft state
      await ctx.db.insert("courierApplications", {
        userId,
        status: "draft",
        fullName: identity.name || "",
        phone: "",
        email: identity.email || "",
        vehicleMake: "",
        vehicleModel: "",
        vehicleYear: "",
        vehicleColor: "",
        vehiclePlate: "",
        agreedToContractor: false,
        agreedToLicenseInsurance: false,
        agreedToBackgroundCheck: false,
        isOnline: false,
        createdAt: Date.now(),
      });
      
      console.log("[toggleOnline] Created pending courier, throwing COURIER_NOT_FOUND_CREATED_PENDING");
      throw new ConvexError("COURIER_NOT_FOUND_CREATED_PENDING");
    }

    // Check approval status - support both old (status) and new (verificationStatus) fields
    const isApproved = courier.verificationStatus === "approved" || courier.status === "approved";

    console.log("[toggleOnline] Status check:", {
      status: courier.status,
      verificationStatus: courier.verificationStatus,
      isApproved,
      currentOnline: courier.isOnline,
      payoutStatus: courier.payoutSetupStatus,
    });

    // If not approved, ensure offline and throw
    if (!isApproved) {
      console.log("[toggleOnline] COURIER_NOT_APPROVED - forcing offline");
      await ctx.db.patch(courier._id, {
        isOnline: false,
        lastOnlineAt: Date.now(),
      });
      throw new ConvexError("COURIER_NOT_APPROVED");
    }

    // Payout check - warn but don't block for now (MVP)
    if (args.isOnline && courier.payoutSetupStatus !== "complete") {
      console.log("[toggleOnline] WARNING: Payout not set up, but allowing online for MVP");
      // Don't throw - allow going online without payout setup
    }

    // Update online status
    await ctx.db.patch(courier._id, {
      isOnline: args.isOnline,
      lastOnlineAt: Date.now(),
    });

    // Update location if provided and going online
    const userId = await getAuthUserId(ctx);
    if (args.isOnline && args.latitude && args.longitude && userId) {
      const existingLocation = await ctx.db
        .query("courierLocations")
        .withIndex("by_courier", (q) => q.eq("courierId", userId))
        .unique();

      if (existingLocation) {
        await ctx.db.patch(existingLocation._id, {
          latitude: args.latitude,
          longitude: args.longitude,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("courierLocations", {
          courierId: userId,
          latitude: args.latitude,
          longitude: args.longitude,
          updatedAt: Date.now(),
        });
      }
    }

    console.log("[toggleOnline] Success:", {
      newOnlineStatus: args.isOnline,
      applicationId: courier._id.toString(),
    });

    return {
      success: true,
      isOnline: args.isOnline,
      applicationStatus: courier.verificationStatus || courier.status,
    };
  },
});

// Get online couriers (admin only)
export const getOnlineCouriers = query({
  args: {},
  handler: async (ctx) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      return [];
    }

    return await ctx.db
      .query("courierApplications")
      .withIndex("by_online", (q) => q.eq("isOnline", true).eq("status", "approved"))
      .collect();
  },
});

// Get courier notifications
export const getMyNotifications = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("courierNotifications")
      .withIndex("by_courier", (q) => q.eq("courierId", userId))
      .order("desc")
      .take(args.limit ?? 20);
  },
});

// Mark notification as read
export const markNotificationRead = mutation({
  args: { notificationId: v.id("courierNotifications") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please sign in");

    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.courierId !== userId) {
      throw new Error("Notification not found");
    }

    await ctx.db.patch(args.notificationId, { isRead: true });
  },
});

// Mark all courier notifications as read
export const markAllNotificationsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please sign in");

    const unread = await ctx.db
      .query("courierNotifications")
      .withIndex("by_courier_read", (q) => 
        q.eq("courierId", userId).eq("isRead", false)
      )
      .collect();

    await Promise.all(
      unread.map((n) => ctx.db.patch(n._id, { isRead: true }))
    );

    return { marked: unread.length };
  },
});

// Count unread courier notifications
export const countUnreadNotifications = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;

    const unread = await ctx.db
      .query("courierNotifications")
      .withIndex("by_courier_read", (q) => 
        q.eq("courierId", userId).eq("isRead", false)
      )
      .collect();

    return unread.length;
  },
});

// Get admin notifications
export const getAdminNotifications = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      return [];
    }
    return await ctx.db
      .query("adminNotifications")
      .order("desc")
      .take(args.limit ?? 20);
  },
});

// Mark admin notification as read
export const markAdminNotificationRead = mutation({
  args: { notificationId: v.id("adminNotifications") },
  handler: async (ctx, args) => {
    await requireAdminStrict(ctx);
    await ctx.db.patch(args.notificationId, { isRead: true });
  },
});

// Count unread admin notifications
export const countUnreadAdminNotifications = query({
  args: {},
  handler: async (ctx) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      return 0;
    }
    const unread = await ctx.db
      .query("adminNotifications")
      .withIndex("by_read", (q) => q.eq("isRead", false))
      .collect();
    return unread.length;
  },
});

// Admin: approve courier verification
export const approveVerification = mutation({
  args: { applicationId: v.id("courierApplications") },
  handler: async (ctx, args) => {
    const adminId = await requireAdminStrict(ctx);

    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");

    // Update verification status
    await ctx.db.patch(args.applicationId, {
      verificationStatus: "approved",
      verifiedAt: Date.now(),
      verifiedBy: adminId,
      status: "approved", // Also approve the overall application
      reviewedAt: Date.now(),
      reviewedBy: adminId,
      licenseVerified: true,
    });

    console.log("[APPROVE_VERIFICATION] Updated application", {
      applicationId: args.applicationId,
      userId: app.userId,
      newStatus: "approved",
      verificationStatus: "approved",
    });

    // Also update the user's profile photo if profilePhotoId exists
    if (app.profilePhotoId) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", app.userId))
        .unique();

      if (profile) {
        await ctx.db.patch(profile._id, {
          profileImageId: app.profilePhotoId,
        });
      }
    }

    // Update user profile role to courier
    const courierProfile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", app.userId))
      .unique();

    if (courierProfile) {
      await ctx.db.patch(courierProfile._id, { role: "courier" });
    } else {
      // Create profile if doesn't exist
      await ctx.db.insert("profiles", {
        userId: app.userId,
        role: "courier",
        name: app.fullName,
        email: app.email,
        phone: app.phone,
        profileImageId: app.profilePhotoId,
        createdAt: Date.now(),
      });
    }

    // Notify courier
    await ctx.db.insert("courierNotifications", {
      courierId: app.userId,
      type: "verification_approved",
      title: "Verification Approved!",
      message: "Congratulations! Your courier verification has been approved. You can now go online and start accepting deliveries.",
      isRead: false,
      createdAt: Date.now(),
    });

    // Return the updated application for confirmation
    const updated = await ctx.db.get(args.applicationId);
    return {
      success: true,
      applicationId: args.applicationId,
      userId: app.userId,
      status: updated?.status,
      verificationStatus: updated?.verificationStatus,
    };
  },
});

// Admin: deny courier verification
export const denyVerification = mutation({
  args: {
    applicationId: v.id("courierApplications"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdminStrict(ctx);

    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");

    await ctx.db.patch(args.applicationId, {
      verificationStatus: "denied",
      verificationDenialReason: args.reason,
      verifiedAt: Date.now(),
      verifiedBy: adminId,
      status: "denied",
      denialReason: args.reason,
      reviewedAt: Date.now(),
      reviewedBy: adminId,
      isOnline: false, // Force offline when denied
    });

    console.log("[DENY_VERIFICATION] Updated application", {
      applicationId: args.applicationId,
      userId: app.userId,
      newStatus: "denied",
      verificationStatus: "denied",
      reason: args.reason,
    });

    // Notify courier
    await ctx.db.insert("courierNotifications", {
      courierId: app.userId,
      type: "verification_denied",
      title: "Verification Update",
      message: "Your verification was not approved. Please contact support for more information.",
      isRead: false,
      createdAt: Date.now(),
    });

    return args.applicationId;
  },
});

// Admin: list pending verifications
export const listPendingVerifications = query({
  args: {},
  handler: async (ctx) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) return [];

    // Get all applications that need verification review
    const allApplications = await ctx.db
      .query("courierApplications")
      .order("desc")
      .collect();

    // Filter for pending verifications (new field OR legacy pending_review status)
    const pending = allApplications.filter(
      (app) =>
        app.verificationStatus === "pending" ||
        (app.verificationStatus === undefined && app.status === "pending_review")
    );

    // Enrich with document URLs
    const enriched = await Promise.all(
      pending.map(async (app) => {
        const licenseFrontUrl = app.licenseFrontId
          ? await ctx.storage.getUrl(app.licenseFrontId)
          : null;
        const licenseBackUrl = app.licenseBackId
          ? await ctx.storage.getUrl(app.licenseBackId)
          : null;
        const selfieUrl = app.profilePhotoId
          ? await ctx.storage.getUrl(app.profilePhotoId)
          : null;

        return {
          ...app,
          licenseFrontUrl,
          licenseBackUrl,
          selfieUrl,
        };
      })
    );

    return enriched;
  },
});

// Get my verification status - simplified for real-time updates
export const getMyVerificationStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const app = await ctx.db
      .query("courierApplications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!app) return { status: "not_submitted" as const };

    // Primary source: verificationStatus field
    // Fallback: derive from status field for legacy records
    const status = app.verificationStatus || 
      (app.status === "approved" ? "approved" : 
       app.status === "denied" ? "denied" : 
       app.status === "pending_review" ? "pending" : 
       "not_submitted");

    return {
      status: status as "approved" | "denied" | "pending" | "not_submitted",
      denialReason: app.verificationDenialReason || app.denialReason || null,
      submittedAt: app.submittedAt || null,
      verifiedAt: app.verifiedAt || app.reviewedAt || null,
      // Include _id to help with cache invalidation debugging
      applicationId: app._id,
    };
  },
});

// ============================================
// SINGLE SOURCE OF TRUTH: Get current courier status
// Uses multiple lookup strategies for robustness
// ============================================
export const getMyCourierStatus = query({
  args: {},
  handler: async (ctx) => {
    // Get auth identity with detailed logging
    const identity = await getStableAuthIdentity(ctx);
    
    console.log("[getMyCourierStatus] Identity:", {
      authId: identity?.authId?.slice(0, 20) || "null",
      email: identity?.email || "null",
      timestamp: Date.now(),
    });

    if (!identity || !identity.authId) {
      console.log("[getMyCourierStatus] No authenticated user");
      return null;
    }

    // Find courier using multiple strategies
    const app = await findCourierByIdentity(ctx, identity);

    console.log("[getMyCourierStatus] Courier lookup result:", {
      found: !!app,
      applicationId: app?._id?.toString() || "none",
      status: app?.status,
      verificationStatus: app?.verificationStatus,
    });

    if (!app) {
      // Log all couriers for debugging
      const allCouriers = await ctx.db.query("courierApplications").collect();
      console.log("[getMyCourierStatus] All couriers in DB:", allCouriers.map(c => ({
        id: c._id.toString(),
        email: c.email,
        userId: c.userId.toString(),
        status: c.status,
      })));
      
      return {
        exists: false,
        applicationStatus: "not_found" as const,
        isOnline: false,
        canGoOnline: false,
        payoutStatus: "not_started" as const,
        denialReason: null,
        approvedAt: null,
        _debug: { 
          authId: identity.authId.slice(0, 20), 
          email: identity.email,
          lookupMethod: "multi-strategy" 
        },
      };
    }

    // Determine effective status
    const rawStatus = app.verificationStatus || app.status;
    
    const applicationStatus = 
      rawStatus === "approved" ? "approved" :
      rawStatus === "denied" ? "denied" :
      rawStatus === "pending_review" ? "pending" :
      rawStatus === "pending" ? "pending" :
      rawStatus === "draft" ? "draft" :
      rawStatus === "suspended" ? "suspended" :
      "pending";

    const isApproved = applicationStatus === "approved";
    const payoutComplete = app.payoutSetupStatus === "complete";
    const canGoOnline = isApproved && payoutComplete;

    console.log("[getMyCourierStatus] Status computed:", {
      rawStatus,
      applicationStatus,
      isApproved,
      payoutComplete,
      canGoOnline,
      isOnline: app.isOnline,
    });

    return {
      exists: true,
      applicationId: app._id,
      applicationStatus: applicationStatus as "approved" | "denied" | "pending" | "draft" | "suspended",
      isOnline: app.isOnline ?? false,
      canGoOnline,
      payoutStatus: (app.payoutSetupStatus || "not_started") as "not_started" | "pending" | "complete",
      denialReason: app.verificationDenialReason || app.denialReason || null,
      approvedAt: app.verifiedAt || app.reviewedAt || null,
      _debug: { 
        authId: identity.authId.slice(0, 20),
        email: identity.email,
        applicationId: app._id.toString(),
        rawStatus,
      },
    };
  },
});

// ============================================
// DEBUG: Test courier lookup with all strategies
// ============================================
export const debugCourierLookup = query({
  args: {},
  handler: async (ctx) => {
    // Get all identity info
    const identity = await ctx.auth.getUserIdentity();
    const userId = await getAuthUserId(ctx);
    
    console.log("[DEBUG_LOOKUP] Identity:", {
      subject: identity?.subject,
      tokenIdentifier: identity?.tokenIdentifier,
      email: identity?.email,
      userId: userId?.toString(),
    });
    
    // Try all lookup strategies
    let byUserId = null;
    let byEmail = null;
    
    if (userId) {
      byUserId = await ctx.db
        .query("courierApplications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
    }
    
    if (identity?.email) {
      byEmail = await ctx.db
        .query("courierApplications")
        .filter((q) => q.eq(q.field("email"), identity.email))
        .first();
    }
    
    // Get all couriers for comparison
    const allCouriers = await ctx.db
      .query("courierApplications")
      .collect();
    
    return {
      identity: {
        subject: identity?.subject || null,
        tokenIdentifier: identity?.tokenIdentifier || null,
        email: identity?.email || null,
        name: identity?.name || null,
      },
      userId: userId?.toString() || null,
      lookupResults: {
        byUserId: byUserId ? {
          id: byUserId._id.toString(),
          email: byUserId.email,
          status: byUserId.status,
          verificationStatus: byUserId.verificationStatus,
        } : null,
        byEmail: byEmail ? {
          id: byEmail._id.toString(),
          email: byEmail.email,
          status: byEmail.status,
          verificationStatus: byEmail.verificationStatus,
          userId: byEmail.userId.toString(),
        } : null,
      },
      allCouriers: allCouriers.map(c => ({
        id: c._id.toString(),
        email: c.email,
        userId: c.userId.toString(),
        status: c.status,
        verificationStatus: c.verificationStatus,
      })),
    };
  },
});

// ============================================
// Set online status - alias for toggleOnline with same robust lookup
// ============================================
export const setOnlineStatus = mutation({
  args: {
    isOnline: v.boolean(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Get auth identity
    const identity = await getStableAuthIdentity(ctx);
    
    console.log("[setOnlineStatus] Identity:", {
      authId: identity?.authId?.slice(0, 20) || "null",
      email: identity?.email || "null",
      requestedOnline: args.isOnline,
    });

    if (!identity || !identity.authId) {
      console.log("[setOnlineStatus] UNAUTHENTICATED");
      throw new ConvexError("UNAUTHENTICATED");
    }

    // Find courier using multiple strategies
    const courier = await findCourierByIdentity(ctx, identity);

    if (!courier) {
      console.log("[setOnlineStatus] COURIER_NOT_FOUND");
      throw new ConvexError("COURIER_NOT_FOUND");
    }

    // Check approval status - support both old (status) and new (verificationStatus) fields
    const isApproved = courier.verificationStatus === "approved" || courier.status === "approved";

    console.log("[setOnlineStatus] Status check:", {
      status: courier.status,
      verificationStatus: courier.verificationStatus,
      isApproved,
      currentOnline: courier.isOnline,
      payoutStatus: courier.payoutSetupStatus,
    });

    if (!isApproved) {
      console.log("[setOnlineStatus] COURIER_NOT_APPROVED");
      throw new ConvexError("COURIER_NOT_APPROVED");
    }

    // Payout check - warn but don't block for now (MVP)
    if (args.isOnline && courier.payoutSetupStatus !== "complete") {
      console.log("[setOnlineStatus] WARNING: Payout not set up, but allowing online for MVP");
      // Don't throw - allow going online without payout setup for MVP
    }

    // Update online status
    await ctx.db.patch(courier._id, {
      isOnline: args.isOnline,
      lastOnlineAt: Date.now(),
    });

    // Update location if provided
    const userId = await getAuthUserId(ctx);
    if (args.isOnline && args.latitude && args.longitude && userId) {
      const existingLocation = await ctx.db
        .query("courierLocations")
        .withIndex("by_courier", (q) => q.eq("courierId", userId))
        .unique();

      if (existingLocation) {
        await ctx.db.patch(existingLocation._id, {
          latitude: args.latitude,
          longitude: args.longitude,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("courierLocations", {
          courierId: userId,
          latitude: args.latitude,
          longitude: args.longitude,
          updatedAt: Date.now(),
        });
      }
    }

    console.log("[setOnlineStatus] Success:", { isOnline: args.isOnline });

    return {
      success: true,
      isOnline: args.isOnline,
    };
  },
});

// Admin: Fix legacy courier verification status
// This updates couriers who were approved before verificationStatus field existed
export const fixLegacyVerificationStatus = mutation({
  args: { applicationId: v.id("courierApplications") },
  handler: async (ctx, args) => {
    const adminId = await requireAdminStrict(ctx);

    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");

    // Only fix if status is approved but verificationStatus is missing
    if (app.status === "approved" && !app.verificationStatus) {
      await ctx.db.patch(args.applicationId, {
        verificationStatus: "approved",
        verifiedAt: app.reviewedAt || Date.now(),
        verifiedBy: adminId,
        licenseVerified: true,
      });

      console.log("[FIX_LEGACY] Updated courier", {
        applicationId: args.applicationId,
        email: app.email,
      });

      return { fixed: true, email: app.email };
    }

    return { fixed: false, reason: "Not a legacy approved courier" };
  },
});

// Admin: Batch fix all legacy couriers
export const fixAllLegacyVerificationStatus = mutation({
  args: {},
  handler: async (ctx) => {
    const adminId = await requireAdminStrict(ctx);

    const allApplications = await ctx.db
      .query("courierApplications")
      .collect();

    let fixedCount = 0;
    for (const app of allApplications) {
      if (app.status === "approved" && !app.verificationStatus) {
        await ctx.db.patch(app._id, {
          verificationStatus: "approved",
          verifiedAt: app.reviewedAt || Date.now(),
          verifiedBy: adminId,
          licenseVerified: true,
        });
        fixedCount++;
        console.log("[FIX_LEGACY] Updated courier", { email: app.email });
      }
    }

    return { fixed: fixedCount };
  },
});

// ============================================
// MIGRATION: Normalize courier records to single source of truth
// Run once via admin dashboard or admin UI
// Idempotent - safe to run multiple times
// ============================================
export const migrateCouriers_v1 = mutation({
  args: {},
  handler: async (ctx) => {
    // Require admin
    await requireAdminStrict(ctx);
    
    console.log("[MIGRATION_V1] Starting courier migration...");
    
    // Get all courier applications
    const allApplications = await ctx.db
      .query("courierApplications")
      .collect();
    
    console.log(`[MIGRATION_V1] Found ${allApplications.length} courier records`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    const results: Array<{ id: string; email: string; action: string }> = [];
    
    for (const app of allApplications) {
      const updates: Record<string, unknown> = {};
      let needsUpdate = false;
      let action = "skipped";
      
      // ============================================
      // STEP A: Determine the canonical applicationStatus
      // ============================================
      
      // Check all possible status fields and normalize
      const oldStatus = app.status;
      const oldVerificationStatus = app.verificationStatus;
      const isLegacyApproved = oldStatus === "approved";
      const isLegacyDenied = oldStatus === "denied";
      const isLegacyPending = oldStatus === "pending_review";
      const isDraft = oldStatus === "draft";
      
      // Determine canonical status
      let canonicalStatus: "approved" | "denied" | "pending" | "draft";
      
      if (oldVerificationStatus === "approved" || isLegacyApproved) {
        canonicalStatus = "approved";
      } else if (oldVerificationStatus === "denied" || isLegacyDenied) {
        canonicalStatus = "denied";
      } else if (isDraft) {
        canonicalStatus = "draft";
      } else if (isLegacyPending || oldVerificationStatus === "pending") {
        canonicalStatus = "pending";
      } else {
        canonicalStatus = "pending";
      }
      
      // ============================================
      // STEP B: Sync verificationStatus with status
      // ============================================
      
      // Ensure verificationStatus matches the canonical status
      const expectedVerificationStatus = 
        canonicalStatus === "approved" ? "approved" :
        canonicalStatus === "denied" ? "denied" :
        canonicalStatus === "draft" ? "not_submitted" :
        "pending";
      
      if (app.verificationStatus !== expectedVerificationStatus) {
        updates.verificationStatus = expectedVerificationStatus;
        needsUpdate = true;
      }
      
      // Ensure status field is also correct
      const expectedStatus = 
        canonicalStatus === "approved" ? "approved" :
        canonicalStatus === "denied" ? "denied" :
        canonicalStatus === "draft" ? "draft" :
        "pending_review";
      
      if (app.status !== expectedStatus) {
        updates.status = expectedStatus;
        needsUpdate = true;
      }
      
      // ============================================
      // STEP C: Ensure isOnline is boolean and valid
      // ============================================
      
      if (typeof app.isOnline !== "boolean") {
        updates.isOnline = false;
        needsUpdate = true;
      }
      
      // Force offline if not approved
      if (canonicalStatus !== "approved" && app.isOnline === true) {
        updates.isOnline = false;
        needsUpdate = true;
        console.log(`[MIGRATION_V1] Forcing offline for non-approved courier: ${app.email}`);
      }
      
      // ============================================
      // STEP D: Copy denial reason if needed
      // ============================================
      
      if (canonicalStatus === "denied") {
        // Ensure we have a denial reason
        if (!app.verificationDenialReason && app.denialReason) {
          updates.verificationDenialReason = app.denialReason;
          needsUpdate = true;
        }
        if (!app.denialReason && app.verificationDenialReason) {
          updates.denialReason = app.verificationDenialReason;
          needsUpdate = true;
        }
      }
      
      // ============================================
      // STEP E: Set approvedAt/verifiedAt if approved and missing
      // ============================================
      
      if (canonicalStatus === "approved") {
        const approvalTimestamp = app.verifiedAt || app.reviewedAt || Date.now();
        
        if (!app.verifiedAt) {
          updates.verifiedAt = approvalTimestamp;
          needsUpdate = true;
        }
        
        if (!app.licenseVerified) {
          updates.licenseVerified = true;
          needsUpdate = true;
        }
      }
      
      // ============================================
      // STEP F: Apply updates if needed
      // ============================================
      
      if (needsUpdate) {
        await ctx.db.patch(app._id, updates);
        migratedCount++;
        action = `migrated: ${Object.keys(updates).join(", ")}`;
        
        console.log(`[MIGRATION_V1] Updated ${app.email}:`, updates);
      } else {
        skippedCount++;
        action = "already normalized";
      }
      
      results.push({
        id: app._id,
        email: app.email || "unknown",
        action,
      });
    }
    
    console.log(`[MIGRATION_V1] Complete. Migrated: ${migratedCount}, Skipped: ${skippedCount}`);
    
    return {
      success: true,
      totalRecords: allApplications.length,
      migratedCount,
      skippedCount,
      results,
    };
  },
});

// ============================================
// MIGRATION: Check migration status (read-only)
// ============================================
export const checkMigrationStatus = query({
  args: {},
  handler: async (ctx) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) return null;
    
    const allApplications = await ctx.db
      .query("courierApplications")
      .collect();
    
    let needsMigration = 0;
    let alreadyNormalized = 0;
    const issues: Array<{ email: string; issue: string }> = [];
    
    for (const app of allApplications) {
      let hasIssue = false;
      
      // Check if verificationStatus matches status
      const expectedVerificationStatus = 
        app.status === "approved" ? "approved" :
        app.status === "denied" ? "denied" :
        app.status === "draft" ? "not_submitted" :
        "pending";
      
      if (app.verificationStatus !== expectedVerificationStatus) {
        hasIssue = true;
        issues.push({
          email: app.email || "unknown",
          issue: `verificationStatus mismatch: ${app.verificationStatus} vs expected ${expectedVerificationStatus}`,
        });
      }
      
      // Check if non-approved courier is online
      if (app.status !== "approved" && app.isOnline === true) {
        hasIssue = true;
        issues.push({
          email: app.email || "unknown",
          issue: "Non-approved courier is online",
        });
      }
      
      // Check if isOnline is not a boolean
      if (typeof app.isOnline !== "boolean") {
        hasIssue = true;
        issues.push({
          email: app.email || "unknown",
          issue: `isOnline is not boolean: ${app.isOnline}`,
        });
      }
      
      if (hasIssue) {
        needsMigration++;
      } else {
        alreadyNormalized++;
      }
    }
    
    return {
      totalRecords: allApplications.length,
      needsMigration,
      alreadyNormalized,
      issues: issues.slice(0, 20), // Limit to first 20 issues
    };
  },
});

// ============================================
// Auto-heal: Ensure courier record exists for logged-in user
// ============================================
export const ensureMyCourierExists = mutation({
  args: {
    roleHint: v.optional(v.union(v.literal("courier"), v.literal("customer"))),
  },
  handler: async (ctx, args) => {
    const identity = await getStableAuthIdentity(ctx);
    
    console.log("[ensureMyCourierExists] Identity:", {
      authId: identity?.authId?.slice(0, 20) || "null",
      email: identity?.email || "null",
      roleHint: args.roleHint,
    });

    if (!identity || !identity.authId) {
      throw new ConvexError("UNAUTHENTICATED");
    }

    // Only proceed if roleHint is courier
    if (args.roleHint !== "courier") {
      console.log("[ensureMyCourierExists] Skipping - not a courier role hint");
      return { action: "skipped", reason: "not_courier_role" };
    }

    // Check if courier application exists using multiple strategies
    const existing = await findCourierByIdentity(ctx, identity);

    if (existing) {
      console.log("[ensureMyCourierExists] Courier exists:", {
        applicationId: existing._id.toString(),
        status: existing.status,
      });
      return {
        action: "exists",
        applicationId: existing._id,
        status: existing.status,
      };
    }

    // Get userId for the new record
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError("UNAUTHENTICATED");
    }

    // Create new courier application in draft state
    const applicationId = await ctx.db.insert("courierApplications", {
      userId,
      status: "draft",
      fullName: identity.name || "",
      phone: "",
      email: identity.email || "",
      vehicleMake: "",
      vehicleModel: "",
      vehicleYear: "",
      vehicleColor: "",
      vehiclePlate: "",
      agreedToContractor: false,
      agreedToLicenseInsurance: false,
      agreedToBackgroundCheck: false,
      isOnline: false,
      createdAt: Date.now(),
    });

    console.log("[ensureMyCourierExists] Created new courier:", {
      applicationId: applicationId.toString(),
      email: identity.email,
    });

    return {
      action: "created",
      applicationId,
      status: "draft",
    };
  },
});

// ============================================
// List online couriers (for consumer app / admin)
// ============================================
export const listOnlineCouriers = query({
  args: {
    // Future: add lat/lng for geo filtering
  },
  handler: async (ctx) => {
    // Get all online + approved couriers
    const onlineCouriers = await ctx.db
      .query("courierApplications")
      .withIndex("by_online", (q) => q.eq("isOnline", true).eq("status", "approved"))
      .collect();

    console.log("[listOnlineCouriers] Found:", onlineCouriers.length);

    // Enrich with location data
    const enriched = await Promise.all(
      onlineCouriers.map(async (courier) => {
        const location = await ctx.db
          .query("courierLocations")
          .withIndex("by_courier", (q) => q.eq("courierId", courier.userId))
          .unique();

        return {
          courierId: courier.userId,
          applicationId: courier._id,
          name: courier.fullName,
          vehicle: `${courier.vehicleColor} ${courier.vehicleMake} ${courier.vehicleModel}`,
          plate: courier.vehiclePlate,
          location: location ? {
            latitude: location.latitude,
            longitude: location.longitude,
            updatedAt: location.updatedAt,
          } : null,
          lastOnlineAt: courier.lastOnlineAt,
        };
      })
    );

    return enriched;
  },
});

// ============================================
// MIGRATION V2: Backfill/fix existing courier records
// - Ensures all records have consistent status fields
// - Forces non-approved couriers offline
// - Adds missing fields
// ============================================
export const migrateCouriers_v2 = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminStrict(ctx);
    
    console.log("[MIGRATION_V2] Starting...");
    
    const allApplications = await ctx.db
      .query("courierApplications")
      .collect();
    
    console.log(`[MIGRATION_V2] Found ${allApplications.length} records`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    const results: Array<{ id: string; email: string; action: string; changes: string[] }> = [];
    
    for (const app of allApplications) {
      const changes: string[] = [];
      const updates: Record<string, unknown> = {};
      
      // 1. Normalize status fields
      const currentStatus = app.status;
      const currentVerificationStatus = app.verificationStatus;
      
      // Determine canonical status
      let canonicalStatus: "approved" | "denied" | "pending" | "draft" | "suspended";
      if (currentVerificationStatus === "approved" || currentStatus === "approved") {
        canonicalStatus = "approved";
      } else if (currentVerificationStatus === "denied" || currentStatus === "denied") {
        canonicalStatus = "denied";
      } else if (currentStatus === "suspended") {
        canonicalStatus = "suspended";
      } else if (currentStatus === "draft") {
        canonicalStatus = "draft";
      } else {
        canonicalStatus = "pending";
      }
      
      // Map to verificationStatus values
      const expectedVerificationStatus = 
        canonicalStatus === "approved" ? "approved" :
        canonicalStatus === "denied" ? "denied" :
        canonicalStatus === "draft" ? "not_submitted" :
        "pending";
      
      // Map to status values (for backward compat)
      const expectedStatus = 
        canonicalStatus === "approved" ? "approved" :
        canonicalStatus === "denied" ? "denied" :
        canonicalStatus === "draft" ? "draft" :
        canonicalStatus === "suspended" ? "suspended" :
        "pending_review";
      
      if (app.verificationStatus !== expectedVerificationStatus) {
        updates.verificationStatus = expectedVerificationStatus;
        changes.push(`verificationStatus: ${app.verificationStatus} -> ${expectedVerificationStatus}`);
      }
      
      if (app.status !== expectedStatus) {
        updates.status = expectedStatus;
        changes.push(`status: ${app.status} -> ${expectedStatus}`);
      }
      
      // 2. Ensure isOnline is boolean
      if (typeof app.isOnline !== "boolean") {
        updates.isOnline = false;
        changes.push(`isOnline: ${app.isOnline} -> false`);
      }
      
      // 3. Force offline if not approved
      if (canonicalStatus !== "approved" && app.isOnline === true) {
        updates.isOnline = false;
        changes.push("forced offline (not approved)");
      }
      
      // 4. Set verifiedAt if approved and missing
      if (canonicalStatus === "approved" && !app.verifiedAt) {
        updates.verifiedAt = app.reviewedAt || Date.now();
        changes.push("added verifiedAt");
      }
      
      // 5. Sync denial reasons
      if (canonicalStatus === "denied") {
        if (!app.verificationDenialReason && app.denialReason) {
          updates.verificationDenialReason = app.denialReason;
          changes.push("synced verificationDenialReason");
        }
        if (!app.denialReason && app.verificationDenialReason) {
          updates.denialReason = app.verificationDenialReason;
          changes.push("synced denialReason");
        }
      }
      
      // 6. Apply updates
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(app._id, updates);
        migratedCount++;
        console.log(`[MIGRATION_V2] Updated ${app.email}:`, changes);
      } else {
        skippedCount++;
      }
      
      results.push({
        id: app._id,
        email: app.email || "unknown",
        action: changes.length > 0 ? "migrated" : "skipped",
        changes,
      });
    }
    
    console.log(`[MIGRATION_V2] Complete. Migrated: ${migratedCount}, Skipped: ${skippedCount}`);
    
    return {
      success: true,
      totalRecords: allApplications.length,
      migratedCount,
      skippedCount,
      results,
    };
  },
});

// ============================================
// Migration: Backfill verificationStatus for existing approved couriers
// This is a simpler, targeted migration for the specific issue
// ============================================
export const migrateBackfillVerificationStatus = mutation({
  args: {},
  handler: async (ctx) => {
    // Get all courier applications
    const applications = await ctx.db.query("courierApplications").collect();
    
    let updatedCount = 0;
    for (const app of applications) {
      // If status is approved but verificationStatus is not set or mismatched, sync it
      if (app.status === "approved" && app.verificationStatus !== "approved") {
        await ctx.db.patch(app._id, {
          verificationStatus: "approved",
        });
        updatedCount++;
        console.log(`[BACKFILL] Updated courier ${app.email}: verificationStatus -> approved`);
      }
      // Sync denied status
      if (app.status === "denied" && app.verificationStatus !== "denied") {
        await ctx.db.patch(app._id, {
          verificationStatus: "denied",
        });
        updatedCount++;
        console.log(`[BACKFILL] Updated courier ${app.email}: verificationStatus -> denied`);
      }
      // For suspended, map to denied in verificationStatus (schema doesn't support suspended)
      if (app.status === "suspended" && app.verificationStatus !== "denied") {
        await ctx.db.patch(app._id, {
          verificationStatus: "denied",
        });
        updatedCount++;
        console.log(`[BACKFILL] Updated courier ${app.email}: verificationStatus -> denied (suspended)`);
      }
    }
    
    return {
      success: true,
      message: `Backfilled verificationStatus for ${updatedCount} couriers`,
      updatedCount,
    };
  },
});