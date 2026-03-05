import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAdmin } from "./lib/adminAuth";

// Normalize phone number to E.164 format
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  
  // If 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If 11 digits starting with 1, add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If already has country code (12+ digits), add + if not present
  if (digits.length >= 11) {
    return phone.startsWith('+') ? phone : `+${digits}`;
  }
  
  // Return as-is for other formats
  return phone;
}

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const getProfileByUserId = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

export const createProfile = mutation({
  args: {
    role: v.union(v.literal("customer"), v.literal("courier"), v.literal("admin")),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    // SECURITY: Block admin role from public signup
    if (args.role === "admin") {
      throw new Error("ADMIN_ROLE_BLOCKED: Admin accounts cannot be created via signup");
    }

    // Validate phone number
    const phoneDigits = args.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      throw new Error("PHONE_REQUIRED: Please provide a valid phone number (10+ digits)");
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in to create a profile");
    }

    // Check if profile already exists
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      throw new Error("You already have a profile");
    }

    return await ctx.db.insert("profiles", {
      userId,
      role: args.role,
      name: args.name,
      email: args.email,
      phone: normalizePhone(args.phone),
      createdAt: Date.now(),
    });
  },
});

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in to update your profile");
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("Profile not found. Please create a profile first");
    }

    const updates: Partial<typeof args> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.email !== undefined) updates.email = args.email;
    if (args.phone !== undefined) updates.phone = args.phone;

    await ctx.db.patch(profile._id, updates);
    return profile._id;
  },
});

// Create or update profile after signup (atomic operation)
export const createOrUpdateProfile = mutation({
  args: {
    role: v.union(v.literal("customer"), v.literal("courier"), v.literal("admin")),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    // SECURITY: Block admin role from public signup
    if (args.role === "admin") {
      throw new Error("ADMIN_ROLE_BLOCKED: Admin accounts cannot be created via signup");
    }

    // Validate phone number
    const phoneDigits = args.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      throw new Error("PHONE_REQUIRED: Please provide a valid phone number (10+ digits)");
    }

    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Session not established. Please try again.");
    }

    // Check if profile already exists
    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    let profileId;
    const normalizedPhone = normalizePhone(args.phone);
    
    if (existing) {
      // Update existing profile (but don't change role if already set)
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        phone: normalizedPhone,
      });
      profileId = existing._id;
    } else {
      // Create new profile
      profileId = await ctx.db.insert("profiles", {
        userId,
        role: args.role,
        name: args.name,
        email: args.email,
        phone: normalizedPhone,
        createdAt: Date.now(),
      });
    }

    // For couriers, ensure courier application exists
    if (args.role === "courier") {
      const existingApplication = await ctx.db
        .query("courierApplications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();

      if (!existingApplication) {
        await ctx.db.insert("courierApplications", {
          userId,
          status: "draft",
          fullName: args.name,
          phone: args.phone,
          email: args.email,
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
      }
    }
    
    return { 
      profileId, 
      role: existing?.role || args.role,
      isNewUser: !existing,
    };
  },
});

// Get profile with retry logic for new signups
export const getMyProfileWithRetry = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return profile;
  },
});

// Update profile image
export const updateProfileImage = mutation({
  args: {
    imageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in");
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) {
      throw new Error("Profile not found");
    }

    await ctx.db.patch(profile._id, {
      profileImageId: args.imageId,
    });

    // If user is a courier, also update their application's profile photo
    if (profile.role === "courier") {
      const application = await ctx.db
        .query("courierApplications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();

      if (application) {
        await ctx.db.patch(application._id, {
          profilePhotoId: args.imageId,
        });
      }
    }

    return { success: true };
  },
});

// Get profile image URL
export const getProfileImageUrl = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!profile?.profileImageId) return null;

    return await ctx.storage.getUrl(profile.profileImageId);
  },
});

// Ensure profile exists for returning users (called on login)
export const ensureProfileExists = mutation({
  args: {
    // Optional: pass these if we know the intended role (from login form)
    intendedRole: v.optional(v.union(v.literal("customer"), v.literal("courier"), v.literal("admin"))),
  },
  handler: async (ctx, _args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("SESSION_NOT_ESTABLISHED");
    }

    // Note: _args.intendedRole is available for future use (e.g., role mismatch detection)

    // Check if profile exists
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (profile) {
      // Profile exists - return it
      // For couriers, also check if application exists
      let courierStatus = null;
      if (profile.role === "courier") {
        const application = await ctx.db
          .query("courierApplications")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique();
        courierStatus = application?.status || null;
        
        // If courier has no application, that's a problem - create one
        if (!application) {
          await ctx.db.insert("courierApplications", {
            userId,
            status: "draft",
            fullName: profile.name,
            phone: profile.phone || "",
            email: profile.email,
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
          courierStatus = "draft";
        }
      }
      
      return {
        exists: true,
        profileId: profile._id,
        role: profile.role,
        name: profile.name,
        email: profile.email,
        courierStatus,
      };
    }

    // Profile doesn't exist
    // This shouldn't happen for returning users, but handle it gracefully
    return {
      exists: false,
      profileId: null,
      role: null,
      name: null,
      email: null,
      courierStatus: null,
      error: "PROFILE_NOT_FOUND",
    };
  },
});

// Debug query to help diagnose auth issues
export const getAuthDebugInfo = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    
    if (!userId) {
      return {
        authenticated: false,
        userId: null,
        hasProfile: false,
        profile: null,
        hasCourierApplication: false,
        courierApplication: null,
      };
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    let courierApplication = null;
    if (profile?.role === "courier") {
      courierApplication = await ctx.db
        .query("courierApplications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
    }

    return {
      authenticated: true,
      userId: userId.toString(),
      hasProfile: !!profile,
      profile: profile ? {
        id: profile._id,
        role: profile.role,
        name: profile.name,
        email: profile.email,
        createdAt: profile.createdAt,
      } : null,
      hasCourierApplication: !!courierApplication,
      courierApplication: courierApplication ? {
        id: courierApplication._id,
        status: courierApplication.status,
        isOnline: courierApplication.isOnline,
        payoutSetupStatus: courierApplication.payoutSetupStatus,
      } : null,
    };
  },
});

// Admin: update user role
export const updateUserRole = mutation({
  args: {
    profileId: v.id("profiles"),
    role: v.union(v.literal("customer"), v.literal("courier"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in to continue");
    }

    // Check admin role
    const adminProfile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!adminProfile || adminProfile.role !== "admin") {
      throw new Error("Only admins can update user roles");
    }

    await ctx.db.patch(args.profileId, { role: args.role });
    return args.profileId;
  },
});

// Get customer public profile for couriers (privacy-safe)
export const getCustomerPublicProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const requesterId = await getAuthUserId(ctx);
    if (!requesterId) return null;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!profile) return null;

    // Only return first name for privacy
    const firstName = profile.name.split(' ')[0];

    return {
      firstName,
      profileImageId: profile.profileImageId,
      // NO phone number returned to couriers
    };
  },
});

// Admin: list recent users
export const listRecentUsers = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) return [];

    const limit = args.limit ?? 25;

    // Get profiles ordered by createdAt descending
    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_created")
      .order("desc")
      .take(limit);

    return profiles.map((p) => ({
      id: p._id,
      userId: p.userId,
      name: p.name,
      email: p.email,
      phone: p.phone,
      role: p.role,
      createdAt: p.createdAt,
    }));
  },
});
