import { query, mutation } from "./_generated/server";

// Public health check - no auth required
export const getSystemHealth = query({
  args: {},
  handler: async (ctx) => {
    // Count hub locations by type
    const allHubs = await ctx.db.query("hubLocations").collect();
    const activeHubs = allHubs.filter(h => h.isActive);
    
    const hubCounts = {
      total: activeHubs.length,
      amazon: activeHubs.filter(h => h.type.startsWith("amazon_")).length,
      ups: activeHubs.filter(h => h.type === "ups").length,
      fedex: activeHubs.filter(h => h.type === "fedex").length,
      usps: activeHubs.filter(h => h.type === "usps").length,
      dhl: activeHubs.filter(h => h.type === "dhl").length,
      byType: {} as Record<string, number>,
    };
    
    // Detailed breakdown by type
    for (const hub of activeHubs) {
      hubCounts.byType[hub.type] = (hubCounts.byType[hub.type] || 0) + 1;
    }

    // Check recent booking drafts
    const recentDrafts = await ctx.db
      .query("bookingDrafts")
      .order("desc")
      .take(10);
    
    const draftStats = {
      total: recentDrafts.length,
      pending: recentDrafts.filter(d => d.paymentStatus === "pending").length,
      processing: recentDrafts.filter(d => d.paymentStatus === "processing").length,
      paid: recentDrafts.filter(d => d.paymentStatus === "paid").length,
    };

    // Check recent jobs
    const recentJobs = await ctx.db
      .query("jobs")
      .order("desc")
      .take(10);
    
    const jobStats = {
      total: recentJobs.length,
      requested: recentJobs.filter(j => j.status === "requested").length,
      completed: recentJobs.filter(j => j.status === "completed").length,
    };

    // Environment checks (server-side only - don't expose actual values)
    const envChecks = {
      hasSurgentApiKey: !!process.env.SURGENT_API_KEY,
      surgentKeyType: process.env.SURGENT_API_KEY?.startsWith("sk_live_") ? "live" : "test",
      hasSiteUrl: !!process.env.SITE_URL,
      siteUrl: process.env.SITE_URL || "NOT SET",
      hasWhopApiKey: !!process.env.WHOP_API_KEY,
      hasWhopCompanyId: !!process.env.WHOP_PARENT_COMPANY_ID,
    };

    return {
      timestamp: Date.now(),
      hubs: hubCounts,
      drafts: draftStats,
      jobs: jobStats,
      env: envChecks,
      status: hubCounts.total > 0 && envChecks.hasSurgentApiKey ? "healthy" : "degraded",
    };
  },
});

// Seed all hubs (idempotent)
export const seedAllHubs = mutation({
  args: {},
  handler: async (ctx) => {
    const results = {
      locations: 0,
      amazonHubs: 0,
      carrierHubs: 0,
    };

    // Check existing count
    const existing = await ctx.db.query("hubLocations").collect();
    
    if (existing.length > 0) {
      return {
        success: true,
        message: `Hubs already exist (${existing.length} total). Use admin panel to manage.`,
        ...results,
        existingCount: existing.length,
      };
    }

    // Seed sample locations (NYC, Atlanta, LA)
    const sampleLocations = [
      // NYC - UPS
      { name: "The UPS Store #4521", type: "ups" as const, address: "350 5th Avenue", city: "New York", state: "NY", zipCode: "10118", latitude: 40.7484, longitude: -73.9857, hours: "Mon-Fri 8am-7pm, Sat 9am-5pm" },
      { name: "The UPS Store #3892", type: "ups" as const, address: "1412 Broadway", city: "New York", state: "NY", zipCode: "10018", latitude: 40.7537, longitude: -73.9871, hours: "Mon-Fri 8am-8pm, Sat-Sun 10am-4pm" },
      
      // NYC - FedEx
      { name: "FedEx Office Print & Ship Center", type: "fedex" as const, address: "245 Park Avenue", city: "New York", state: "NY", zipCode: "10167", latitude: 40.7549, longitude: -73.9724, hours: "Mon-Fri 7am-9pm, Sat-Sun 9am-6pm" },
      
      // NYC - Amazon
      { name: "Amazon Hub Locker - Whole Foods Chelsea", type: "amazon_locker" as const, address: "250 7th Avenue", city: "New York", state: "NY", zipCode: "10001", latitude: 40.7448, longitude: -73.9945, hours: "6am-10pm Daily" },
      { name: "Amazon Hub Counter - Rite Aid Midtown", type: "amazon_counter" as const, address: "408 8th Avenue", city: "New York", state: "NY", zipCode: "10001", latitude: 40.7507, longitude: -73.9946, hours: "7am-10pm Daily" },
      
      // Atlanta - UPS
      { name: "UPS Store – Midtown", type: "ups" as const, address: "750 Ponce De Leon Pl NE", city: "Atlanta", state: "GA", zipCode: "30306", latitude: 33.7748, longitude: -84.3656, hours: "Mon-Fri 8am-7pm, Sat 9am-5pm" },
      { name: "UPS Store – Buckhead", type: "ups" as const, address: "3655 Roswell Rd NE", city: "Atlanta", state: "GA", zipCode: "30342", latitude: 33.8521, longitude: -84.3627, hours: "Mon-Fri 8am-7pm, Sat 9am-4pm" },
      
      // Atlanta - FedEx
      { name: "FedEx Office – Midtown", type: "fedex" as const, address: "595 Piedmont Ave NE", city: "Atlanta", state: "GA", zipCode: "30308", latitude: 33.7710, longitude: -84.3830, hours: "Mon-Fri 7am-9pm, Sat-Sun 9am-6pm" },
      { name: "FedEx Office – Buckhead", type: "fedex" as const, address: "3330 Piedmont Rd NE", city: "Atlanta", state: "GA", zipCode: "30305", latitude: 33.8456, longitude: -84.3712, hours: "Mon-Fri 7am-9pm, Sat-Sun 9am-6pm" },
      
      // Atlanta - Amazon
      { name: "Whole Foods Market – Midtown Atlanta", type: "amazon_wholefoods" as const, address: "22 14th St NW", city: "Atlanta", state: "GA", zipCode: "30309", latitude: 33.7866, longitude: -84.3953, hours: "7am-10pm Daily", notes: "Amazon Returns (no box/label needed; QR code)" },
      { name: "Whole Foods Market – Ponce de Leon", type: "amazon_wholefoods" as const, address: "650 Ponce de Leon Ave NE", city: "Atlanta", state: "GA", zipCode: "30308", latitude: 33.7729, longitude: -84.3656, hours: "7am-10pm Daily", notes: "Amazon Returns (no box/label needed; QR code)" },
      { name: "Amazon Hub - Kohl's Buckhead", type: "amazon_kohls" as const, address: "3330 Piedmont Road NE", city: "Atlanta", state: "GA", zipCode: "30305", latitude: 33.8456, longitude: -84.3712, hours: "Mon-Sat 9am-9pm, Sun 10am-8pm" },
      
      // LA - UPS
      { name: "The UPS Store #7234", type: "ups" as const, address: "523 West 6th Street", city: "Los Angeles", state: "CA", zipCode: "90014", latitude: 34.0478, longitude: -118.2541, hours: "Mon-Fri 8am-7pm, Sat 9am-5pm" },
      
      // LA - FedEx
      { name: "FedEx Office Print & Ship Center", type: "fedex" as const, address: "6922 Hollywood Boulevard", city: "Los Angeles", state: "CA", zipCode: "90028", latitude: 34.1017, longitude: -118.3354, hours: "Mon-Fri 7am-9pm, Sat-Sun 9am-6pm" },
      
      // LA - Amazon
      { name: "Amazon Hub - Kohl's Downtown LA", type: "amazon_hub" as const, address: "735 South Figueroa Street", city: "Los Angeles", state: "CA", zipCode: "90017", latitude: 34.0489, longitude: -118.2598, hours: "Mon-Sat 9am-9pm, Sun 10am-8pm" },
    ];

    for (const loc of sampleLocations) {
      await ctx.db.insert("hubLocations", {
        ...loc,
        isActive: true,
        createdAt: Date.now(),
      });
      results.locations++;
    }

    return {
      success: true,
      message: `Seeded ${results.locations} hub locations`,
      ...results,
    };
  },
});
