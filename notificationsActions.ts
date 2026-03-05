"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Site URL for notification click URLs
const SITE_URL = process.env.SITE_URL || "https://droppit.surgent.site";

// Type for push result
type PushResult = {
  success: boolean;
  error?: string;
  notificationId?: string;
  recipients?: number;
};

// Helper function to send push via OneSignal API
async function sendOneSignalPush(args: {
  oneSignalIds: string[];
  title: string;
  message: string;
  url?: string;
  data?: unknown;
}): Promise<PushResult> {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !apiKey) {
    console.error("[notifications] Missing OneSignal credentials");
    return { success: false, error: "MISSING_CREDENTIALS" };
  }

  if (args.oneSignalIds.length === 0) {
    console.log("[notifications] No recipients to send push to");
    return { success: false, error: "NO_RECIPIENTS" };
  }

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        include_player_ids: args.oneSignalIds,
        headings: { en: args.title },
        contents: { en: args.message },
        url: args.url ? (args.url.startsWith('http') ? args.url : `${SITE_URL}${args.url}`) : undefined,
        data: args.data,
        // iOS specific
        ios_badgeType: "Increase",
        ios_badgeCount: 1,
        // Android specific
        android_channel_id: "droppit_notifications",
        priority: 10,
        // TTL (24 hours)
        ttl: 86400,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("[notifications] OneSignal API error:", result);
      return { success: false, error: result.errors?.[0] || "API_ERROR" };
    }

    console.log("[notifications] Push sent successfully:", {
      id: result.id,
      recipients: result.recipients,
    });

    return { success: true, notificationId: result.id, recipients: result.recipients };
  } catch (error) {
    console.error("[notifications] Failed to send push:", error);
    return { success: false, error: "NETWORK_ERROR" };
  }
}

// ============================================
// INTERNAL ACTION: Send push notification via OneSignal API
// ============================================
export const sendPushInternal = internalAction({
  args: {
    oneSignalIds: v.array(v.string()),
    title: v.string(),
    message: v.string(),
    url: v.optional(v.string()),
    data: v.optional(v.any()),
  },
  handler: async (_ctx, args): Promise<PushResult> => {
    return sendOneSignalPush({
      oneSignalIds: args.oneSignalIds,
      title: args.title,
      message: args.message,
      url: args.url,
      data: args.data,
    });
  },
});

// ============================================
// INTERNAL ACTION: Send push to a specific user by userId
// ============================================
export const sendPushToUser = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    message: v.string(),
    url: v.optional(v.string()),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<PushResult> => {
    // Get user's profile to find OneSignal ID
    const profile = await ctx.runQuery(internal.notifications.getProfileByUserId, {
      userId: args.userId,
    });

    if (!profile?.oneSignalId) {
      console.log("[notifications] User has no OneSignal ID:", args.userId);
      return { success: false, error: "NO_ONESIGNAL_ID" };
    }

    // Send push directly
    return sendOneSignalPush({
      oneSignalIds: [profile.oneSignalId],
      title: args.title,
      message: args.message,
      url: args.url,
      data: args.data,
    });
  },
});

// ============================================
// INTERNAL ACTION: Send push to multiple users
// ============================================
export const sendPushToUsers = internalAction({
  args: {
    userIds: v.array(v.id("users")),
    title: v.string(),
    message: v.string(),
    url: v.optional(v.string()),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<PushResult> => {
    // Get all profiles
    const profiles = await ctx.runQuery(internal.notifications.getProfilesByUserIds, {
      userIds: args.userIds,
    });

    const oneSignalIds = profiles
      .filter((p) => !!p.oneSignalId)
      .map((p) => p.oneSignalId as string);

    if (oneSignalIds.length === 0) {
      console.log("[notifications] No users have OneSignal IDs");
      return { success: false, error: "NO_ONESIGNAL_IDS" };
    }

    return sendOneSignalPush({
      oneSignalIds,
      title: args.title,
      message: args.message,
      url: args.url,
      data: args.data,
    });
  },
});

// ============================================
// INTERNAL ACTION: Notify all online couriers about new job
// ============================================
export const notifyOnlineCouriers = internalAction({
  args: {
    title: v.string(),
    message: v.string(),
    jobId: v.id("jobs"),
  },
  handler: async (ctx, args): Promise<PushResult> => {
    // Get all online approved couriers
    const couriers = await ctx.runQuery(internal.notifications.getOnlineCouriers, {});

    const oneSignalIds = couriers
      .filter((c) => !!c.oneSignalId)
      .map((c) => c.oneSignalId as string);

    if (oneSignalIds.length === 0) {
      console.log("[notifications] No online couriers with push enabled");
      return { success: false, error: "NO_ONLINE_COURIERS" };
    }

    console.log("[notifications] Notifying", oneSignalIds.length, "online couriers about new job");

    return sendOneSignalPush({
      oneSignalIds,
      title: args.title,
      message: args.message,
      url: "/courier/available-jobs",
      data: { jobId: args.jobId, type: "new_job" },
    });
  },
});
