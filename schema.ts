import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  // Admin credentials (separate from regular auth for security)
  adminCredentials: defineTable({
    email: v.string(),
    passwordHash: v.string(), // bcrypt hash
    mustChangePassword: v.boolean(),
    failedAttempts: v.number(),
    lockedUntil: v.optional(v.number()), // timestamp for lockout
    lastLoginAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_email", ["email"]),

  // Admin sessions (separate from user auth)
  adminSessions: defineTable({
    adminId: v.id("adminCredentials"),
    token: v.string(), // Unique session token
    email: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    lastActivityAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_admin", ["adminId"])
    .index("by_email", ["email"]),

  // Saved customer addresses
  savedAddresses: defineTable({
    userId: v.id("users"),
    label: v.string(), // "Home", "Work", "Mom's House", "Recent", etc.
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
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_default", ["userId", "isDefault"]),

  // User profiles with role
  profiles: defineTable({
    userId: v.id("users"),
    role: v.union(v.literal("customer"), v.literal("courier"), v.literal("admin")),
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    profileImageId: v.optional(v.id("_storage")),
    oneSignalId: v.optional(v.string()), // OneSignal subscription/player ID
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_role", ["role"])
    .index("by_created", ["createdAt"]),

  // Enhanced courier applications with verification fields
  courierApplications: defineTable({
    userId: v.id("users"),
    
    // Application status
    status: v.union(
      v.literal("draft"),
      v.literal("pending_review"),
      v.literal("approved"),
      v.literal("denied"),
      v.literal("suspended")
    ),
    
    // Personal info
    fullName: v.string(),
    phone: v.string(),
    email: v.string(),
    dateOfBirth: v.optional(v.string()),
    homeAddress: v.optional(v.string()),
    
    // Documents (storage IDs)
    profilePhotoId: v.optional(v.id("_storage")),
    licenseFrontId: v.optional(v.id("_storage")),
    licenseBackId: v.optional(v.id("_storage")),
    insuranceId: v.optional(v.id("_storage")),
    
    // Vehicle info
    vehicleMake: v.string(),
    vehicleModel: v.string(),
    vehicleYear: v.string(),
    vehicleColor: v.string(),
    vehiclePlate: v.string(),
    
    // Agreements
    agreedToContractor: v.boolean(),
    agreedToLicenseInsurance: v.boolean(),
    agreedToBackgroundCheck: v.boolean(),
    
    // Optional courier notes
    applicantNotes: v.optional(v.string()),
    
    // Timestamps
    createdAt: v.number(),
    submittedAt: v.optional(v.number()),
    reviewedAt: v.optional(v.number()),
    reviewedBy: v.optional(v.union(v.id("users"), v.id("adminCredentials"))),
    
    // Admin verification fields (private)
    backgroundCheckStatus: v.optional(v.union(
      v.literal("not_started"),
      v.literal("in_progress"),
      v.literal("cleared"),
      v.literal("flagged")
    )),
    licenseCheckStatus: v.optional(v.union(
      v.literal("not_started"),
      v.literal("verified"),
      v.literal("expired"),
      v.literal("mismatch")
    )),
    adminNotes: v.optional(v.string()),
    denialReason: v.optional(v.string()),
    suspensionReason: v.optional(v.string()),
    
    // Online status (only matters if approved)
    isOnline: v.boolean(),
    lastOnlineAt: v.optional(v.number()),
    
    // License details
    licenseNumber: v.optional(v.string()),
    licenseState: v.optional(v.string()),
    licenseExpiresAt: v.optional(v.string()), // Date string YYYY-MM-DD

    // Verification status
    verificationStatus: v.optional(v.union(
      v.literal("not_submitted"),
      v.literal("pending"),
      v.literal("approved"),
      v.literal("denied")
    )),
    verificationDenialReason: v.optional(v.string()),
    verifiedAt: v.optional(v.number()),
    verifiedBy: v.optional(v.id("adminCredentials")),

    // Manual verification fields
    licenseVerified: v.optional(v.boolean()),
    insuranceVerified: v.optional(v.boolean()),
    manualScreeningComplete: v.optional(v.boolean()),
    
    // Payout setup
    payoutSetupStatus: v.optional(v.union(
      v.literal("not_started"),
      v.literal("pending"),
      v.literal("complete")
    )),
    whopConnectedAccountId: v.optional(v.string()), // Whop company ID (biz_xxx) - kept for future use
    lastPayoutSetupAt: v.optional(v.number()),
    
    // Manual payout info (MVP)
    payoutMethod: v.optional(v.union(
      v.literal("bank_transfer"),
      v.literal("cashapp"),
      v.literal("zelle")
    )),
    payoutEmail: v.optional(v.string()), // For PayPal, Venmo, CashApp
    payoutPhone: v.optional(v.string()), // For Venmo, CashApp, Zelle
    payoutBankName: v.optional(v.string()),
    payoutAccountLast4: v.optional(v.string()), // Last 4 digits only for display
    payoutHandle: v.optional(v.string()), // Username/handle for Venmo/CashApp
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_online", ["isOnline", "status"])
    .index("by_submitted", ["submittedAt"])
    .index("by_verification", ["verificationStatus"]),

  // Admin notifications table
  adminNotifications: defineTable({
    type: v.string(),
    title: v.string(),
    message: v.string(),
    targetId: v.optional(v.string()),
    targetType: v.optional(v.string()),
    isRead: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_read", ["isRead"])
    .index("by_created", ["createdAt"]),

  // Courier notifications table
  courierNotifications: defineTable({
    courierId: v.id("users"),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    isRead: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_courier", ["courierId"])
    .index("by_courier_read", ["courierId", "isRead"]),

  // Customer notifications
  customerNotifications: defineTable({
    customerId: v.id("users"),
    jobId: v.optional(v.id("jobs")),
    type: v.string(),
    title: v.string(),
    message: v.string(),
    isRead: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_customer", ["customerId"])
    .index("by_customer_read", ["customerId", "isRead"]),

  // Jobs/Orders
  jobs: defineTable({
    // Customer info
    customerId: v.id("users"),
    // Pickup details (display address)
    pickupAddress: v.string(),
    pickupNotes: v.optional(v.string()),
    pickupPhotoId: v.optional(v.id("_storage")),
    // Structured address fields
    pickupStreet1: v.optional(v.string()),
    pickupStreet2: v.optional(v.string()),
    pickupCity: v.optional(v.string()),
    pickupState: v.optional(v.string()),
    pickupZipCode: v.optional(v.string()),
    pickupCountry: v.optional(v.string()),
    pickupLatitude: v.optional(v.number()),
    pickupLongitude: v.optional(v.number()),
    pickupPlaceId: v.optional(v.string()),
    // Manual address flag
    isManualAddress: v.optional(v.boolean()),
    // Time
    isAsap: v.boolean(),
    scheduledDate: v.optional(v.string()),
    scheduledTime: v.optional(v.string()),
    // Carrier
    carrier: v.union(
      v.literal("UPS"),
      v.literal("FedEx"),
      v.literal("USPS"),
      v.literal("DHL"),
      v.literal("Other")
    ),
    // Packages
    packageCount: v.number(),
    packageSize: v.union(v.literal("S"), v.literal("M"), v.literal("L")),
    // Package quantities by size
    smallQty: v.optional(v.number()),
    mediumQty: v.optional(v.number()),
    largeQty: v.optional(v.number()),
    oversizedQty: v.optional(v.number()),
    // Pricing
    baseFee: v.number(),
    additionalFee: v.number(),
    totalPrice: v.number(),
    platformCommission: v.number(),
    courierPayout: v.number(),
    // Status
    status: v.union(
      v.literal("draft"),        // Created but not paid
      v.literal("requested"),    // Paid, waiting for courier
      v.literal("matched"),
      v.literal("en_route"),
      v.literal("arrived"),
      v.literal("picked_up"),
      v.literal("dropped_off"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    // Courier assignment
    courierId: v.optional(v.id("users")),
    courierAcceptedAt: v.optional(v.number()),
    // Timestamps
    createdAt: v.number(),
    matchedAt: v.optional(v.number()),
    arrivedAt: v.optional(v.number()),
    pickedUpAt: v.optional(v.number()),
    droppedOffAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    // Scans (required for completion)
    pickupScan: v.optional(
      v.object({
        timestamp: v.number(),
        latitude: v.number(),
        longitude: v.number(),
        barcodeData: v.string(),
      })
    ),
    dropoffScan: v.optional(
      v.object({
        timestamp: v.number(),
        latitude: v.number(),
        longitude: v.number(),
        barcodeData: v.string(),
      })
    ),
    // Proof photos with metadata
    pickupProofId: v.optional(v.id("_storage")),
    pickupProofTimestamp: v.optional(v.number()),
    pickupProofLocation: v.optional(v.object({
      latitude: v.number(),
      longitude: v.number(),
    })),
    dropoffProofId: v.optional(v.id("_storage")),
    dropoffProofTimestamp: v.optional(v.number()),
    dropoffProofLocation: v.optional(v.object({
      latitude: v.number(),
      longitude: v.number(),
    })),
    // Package label scan verification
    pickupLabelScanValue: v.optional(v.string()),        // The scanned barcode/QR value
    pickupLabelScanType: v.optional(v.union(
      v.literal("qr"),
      v.literal("barcode"),
      v.literal("manual"),
      v.literal("ocr")  // OCR fallback for label photos
    )),
    pickupLabelScanTimestamp: v.optional(v.number()),
    pickupLabelScanVerified: v.optional(v.boolean()),    // true when scan completed
    // OCR label photo fallback
    pickupLabelPhotoId: v.optional(v.id("_storage")),    // Storage ID for label photo
    pickupLabelPhotoTimestamp: v.optional(v.number()),   // When photo was taken
    // Optional: Customer-provided tracking number for validation
    expectedTrackingNumber: v.optional(v.string()),
    scanMatchesExpected: v.optional(v.boolean()),
    // ETA tracking fields
    etaSeconds: v.optional(v.number()),        // Estimated time to destination in seconds
    etaUpdatedAt: v.optional(v.number()),      // Timestamp when ETA was last calculated
    distanceMeters: v.optional(v.number()),    // Distance to destination in meters
    // Rating
    rating: v.optional(v.number()),
    ratingFeedback: v.optional(v.string()),
    // Payment tracking
    paymentStatus: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("failed"),
      v.literal("refunded")
    ),
    paymentId: v.optional(v.string()),        // Whop order/checkout ID
    paymentAmount: v.optional(v.number()),    // Amount paid
    paymentCurrency: v.optional(v.string()),  // Currency (USD)
    paidAt: v.optional(v.number()),           // Timestamp when paid
    // Service type and drop-off location
    serviceType: v.optional(v.union(v.literal("amazon_return"), v.literal("carrier_dropoff"))),
    dropoffLocationType: v.optional(v.union(
      v.literal("ups"),
      v.literal("fedex"),
      v.literal("usps"),
      v.literal("dhl"),
      v.literal("amazon_hub"),
      v.literal("amazon_locker"),
      v.literal("amazon_counter"),
      v.literal("amazon_wholefoods"),
      v.literal("amazon_kohls"),
      v.literal("other")
    )),
    // Selected hub location
    dropoffLocationId: v.optional(v.id("hubLocations")),
    dropoffLocationName: v.optional(v.string()),
    dropoffLocationAddress: v.optional(v.string()),
    dropoffLatitude: v.optional(v.number()),
    dropoffLongitude: v.optional(v.number()),
    // Amazon specific
    amazonLabelConfirmed: v.optional(v.boolean()),
    labelPhotoId: v.optional(v.id("_storage")),
    // Drop-off proof
    dropoffProofPhotoId: v.optional(v.id("_storage")),
    // Snapshot of address at booking time
    dropoffAddressSnapshot: v.optional(v.string()),
  })
    .index("by_customer", ["customerId"])
    .index("by_courier", ["courierId"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

  // Platform settings
  settings: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),

  // Platform configuration (single record)
  platformConfig: defineTable({
    primaryCity: v.string(),
    radiusMiles: v.number(),
    centerLat: v.number(),
    centerLng: v.number(),
    updatedAt: v.number(),
  }),

  // Transactions log
  transactions: defineTable({
    jobId: v.optional(v.id("jobs")),
    type: v.union(
      v.literal("payment"),
      v.literal("payout"),
      v.literal("refund"),
      v.literal("commission")
    ),
    amount: v.number(),
    customerId: v.optional(v.id("users")),
    courierId: v.optional(v.id("users")),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  })
    .index("by_job", ["jobId"])
    .index("by_type", ["type"])
    .index("by_customer", ["customerId"])
    .index("by_courier", ["courierId"])
    .index("by_created", ["createdAt"]),

  // Admin action logs
  adminLogs: defineTable({
    adminId: v.union(v.id("users"), v.id("adminCredentials")), // Support both auth systems
    action: v.string(),
    targetType: v.optional(v.string()),
    targetId: v.optional(v.string()),
    details: v.optional(v.any()),
    ipAddress: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_admin", ["adminId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_action", ["action"]),

  // Job events audit trail
  jobEvents: defineTable({
    jobId: v.id("jobs"),
    courierId: v.optional(v.id("users")),
    customerId: v.optional(v.id("users")),
    eventType: v.string(), // "status_change", "scan", "location_update", "error"
    previousStatus: v.optional(v.string()),
    newStatus: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    metadata: v.optional(v.any()),
    errorMessage: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_job", ["jobId"])
    .index("by_courier", ["courierId"])
    .index("by_type", ["eventType"]),

  // Platform mode (test/live)
  platformMode: defineTable({
    mode: v.union(v.literal("test"), v.literal("live")),
    updatedAt: v.number(),
    updatedBy: v.union(v.id("users"), v.id("adminCredentials")), // Support both auth systems
  }).index("by_mode", ["mode"]),

  // System health checks
  healthChecks: defineTable({
    category: v.string(),
    testName: v.string(),
    status: v.union(v.literal("pass"), v.literal("fail"), v.literal("warning")),
    message: v.string(),
    details: v.optional(v.any()),
    runAt: v.number(),
    runBy: v.union(v.id("users"), v.id("adminCredentials")), // Support both auth systems
  })
    .index("by_category", ["category"])
    .index("by_run", ["runAt"]),

  // Payout ledger (for manual payout tracking)
  payoutLedger: defineTable({
    courierId: v.id("users"),
    jobId: v.id("jobs"),
    amount: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("paid"),
      v.literal("failed")
    ),
    paidAt: v.optional(v.number()),
    paidBy: v.optional(v.union(v.id("users"), v.id("adminCredentials"))), // Support both auth systems
    paymentMethod: v.optional(v.string()),
    paymentReference: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_courier", ["courierId"])
    .index("by_job", ["jobId"])
    .index("by_status", ["status"]),

  // Hub/Drop-off locations directory
  hubLocations: defineTable({
    name: v.string(),
    type: v.union(
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
    ),
    address: v.string(),
    address2: v.optional(v.string()), // Suite/unit number
    city: v.string(),
    state: v.string(),
    zipCode: v.string(),
    latitude: v.optional(v.number()), // Optional for manual entry without geocoding
    longitude: v.optional(v.number()), // Optional for manual entry without geocoding
    hours: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
    sortOrder: v.optional(v.number()), // For custom ordering
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_type", ["type", "isActive"])
    .index("by_city", ["city", "isActive"])
    .index("by_zip", ["zipCode", "isActive"])
    .index("by_active", ["isActive"]),

  // Real-time courier location tracking
  courierLocations: defineTable({
    courierId: v.id("users"),
    jobId: v.optional(v.id("jobs")), // Current active job if any
    latitude: v.number(),
    longitude: v.number(),
    heading: v.optional(v.number()), // Direction in degrees
    speed: v.optional(v.number()), // Speed in m/s
    accuracy: v.optional(v.number()), // GPS accuracy in meters
    updatedAt: v.number(),
  })
    .index("by_courier", ["courierId"])
    .index("by_job", ["jobId"]),

  // Payment sessions for checkout tracking
  paymentSessions: defineTable({
    // Customer and job reference
    customerId: v.id("users"),
    jobId: v.id("jobs"),

    // Session details
    sessionId: v.string(), // Unique session ID for URL params

    // Whop/Surgent checkout details
    checkoutId: v.optional(v.string()),
    checkoutUrl: v.optional(v.string()),

    // Payment details
    amount: v.number(),
    currency: v.string(),

    // Status tracking
    status: v.union(
      v.literal("pending"), // Created, waiting for checkout
      v.literal("processing"), // User redirected to checkout
      v.literal("paid"), // Payment confirmed
      v.literal("failed"), // Payment failed
      v.literal("cancelled"), // User cancelled
      v.literal("expired") // Session expired (30 min timeout)
    ),

    // Timestamps
    createdAt: v.number(),
    processedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),

    // Verification
    verifiedAt: v.optional(v.number()),
    verificationMethod: v.optional(v.string()), // "redirect" | "webhook" | "manual"

    // Error tracking
    errorMessage: v.optional(v.string()),

    // Metadata
    metadata: v.optional(v.any()),
  })
    .index("by_session", ["sessionId"])
    .index("by_customer", ["customerId"])
    .index("by_job", ["jobId"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

  // Booking drafts - stores booking data before payment
  bookingDrafts: defineTable({
    customerId: v.id("users"),
    
    // Pickup details
    pickupAddress: v.string(),
    pickupNotes: v.optional(v.string()),
    pickupPhotoId: v.optional(v.id("_storage")),
    pickupStreet1: v.optional(v.string()),
    pickupStreet2: v.optional(v.string()),
    pickupCity: v.optional(v.string()),
    pickupState: v.optional(v.string()),
    pickupZipCode: v.optional(v.string()),
    pickupCountry: v.optional(v.string()),
    pickupLatitude: v.optional(v.number()),
    pickupLongitude: v.optional(v.number()),
    pickupPlaceId: v.optional(v.string()),
    isManualAddress: v.optional(v.boolean()),
    
    // Timing
    isAsap: v.boolean(),
    scheduledDate: v.optional(v.string()),
    scheduledTime: v.optional(v.string()),
    
    // Carrier
    carrier: v.union(
      v.literal("UPS"),
      v.literal("FedEx"),
      v.literal("USPS"),
      v.literal("DHL"),
      v.literal("Other")
    ),
    
    // Packages
    packageCount: v.number(),
    packageSize: v.union(v.literal("S"), v.literal("M"), v.literal("L")),
    smallQty: v.optional(v.number()),
    mediumQty: v.optional(v.number()),
    largeQty: v.optional(v.number()),
    oversizedQty: v.optional(v.number()),
    
    // Pricing (calculated)
    totalPriceCents: v.number(),
    
    // Service type and drop-off
    serviceType: v.optional(v.union(v.literal("amazon_return"), v.literal("carrier_dropoff"))),
    dropoffLocationType: v.optional(v.string()),
    dropoffLocationId: v.optional(v.id("hubLocations")),
    dropoffLocationName: v.optional(v.string()),
    dropoffLocationAddress: v.optional(v.string()),
    dropoffLatitude: v.optional(v.number()),
    dropoffLongitude: v.optional(v.number()),
    
    // Amazon specific
    amazonLabelConfirmed: v.optional(v.boolean()),
    labelPhotoId: v.optional(v.id("_storage")),
    expectedTrackingNumber: v.optional(v.string()),
    
    // Payment tracking
    paymentStatus: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("paid"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    checkoutSessionId: v.optional(v.string()),
    checkoutUrl: v.optional(v.string()),
    
    // Job reference (after payment success)
    jobId: v.optional(v.id("jobs")),
    
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    expiresAt: v.number(), // 30 min from creation
  })
    .index("by_customer", ["customerId"])
    .index("by_checkout_session", ["checkoutSessionId"])
    .index("by_status", ["paymentStatus"]),

  // Support tickets (Customer/Courier ↔ Admin)
  supportTickets: defineTable({
    createdByUserId: v.id("users"),
    createdByRole: v.optional(v.union(v.literal("customer"), v.literal("courier"))), // Optional for backward compat
    subject: v.string(),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("resolved"), v.literal("closed")),
    // Issue category (optional for backward compatibility with existing tickets)
    ticketType: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("high"), v.literal("medium"), v.literal("low"))),
    jobId: v.optional(v.id("jobs")), // Associated job if any
    // Job snapshot (captured at ticket creation)
    jobSnapshot: v.optional(v.object({
      pickupAddress: v.string(),
      dropoffLocationName: v.optional(v.string()),
      courierName: v.optional(v.string()),
      courierPhone: v.optional(v.string()),
      status: v.string(),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["createdByUserId"])
    .index("by_status", ["status"])
    .index("by_updated", ["updatedAt"])
    .index("by_role", ["createdByRole", "status"]),

  // Support messages
  supportMessages: defineTable({
    ticketId: v.id("supportTickets"),
    senderType: v.union(v.literal("customer"), v.literal("courier"), v.literal("admin")),
    senderUserId: v.optional(v.id("users")),
    body: v.string(),
    createdAt: v.number(),
    readByAdminAt: v.optional(v.number()),
    readByCustomerAt: v.optional(v.number()),
    readByCourierAt: v.optional(v.number()),
  })
    .index("by_ticket", ["ticketId"])
    .index("by_created", ["createdAt"]),

  // Job messages (Courier ↔ Customer per job)
  jobMessages: defineTable({
    jobId: v.id("jobs"),
    senderRole: v.union(v.literal("customer"), v.literal("courier")),
    senderUserId: v.id("users"),
    body: v.string(),
    createdAt: v.number(),
    readByCourierAt: v.optional(v.number()),
    readByCustomerAt: v.optional(v.number()),
  })
    .index("by_job", ["jobId"])
    .index("by_created", ["createdAt"]),
});
