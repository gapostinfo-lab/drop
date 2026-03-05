import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireAdminStrict } from "./lib/adminAuth";
import { internal } from "./_generated/api";

// Location type validator (reusable)
const locationTypeValidator = v.union(
  v.literal("ups"),
  v.literal("fedex"),
  v.literal("usps"),
  v.literal("dhl"),
  v.literal("amazon_hub"),
  v.literal("amazon_locker"),
  v.literal("amazon_counter"),
  v.literal("amazon_wholefoods"),
  v.literal("amazon_kohls"),
  // Legacy types - kept for backwards compatibility with existing data
  v.literal("staples"),
  v.literal("amazon_staples"),
  v.literal("other")
);

// Haversine distance calculation (returns miles)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // Round to 1 decimal
}

// Get all active hub locations
export const listActiveLocations = query({
  args: {
    type: v.optional(locationTypeValidator),
  },
  handler: async (ctx, args) => {
    if (args.type) {
      return await ctx.db
        .query("hubLocations")
        .withIndex("by_type", (q) => q.eq("type", args.type!).eq("isActive", true))
        .collect();
    }
    return await ctx.db
      .query("hubLocations")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
  },
});

// Get locations by ZIP code
export const getLocationsByZip = query({
  args: { zipCode: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("hubLocations")
      .withIndex("by_zip", (q) => q.eq("zipCode", args.zipCode).eq("isActive", true))
      .collect();
  },
});

// Get locations by city
export const getLocationsByCity = query({
  args: { city: v.string() },
  handler: async (ctx, args) => {
    const cityLower = args.city.toLowerCase();
    const allActive = await ctx.db
      .query("hubLocations")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    
    return allActive.filter(loc => loc.city.toLowerCase().includes(cityLower));
  },
});

// Get locations by state (for regional filtering)
export const getLocationsByState = query({
  args: { state: v.string() },
  handler: async (ctx, args) => {
    const allActive = await ctx.db
      .query("hubLocations")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    
    return allActive
      .filter(loc => loc.state.toUpperCase() === args.state.toUpperCase())
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  },
});

// Get nearby locations with distance calculation
export const getNearbyLocations = query({
  args: {
    latitude: v.number(),
    longitude: v.number(),
    type: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let locations = await ctx.db
      .query("hubLocations")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();

    // Filter by type if specified
    if (args.type) {
      locations = locations.filter(loc => loc.type === args.type);
    }

    // Filter to only locations with coordinates and calculate distance
    const withDistance = locations
      .filter(loc => loc.latitude !== undefined && loc.longitude !== undefined)
      .map(loc => {
        const distance = calculateDistance(
          args.latitude,
          args.longitude,
          loc.latitude!,
          loc.longitude!
        );
        return { ...loc, distance };
      });

    // Sort by distance
    withDistance.sort((a, b) => a.distance - b.distance);

    // Return limited results
    return withDistance.slice(0, args.limit ?? 10);
  },
});

// Get single location by ID
export const getLocationById = query({
  args: { locationId: v.id("hubLocations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.locationId);
  },
});

// Admin: List all locations (including inactive)
export const listAllLocations = query({
  args: {},
  handler: async (ctx) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      return [];
    }
    return await ctx.db.query("hubLocations").order("desc").collect();
  },
});

// Admin: Create a hub location
export const createLocation = mutation({
  args: {
    name: v.string(),
    type: locationTypeValidator,
    address: v.string(),
    address2: v.optional(v.string()),
    city: v.string(),
    state: v.string(),
    zipCode: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    hours: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdminStrict(ctx);

    const locationId = await ctx.db.insert("hubLocations", {
      ...args,
      isActive: true,
      createdAt: Date.now(),
    });

    // Log admin action
    await ctx.scheduler.runAfter(0, internal.adminLogs.logAdminAction, {
      adminId,
      action: "hub_location_created",
      targetType: "hubLocation",
      targetId: locationId,
      details: { name: args.name, type: args.type },
    });

    return locationId;
  },
});

// Admin: Update a hub location
export const updateLocation = mutation({
  args: {
    locationId: v.id("hubLocations"),
    name: v.optional(v.string()),
    type: v.optional(locationTypeValidator),
    address: v.optional(v.string()),
    address2: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    hours: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdminStrict(ctx);

    const location = await ctx.db.get(args.locationId);
    if (!location) throw new Error("Location not found");

    const { locationId, ...updates } = args;
    await ctx.db.patch(locationId, {
      ...updates,
      updatedAt: Date.now(),
    });

    // Log admin action
    await ctx.scheduler.runAfter(0, internal.adminLogs.logAdminAction, {
      adminId,
      action: "hub_location_updated",
      targetType: "hubLocation",
      targetId: locationId,
      details: updates,
    });

    return locationId;
  },
});

// Admin: Delete a hub location
export const deleteLocation = mutation({
  args: { locationId: v.id("hubLocations") },
  handler: async (ctx, args) => {
    const adminId = await requireAdminStrict(ctx);

    const location = await ctx.db.get(args.locationId);
    if (!location) throw new Error("Location not found");

    await ctx.db.delete(args.locationId);

    // Log admin action
    await ctx.scheduler.runAfter(0, internal.adminLogs.logAdminAction, {
      adminId,
      action: "hub_location_deleted",
      targetType: "hubLocation",
      targetId: args.locationId,
      details: { name: location.name },
    });
  },
});

// Admin: Get analytics by drop-off type
export const getDropoffAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const adminId = await requireAdmin(ctx);
    if (!adminId) {
      return { byDropoffType: {}, byServiceType: { amazon_return: 0, carrier_dropoff: 0 } };
    }

    const allJobs = await ctx.db.query("jobs").collect();
    const completedJobs = allJobs.filter(j => j.status === "completed");

    const analytics: Record<string, { count: number; revenue: number }> = {
      ups: { count: 0, revenue: 0 },
      fedex: { count: 0, revenue: 0 },
      usps: { count: 0, revenue: 0 },
      dhl: { count: 0, revenue: 0 },
      amazon_hub: { count: 0, revenue: 0 },
      amazon_locker: { count: 0, revenue: 0 },
      amazon_counter: { count: 0, revenue: 0 },
      amazon_wholefoods: { count: 0, revenue: 0 },
      amazon_kohls: { count: 0, revenue: 0 },
      other: { count: 0, revenue: 0 },
    };

    for (const job of completedJobs) {
      const type = job.dropoffLocationType || job.carrier?.toLowerCase() || "other";
      if (analytics[type]) {
        analytics[type].count++;
        analytics[type].revenue += job.totalPrice;
      }
    }

    // Also count by service type
    const serviceTypeAnalytics = {
      amazon_return: completedJobs.filter(j => j.serviceType === "amazon_return").length,
      carrier_dropoff: completedJobs.filter(j => j.serviceType === "carrier_dropoff" || !j.serviceType).length,
    };

    return { byDropoffType: analytics, byServiceType: serviceTypeAnalytics };
  },
});

// Seed sample locations for launch city
export const seedSampleLocations = mutation({
  args: {},
  handler: async (ctx) => {
    const adminId = await requireAdminStrict(ctx);

    // Check if locations already exist
    const existing = await ctx.db.query("hubLocations").first();
    if (existing) {
      throw new Error("Locations already exist. Delete them first to reseed.");
    }

    const sampleLocations = [
      // ============================================
      // NEW YORK CITY (10 locations)
      // ============================================
      
      // NYC - UPS Stores (3)
      {
        name: "The UPS Store #4521",
        type: "ups" as const,
        address: "350 5th Avenue",
        city: "New York",
        state: "NY",
        zipCode: "10118",
        latitude: 40.7484,
        longitude: -73.9857,
        hours: "Mon-Fri 8am-7pm, Sat 9am-5pm",
        phone: "(212) 555-0101",
      },
      {
        name: "The UPS Store #3892",
        type: "ups" as const,
        address: "1412 Broadway",
        city: "New York",
        state: "NY",
        zipCode: "10018",
        latitude: 40.7537,
        longitude: -73.9871,
        hours: "Mon-Fri 8am-8pm, Sat-Sun 10am-4pm",
        phone: "(212) 555-0102",
      },
      {
        name: "The UPS Store #6104",
        type: "ups" as const,
        address: "187 Montague Street",
        city: "Brooklyn",
        state: "NY",
        zipCode: "11201",
        latitude: 40.6934,
        longitude: -73.9903,
        hours: "Mon-Fri 8am-7pm, Sat 9am-5pm",
        phone: "(718) 555-0103",
      },
      
      // NYC - FedEx (2)
      {
        name: "FedEx Office Print & Ship Center",
        type: "fedex" as const,
        address: "245 Park Avenue",
        city: "New York",
        state: "NY",
        zipCode: "10167",
        latitude: 40.7549,
        longitude: -73.9724,
        hours: "Mon-Fri 7am-9pm, Sat-Sun 9am-6pm",
        phone: "(212) 555-0201",
      },
      {
        name: "FedEx Ship Center",
        type: "fedex" as const,
        address: "37-11 35th Avenue",
        city: "Queens",
        state: "NY",
        zipCode: "11101",
        latitude: 40.7562,
        longitude: -73.9284,
        hours: "Mon-Fri 8am-8pm, Sat 9am-5pm",
        phone: "(718) 555-0202",
      },
      
      // NYC - Amazon (3)
      {
        name: "Amazon Hub Locker - Whole Foods Chelsea",
        type: "amazon_locker" as const,
        address: "250 7th Avenue",
        city: "New York",
        state: "NY",
        zipCode: "10001",
        latitude: 40.7448,
        longitude: -73.9945,
        hours: "6am-10pm Daily",
      },
      {
        name: "Amazon Hub Counter - Rite Aid Midtown",
        type: "amazon_counter" as const,
        address: "408 8th Avenue",
        city: "New York",
        state: "NY",
        zipCode: "10001",
        latitude: 40.7507,
        longitude: -73.9946,
        hours: "7am-10pm Daily",
        phone: "(212) 555-0401",
      },
      {
        name: "Amazon Hub - Kohl's Downtown Brooklyn",
        type: "amazon_hub" as const,
        address: "139 Flatbush Avenue",
        city: "Brooklyn",
        state: "NY",
        zipCode: "11217",
        latitude: 40.6839,
        longitude: -73.9770,
        hours: "Mon-Sat 9am-9pm, Sun 10am-8pm",
        phone: "(718) 555-0501",
      },
      
      // ============================================
      // ATLANTA (8 locations)
      // ============================================
      
      // Atlanta - UPS Stores (2)
      {
        name: "The UPS Store #2847",
        type: "ups" as const,
        address: "1100 Peachtree Street NE",
        city: "Atlanta",
        state: "GA",
        zipCode: "30309",
        latitude: 33.7866,
        longitude: -84.3853,
        hours: "Mon-Fri 8am-7pm, Sat 9am-5pm",
        phone: "(404) 555-0104",
      },
      {
        name: "The UPS Store #3156",
        type: "ups" as const,
        address: "3655 Roswell Road NE",
        city: "Atlanta",
        state: "GA",
        zipCode: "30342",
        latitude: 33.8521,
        longitude: -84.3627,
        hours: "Mon-Fri 8am-7pm, Sat 9am-4pm",
        phone: "(404) 555-0105",
      },
      
      // Atlanta - FedEx (2)
      {
        name: "FedEx Office Print & Ship Center",
        type: "fedex" as const,
        address: "817 West Peachtree Street NW",
        city: "Atlanta",
        state: "GA",
        zipCode: "30308",
        latitude: 33.7742,
        longitude: -84.3880,
        hours: "Mon-Fri 7am-9pm, Sat-Sun 9am-6pm",
        phone: "(404) 555-0203",
      },
      {
        name: "FedEx Ship Center",
        type: "fedex" as const,
        address: "2581 Piedmont Road NE",
        city: "Atlanta",
        state: "GA",
        zipCode: "30324",
        latitude: 33.8198,
        longitude: -84.3621,
        hours: "Mon-Fri 8am-8pm, Sat 9am-5pm",
        phone: "(404) 555-0204",
      },
      
      // Atlanta - Amazon (3)
      {
        name: "Amazon Hub - Kohl's Buckhead",
        type: "amazon_hub" as const,
        address: "3330 Piedmont Road NE",
        city: "Atlanta",
        state: "GA",
        zipCode: "30305",
        latitude: 33.8456,
        longitude: -84.3712,
        hours: "Mon-Sat 9am-9pm, Sun 10am-8pm",
        phone: "(404) 555-0502",
      },
      {
        name: "Amazon Hub Locker - Whole Foods Midtown",
        type: "amazon_locker" as const,
        address: "650 Ponce De Leon Avenue NE",
        city: "Atlanta",
        state: "GA",
        zipCode: "30308",
        latitude: 33.7729,
        longitude: -84.3656,
        hours: "6am-10pm Daily",
      },
      {
        name: "Amazon Hub Counter - CVS Decatur",
        type: "amazon_counter" as const,
        address: "125 E Ponce De Leon Avenue",
        city: "Decatur",
        state: "GA",
        zipCode: "30030",
        latitude: 33.7748,
        longitude: -84.2963,
        hours: "7am-10pm Daily",
        phone: "(404) 555-0402",
      },
      
      // ============================================
      // LOS ANGELES (8 locations)
      // ============================================
      
      // LA - UPS Stores (2)
      {
        name: "The UPS Store #7234",
        type: "ups" as const,
        address: "523 West 6th Street",
        city: "Los Angeles",
        state: "CA",
        zipCode: "90014",
        latitude: 34.0478,
        longitude: -118.2541,
        hours: "Mon-Fri 8am-7pm, Sat 9am-5pm",
        phone: "(213) 555-0106",
      },
      {
        name: "The UPS Store #8912",
        type: "ups" as const,
        address: "1318 2nd Street",
        city: "Santa Monica",
        state: "CA",
        zipCode: "90401",
        latitude: 34.0152,
        longitude: -118.4961,
        hours: "Mon-Fri 8am-7pm, Sat 9am-5pm",
        phone: "(310) 555-0107",
      },
      
      // LA - FedEx (2)
      {
        name: "FedEx Office Print & Ship Center",
        type: "fedex" as const,
        address: "6922 Hollywood Boulevard",
        city: "Los Angeles",
        state: "CA",
        zipCode: "90028",
        latitude: 34.1017,
        longitude: -118.3354,
        hours: "Mon-Fri 7am-9pm, Sat-Sun 9am-6pm",
        phone: "(323) 555-0205",
      },
      {
        name: "FedEx Ship Center",
        type: "fedex" as const,
        address: "1453 4th Street",
        city: "Santa Monica",
        state: "CA",
        zipCode: "90401",
        latitude: 34.0168,
        longitude: -118.4943,
        hours: "Mon-Fri 8am-8pm, Sat 9am-5pm",
        phone: "(310) 555-0206",
      },
      
      // LA - Amazon (3)
      {
        name: "Amazon Hub - Kohl's Downtown LA",
        type: "amazon_hub" as const,
        address: "735 South Figueroa Street",
        city: "Los Angeles",
        state: "CA",
        zipCode: "90017",
        latitude: 34.0489,
        longitude: -118.2598,
        hours: "Mon-Sat 9am-9pm, Sun 10am-8pm",
        phone: "(213) 555-0503",
      },
      {
        name: "Amazon Hub Locker - Whole Foods Santa Monica",
        type: "amazon_locker" as const,
        address: "2201 Wilshire Boulevard",
        city: "Santa Monica",
        state: "CA",
        zipCode: "90403",
        latitude: 34.0293,
        longitude: -118.4812,
        hours: "6am-10pm Daily",
      },
      {
        name: "Amazon Hub Counter - Rite Aid Hollywood",
        type: "amazon_counter" as const,
        address: "6150 Sunset Boulevard",
        city: "Los Angeles",
        state: "CA",
        zipCode: "90028",
        latitude: 34.0978,
        longitude: -118.3267,
        hours: "7am-10pm Daily",
        phone: "(323) 555-0403",
      },
    ];

    for (const loc of sampleLocations) {
      await ctx.db.insert("hubLocations", {
        ...loc,
        isActive: true,
        createdAt: Date.now(),
      });
    }

    // Log admin action
    await ctx.scheduler.runAfter(0, internal.adminLogs.logAdminAction, {
      adminId,
      action: "hub_locations_seeded",
      targetType: "hubLocation",
      targetId: "batch",
      details: { count: sampleLocations.length },
    });

    return sampleLocations.length;
  },
});

// Public seed mutation for development/testing (no admin auth required)
export const seedLocationsPublic = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if locations already exist - return early with message (no error)
    const existing = await ctx.db.query("hubLocations").first();
    if (existing) {
      return { success: false, message: "Locations already exist", count: 0 };
    }

    const sampleLocations = [
      // ============================================
      // NEW YORK CITY (10 locations)
      // ============================================
      
      // NYC - UPS Stores (3)
      {
        name: "The UPS Store #4521",
        type: "ups" as const,
        address: "350 5th Avenue",
        city: "New York",
        state: "NY",
        zipCode: "10118",
        latitude: 40.7484,
        longitude: -73.9857,
        hours: "Mon-Fri 8am-7pm, Sat 9am-5pm",
        phone: "(212) 555-0101",
      },
      {
        name: "The UPS Store #3892",
        type: "ups" as const,
        address: "1412 Broadway",
        city: "New York",
        state: "NY",
        zipCode: "10018",
        latitude: 40.7537,
        longitude: -73.9871,
        hours: "Mon-Fri 8am-8pm, Sat-Sun 10am-4pm",
        phone: "(212) 555-0102",
      },
      {
        name: "The UPS Store #6104",
        type: "ups" as const,
        address: "187 Montague Street",
        city: "Brooklyn",
        state: "NY",
        zipCode: "11201",
        latitude: 40.6934,
        longitude: -73.9903,
        hours: "Mon-Fri 8am-7pm, Sat 9am-5pm",
        phone: "(718) 555-0103",
      },
      
      // NYC - FedEx (2)
      {
        name: "FedEx Office Print & Ship Center",
        type: "fedex" as const,
        address: "245 Park Avenue",
        city: "New York",
        state: "NY",
        zipCode: "10167",
        latitude: 40.7549,
        longitude: -73.9724,
        hours: "Mon-Fri 7am-9pm, Sat-Sun 9am-6pm",
        phone: "(212) 555-0201",
      },
      {
        name: "FedEx Ship Center",
        type: "fedex" as const,
        address: "37-11 35th Avenue",
        city: "Queens",
        state: "NY",
        zipCode: "11101",
        latitude: 40.7562,
        longitude: -73.9284,
        hours: "Mon-Fri 8am-8pm, Sat 9am-5pm",
        phone: "(718) 555-0202",
      },
      
      // NYC - Amazon (3)
      {
        name: "Amazon Hub Locker - Whole Foods Chelsea",
        type: "amazon_locker" as const,
        address: "250 7th Avenue",
        city: "New York",
        state: "NY",
        zipCode: "10001",
        latitude: 40.7448,
        longitude: -73.9945,
        hours: "6am-10pm Daily",
      },
      {
        name: "Amazon Hub Counter - Rite Aid Midtown",
        type: "amazon_counter" as const,
        address: "408 8th Avenue",
        city: "New York",
        state: "NY",
        zipCode: "10001",
        latitude: 40.7507,
        longitude: -73.9946,
        hours: "7am-10pm Daily",
        phone: "(212) 555-0401",
      },
      {
        name: "Amazon Hub - Kohl's Downtown Brooklyn",
        type: "amazon_hub" as const,
        address: "139 Flatbush Avenue",
        city: "Brooklyn",
        state: "NY",
        zipCode: "11217",
        latitude: 40.6839,
        longitude: -73.9770,
        hours: "Mon-Sat 9am-9pm, Sun 10am-8pm",
        phone: "(718) 555-0501",
      },
      
      // ============================================
      // ATLANTA (8 locations)
      // ============================================
      
      // Atlanta - UPS Stores (2)
      {
        name: "The UPS Store #2847",
        type: "ups" as const,
        address: "1100 Peachtree Street NE",
        city: "Atlanta",
        state: "GA",
        zipCode: "30309",
        latitude: 33.7866,
        longitude: -84.3853,
        hours: "Mon-Fri 8am-7pm, Sat 9am-5pm",
        phone: "(404) 555-0104",
      },
      {
        name: "The UPS Store #3156",
        type: "ups" as const,
        address: "3655 Roswell Road NE",
        city: "Atlanta",
        state: "GA",
        zipCode: "30342",
        latitude: 33.8521,
        longitude: -84.3627,
        hours: "Mon-Fri 8am-7pm, Sat 9am-4pm",
        phone: "(404) 555-0105",
      },
      
      // Atlanta - FedEx (2)
      {
        name: "FedEx Office Print & Ship Center",
        type: "fedex" as const,
        address: "817 West Peachtree Street NW",
        city: "Atlanta",
        state: "GA",
        zipCode: "30308",
        latitude: 33.7742,
        longitude: -84.3880,
        hours: "Mon-Fri 7am-9pm, Sat-Sun 9am-6pm",
        phone: "(404) 555-0203",
      },
      {
        name: "FedEx Ship Center",
        type: "fedex" as const,
        address: "2581 Piedmont Road NE",
        city: "Atlanta",
        state: "GA",
        zipCode: "30324",
        latitude: 33.8198,
        longitude: -84.3621,
        hours: "Mon-Fri 8am-8pm, Sat 9am-5pm",
        phone: "(404) 555-0204",
      },
      
      // Atlanta - Amazon (3)
      {
        name: "Amazon Hub - Kohl's Buckhead",
        type: "amazon_hub" as const,
        address: "3330 Piedmont Road NE",
        city: "Atlanta",
        state: "GA",
        zipCode: "30305",
        latitude: 33.8456,
        longitude: -84.3712,
        hours: "Mon-Sat 9am-9pm, Sun 10am-8pm",
        phone: "(404) 555-0502",
      },
      {
        name: "Amazon Hub Locker - Whole Foods Midtown",
        type: "amazon_locker" as const,
        address: "650 Ponce De Leon Avenue NE",
        city: "Atlanta",
        state: "GA",
        zipCode: "30308",
        latitude: 33.7729,
        longitude: -84.3656,
        hours: "6am-10pm Daily",
      },
      {
        name: "Amazon Hub Counter - CVS Decatur",
        type: "amazon_counter" as const,
        address: "125 E Ponce De Leon Avenue",
        city: "Decatur",
        state: "GA",
        zipCode: "30030",
        latitude: 33.7748,
        longitude: -84.2963,
        hours: "7am-10pm Daily",
        phone: "(404) 555-0402",
      },
      
      // ============================================
      // LOS ANGELES (8 locations)
      // ============================================
      
      // LA - UPS Stores (2)
      {
        name: "The UPS Store #7234",
        type: "ups" as const,
        address: "523 West 6th Street",
        city: "Los Angeles",
        state: "CA",
        zipCode: "90014",
        latitude: 34.0478,
        longitude: -118.2541,
        hours: "Mon-Fri 8am-7pm, Sat 9am-5pm",
        phone: "(213) 555-0106",
      },
      {
        name: "The UPS Store #8912",
        type: "ups" as const,
        address: "1318 2nd Street",
        city: "Santa Monica",
        state: "CA",
        zipCode: "90401",
        latitude: 34.0152,
        longitude: -118.4961,
        hours: "Mon-Fri 8am-7pm, Sat 9am-5pm",
        phone: "(310) 555-0107",
      },
      
      // LA - FedEx (2)
      {
        name: "FedEx Office Print & Ship Center",
        type: "fedex" as const,
        address: "6922 Hollywood Boulevard",
        city: "Los Angeles",
        state: "CA",
        zipCode: "90028",
        latitude: 34.1017,
        longitude: -118.3354,
        hours: "Mon-Fri 7am-9pm, Sat-Sun 9am-6pm",
        phone: "(323) 555-0205",
      },
      {
        name: "FedEx Ship Center",
        type: "fedex" as const,
        address: "1453 4th Street",
        city: "Santa Monica",
        state: "CA",
        zipCode: "90401",
        latitude: 34.0168,
        longitude: -118.4943,
        hours: "Mon-Fri 8am-8pm, Sat 9am-5pm",
        phone: "(310) 555-0206",
      },
      
      // LA - Amazon (3)
      {
        name: "Amazon Hub - Kohl's Downtown LA",
        type: "amazon_hub" as const,
        address: "735 South Figueroa Street",
        city: "Los Angeles",
        state: "CA",
        zipCode: "90017",
        latitude: 34.0489,
        longitude: -118.2598,
        hours: "Mon-Sat 9am-9pm, Sun 10am-8pm",
        phone: "(213) 555-0503",
      },
      {
        name: "Amazon Hub Locker - Whole Foods Santa Monica",
        type: "amazon_locker" as const,
        address: "2201 Wilshire Boulevard",
        city: "Santa Monica",
        state: "CA",
        zipCode: "90403",
        latitude: 34.0293,
        longitude: -118.4812,
        hours: "6am-10pm Daily",
      },
      {
        name: "Amazon Hub Counter - Rite Aid Hollywood",
        type: "amazon_counter" as const,
        address: "6150 Sunset Boulevard",
        city: "Los Angeles",
        state: "CA",
        zipCode: "90028",
        latitude: 34.0978,
        longitude: -118.3267,
        hours: "7am-10pm Daily",
        phone: "(323) 555-0403",
      },
    ];

    for (const loc of sampleLocations) {
      await ctx.db.insert("hubLocations", {
        ...loc,
        isActive: true,
        createdAt: Date.now(),
      });
    }

    return { success: true, message: "Locations seeded successfully", count: sampleLocations.length };
  },
});

// Seed Atlanta Amazon Return Hubs (Whole Foods, Kohl's, Staples)
export const seedAtlantaReturnHubs = mutation({
  args: {},
  handler: async (ctx) => {
    // This is a public seed for development - no admin auth required
    
    const atlantaHubs = [
      // ============================================
      // WHOLE FOODS (Amazon Returns - QR code, no box needed)
      // ============================================
      {
        name: "Whole Foods Market – Midtown Atlanta",
        type: "amazon_wholefoods" as const,
        address: "22 14th St NW",
        city: "Atlanta",
        state: "GA",
        zipCode: "30309",
        latitude: 33.7866,
        longitude: -84.3953,
        hours: "7am-10pm Daily",
        notes: "Amazon Returns (no box/label needed; QR code)",
        sortOrder: 1,
      },
      {
        name: "Whole Foods Market – Ponce de Leon",
        type: "amazon_wholefoods" as const,
        address: "650 Ponce de Leon Ave NE",
        city: "Atlanta",
        state: "GA",
        zipCode: "30308",
        latitude: 33.7729,
        longitude: -84.3656,
        hours: "7am-10pm Daily",
        notes: "Amazon Returns (no box/label needed; QR code)",
        sortOrder: 2,
      },
      {
        name: "Whole Foods Market – Buckhead",
        type: "amazon_wholefoods" as const,
        address: "77 West Paces Ferry Rd NW",
        city: "Atlanta",
        state: "GA",
        zipCode: "30305",
        latitude: 33.8412,
        longitude: -84.3802,
        hours: "7am-10pm Daily",
        notes: "Amazon Returns (no box/label needed; QR code)",
        sortOrder: 3,
      },
      {
        name: "Whole Foods Market – Northside Buckhead",
        type: "amazon_wholefoods" as const,
        address: "3535 Northside Pkwy",
        city: "Atlanta",
        state: "GA",
        zipCode: "30327",
        latitude: 33.8589,
        longitude: -84.4178,
        hours: "7am-10pm Daily",
        notes: "Amazon Returns (no box/label needed; QR code)",
        sortOrder: 4,
      },
      {
        name: "Whole Foods Market – Chamblee",
        type: "amazon_wholefoods" as const,
        address: "5001 Peachtree Blvd Bldg 300",
        city: "Chamblee",
        state: "GA",
        zipCode: "30341",
        latitude: 33.8912,
        longitude: -84.3123,
        hours: "7am-10pm Daily",
        notes: "Amazon Returns (no box/label needed; QR code)",
        sortOrder: 5,
      },
      
      // ============================================
      // KOHL'S (Amazon Returns Outpost)
      // ============================================
      {
        name: "Kohl's – Austell",
        type: "amazon_kohls" as const,
        address: "1825 East-West Connector",
        city: "Austell",
        state: "GA",
        zipCode: "30106",
        latitude: 33.8167,
        longitude: -84.6342,
        hours: "Mon-Sat 9am-9pm, Sun 10am-8pm",
        notes: "Amazon Returns Outpost (QR code)",
        sortOrder: 10,
      },
      {
        name: "Kohl's – Stockbridge",
        type: "amazon_kohls" as const,
        address: "5005 Mt Zion Pkwy",
        city: "Stockbridge",
        state: "GA",
        zipCode: "30281",
        latitude: 33.5412,
        longitude: -84.2312,
        hours: "Mon-Sat 9am-9pm, Sun 10am-8pm",
        notes: "Amazon Returns Outpost (QR code)",
        sortOrder: 11,
      },
      
    ];

    let insertedCount = 0;
    
    for (const hub of atlantaHubs) {
      // Check if this hub already exists (by name and address)
      const existing = await ctx.db
        .query("hubLocations")
        .filter((q) => 
          q.and(
            q.eq(q.field("name"), hub.name),
            q.eq(q.field("address"), hub.address)
          )
        )
        .first();
      
      if (!existing) {
        await ctx.db.insert("hubLocations", {
          ...hub,
          isActive: true,
          createdAt: Date.now(),
        });
        insertedCount++;
      }
    }

    return { 
      success: true, 
      message: `Seeded ${insertedCount} new Atlanta return hubs (${atlantaHubs.length - insertedCount} already existed)`,
      count: insertedCount,
      total: atlantaHubs.length,
    };
  },
});

// Seed Atlanta UPS, FedEx, Staples carrier drop-off locations
export const seedAtlantaCarrierLocations = mutation({
  args: {},
  handler: async (ctx) => {
    // Public seed for development - no admin auth required
    
    const atlantaCarrierHubs = [
      // ============================================
      // UPS LOCATIONS (Atlanta area)
      // ============================================
      {
        name: "UPS Store – Midtown",
        type: "ups" as const,
        address: "750 Ponce De Leon Pl NE",
        city: "Atlanta",
        state: "GA",
        zipCode: "30306",
        latitude: 33.7748,
        longitude: -84.3656,
        hours: "Mon-Fri 8am-7pm, Sat 9am-5pm",
        sortOrder: 1,
      },
      {
        name: "UPS Store – Buckhead",
        type: "ups" as const,
        address: "3655 Roswell Rd NE",
        city: "Atlanta",
        state: "GA",
        zipCode: "30342",
        latitude: 33.8521,
        longitude: -84.3627,
        hours: "Mon-Fri 8am-7pm, Sat 9am-4pm",
        sortOrder: 2,
      },
      {
        name: "UPS Store – Downtown",
        type: "ups" as const,
        address: "260 Peachtree St NW",
        city: "Atlanta",
        state: "GA",
        zipCode: "30303",
        latitude: 33.7590,
        longitude: -84.3880,
        hours: "Mon-Fri 8am-7pm, Sat 9am-5pm",
        sortOrder: 3,
      },
      {
        name: "UPS Customer Center",
        type: "ups" as const,
        address: "2910 Northeast Pkwy",
        city: "Atlanta",
        state: "GA",
        zipCode: "30360",
        latitude: 33.9312,
        longitude: -84.2890,
        hours: "Mon-Fri 8am-8pm",
        sortOrder: 4,
      },
      
      // ============================================
      // FEDEX LOCATIONS (Atlanta area)
      // ============================================
      {
        name: "FedEx Office – Midtown",
        type: "fedex" as const,
        address: "595 Piedmont Ave NE",
        city: "Atlanta",
        state: "GA",
        zipCode: "30308",
        latitude: 33.7710,
        longitude: -84.3830,
        hours: "Mon-Fri 7am-9pm, Sat-Sun 9am-6pm",
        sortOrder: 10,
      },
      {
        name: "FedEx Office – Buckhead",
        type: "fedex" as const,
        address: "3330 Piedmont Rd NE",
        city: "Atlanta",
        state: "GA",
        zipCode: "30305",
        latitude: 33.8456,
        longitude: -84.3712,
        hours: "Mon-Fri 7am-9pm, Sat-Sun 9am-6pm",
        sortOrder: 11,
      },
      {
        name: "FedEx Ship Center",
        type: "fedex" as const,
        address: "4400 International Pkwy",
        city: "Atlanta",
        state: "GA",
        zipCode: "30354",
        latitude: 33.6412,
        longitude: -84.4312,
        hours: "Mon-Fri 8am-8pm, Sat 9am-5pm",
        sortOrder: 12,
      },
      {
        name: "FedEx Office – Downtown",
        type: "fedex" as const,
        address: "233 Peachtree St NE",
        city: "Atlanta",
        state: "GA",
        zipCode: "30303",
        latitude: 33.7601,
        longitude: -84.3867,
        hours: "Mon-Fri 7am-9pm, Sat-Sun 9am-6pm",
        sortOrder: 13,
      },
      
    ];

    let insertedCount = 0;
    
    for (const hub of atlantaCarrierHubs) {
      // Check if this hub already exists (by name and address)
      const existing = await ctx.db
        .query("hubLocations")
        .filter((q) => 
          q.and(
            q.eq(q.field("name"), hub.name),
            q.eq(q.field("address"), hub.address)
          )
        )
        .first();
      
      if (!existing) {
        await ctx.db.insert("hubLocations", {
          ...hub,
          isActive: true,
          createdAt: Date.now(),
        });
        insertedCount++;
      }
    }

    return { 
      success: true, 
      message: `Seeded ${insertedCount} new Atlanta carrier locations (${atlantaCarrierHubs.length - insertedCount} already existed)`,
      count: insertedCount,
      total: atlantaCarrierHubs.length,
    };
  },
});

// Get all Amazon return-friendly locations
export const getAmazonReturnLocations = query({
  args: { 
    state: v.optional(v.string()),
    city: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const amazonTypes = [
      "amazon_wholefoods",
      "amazon_kohls", 
      "amazon_hub",
      "amazon_locker",
      "amazon_counter",
    ];
    
    let locations = await ctx.db
      .query("hubLocations")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    
    // Filter to Amazon return types only
    locations = locations.filter(loc => amazonTypes.includes(loc.type));
    
    // Filter by state if provided
    if (args.state) {
      locations = locations.filter(loc => 
        loc.state.toUpperCase() === args.state!.toUpperCase()
      );
    }
    
    // Filter by city if provided
    if (args.city) {
      locations = locations.filter(loc => 
        loc.city.toLowerCase().includes(args.city!.toLowerCase())
      );
    }
    
    // Sort by sortOrder, then by name
    return locations.sort((a, b) => {
      const orderDiff = (a.sortOrder || 999) - (b.sortOrder || 999);
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name);
    });
  },
});

// Seed Atlanta DHL ServicePoint locations
export const seedAtlantaDHLLocations = mutation({
  args: {},
  handler: async (ctx) => {
    const dhlLocations = [
      {
        name: "DHL ServicePoint",
        type: "dhl" as const,
        address: "2045 Pleasantdale Rd",
        city: "Atlanta",
        state: "GA",
        zipCode: "30340",
        latitude: 33.9023,
        longitude: -84.2232,
        hours: "Mon-Fri 8am-6pm, Sat 9am-1pm",
        sortOrder: 30,
      },
      {
        name: "DHL ServicePoint",
        type: "dhl" as const,
        address: "2600 International Pkwy",
        city: "Atlanta",
        state: "GA",
        zipCode: "30337",
        latitude: 33.6407,
        longitude: -84.4277,
        hours: "Mon-Fri 8am-7pm, Sat 9am-2pm",
        sortOrder: 31,
      },
      {
        name: "DHL ServicePoint",
        type: "dhl" as const,
        address: "3455 Peachtree Rd NE",
        city: "Atlanta",
        state: "GA",
        zipCode: "30326",
        latitude: 33.8486,
        longitude: -84.3633,
        hours: "Mon-Fri 8am-6pm, Sat 9am-1pm",
        sortOrder: 32,
      },
      {
        name: "DHL ServicePoint",
        type: "dhl" as const,
        address: "5730 Oakbrook Pkwy",
        city: "Norcross",
        state: "GA",
        zipCode: "30093",
        latitude: 33.9158,
        longitude: -84.2030,
        hours: "Mon-Fri 8am-6pm",
        sortOrder: 33,
      },
      {
        name: "DHL ServicePoint",
        type: "dhl" as const,
        address: "6305 Best Friend Rd",
        city: "Atlanta",
        state: "GA",
        zipCode: "30340",
        latitude: 33.9036,
        longitude: -84.2492,
        hours: "Mon-Fri 8am-7pm, Sat 9am-3pm",
        sortOrder: 34,
      },
    ];

    let insertedCount = 0;
    
    for (const hub of dhlLocations) {
      const existing = await ctx.db
        .query("hubLocations")
        .filter((q) => 
          q.and(
            q.eq(q.field("type"), "dhl"),
            q.eq(q.field("address"), hub.address)
          )
        )
        .first();
      
      if (!existing) {
        await ctx.db.insert("hubLocations", {
          ...hub,
          isActive: true,
          createdAt: Date.now(),
        });
        insertedCount++;
      }
    }

    return { 
      success: true, 
      message: `Seeded ${insertedCount} new DHL locations`,
      count: insertedCount,
      total: dhlLocations.length,
    };
  },
});

// List hubs by carrier with strict filtering
export const listHubsByCarrier = query({
  args: {
    carrier: v.union(
      v.literal("ups"),
      v.literal("fedex"),
      v.literal("usps"),
      v.literal("dhl"),
      v.literal("amazon")
    ),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    nearLat: v.optional(v.number()),
    nearLng: v.optional(v.number()),
    radiusMiles: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Map carrier to hub types
    const carrierToTypes: Record<string, string[]> = {
      ups: ["ups"],
      fedex: ["fedex"],
      usps: ["usps"],
      dhl: ["dhl"],
      amazon: ["amazon_hub", "amazon_locker", "amazon_counter", "amazon_wholefoods", "amazon_kohls"],
    };
    
    const types = carrierToTypes[args.carrier];
    if (!types) return [];
    
    // Get all active locations
    let locations = await ctx.db
      .query("hubLocations")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    
    // Filter by carrier types
    locations = locations.filter(loc => types.includes(loc.type));
    
    // Filter by city if provided
    if (args.city) {
      const cityLower = args.city.toLowerCase();
      locations = locations.filter(loc => 
        loc.city.toLowerCase().includes(cityLower)
      );
    }
    
    // Filter by state if provided
    if (args.state) {
      locations = locations.filter(loc => 
        loc.state.toUpperCase() === args.state!.toUpperCase()
      );
    }
    
    // Calculate distance if coordinates provided
    if (args.nearLat !== undefined && args.nearLng !== undefined) {
      const radiusMiles = args.radiusMiles ?? 25;
      
      locations = locations
        .filter(loc => loc.latitude !== undefined && loc.longitude !== undefined)
        .map(loc => ({
          ...loc,
          distance: calculateDistance(args.nearLat!, args.nearLng!, loc.latitude!, loc.longitude!)
        }))
        .filter(loc => loc.distance <= radiusMiles)
        .sort((a, b) => a.distance - b.distance);
    } else {
      // Sort by sortOrder then name
      locations.sort((a, b) => {
        const orderDiff = (a.sortOrder || 999) - (b.sortOrder || 999);
        if (orderDiff !== 0) return orderDiff;
        return a.name.localeCompare(b.name);
      });
    }
    
    return locations;
  },
});

// Seed Atlanta USPS locations
export const seedAtlantaUSPSLocations = mutation({
  args: {},
  handler: async (ctx) => {
    const uspsLocations = [
      {
        name: "USPS – Midtown Station",
        type: "usps" as const,
        address: "1050 Peachtree St NE",
        city: "Atlanta",
        state: "GA",
        zipCode: "30309",
        latitude: 33.7866,
        longitude: -84.3853,
        hours: "Mon-Fri 9am-5pm, Sat 9am-1pm",
        sortOrder: 40,
      },
      {
        name: "USPS – Downtown Station",
        type: "usps" as const,
        address: "400 Pryor St SW",
        city: "Atlanta",
        state: "GA",
        zipCode: "30312",
        latitude: 33.7490,
        longitude: -84.3880,
        hours: "Mon-Fri 8:30am-5pm, Sat 9am-12pm",
        sortOrder: 41,
      },
      {
        name: "USPS – Buckhead Station",
        type: "usps" as const,
        address: "3035 Peachtree Rd NE",
        city: "Atlanta",
        state: "GA",
        zipCode: "30305",
        latitude: 33.8400,
        longitude: -84.3800,
        hours: "Mon-Fri 8:30am-5pm, Sat 9am-1pm",
        sortOrder: 42,
      },
      {
        name: "USPS – Decatur Station",
        type: "usps" as const,
        address: "141 E Trinity Pl",
        city: "Decatur",
        state: "GA",
        zipCode: "30030",
        latitude: 33.7748,
        longitude: -84.2963,
        hours: "Mon-Fri 9am-5pm, Sat 9am-12pm",
        sortOrder: 43,
      },
    ];

    let insertedCount = 0;
    
    for (const hub of uspsLocations) {
      const existing = await ctx.db
        .query("hubLocations")
        .filter((q) => 
          q.and(
            q.eq(q.field("type"), "usps"),
            q.eq(q.field("address"), hub.address)
          )
        )
        .first();
      
      if (!existing) {
        await ctx.db.insert("hubLocations", {
          ...hub,
          isActive: true,
          createdAt: Date.now(),
        });
        insertedCount++;
      }
    }

    return { 
      success: true, 
      message: `Seeded ${insertedCount} new USPS locations`,
      count: insertedCount,
      total: uspsLocations.length,
    };
  },
});

// Alias for backward compatibility - frontend calls listHubLocations
export const listHubLocations = listActiveLocations;

// Migration: Remove legacy staples locations (admin auth required)
export const migrateRemoveStaplesLocations = mutation({
  args: {},
  handler: async (ctx) => {
    // This is a migration - require admin auth
    const adminId = await requireAdminStrict(ctx);
    
    // Find all staples locations
    const allLocations = await ctx.db.query("hubLocations").collect();
    
    const staplesLocations = allLocations.filter(loc => 
      loc.type === "staples" || loc.type === "amazon_staples"
    );
    
    // Delete them
    let deletedCount = 0;
    for (const loc of staplesLocations) {
      await ctx.db.delete(loc._id);
      deletedCount++;
    }
    
    // Log admin action
    if (deletedCount > 0) {
      await ctx.scheduler.runAfter(0, internal.adminLogs.logAdminAction, {
        adminId,
        action: "hub_locations_migration_staples_removed",
        targetType: "hubLocation",
        targetId: "migration",
        details: { deletedCount },
      });
    }
    
    return {
      success: true,
      message: `Migration complete: removed ${deletedCount} staples locations`,
      deletedCount,
    };
  },
});

// Public migration (no auth) for development
export const migrateRemoveStaplesLocationsPublic = mutation({
  args: {},
  handler: async (ctx) => {
    const allLocations = await ctx.db.query("hubLocations").collect();
    
    const staplesLocations = allLocations.filter(loc => 
      loc.type === "staples" || loc.type === "amazon_staples"
    );
    
    let deletedCount = 0;
    for (const loc of staplesLocations) {
      await ctx.db.delete(loc._id);
      deletedCount++;
    }
    
    return {
      success: true,
      message: `Migration complete: removed ${deletedCount} staples locations`,
      deletedCount,
    };
  },
});
