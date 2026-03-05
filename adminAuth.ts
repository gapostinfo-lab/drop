import { mutation, query, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";

// Constants
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const MIN_PASSWORD_LENGTH = 10;
const COMMON_PASSWORDS = ["password123", "qwerty12345", "admin12345", "letmein123"];
const SALT = "droppit_admin_v2_";

// Simple deterministic hash using base64
// This is NOT cryptographically secure but works consistently in Convex
function simpleHash(password: string): string {
  const salted = SALT + password + SALT;
  // Use btoa for base64 encoding (available in Convex runtime)
  return btoa(salted).split('').reverse().join('');
}

// Verify password
function verifyPassword(password: string, storedHash: string): boolean {
  const inputHash = simpleHash(password);
  console.log("[adminAuth] Verifying - input hash:", inputHash.substring(0, 20) + "...");
  console.log("[adminAuth] Verifying - stored hash:", storedHash.substring(0, 20) + "...");
  return inputHash === storedHash;
}

// Check password strength
function isPasswordStrong(password: string): { valid: boolean; error?: string } {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) {
    return { valid: false, error: "Password is too common. Choose a stronger password." };
  }
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (!(hasUpper && hasLower && hasNumber)) {
    return { valid: false, error: "Password must contain uppercase, lowercase, and numbers" };
  }
  return { valid: true };
}

// Shared admin lookup - EXACT same logic as adminLogin uses
// This ensures bootstrap and login use identical lookup paths
async function findAdminByEmail(ctx: { db: any }, email: string) {
  const normalizedEmail = email.toLowerCase().trim();
  
  // Try normalized email first (same as adminLogin)
  let admin = await ctx.db
    .query("adminCredentials")
    .withIndex("by_email", (q: any) => q.eq("email", normalizedEmail))
    .unique();
  
  // Also try exact match if not found (same as adminLogin)
  if (!admin) {
    admin = await ctx.db
      .query("adminCredentials")
      .withIndex("by_email", (q: any) => q.eq("email", email))
      .unique();
  }
  
  return admin;
}

// Seed default admin (idempotent - safe to run multiple times)
export const seedDefaultAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const DEFAULT_EMAIL = "neemar12@gmail.com";
    // Use env var if set, otherwise use the strong default password
    const DEFAULT_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD || "SetNewStrongPassword123!@#";
    
    // Check if admin already exists using shared helper
    const existing = await findAdminByEmail(ctx, DEFAULT_EMAIL);
    
    if (existing) {
      return { success: true, message: "Admin already exists", created: false };
    }
    
    // Create admin credentials
    const passwordHash = simpleHash(DEFAULT_PASSWORD);
    await ctx.db.insert("adminCredentials", {
      email: DEFAULT_EMAIL.toLowerCase().trim(),
      passwordHash,
      mustChangePassword: false, // Don't require change for the strong password
      failedAttempts: 0,
      createdAt: Date.now(),
    });
    
    console.log("[adminAuth] Admin created with email:", DEFAULT_EMAIL);
    
    return { success: true, message: "Admin created", created: true };
  },
});

// Alias for seedDefaultAdmin to match frontend usage
export const ensureAdmin = seedDefaultAdmin;

// Seed initial admin with secure token validation (for production setup)
export const seedInitialAdmin = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const ADMIN_EMAIL = "neemar12@gmail.com";
    
    // Validate token against environment variable
    const expectedToken = process.env.ADMIN_SEED_TOKEN;
    if (!expectedToken || args.token !== expectedToken) {
      throw new ConvexError("BAD_TOKEN");
    }
    
    // Check if admin already exists
    const existing = await ctx.db
      .query("adminCredentials")
      .withIndex("by_email", (q) => q.eq("email", ADMIN_EMAIL))
      .unique();
    
    if (existing) {
      return { ok: true, created: false, message: "Admin already exists" };
    }
    
    // Get password from environment variable
    const initialPassword = process.env.ADMIN_INITIAL_PASSWORD;
    if (!initialPassword) {
      throw new ConvexError("MISSING_PASSWORD_ENV");
    }
    
    // Hash the password using existing simpleHash function
    const passwordHash = simpleHash(initialPassword);
    
    // Insert admin credentials
    await ctx.db.insert("adminCredentials", {
      email: ADMIN_EMAIL,
      passwordHash,
      mustChangePassword: false,
      failedAttempts: 0,
      createdAt: Date.now(),
    });
    
    return { ok: true, created: true, message: "Admin created" };
  },
});

// Admin login (validates credentials, handles lockout)
export const adminLogin = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const { email, password } = args;
    const normalizedEmail = email.toLowerCase().trim();
    
    try {
      // Auto-bootstrap admin if env vars are set and no admin exists
      const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
      const bootstrapPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;

      if (bootstrapEmail && bootstrapPassword) {
        const existingAdmin = await ctx.db
          .query("adminCredentials")
          .withIndex("by_email", (q) => q.eq("email", bootstrapEmail.toLowerCase().trim()))
          .unique();
        
        if (!existingAdmin) {
          console.log("[adminAuth] Auto-bootstrapping admin:", bootstrapEmail);
          const passwordHash = simpleHash(bootstrapPassword);
          await ctx.db.insert("adminCredentials", {
            email: bootstrapEmail.toLowerCase().trim(),
            passwordHash,
            mustChangePassword: false,
            failedAttempts: 0,
            createdAt: Date.now(),
          });
        }
      }
      
      // Debug log (no secrets)
      console.log("ADMIN_LOGIN_ATTEMPT", { email: normalizedEmail });
      
      // Find admin credentials - try both normalized and exact
      let admin = await ctx.db
        .query("adminCredentials")
        .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
        .unique();
      
      // Also try exact match if not found
      if (!admin) {
        admin = await ctx.db
          .query("adminCredentials")
          .withIndex("by_email", (q) => q.eq("email", email))
          .unique();
      }
      
      // Debug log (no secrets)
      console.log("ADMIN_LOGIN_DEBUG", {
        email: normalizedEmail,
        hasAdmin: !!admin,
        hasPasswordHash: !!admin?.passwordHash,
        hashLength: admin?.passwordHash?.length ?? 0,
        failedAttempts: admin?.failedAttempts ?? 0,
        isLocked: admin?.lockedUntil ? admin.lockedUntil > Date.now() : false,
      });
      
      if (!admin) {
        throw new ConvexError("ADMIN_NOT_FOUND");
      }
      
      // Check if locked out
      if (admin.lockedUntil && admin.lockedUntil > Date.now()) {
        const remainingMinutes = Math.ceil((admin.lockedUntil - Date.now()) / 60000);
        throw new ConvexError(`ACCOUNT_LOCKED: Try again in ${remainingMinutes} minutes`);
      }
      
      // Verify password
      let isValid = false;
      try {
        isValid = verifyPassword(password, admin.passwordHash);
      } catch (hashErr) {
        console.error("HASHING_ERROR", hashErr);
        throw new ConvexError("HASHING_ERROR: Password verification failed");
      }
      
      console.log("ADMIN_LOGIN_VERIFY", { isValid });
      
      if (!isValid) {
        // Increment failed attempts
        const newFailedAttempts = admin.failedAttempts + 1;
        const updates: {
          failedAttempts: number;
          updatedAt: number;
          lockedUntil?: number;
        } = { 
          failedAttempts: newFailedAttempts,
          updatedAt: Date.now(),
        };
        
        // Lock if too many attempts
        if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
          updates.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
          await ctx.db.patch(admin._id, updates);
          throw new ConvexError("ACCOUNT_LOCKED: Too many failed attempts. Locked for 10 minutes.");
        }
        
        await ctx.db.patch(admin._id, updates);
        throw new ConvexError("INVALID_PASSWORD");
      }
      
      // Success - reset failed attempts
      await ctx.db.patch(admin._id, {
        failedAttempts: 0,
        lockedUntil: undefined,
        lastLoginAt: Date.now(),
        updatedAt: Date.now(),
      });
      
      // Create admin session
      const sessionResult: { token: string; expiresAt: number } = await ctx.runMutation(internal.adminSessions.createSessionInternal, {
        adminId: admin._id,
        email: admin.email,
      });

      console.log("ADMIN_LOGIN_SUCCESS", { email: admin.email });

      return {
        success: true,
        mustChangePassword: admin.mustChangePassword,
        email: admin.email,
        sessionToken: sessionResult.token,
        expiresAt: sessionResult.expiresAt,
      };
    } catch (err: unknown) {
      const message = err instanceof ConvexError ? err.data : (err instanceof Error ? err.message : "UNKNOWN_ERROR");
      console.error("ADMIN_LOGIN_ERROR", { email: normalizedEmail, error: message });
      if (err instanceof ConvexError) {
        throw err;
      }
      throw new ConvexError(message as string);
    }
  },
});

// Check if admin must change password
export const checkMustChangePassword = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("adminCredentials")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase().trim()))
      .unique();
    
    if (!admin) return null;
    return { mustChangePassword: admin.mustChangePassword };
  },
});

// Change admin password (with session validation)
export const changeAdminPassword = mutation({
  args: {
    email: v.string(),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const { email, currentPassword, newPassword } = args;
    const normalizedEmail = email.toLowerCase().trim();
    
    // Diagnostic log (temporary)
    console.log("[changeAdminPassword] Attempt", { 
      email: normalizedEmail,
      argsKeys: Object.keys(args),
    });
    
    try {
      // Find admin
      const admin = await ctx.db
        .query("adminCredentials")
        .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
        .unique();
      
      if (!admin) {
        console.log("[changeAdminPassword] Admin not found");
        throw new ConvexError({ code: "ADMIN_NOT_FOUND", message: "Admin account not found" });
      }
      
      // Verify current password
      if (!verifyPassword(currentPassword, admin.passwordHash)) {
        console.log("[changeAdminPassword] Invalid current password");
        throw new ConvexError({ code: "INVALID_PASSWORD", message: "Current password is incorrect" });
      }
      
      // Validate new password strength
      const strength = isPasswordStrong(newPassword);
      if (!strength.valid) {
        console.log("[changeAdminPassword] Weak password:", strength.error);
        throw new ConvexError({ code: "WEAK_PASSWORD", message: strength.error! });
      }
      
      // Don't allow same password
      if (verifyPassword(newPassword, admin.passwordHash)) {
        throw new ConvexError({ code: "SAME_PASSWORD", message: "New password must be different from current password" });
      }
      
      // Update password
      const newHash = simpleHash(newPassword);
      await ctx.db.patch(admin._id, {
        passwordHash: newHash,
        mustChangePassword: false,
        updatedAt: Date.now(),
      });
      
      console.log("[changeAdminPassword] Success for:", normalizedEmail);
      
      return { success: true };
    } catch (err) {
      // Re-throw ConvexErrors as-is
      if (err instanceof ConvexError) {
        throw err;
      }
      // Wrap unexpected errors
      console.error("[changeAdminPassword] Unexpected error:", err);
      throw new ConvexError({ code: "UNKNOWN_ERROR", message: "An unexpected error occurred" });
    }
  },
});

// Change admin email
export const changeAdminEmail = mutation({
  args: {
    currentEmail: v.string(),
    newEmail: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const { currentEmail, newEmail, password } = args;
    const normalizedCurrentEmail = currentEmail.toLowerCase().trim();
    const normalizedNewEmail = newEmail.toLowerCase().trim();
    
    console.log("[changeAdminEmail] Attempt", { 
      currentEmail: normalizedCurrentEmail,
      newEmail: normalizedNewEmail,
    });
    
    try {
      // Find admin
      const admin = await ctx.db
        .query("adminCredentials")
        .withIndex("by_email", (q) => q.eq("email", normalizedCurrentEmail))
        .unique();
      
      if (!admin) {
        throw new ConvexError({ code: "ADMIN_NOT_FOUND", message: "Admin account not found" });
      }
      
      // Verify password
      if (!verifyPassword(password, admin.passwordHash)) {
        throw new ConvexError({ code: "INVALID_PASSWORD", message: "Password is incorrect" });
      }
      
      // Check if new email already exists
      const existingWithNewEmail = await ctx.db
        .query("adminCredentials")
        .withIndex("by_email", (q) => q.eq("email", normalizedNewEmail))
        .unique();
      
      if (existingWithNewEmail) {
        throw new ConvexError({ code: "EMAIL_EXISTS", message: "Email already in use" });
      }
      
      // Validate email format
      if (!normalizedNewEmail.includes("@") || !normalizedNewEmail.includes(".")) {
        throw new ConvexError({ code: "INVALID_EMAIL", message: "Please enter a valid email address" });
      }
      
      // Update email
      await ctx.db.patch(admin._id, {
        email: normalizedNewEmail,
        updatedAt: Date.now(),
      });
      
      // Also update profile email if exists
      const profile = await ctx.db
        .query("profiles")
        .filter((q) => q.eq(q.field("email"), normalizedCurrentEmail))
        .first();
      
      if (profile) {
        await ctx.db.patch(profile._id, { email: normalizedNewEmail });
      }
      
      // Update admin sessions email
      const sessions = await ctx.db
        .query("adminSessions")
        .withIndex("by_admin", (q) => q.eq("adminId", admin._id))
        .collect();
      
      for (const session of sessions) {
        await ctx.db.patch(session._id, { email: normalizedNewEmail });
      }
      
      console.log("[changeAdminEmail] Success:", normalizedCurrentEmail, "->", normalizedNewEmail);
      
      return { success: true };
    } catch (err) {
      if (err instanceof ConvexError) {
        throw err;
      }
      console.error("[changeAdminEmail] Unexpected error:", err);
      throw new ConvexError({ code: "UNKNOWN_ERROR", message: "An unexpected error occurred" });
    }
  },
});

// Get admin info (for settings page)
export const getAdminInfo = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("adminCredentials")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase().trim()))
      .unique();
    
    if (!admin) return null;
    
    return {
      email: admin.email,
      mustChangePassword: admin.mustChangePassword,
      lastLoginAt: admin.lastLoginAt,
      createdAt: admin.createdAt,
    };
  },
});

// Reset admin credentials (deletes existing and re-seeds with new hash format)
// Use this after migrating from bcrypt to Web Crypto API
export const resetAdminCredentials = mutation({
  args: {},
  handler: async (ctx) => {
    const DEFAULT_EMAIL = "neemar12@gmail.com";
    const DEFAULT_PASSWORD = "123456789";
    
    // Delete existing admin if exists
    const existing = await ctx.db
      .query("adminCredentials")
      .withIndex("by_email", (q) => q.eq("email", DEFAULT_EMAIL))
      .unique();
    
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    
    // Create admin credentials with new hash format
    const passwordHash = simpleHash(DEFAULT_PASSWORD);
    await ctx.db.insert("adminCredentials", {
      email: DEFAULT_EMAIL.toLowerCase(),
      passwordHash,
      mustChangePassword: true,
      failedAttempts: 0,
      createdAt: Date.now(),
    });
    
    return { success: true, message: "Admin credentials reset with new hash format" };
  },
});

// Skip password change requirement (for initial setup/testing)
export const skipPasswordChange = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("adminCredentials")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase().trim()))
      .unique();
    
    if (!admin) {
      throw new Error("Admin not found");
    }
    
    await ctx.db.patch(admin._id, {
      mustChangePassword: false,
      updatedAt: Date.now(),
    });
    
    return { success: true };
  },
});

// Ensure admin exists in Convex Auth system with admin profile
// This should be called once to set up the admin user
export const ensureAdminUser = mutation({
  args: {},
  handler: async (ctx) => {
    const DEFAULT_EMAIL = "neemar12@gmail.com";
    
    // Check if admin profile exists
    const existingProfile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("email"), DEFAULT_EMAIL))
      .first();
    
    if (existingProfile) {
      // Update to admin role if not already
      if (existingProfile.role !== "admin") {
        await ctx.db.patch(existingProfile._id, { role: "admin" });
        return { success: true, message: "Updated existing profile to admin", profileId: existingProfile._id };
      }
      return { success: true, message: "Admin profile already exists", profileId: existingProfile._id };
    }
    
    // No profile exists - we need to create one
    // But we need a userId from Convex Auth first
    // The user will need to sign up via Convex Auth, then we update their profile
    return { 
      success: false, 
      message: "Admin needs to sign up via /auth first with email " + DEFAULT_EMAIL + ", then run this again to set admin role"
    };
  },
});

// Set a user's profile to admin role (use after they sign up)
export const setAdminRole = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .filter((q) => q.eq(q.field("email"), args.email.toLowerCase().trim()))
      .first();
    
    if (!profile) {
      throw new Error("Profile not found for email: " + args.email);
    }
    
    await ctx.db.patch(profile._id, { role: "admin" });
    return { success: true, profileId: profile._id };
  },
});

// ONE-TIME force reset admin password (for production fixes)
// Uses hardcoded token - REMOVE AFTER USE
const FORCE_RESET_TOKEN = "DROPPIT_FORCE_RESET_2024_SECURE";

export const forceResetAdmin = mutation({
  args: {
    email: v.string(),
    newPassword: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const { email, newPassword, token } = args;
    
    // Validate token
    if (token !== FORCE_RESET_TOKEN) {
      throw new ConvexError("INVALID_TOKEN");
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    
    // Find or create admin
    let admin = await ctx.db
      .query("adminCredentials")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();
    
    const newHash = simpleHash(newPassword);
    
    console.log("FORCE_RESET_ADMIN", {
      email: normalizedEmail,
      hasExisting: !!admin,
      newHashLength: newHash.length,
      newHashPrefix: newHash.substring(0, 15),
    });
    
    if (admin) {
      // Update existing
      await ctx.db.patch(admin._id, {
        email: normalizedEmail,
        passwordHash: newHash,
        mustChangePassword: false,
        failedAttempts: 0,
        lockedUntil: undefined,
        updatedAt: Date.now(),
      });
    } else {
      // Create new
      await ctx.db.insert("adminCredentials", {
        email: normalizedEmail,
        passwordHash: newHash,
        mustChangePassword: false,
        failedAttempts: 0,
        createdAt: Date.now(),
      });
    }
    
    return { success: true, email: normalizedEmail };
  },
});

// Debug query to check admin state (no secrets exposed)
export const debugAdminState = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.toLowerCase().trim();
    
    const admin = await ctx.db
      .query("adminCredentials")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();
    
    if (!admin) {
      return { found: false, email: normalizedEmail };
    }
    
    return {
      found: true,
      email: admin.email,
      hasPasswordHash: !!admin.passwordHash,
      hashLength: admin.passwordHash?.length ?? 0,
      hashPrefix: admin.passwordHash?.substring(0, 15) ?? "",
      failedAttempts: admin.failedAttempts,
      isLocked: admin.lockedUntil ? admin.lockedUntil > Date.now() : false,
      mustChangePassword: admin.mustChangePassword,
      createdAt: admin.createdAt,
      lastLoginAt: admin.lastLoginAt,
    };
  },
});

// List all admins (for debugging - no password hashes exposed)
export const listAllAdmins = query({
  args: {},
  handler: async (ctx) => {
    const admins = await ctx.db.query("adminCredentials").collect();
    return admins.map(a => ({
      id: a._id,
      email: a.email,
      failedAttempts: a.failedAttempts,
      isLocked: a.lockedUntil ? a.lockedUntil > Date.now() : false,
      mustChangePassword: a.mustChangePassword,
      createdAt: a.createdAt,
    }));
  },
});

// Seed super admin with token validation (for production setup)
export const seedSuperAdmin = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    // Validate token
    const expectedToken = process.env.ADMIN_SEED_TOKEN;
    if (!expectedToken || args.token !== expectedToken) {
      throw new ConvexError("BAD_TOKEN");
    }
    
    const email = "neemar12@gmail.com";
    
    // Check if admin exists
    const existing = await ctx.db
      .query("adminCredentials")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    
    if (existing) {
      return { ok: true, created: false, message: "Admin already exists" };
    }
    
    // Get password from env
    const password = process.env.ADMIN_INITIAL_PASSWORD;
    if (!password) {
      throw new ConvexError("MISSING_PASSWORD_ENV");
    }
    
    // Hash using the existing simpleHash function
    const passwordHash = simpleHash(password);
    
    // Insert admin
    await ctx.db.insert("adminCredentials", {
      email,
      passwordHash,
      mustChangePassword: false,
      failedAttempts: 0,
      createdAt: Date.now(),
    });
    
    return { ok: true, created: true, message: "Admin created" };
  },
});

// Check if admin exists by email (with token validation)
export const adminExists = query({
  args: { 
    email: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate token
    const expectedToken = process.env.ADMIN_SEED_TOKEN;
    if (!expectedToken || args.token !== expectedToken) {
      throw new ConvexError("BAD_TOKEN");
    }
    
    const admin = await ctx.db
      .query("adminCredentials")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase().trim()))
      .unique();
    
    return { exists: !!admin };
  },
});

// =============================================================================
// BOOTSTRAP FUNCTIONS - Use these to set up admin in production
// Remove after admin is confirmed working
// =============================================================================

// Bootstrap admin - creates admin using EXACT same lookup/insert as adminLogin expects
export const bootstrapAdmin = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    // Validate token
    const expectedToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
    if (!expectedToken || args.token !== expectedToken) {
      throw new ConvexError("BAD_TOKEN");
    }
    
    const email = "neemar12@gmail.com";
    
    // Use shared helper - SAME lookup as adminLogin
    const existing = await findAdminByEmail(ctx, email);
    
    if (existing) {
      return { 
        ok: true, 
        created: false, 
        message: "Admin already exists",
        email: existing.email,
        hashLen: existing.passwordHash?.length ?? 0,
      };
    }
    
    // Get password from env
    const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
    if (!password) {
      throw new ConvexError("MISSING_PASSWORD_ENV");
    }
    
    // Hash using SAME function as adminLogin verification
    const passwordHash = simpleHash(password);
    
    // Insert into adminCredentials - SAME table/fields as adminLogin expects
    const id = await ctx.db.insert("adminCredentials", {
      email: email.toLowerCase().trim(), // Store normalized
      passwordHash,
      mustChangePassword: false,
      failedAttempts: 0,
      createdAt: Date.now(),
    });
    
    return { 
      ok: true, 
      created: true, 
      message: "Admin created",
      id: id,
      email: email.toLowerCase().trim(),
      hashLen: passwordHash.length,
    };
  },
});

// Bootstrap status - verify admin exists using EXACT same lookup as adminLogin
export const bootstrapStatus = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    // Validate token
    const expectedToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
    if (!expectedToken || args.token !== expectedToken) {
      throw new ConvexError("BAD_TOKEN");
    }
    
    const email = "neemar12@gmail.com";
    
    // Use shared helper - SAME lookup as adminLogin
    const admin = await findAdminByEmail(ctx, email);
    
    if (!admin) {
      return { 
        exists: false, 
        hashLen: 0, 
        email: null,
        table: "adminCredentials",
        lookupMethod: "findAdminByEmail (same as adminLogin)",
      };
    }
    
    return { 
      exists: true, 
      hashLen: admin.passwordHash?.length ?? 0,
      email: admin.email,
      failedAttempts: admin.failedAttempts,
      mustChangePassword: admin.mustChangePassword,
      table: "adminCredentials",
      lookupMethod: "findAdminByEmail (same as adminLogin)",
    };
  },
});

// TEMPORARY DEBUG - Check if there's a separate "admins" table
export const debugCheckAdminsTable = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const expectedToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
    if (!expectedToken || args.token !== expectedToken) {
      throw new ConvexError("BAD_TOKEN");
    }
    
    // Try to query "admins" table (might not exist)
    try {
      const adminsTable = await ctx.db.query("admins" as any).collect();
      return {
        adminsTableExists: true,
        adminsCount: adminsTable.length,
        adminsRecords: adminsTable.map((a: any) => ({
          id: a._id,
          email: a.email,
          role: a.role,
          hasPasswordHash: !!a.passwordHash,
        })),
      };
    } catch (e) {
      return {
        adminsTableExists: false,
        error: String(e),
      };
    }
  },
});

// TEMPORARY DEBUG - Check both tables side by side
export const debugCompareTables = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const expectedToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
    if (!expectedToken || args.token !== expectedToken) {
      throw new ConvexError("BAD_TOKEN");
    }
    
    const adminCredentials = await ctx.db.query("adminCredentials").collect();
    
    let adminsTable: any[] = [];
    let adminsError = null;
    try {
      adminsTable = await ctx.db.query("admins" as any).collect();
    } catch (e) {
      adminsError = String(e);
    }
    
    return {
      adminCredentials: {
        count: adminCredentials.length,
        records: adminCredentials.map(a => ({ 
          id: a._id, 
          email: a.email,
          hashLen: a.passwordHash?.length ?? 0,
        })),
      },
      admins: {
        count: adminsTable.length,
        records: adminsTable.map((a: any) => ({ 
          id: a._id, 
          email: a.email,
          role: a.role,
          hashLen: a.passwordHash?.length ?? 0,
        })),
        error: adminsError,
      },
    };
  },
});

// =============================================================================
// AUTH DIAGNOSTICS - Check auth environment configuration
// =============================================================================

export const authEnvDiagnostic = action({
  args: { token: v.string() },
  handler: async (_ctx, args) => {
    const expectedToken = process.env.ADMIN_BOOTSTRAP_TOKEN;
    if (!expectedToken || args.token !== expectedToken) {
      throw new Error("BAD_TOKEN");
    }
    
    const diagnostic = {
      // JWKS
      hasJWKS: !!process.env.JWKS,
      jwksLen: process.env.JWKS?.length ?? 0,
      jwksPrefix: process.env.JWKS?.substring(0, 20) ?? null,
      
      // JWT Private Key
      hasJwtPrivateKey: !!process.env.JWT_PRIVATE_KEY,
      jwtPrivateKeyLen: process.env.JWT_PRIVATE_KEY?.length ?? 0,
      jwtPrivateKeyPrefix: process.env.JWT_PRIVATE_KEY?.substring(0, 30) ?? null,
      
      // Site URL
      hasSiteUrl: !!process.env.SITE_URL,
      siteUrl: process.env.SITE_URL ?? null,
      
      // Convex Site URL (built-in)
      hasConvexSiteUrl: !!process.env.CONVEX_SITE_URL,
      convexSiteUrl: process.env.CONVEX_SITE_URL ?? null,
      
      // Other relevant vars
      hasConvexUrl: !!process.env.CONVEX_URL,
      convexUrl: process.env.CONVEX_URL ?? null,
    };
    
    console.log("AUTH_ENV_DIAGNOSTIC", diagnostic);
    
    // Check for missing required vars
    const missing: string[] = [];
    if (!process.env.JWKS) missing.push("JWKS");
    if (!process.env.JWT_PRIVATE_KEY) missing.push("JWT_PRIVATE_KEY");
    if (!process.env.SITE_URL) missing.push("SITE_URL");
    
    return {
      ...diagnostic,
      missingVars: missing,
      allRequiredPresent: missing.length === 0,
    };
  },
});

// =============================================================================
// TEMPORARY: Force reset admin password (REMOVE AFTER USE)
// =============================================================================
export const forceResetAdminPassword = mutation({
  args: {
    email: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = args.email.toLowerCase().trim();
    
    // Find admin in adminCredentials table
    const admin = await ctx.db
      .query("adminCredentials")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .unique();
    
    if (!admin) {
      throw new ConvexError("ADMIN_NOT_FOUND");
    }
    
    // Hash the new password using the same method as login
    const newHash = simpleHash(args.newPassword);
    
    console.log("[forceResetAdminPassword] Resetting password for:", normalizedEmail);
    console.log("[forceResetAdminPassword] New hash length:", newHash.length);
    console.log("[forceResetAdminPassword] New hash prefix:", newHash.substring(0, 15));
    
    // Update the admin record
    await ctx.db.patch(admin._id, {
      passwordHash: newHash,
      failedAttempts: 0,
      lockedUntil: undefined,
      mustChangePassword: false,
      updatedAt: Date.now(),
    });
    
    // Also delete any existing sessions to force re-login
    const sessions = await ctx.db
      .query("adminSessions")
      .withIndex("by_admin", (q) => q.eq("adminId", admin._id))
      .collect();
    
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }
    
    console.log("[forceResetAdminPassword] Password reset successful, deleted", sessions.length, "sessions");
    
    return { 
      success: true, 
      email: normalizedEmail,
      message: "Password reset. Please login with new password.",
    };
  },
});
