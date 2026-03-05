/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as addresses from "../addresses.js";
import type * as adminAuth from "../adminAuth.js";
import type * as adminLogs from "../adminLogs.js";
import type * as adminSessions from "../adminSessions.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as bookingDrafts from "../bookingDrafts.js";
import type * as couriers from "../couriers.js";
import type * as customerNotifications from "../customerNotifications.js";
import type * as demo from "../demo.js";
import type * as eta from "../eta.js";
import type * as etaActions from "../etaActions.js";
import type * as geocoding from "../geocoding.js";
import type * as health from "../health.js";
import type * as http from "../http.js";
import type * as hubLocations from "../hubLocations.js";
import type * as jobMessages from "../jobMessages.js";
import type * as jobs from "../jobs.js";
import type * as lib_adminAuth from "../lib/adminAuth.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_jobHelpers from "../lib/jobHelpers.js";
import type * as lib_pricing from "../lib/pricing.js";
import type * as lib_privacy from "../lib/privacy.js";
import type * as locations from "../locations.js";
import type * as notifications from "../notifications.js";
import type * as notificationsActions from "../notificationsActions.js";
import type * as pay from "../pay.js";
import type * as paymentSessions from "../paymentSessions.js";
import type * as payments from "../payments.js";
import type * as paymentsActions from "../paymentsActions.js";
import type * as payoutActions from "../payoutActions.js";
import type * as payouts from "../payouts.js";
import type * as platform from "../platform.js";
import type * as platformConfig from "../platformConfig.js";
import type * as profiles from "../profiles.js";
import type * as settings from "../settings.js";
import type * as storage from "../storage.js";
import type * as support from "../support.js";
import type * as transactions from "../transactions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  addresses: typeof addresses;
  adminAuth: typeof adminAuth;
  adminLogs: typeof adminLogs;
  adminSessions: typeof adminSessions;
  analytics: typeof analytics;
  auth: typeof auth;
  bookingDrafts: typeof bookingDrafts;
  couriers: typeof couriers;
  customerNotifications: typeof customerNotifications;
  demo: typeof demo;
  eta: typeof eta;
  etaActions: typeof etaActions;
  geocoding: typeof geocoding;
  health: typeof health;
  http: typeof http;
  hubLocations: typeof hubLocations;
  jobMessages: typeof jobMessages;
  jobs: typeof jobs;
  "lib/adminAuth": typeof lib_adminAuth;
  "lib/auth": typeof lib_auth;
  "lib/jobHelpers": typeof lib_jobHelpers;
  "lib/pricing": typeof lib_pricing;
  "lib/privacy": typeof lib_privacy;
  locations: typeof locations;
  notifications: typeof notifications;
  notificationsActions: typeof notificationsActions;
  pay: typeof pay;
  paymentSessions: typeof paymentSessions;
  payments: typeof payments;
  paymentsActions: typeof paymentsActions;
  payoutActions: typeof payoutActions;
  payouts: typeof payouts;
  platform: typeof platform;
  platformConfig: typeof platformConfig;
  profiles: typeof profiles;
  settings: typeof settings;
  storage: typeof storage;
  support: typeof support;
  transactions: typeof transactions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
