"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Types for geocoding response
interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId: string;
  components: {
    street1: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

interface GeocodeResponse {
  success: boolean;
  result?: GeocodeResult;
  error?: string;
  status?: string; // Google API status: OK, ZERO_RESULTS, REQUEST_DENIED, etc.
}

// Helper to parse Google address components
function parseAddressComponents(
  components: { types: string[]; long_name: string; short_name: string }[]
): GeocodeResult["components"] {
  const result = {
    street1: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
  };

  let streetNumber = "";
  let route = "";

  for (const component of components) {
    const types = component.types;

    if (types.includes("street_number")) {
      streetNumber = component.long_name;
    } else if (types.includes("route")) {
      route = component.long_name;
    } else if (
      types.includes("locality") ||
      types.includes("sublocality") ||
      types.includes("sublocality_level_1")
    ) {
      if (!result.city || types.includes("locality")) {
        result.city = component.long_name;
      }
    } else if (types.includes("administrative_area_level_1")) {
      result.state = component.short_name;
    } else if (types.includes("postal_code")) {
      result.zipCode = component.long_name;
    } else if (types.includes("country")) {
      result.country = component.short_name;
    }
  }

  result.street1 = [streetNumber, route].filter(Boolean).join(" ");
  return result;
}

// Internal geocode action (for server-side use)
export const geocodeAddressInternal = internalAction({
  args: {
    address: v.string(),
  },
  handler: async (_ctx, args): Promise<GeocodeResponse> => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.log("[geocodeAddressInternal] GOOGLE_MAPS_API_KEY not configured");
      throw new Error("GEOCODING_UNAVAILABLE: Server configuration error");
    }

    try {
      const encodedAddress = encodeURIComponent(args.address);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

      console.log("[geocodeAddressInternal] Geocoding address:", args.address);
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== "OK" || !data.results?.[0]) {
        console.log("[geocodeAddressInternal] Failed:", { address: args.address, status: data.status });
        throw new Error("ADDRESS_NOT_FOUND: Could not find this address. Please check and try again.");
      }

      const result = data.results[0];
      const location = result.geometry.location;
      const components = parseAddressComponents(result.address_components);

      console.log("[geocodeAddressInternal] Success:", {
        address: args.address,
        lat: location.lat,
        lng: location.lng,
        formattedAddress: result.formatted_address,
      });

      return {
        success: true,
        status: "OK",
        result: {
          lat: location.lat,
          lng: location.lng,
          formattedAddress: result.formatted_address,
          placeId: result.place_id,
          components,
        },
      };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("ADDRESS_NOT_FOUND")) {
        throw error;
      }
      console.log("[geocodeAddressInternal] Error:", error);
      throw new Error("GEOCODING_FAILED: Unable to geocode address. Please try again.");
    }
  },
});

// Public geocode action (requires auth)
export const geocodeAddressPublic = action({
  args: {
    address: v.string(),
  },
  handler: async (ctx, args): Promise<GeocodeResponse> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Please sign in to use geocoding");
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.log("[geocodeAddressPublic] GOOGLE_MAPS_API_KEY not configured");
      throw new Error("GEOCODING_UNAVAILABLE: Server configuration error");
    }

    try {
      const encodedAddress = encodeURIComponent(args.address);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

      console.log("[geocodeAddressPublic] Geocoding address for user:", userId, "address:", args.address);
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== "OK" || !data.results?.[0]) {
        console.log("[geocodeAddressPublic] Failed:", { address: args.address, status: data.status });
        throw new Error("ADDRESS_NOT_FOUND: Could not find this address. Please check and try again.");
      }

      const result = data.results[0];
      const location = result.geometry.location;
      const components = parseAddressComponents(result.address_components);

      console.log("[geocodeAddressPublic] Success:", {
        address: args.address,
        lat: location.lat,
        lng: location.lng,
        formattedAddress: result.formatted_address,
      });

      return {
        success: true,
        status: "OK",
        result: {
          lat: location.lat,
          lng: location.lng,
          formattedAddress: result.formatted_address,
          placeId: result.place_id,
          components,
        },
      };
    } catch (error) {
      if (error instanceof Error && (error.message.startsWith("ADDRESS_NOT_FOUND") || error.message.startsWith("Please sign in"))) {
        throw error;
      }
      console.log("[geocodeAddressPublic] Error:", error);
      throw new Error("GEOCODING_FAILED: Unable to geocode address. Please try again.");
    }
  },
});

// Geocode by full address string (legacy - kept for backward compatibility)
export const geocodeAddress = action({
  args: {
    address: v.string(),
  },
  handler: async (_ctx, args): Promise<GeocodeResponse> => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: "GOOGLE_MAPS_API_KEY not configured",
        status: "CONFIG_ERROR",
      };
    }

    try {
      const encodedAddress = encodeURIComponent(args.address);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== "OK") {
        return {
          success: false,
          error: data.error_message || `Geocoding failed: ${data.status}`,
          status: data.status,
        };
      }

      if (!data.results || data.results.length === 0) {
        return {
          success: false,
          error: "No results found",
          status: "ZERO_RESULTS",
        };
      }

      const result = data.results[0];
      const location = result.geometry.location;
      const components = parseAddressComponents(result.address_components);

      return {
        success: true,
        status: "OK",
        result: {
          lat: location.lat,
          lng: location.lng,
          formattedAddress: result.formatted_address,
          placeId: result.place_id,
          components,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error",
        status: "NETWORK_ERROR",
      };
    }
  },
});

// Geocode by place_id (more accurate when available)
export const geocodeByPlaceId = action({
  args: {
    placeId: v.string(),
  },
  handler: async (_ctx, args): Promise<GeocodeResponse> => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: "GOOGLE_MAPS_API_KEY not configured",
        status: "CONFIG_ERROR",
      };
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?place_id=${args.placeId}&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== "OK") {
        return {
          success: false,
          error: data.error_message || `Geocoding failed: ${data.status}`,
          status: data.status,
        };
      }

      if (!data.results || data.results.length === 0) {
        return {
          success: false,
          error: "No results found",
          status: "ZERO_RESULTS",
        };
      }

      const result = data.results[0];
      const location = result.geometry.location;
      const components = parseAddressComponents(result.address_components);

      return {
        success: true,
        status: "OK",
        result: {
          lat: location.lat,
          lng: location.lng,
          formattedAddress: result.formatted_address,
          placeId: result.place_id,
          components,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error",
        status: "NETWORK_ERROR",
      };
    }
  },
});
