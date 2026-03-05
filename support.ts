import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAdmin, requireAdminStrict } from "./lib/adminAuth";

// Ticket types
export const TICKET_TYPES = [
  "app_bug",
  "cannot_find_courier",
  "courier_not_arrived",
  "wrong_package",
  "not_delivered",
  "payment_issue",
  "cancel_pickup",
  "change_address",
  "driver_behavior",
  "general_question",
] as const;

// Priority mapping
const HIGH_PRIORITY_TYPES = [
  "cannot_find_courier",
  "courier_not_arrived",
  "not_delivered",
];

const MEDIUM_PRIORITY_TYPES = [
  "app_bug",
  "payment_issue",
  "change_address",
  "wrong_package",
  "driver_behavior",
  "cancel_pickup",
];

// LOW_PRIORITY_TYPES = ["general_question"] - default

function getPriorityForType(ticketType: string): "high" | "medium" | "low" {
  if (HIGH_PRIORITY_TYPES.includes(ticketType)) return "high";
  if (MEDIUM_PRIORITY_TYPES.includes(ticketType)) return "medium";
  return "low";
}

// Create a new support ticket
export const createTicket = mutation({
  args: {
    subject: v.string(),
    firstMessage: v.string(),
    ticketType: v.string(),
    jobId: v.optional(v.id("jobs")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in to create a support ticket");
    }

    if (!args.subject.trim() || !args.firstMessage.trim()) {
      throw new Error("Subject and message are required");
    }

    // Get user's profile to determine role
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const userRole = (profile?.role === "courier" ? "courier" : "customer") as "customer" | "courier";

    // Calculate priority based on ticket type
    const priority = getPriorityForType(args.ticketType);

    // Get job snapshot if jobId provided
    let jobSnapshot = undefined;
    if (args.jobId) {
      const job = await ctx.db.get(args.jobId);
      if (job) {
        // Get courier info if assigned
        let courierName = undefined;
        let courierPhone = undefined;
        if (job.courierId) {
          const courierProfile = await ctx.db
            .query("profiles")
            .withIndex("by_user", (q) => q.eq("userId", job.courierId!))
            .unique();
          courierName = courierProfile?.name;
          courierPhone = courierProfile?.phone;
        }

        jobSnapshot = {
          pickupAddress: job.pickupAddress,
          dropoffLocationName: job.dropoffLocationName,
          courierName,
          courierPhone,
          status: job.status,
        };
      }
    }

    const now = Date.now();

    // Create ticket
    const ticketId = await ctx.db.insert("supportTickets", {
      createdByUserId: userId,
      createdByRole: userRole,
      subject: args.subject.trim(),
      status: "open",
      ticketType: args.ticketType,
      priority,
      jobId: args.jobId,
      jobSnapshot,
      createdAt: now,
      updatedAt: now,
    });

    // Add first message with detected role as senderType
    await ctx.db.insert("supportMessages", {
      ticketId,
      senderType: userRole,
      senderUserId: userId,
      body: args.firstMessage.trim(),
      createdAt: now,
    });

    // Notify admin
    await ctx.db.insert("adminNotifications", {
      type: "new_support_ticket",
      title: "New Support Ticket",
      message: `New ${userRole} ticket: ${args.subject.trim().substring(0, 50)}`,
      targetId: ticketId,
      targetType: "supportTicket",
      isRead: false,
      createdAt: now,
    });

    return { ticketId };
  },
});

// List tickets for current customer/courier
export const listMyTickets = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Get user's profile to determine role
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const isCourier = profile?.role === "courier";

    const tickets = await ctx.db
      .query("supportTickets")
      .withIndex("by_user", (q) => q.eq("createdByUserId", userId))
      .order("desc")
      .collect();

    // Get unread count for each ticket
    const ticketsWithUnread = await Promise.all(
      tickets.map(async (ticket) => {
        const messages = await ctx.db
          .query("supportMessages")
          .withIndex("by_ticket", (q) => q.eq("ticketId", ticket._id))
          .collect();
        
        // Count unread admin messages based on user role
        const unreadCount = messages.filter((m) => {
          if (m.senderType !== "admin") return false;
          return isCourier ? !m.readByCourierAt : !m.readByCustomerAt;
        }).length;

        return { ...ticket, unreadCount };
      })
    );

    return ticketsWithUnread;
  },
});

// List open tickets for admin
export const listOpenTicketsAdmin = query({
  args: {},
  handler: async (ctx) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) return [];

    const tickets = await ctx.db
      .query("supportTickets")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .collect();

    // Get customer/courier info and unread count for each ticket
    const ticketsWithDetails = await Promise.all(
      tickets.map(async (ticket) => {
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", ticket.createdByUserId))
          .unique();

        const messages = await ctx.db
          .query("supportMessages")
          .withIndex("by_ticket", (q) => q.eq("ticketId", ticket._id))
          .collect();

        // Count unread messages from both customers and couriers
        const unreadCount = messages.filter(
          (m) => (m.senderType === "customer" || m.senderType === "courier") && !m.readByAdminAt
        ).length;

        const lastMessage = messages[messages.length - 1];

        return {
          ...ticket,
          createdByRole: ticket.createdByRole,
          customerName: profile?.name || "Unknown",
          customerEmail: profile?.email || "Unknown",
          unreadCount,
          lastMessage: lastMessage?.body.substring(0, 100),
          messageCount: messages.length,
        };
      })
    );

    return ticketsWithDetails;
  },
});

// List all tickets for admin (including closed)
export const listAllTicketsAdmin = query({
  args: { status: v.optional(v.union(v.literal("open"), v.literal("closed"))) },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) return [];

    let tickets;
    if (args.status) {
      tickets = await ctx.db
        .query("supportTickets")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
    } else {
      tickets = await ctx.db
        .query("supportTickets")
        .order("desc")
        .collect();
    }

    const ticketsWithDetails = await Promise.all(
      tickets.map(async (ticket) => {
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", ticket.createdByUserId))
          .unique();

        const messages = await ctx.db
          .query("supportMessages")
          .withIndex("by_ticket", (q) => q.eq("ticketId", ticket._id))
          .collect();

        // Count unread messages from both customers and couriers
        const unreadCount = messages.filter(
          (m) => (m.senderType === "customer" || m.senderType === "courier") && !m.readByAdminAt
        ).length;

        const lastMessage = messages[messages.length - 1];

        return {
          ...ticket,
          createdByRole: ticket.createdByRole,
          customerName: profile?.name || "Unknown",
          customerEmail: profile?.email || "Unknown",
          unreadCount,
          lastMessage: lastMessage?.body.substring(0, 100),
          messageCount: messages.length,
        };
      })
    );

    return ticketsWithDetails;
  },
});

// Get messages for a ticket
export const listMessages = query({
  args: { ticketId: v.id("supportTickets") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const adminId = await requireAdmin(ctx);

    if (!userId && !adminId) {
      return [];
    }

    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) return [];

    // Customer can only access their own tickets
    if (userId && !adminId && ticket.createdByUserId !== userId) {
      return [];
    }

    const messages = await ctx.db
      .query("supportMessages")
      .withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId))
      .order("asc")
      .collect();

    return messages;
  },
});

// Send a message
export const sendMessage = mutation({
  args: {
    ticketId: v.id("supportTickets"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const adminId = await requireAdmin(ctx);

    if (!userId && !adminId) {
      throw new Error("Please sign in to send a message");
    }

    if (!args.body.trim()) {
      throw new Error("Message cannot be empty");
    }

    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) {
      throw new Error("Ticket not found");
    }

    // Customer/courier can only message their own tickets
    const isAdmin = !!adminId;
    if (!isAdmin && ticket.createdByUserId !== userId) {
      throw new Error("You cannot access this ticket");
    }

    // Determine sender type
    let senderType: "customer" | "courier" | "admin" = "customer";
    if (isAdmin) {
      senderType = "admin";
    } else if (userId) {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();

      if (profile?.role === "courier") {
        senderType = "courier";
      }
    }

    const now = Date.now();

    await ctx.db.insert("supportMessages", {
      ticketId: args.ticketId,
      senderType,
      senderUserId: isAdmin ? undefined : userId!,
      body: args.body.trim(),
      createdAt: now,
    });

    // Update ticket timestamp
    await ctx.db.patch(args.ticketId, { updatedAt: now });

    return { success: true };
  },
});

// Mark messages as read
export const markRead = mutation({
  args: {
    ticketId: v.id("supportTickets"),
    viewerType: v.union(v.literal("customer"), v.literal("courier"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const adminId = await requireAdmin(ctx);

    if (!userId && !adminId) {
      throw new Error("Please sign in");
    }

    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) return { success: false };

    // Verify access
    const isAdmin = !!adminId;
    if ((args.viewerType === "customer" || args.viewerType === "courier") && ticket.createdByUserId !== userId) {
      return { success: false };
    }
    if (args.viewerType === "admin" && !isAdmin) {
      return { success: false };
    }

    const now = Date.now();
    const messages = await ctx.db
      .query("supportMessages")
      .withIndex("by_ticket", (q) => q.eq("ticketId", args.ticketId))
      .collect();

    for (const msg of messages) {
      // Admin marks customer/courier messages as read
      if (args.viewerType === "admin" && (msg.senderType === "customer" || msg.senderType === "courier") && !msg.readByAdminAt) {
        await ctx.db.patch(msg._id, { readByAdminAt: now });
      }
      // Customer marks admin messages as read
      if (args.viewerType === "customer" && msg.senderType === "admin" && !msg.readByCustomerAt) {
        await ctx.db.patch(msg._id, { readByCustomerAt: now });
      }
      // Courier marks admin messages as read
      if (args.viewerType === "courier" && msg.senderType === "admin" && !msg.readByCourierAt) {
        await ctx.db.patch(msg._id, { readByCourierAt: now });
      }
    }

    return { success: true };
  },
});

// Close a ticket (admin only)
export const closeTicket = mutation({
  args: { ticketId: v.id("supportTickets") },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      throw new Error("Admin access required");
    }

    await ctx.db.patch(args.ticketId, {
      status: "closed",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Reopen a ticket (admin only)
export const reopenTicket = mutation({
  args: { ticketId: v.id("supportTickets") },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      throw new Error("Admin access required");
    }

    await ctx.db.patch(args.ticketId, {
      status: "open",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Get ticket by ID
export const getTicket = query({
  args: { ticketId: v.id("supportTickets") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const adminId = await requireAdmin(ctx);

    if (!userId && !adminId) return null;

    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) return null;

    // Customer can only access their own tickets
    if (userId && !adminId && ticket.createdByUserId !== userId) {
      return null;
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_user", (q) => q.eq("userId", ticket.createdByUserId))
      .unique();

    return {
      ...ticket,
      customerName: profile?.name || "Unknown",
      customerEmail: profile?.email || "Unknown",
    };
  },
});

// List tickets with filters (admin)
export const listTicketsAdmin = query({
  args: {
    status: v.optional(v.string()),
    ticketType: v.optional(v.string()),
    priority: v.optional(v.string()),
    createdByRole: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) return [];

    let tickets = await ctx.db
      .query("supportTickets")
      .order("desc")
      .collect();

    // Apply filters
    if (args.status) {
      tickets = tickets.filter(t => t.status === args.status);
    }
    if (args.ticketType) {
      tickets = tickets.filter(t => t.ticketType === args.ticketType);
    }
    if (args.priority) {
      tickets = tickets.filter(t => t.priority === args.priority);
    }
    if (args.createdByRole) {
      tickets = tickets.filter(t => t.createdByRole === args.createdByRole);
    }

    // Enrich with user info and last message
    const enriched = await Promise.all(
      tickets.map(async (ticket) => {
        const profile = await ctx.db
          .query("profiles")
          .withIndex("by_user", (q) => q.eq("userId", ticket.createdByUserId))
          .unique();

        const messages = await ctx.db
          .query("supportMessages")
          .withIndex("by_ticket", (q) => q.eq("ticketId", ticket._id))
          .order("desc")
          .take(1);

        const lastMessage = messages[0];

        // Count unread admin messages (from both customers and couriers)
        const allMessages = await ctx.db
          .query("supportMessages")
          .withIndex("by_ticket", (q) => q.eq("ticketId", ticket._id))
          .collect();
        const adminUnread = allMessages.filter(
          m => (m.senderType === "customer" || m.senderType === "courier") && !m.readByAdminAt
        ).length;

        return {
          ...ticket,
          createdByRole: ticket.createdByRole,
          customerName: profile?.name || "Unknown",
          customerEmail: profile?.email,
          lastMessage: lastMessage?.body?.slice(0, 100),
          lastMessageAt: lastMessage?.createdAt,
          adminUnread,
        };
      })
    );

    return enriched;
  },
});

// Update ticket status (admin)
export const updateTicketStatus = mutation({
  args: {
    ticketId: v.id("supportTickets"),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("resolved"), v.literal("closed")),
  },
  handler: async (ctx, args) => {
    await requireAdminStrict(ctx);

    await ctx.db.patch(args.ticketId, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return args.ticketId;
  },
});

// Update ticket priority (admin)
export const updateTicketPriority = mutation({
  args: {
    ticketId: v.id("supportTickets"),
    priority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
  },
  handler: async (ctx, args) => {
    await requireAdminStrict(ctx);

    await ctx.db.patch(args.ticketId, {
      priority: args.priority,
      updatedAt: Date.now(),
    });

    return args.ticketId;
  },
});

// Get ticket stats for dashboard
export const getTicketStats = query({
  args: {},
  handler: async (ctx) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) return null;

    const tickets = await ctx.db.query("supportTickets").collect();

    return {
      total: tickets.length,
      open: tickets.filter(t => t.status === "open").length,
      inProgress: tickets.filter(t => t.status === "in_progress").length,
      resolved: tickets.filter(t => t.status === "resolved").length,
      // Handle undefined priority for backward compatibility
      highPriority: tickets.filter(t => t.priority === "high" && t.status !== "resolved" && t.status !== "closed").length,
    };
  },
});
