import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Generate a secure random token
function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 64; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Internal mutation for creating sessions (called from adminLogin)
export const createSessionInternal = internalMutation({
  args: {
    adminId: v.id("adminCredentials"),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const token = generateToken();
    
    // Delete any existing sessions for this admin
    const existingSessions = await ctx.db
      .query("adminSessions")
      .withIndex("by_admin", (q) => q.eq("adminId", args.adminId))
      .collect();
    
    for (const session of existingSessions) {
      await ctx.db.delete(session._id);
    }
    
    // Create new session
    await ctx.db.insert("adminSessions", {
      adminId: args.adminId,
      token,
      email: args.email,
      createdAt: now,
      expiresAt: now + SESSION_DURATION_MS,
      lastActivityAt: now,
    });
    
    return { token, expiresAt: now + SESSION_DURATION_MS };
  },
});

// Create a new admin session
export const createSession = mutation({
  args: {
    adminId: v.id("adminCredentials"),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const token = generateToken();
    
    // Delete any existing sessions for this admin
    const existingSessions = await ctx.db
      .query("adminSessions")
      .withIndex("by_admin", (q) => q.eq("adminId", args.adminId))
      .collect();
    
    for (const session of existingSessions) {
      await ctx.db.delete(session._id);
    }
    
    // Create new session
    const sessionId = await ctx.db.insert("adminSessions", {
      adminId: args.adminId,
      token,
      email: args.email,
      createdAt: now,
      expiresAt: now + SESSION_DURATION_MS,
      lastActivityAt: now,
    });
    
    console.log("[adminSessions] Created session for:", args.email);
    
    return { sessionId, token, expiresAt: now + SESSION_DURATION_MS };
  },
});

// Validate session by token
export const validateSession = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) {
      return { valid: false, reason: "NO_TOKEN" };
    }
    
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    
    if (!session) {
      return { valid: false, reason: "SESSION_NOT_FOUND" };
    }
    
    if (session.expiresAt < Date.now()) {
      return { valid: false, reason: "SESSION_EXPIRED" };
    }
    
    return {
      valid: true,
      adminId: session.adminId,
      email: session.email,
      expiresAt: session.expiresAt,
    };
  },
});

// Get current admin from session token
export const getCurrentAdmin = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) {
      return null;
    }
    
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    
    if (!session || session.expiresAt < Date.now()) {
      return null;
    }
    
    const admin = await ctx.db.get(session.adminId);
    if (!admin) {
      return null;
    }
    
    return {
      email: admin.email,
      sessionId: session._id,
      expiresAt: session.expiresAt,
    };
  },
});

// Update session activity (extend expiration)
export const touchSession = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    
    if (!session) {
      return { success: false };
    }
    
    const now = Date.now();
    await ctx.db.patch(session._id, {
      lastActivityAt: now,
      expiresAt: now + SESSION_DURATION_MS,
    });
    
    return { success: true, expiresAt: now + SESSION_DURATION_MS };
  },
});

// Delete session (logout)
export const deleteSession = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("adminSessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    
    if (session) {
      await ctx.db.delete(session._id);
      console.log("[adminSessions] Deleted session for:", session.email);
    }
    
    return { success: true };
  },
});

// Cleanup expired sessions (can be called periodically)
export const cleanupExpiredSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const allSessions = await ctx.db.query("adminSessions").collect();
    
    let deleted = 0;
    for (const session of allSessions) {
      if (session.expiresAt < now) {
        await ctx.db.delete(session._id);
        deleted++;
      }
    }
    
    return { deleted };
  },
});
