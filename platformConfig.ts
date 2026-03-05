import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminStrict } from "./lib/adminAuth";

// Get platform configuration
export const get = query({
  args: {},
  handler: async (ctx) => {
    // Get the single config record
    const config = await ctx.db
      .query("platformConfig")
      .first();
    
    // Return defaults if no config exists
    if (!config) {
      return {
        primaryCity: "Atlanta, GA",
        radiusMiles: 25,
        centerLat: 33.749,
        centerLng: -84.388,
        updatedAt: null,
      };
    }
    
    return config;
  },
});

// Update platform configuration (admin only)
export const update = mutation({
  args: {
    primaryCity: v.string(),
    radiusMiles: v.number(),
    centerLat: v.number(),
    centerLng: v.number(),
  },
  handler: async (ctx, args) => {
    // Require admin auth
    await requireAdminStrict(ctx);
    
    // Get existing config
    const existing = await ctx.db
      .query("platformConfig")
      .first();
    
    const configData = {
      primaryCity: args.primaryCity,
      radiusMiles: args.radiusMiles,
      centerLat: args.centerLat,
      centerLng: args.centerLng,
      updatedAt: Date.now(),
    };
    
    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, configData);
      return existing._id;
    } else {
      // Create new
      const id = await ctx.db.insert("platformConfig", configData);
      return id;
    }
  },
});
