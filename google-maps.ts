/**
 * Google Maps Utilities Library
 *
 * Provides geocoding, reverse geocoding, places autocomplete,
 * distance calculations, and script loading utilities.
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface AddressComponents {
  street1: string
  city: string
  state: string
  zipCode: string
  country: string
}

export interface GeocodedLocation {
  lat?: number
  lng?: number
  formattedAddress: string
  placeId: string
  components: AddressComponents
}

export interface LatLng {
  lat: number
  lng: number
}

export interface AutocompleteOptions {
  types?: string[]
  componentRestrictions?: { country: string | string[] }
}

// Extend Window interface for Google Maps
declare global {
  interface Window {
    google?: typeof google
    __googleMapsCallback?: () => void
  }
}

// ============================================================================
// Constants
// ============================================================================

export const ATLANTA_CENTER: LatLng = { lat: 33.749, lng: -84.388 }
export const DEFAULT_ZOOM = 11

const EARTH_RADIUS_MILES = 3958.8

// ============================================================================
// Script Loader
// ============================================================================

let loadPromise: Promise<typeof google.maps> | null = null

/**
 * Load the Google Maps JavaScript API with Places and Geometry libraries.
 * Returns a cached promise to prevent multiple loads.
 */
export function loadGoogleMapsScript(): Promise<typeof google.maps> {
  if (loadPromise) {
    return loadPromise
  }

  // Check if already loaded
  if (window.google?.maps) {
    loadPromise = Promise.resolve(window.google.maps)
    return loadPromise
  }

  loadPromise = new Promise((resolve, reject) => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      reject(new Error("VITE_GOOGLE_MAPS_API_KEY is not defined"))
      return
    }

    // Create callback function
    const callbackName = "__googleMapsCallback"
    window[callbackName] = () => {
      if (window.google?.maps) {
        resolve(window.google.maps)
      } else {
        reject(new Error("Google Maps failed to load"))
      }
      delete window[callbackName]
    }

    // Create and append script
    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&callback=${callbackName}`
    script.async = true
    script.defer = true

    script.onerror = () => {
      loadPromise = null
      delete window[callbackName]
      reject(new Error("Failed to load Google Maps script"))
    }

    document.head.appendChild(script)
  })

  return loadPromise
}

/**
 * Ensure Google Maps is loaded before using APIs.
 * Throws if not loaded.
 */
async function ensureGoogleMaps(): Promise<typeof google.maps> {
  const maps = await loadGoogleMapsScript()
  return maps
}

// ============================================================================
// Address Component Parser
// ============================================================================

/**
 * Parse Google address components into a structured format.
 */
function parseAddressComponents(
  components: google.maps.GeocoderAddressComponent[]
): AddressComponents {
  const result: AddressComponents = {
    street1: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
  }

  let streetNumber = ""
  let route = ""

  for (const component of components) {
    const types = component.types

    if (types.includes("street_number")) {
      streetNumber = component.long_name
    } else if (types.includes("route")) {
      route = component.long_name
    } else if (
      types.includes("locality") ||
      types.includes("sublocality") ||
      types.includes("sublocality_level_1")
    ) {
      // Prefer locality, but use sublocality if locality not found
      if (!result.city || types.includes("locality")) {
        result.city = component.long_name
      }
    } else if (types.includes("administrative_area_level_1")) {
      result.state = component.short_name
    } else if (types.includes("postal_code")) {
      result.zipCode = component.long_name
    } else if (types.includes("country")) {
      result.country = component.short_name
    }
  }

  // Combine street number and route
  result.street1 = [streetNumber, route].filter(Boolean).join(" ")

  return result
}

// ============================================================================
// Geocoding
// ============================================================================

/**
 * Geocode an address string to coordinates and structured address data.
 * Returns null if geocoding fails or no results found.
 */
export async function geocodeAddress(
  address: string
): Promise<GeocodedLocation | null> {
  try {
    await ensureGoogleMaps()

    const geocoder = new google.maps.Geocoder()

    const response = await geocoder.geocode({ address })

    if (!response.results || response.results.length === 0) {
      return null
    }

    const result = response.results[0]
    const location = result.geometry.location

    return {
      lat: location.lat(),
      lng: location.lng(),
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      components: parseAddressComponents(result.address_components),
    }
  } catch (error) {
    console.error("Geocoding error:", error)
    return null
  }
}

// ============================================================================
// Reverse Geocoding
// ============================================================================

/**
 * Reverse geocode coordinates to address data.
 * Returns null if reverse geocoding fails or no results found.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<Omit<GeocodedLocation, "lat" | "lng"> | null> {
  try {
    await ensureGoogleMaps()

    const geocoder = new google.maps.Geocoder()

    const response = await geocoder.geocode({
      location: { lat, lng },
    })

    if (!response.results || response.results.length === 0) {
      return null
    }

    const result = response.results[0]

    return {
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      components: parseAddressComponents(result.address_components),
    }
  } catch (error) {
    console.error("Reverse geocoding error:", error)
    return null
  }
}

// ============================================================================
// Places Autocomplete
// ============================================================================

/**
 * Set up Google Places Autocomplete on an input element.
 * Returns the Autocomplete instance for cleanup (call .unbindAll() when done).
 *
 * @param inputElement - The HTML input element to attach autocomplete to
 * @param onPlaceSelected - Callback when a place is selected
 * @param options - Autocomplete options (defaults to US addresses)
 */
export function setupPlacesAutocomplete(
  inputElement: HTMLInputElement,
  onPlaceSelected: (place: GeocodedLocation) => void,
  options?: AutocompleteOptions
): google.maps.places.Autocomplete {
  // Ensure Google Maps is loaded synchronously (caller should await loadGoogleMapsScript first)
  if (!window.google?.maps?.places) {
    throw new Error(
      "Google Maps Places library not loaded. Call loadGoogleMapsScript() first."
    )
  }

  const autocompleteOptions: google.maps.places.AutocompleteOptions = {
    types: options?.types ?? ["address"],
    componentRestrictions: options?.componentRestrictions ?? { country: "us" },
    fields: [
      "place_id",
      "formatted_address",
      "geometry",
      "address_components",
    ],
  }

  const autocomplete = new google.maps.places.Autocomplete(
    inputElement,
    autocompleteOptions
  )

  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace()

    const location: GeocodedLocation = {
      lat: place.geometry?.location?.lat(),
      lng: place.geometry?.location?.lng(),
      formattedAddress: place.formatted_address ?? "",
      placeId: place.place_id ?? "",
      components: place.address_components
        ? parseAddressComponents(place.address_components)
        : {
            street1: "",
            city: "",
            state: "",
            zipCode: "",
            country: "",
          },
    }

    onPlaceSelected(location)
  })

  return autocomplete
}

/**
 * Async version that loads Google Maps first, then sets up autocomplete.
 */
export async function setupPlacesAutocompleteAsync(
  inputElement: HTMLInputElement,
  onPlaceSelected: (place: GeocodedLocation) => void,
  options?: AutocompleteOptions
): Promise<google.maps.places.Autocomplete> {
  await loadGoogleMapsScript()
  return setupPlacesAutocomplete(inputElement, onPlaceSelected, options)
}

// ============================================================================
// Distance Calculation (Haversine Formula)
// ============================================================================

/**
 * Convert degrees to radians.
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180)
}

/**
 * Calculate the distance between two coordinates using the Haversine formula.
 * Returns distance in miles.
 */
export function calculateDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1)
  const dLng = toRadians(lng2 - lng1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS_MILES * c
}

/**
 * Calculate distance between two LatLng objects.
 */
export function calculateDistanceBetweenPoints(
  point1: LatLng,
  point2: LatLng
): number {
  return calculateDistanceMiles(point1.lat, point1.lng, point2.lat, point2.lng)
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if Google Maps is currently loaded.
 */
export function isGoogleMapsLoaded(): boolean {
  return !!window.google?.maps
}

/**
 * Format coordinates as a string.
 */
export function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

/**
 * Create a Google Maps URL for directions.
 */
export function createDirectionsUrl(
  destination: LatLng,
  origin?: LatLng
): string {
  const destParam = `${destination.lat},${destination.lng}`

  if (origin) {
    const originParam = `${origin.lat},${origin.lng}`
    return `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destParam}`
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${destParam}`
}

/**
 * Create a Google Maps URL for a place.
 */
export function createPlaceUrl(placeId: string): string {
  return `https://www.google.com/maps/place/?q=place_id:${placeId}`
}
