import { useEffect, useRef, useState } from 'react'
import { loadGoogleMapsScript, ATLANTA_CENTER, DEFAULT_ZOOM } from '@/lib/google-maps'
import { MapPin, Loader2 } from 'lucide-react'
import { StructuredAddress } from './address-input'
import { cn } from '@/lib/utils'

interface AddressMapPreviewProps {
  address: StructuredAddress | null
  nearbyLocations?: Array<{
    _id: string
    name: string
    type: string
    address: string
    city: string
    state: string
    latitude?: number
    longitude?: number
    distance?: number
  }>
  selectedLocationId?: string | null
  onLocationSelect?: (locationId: string) => void
  height?: string
}

const darkMapStyles: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1e293b" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#cbd5e1" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#94a3b8" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#0f172a" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#64748b" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#334155" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#94a3b8" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#475569" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1e293b" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#cbd5e1" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#020617" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#475569" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#020617" }],
  },
]

export function AddressMapPreview({ 
  address, 
  nearbyLocations = [],
  selectedLocationId,
  onLocationSelect,
  height = 'aspect-video'
}: AddressMapPreviewProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const googleMapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null)
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Load Google Maps
  useEffect(() => {
    loadGoogleMapsScript()
      .then(() => setIsLoaded(true))
      .catch((err) => {
        console.error("Failed to load Google Maps:", err)
        setLoadError(err instanceof Error ? err.message : "Failed to load maps")
      })
  }, [])

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || googleMapRef.current) return

    const hasCoords = address?.latitude && address?.longitude
    const center = hasCoords 
      ? { lat: address.latitude!, lng: address.longitude! }
      : ATLANTA_CENTER
    const zoom = hasCoords ? 14 : DEFAULT_ZOOM

    googleMapRef.current = new google.maps.Map(mapRef.current, {
      center,
      zoom,
      styles: darkMapStyles,
      disableDefaultUI: true,
      zoomControl: true,
      clickableIcons: false,
    })

    infoWindowRef.current = new google.maps.InfoWindow()
  }, [isLoaded, address?.latitude, address?.longitude])

  // Update center and pickup marker when address changes
  useEffect(() => {
    if (!googleMapRef.current) return

    const hasCoords = address?.latitude && address?.longitude
    
    if (hasCoords) {
      const pos = { lat: address.latitude!, lng: address.longitude! }
      googleMapRef.current.setCenter(pos)
      googleMapRef.current.setZoom(14)

      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.setPosition(pos)
      } else {
        pickupMarkerRef.current = new google.maps.Marker({
          position: pos,
          map: googleMapRef.current,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: '#39FF14',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
          title: 'Pickup Location',
          zIndex: 1000,
        })
      }
    } else {
      // Default to Atlanta if no coordinates
      googleMapRef.current.setCenter(ATLANTA_CENTER)
      googleMapRef.current.setZoom(DEFAULT_ZOOM)
      
      if (pickupMarkerRef.current) {
        pickupMarkerRef.current.setMap(null)
        pickupMarkerRef.current = null
      }
    }
  }, [address?.latitude, address?.longitude])

  // Add location markers
  useEffect(() => {
    if (!googleMapRef.current) return

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    if (!nearbyLocations.length) return

    // Filter to only locations with coordinates
    const locationsWithCoords = nearbyLocations.filter(
      loc => loc.latitude !== undefined && loc.longitude !== undefined
    )

    // Add new markers
    locationsWithCoords.forEach(loc => {
      const isSelected = loc._id === selectedLocationId
      const marker = new google.maps.Marker({
        position: { lat: loc.latitude!, lng: loc.longitude! },
        map: googleMapRef.current!,
        icon: getMarkerIcon(loc.type, isSelected),
        title: loc.name,
        zIndex: isSelected ? 500 : 100,
      })

      marker.addListener('click', () => {
        onLocationSelect?.(loc._id)
        
        if (infoWindowRef.current) {
          const distanceText = loc.distance ? `<p class="text-xs mt-1 text-slate-400">${loc.distance.toFixed(1)} miles away</p>` : ''
          infoWindowRef.current.setContent(`
            <div class="p-2 min-w-[150px] bg-slate-900 text-white rounded">
              <p class="font-bold text-sm">${loc.name}</p>
              <p class="text-xs text-slate-300">${loc.address}</p>
              ${distanceText}
            </div>
          `)
          infoWindowRef.current.open(googleMapRef.current, marker)
        }
      })

      markersRef.current.push(marker)
    })

    // If we have locations and a pickup address, fit bounds
    if (address?.latitude && address?.longitude && locationsWithCoords.length > 0) {
      const bounds = new google.maps.LatLngBounds()
      bounds.extend({ lat: address.latitude, lng: address.longitude })
      locationsWithCoords.forEach(loc => {
        bounds.extend({ lat: loc.latitude!, lng: loc.longitude! })
      })
      googleMapRef.current.fitBounds(bounds, 50)
    }
  }, [nearbyLocations, selectedLocationId, address?.latitude, address?.longitude, onLocationSelect])

  if (loadError) {
    return (
      <div className={cn(height, "bg-muted rounded-xl flex items-center justify-center p-6 text-center")}>
        <div className="text-destructive">
          <p className="font-medium">Error loading map</p>
          <p className="text-sm opacity-80">{loadError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(height, "bg-slate-900 rounded-xl relative overflow-hidden group border border-slate-800")}>
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}
      
      <div ref={mapRef} className="w-full h-full" />

      {/* Hint overlay when no address provided */}
      {(!address || !address.latitude) && (
        <div className="absolute inset-x-4 top-4 z-10">
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 p-3 rounded-lg shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <p className="text-xs text-slate-200 font-medium">
                Enter your pickup address to see nearby drop-off locations
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Address label overlay when address provided */}
      {address && address.street1 && (
        <div className="absolute bottom-4 left-4 right-4 z-10 pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-lg p-3 shadow-2xl max-w-[280px]">
            <p className="font-semibold text-sm text-white truncate">{address.street1}</p>
            <p className="text-xs text-slate-400">
              {address.city}, {address.state} {address.zipCode}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function getMarkerIcon(type: string, isSelected: boolean) {
  if (isSelected) {
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: '#39FF14',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
    }
  }

  let color = '#94a3b8' // Default gray
  const lowerType = type.toLowerCase()
  if (lowerType.includes('amazon')) color = '#FF9900'
  else if (lowerType.includes('ups')) color = '#6B4423'
  else if (lowerType.includes('fedex')) color = '#4D148C'

  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 1.5,
  }
}
