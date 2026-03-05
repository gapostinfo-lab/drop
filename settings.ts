import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireAdminStrict } from "./lib/adminAuth";

// Default settings
const DEFAULT_SETTINGS: Record<string, unknown> = {
  baseFee: 15,
  additionalPackageFee: 3,
  commissionPercent: 25,
  serviceArea: "New York",
};

export const getSetting = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    if (setting) {
      return setting.value;
    }

    // Return default if exists
    return DEFAULT_SETTINGS[args.key] ?? null;
  },
});

export const getAllSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("settings").collect();

    // Merge with defaults
    const result: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const setting of settings) {
      result[setting.key] = setting.value;
    }

    return result;
  },
});

export const updateSetting = mutation({
  args: {
    key: v.string(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdminStrict(ctx);

    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    const previousValue = existing?.value;

    let settingId;
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
      settingId = existing._id;
    } else {
      settingId = await ctx.db.insert("settings", {
        key: args.key,
        value: args.value,
      });
    }

    // Log admin action
    await ctx.scheduler.runAfter(0, internal.adminLogs.logAdminAction, {
      adminId,
      action: "setting_updated",
      targetType: "setting",
      targetId: args.key,
      details: {
        previousValue,
        newValue: args.value,
      },
    });

    return settingId;
  },
});

export const initializeSettings = mutation({
  args: {},
  handler: async (ctx) => {
    const adminId = await requireAdminStrict(ctx);

    // Insert default settings if they don't exist
    const initializedKeys: string[] = [];
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      const existing = await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();

      if (!existing) {
        await ctx.db.insert("settings", { key, value });
        initializedKeys.push(key);
      }
    }

    // Log admin action if any settings were initialized
    if (initializedKeys.length > 0) {
      await ctx.scheduler.runAfter(0, internal.adminLogs.logAdminAction, {
        adminId,
        action: "settings_initialized",
        targetType: "settings",
        details: {
          initializedKeys,
        },
      });
    }

    return true;
  },
});
