import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get user's saved addresses (sorted by most recently used)
export const getMySavedAddresses = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const addresses = await ctx.db
      .query("savedAddresses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Sort by lastUsedAt descending, then createdAt descending
    return addresses.sort((a, b) => {
      const aLastUsed = a.lastUsedAt ?? 0;
      const bLastUsed = b.lastUsedAt ?? 0;
      if (bLastUsed !== aLastUsed) {
        return bLastUsed - aLastUsed;
      }
      return b.createdAt - a.createdAt;
    });
  },
});

// Save a new address
export const saveAddress = mutation({
  args: {
    label: v.string(),
    street1: v.string(),
    street2: v.optional(v.string()),
    city: v.string(),
    state: v.string(),
    zipCode: v.string(),
    country: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    placeId: v.optional(v.string()),
    isDefault: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please sign in to save addresses");

    // If this is set as default, unset other defaults
    if (args.isDefault) {
      const existingAddresses = await ctx.db
        .query("savedAddresses")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();

      for (const addr of existingAddresses) {
        if (addr.isDefault) {
          await ctx.db.patch(addr._id, { isDefault: false });
        }
      }
    }

    return await ctx.db.insert("savedAddresses", {
      userId,
      ...args,
      createdAt: Date.now(),
    });
  },
});

// Update a saved address
export const updateAddress = mutation({
  args: {
    addressId: v.id("savedAddresses"),
    label: v.optional(v.string()),
    street1: v.optional(v.string()),
    street2: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    country: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    placeId: v.optional(v.string()),
    isDefault: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please sign in to update addresses");

    const address = await ctx.db.get(args.addressId);
    if (!address || address.userId !== userId) {
      throw new Error("Address not found");
    }

    // If setting as default, unset others
    if (args.isDefault) {
      const existingAddresses = await ctx.db
        .query("savedAddresses")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();

      for (const addr of existingAddresses) {
        if (addr.isDefault && addr._id !== args.addressId) {
          await ctx.db.patch(addr._id, { isDefault: false });
        }
      }
    }

    const { addressId, ...updates } = args;
    await ctx.db.patch(addressId, updates);
    return addressId;
  },
});

// Delete a saved address
export const deleteAddress = mutation({
  args: { addressId: v.id("savedAddresses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Please sign in to delete addresses");

    const address = await ctx.db.get(args.addressId);
    if (!address || address.userId !== userId) {
      throw new Error("Address not found");
    }

    await ctx.db.delete(args.addressId);
  },
});

// Get default address
export const getDefaultAddress = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query("savedAddresses")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", userId).eq("isDefault", true)
      )
      .first();
  },
});

// Auto-save address after successful use (silent for guests)
export const autoSaveAddress = mutation({
  args: {
    street1: v.string(),
    street2: v.optional(v.string()),
    city: v.string(),
    state: v.string(),
    zipCode: v.string(),
    country: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    placeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null; // Silent fail for guests

    // Check for duplicates by placeId OR (street1 + zipCode)
    const existing = await ctx.db
      .query("savedAddresses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const isDuplicate = existing.some((addr) => {
      if (args.placeId && addr.placeId === args.placeId) return true;
      if (
        addr.street1.toLowerCase() === args.street1.toLowerCase() &&
        addr.zipCode === args.zipCode
      )
        return true;
      return false;
    });

    if (isDuplicate) {
      // Update lastUsedAt on existing
      const match = existing.find((addr) => {
        if (args.placeId && addr.placeId === args.placeId) return true;
        if (
          addr.street1.toLowerCase() === args.street1.toLowerCase() &&
          addr.zipCode === args.zipCode
        )
          return true;
        return false;
      });
      if (match) {
        await ctx.db.patch(match._id, { lastUsedAt: Date.now() });
      }
      return match?._id ?? null;
    }

    // Create new saved address with label "Recent"
    return await ctx.db.insert("savedAddresses", {
      userId,
      label: "Recent",
      ...args,
      isDefault: false,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    });
  },
});

// Search addresses (for admin)
export const searchAddresses = query({
  args: {
    searchTerm: v.string(),
  },
  handler: async (ctx, args) => {
    // This is a simple search - in production you'd want full-text search
    const allJobs = await ctx.db.query("jobs").collect();
    const term = args.searchTerm.toLowerCase();

    return allJobs.filter(
      (job) =>
        job.pickupAddress?.toLowerCase().includes(term) ||
        job.pickupCity?.toLowerCase().includes(term) ||
        job.pickupZipCode?.includes(term)
    );
  },
});
