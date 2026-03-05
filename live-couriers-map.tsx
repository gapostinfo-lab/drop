import { useEffect, useRef, useState, useCallback } from 'react'
import { loadGoogleMapsScript, ATLANTA_CENTER } from '@/lib/google-maps'
import { Loader2, MapPin, AlertCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface CourierLocation {
  courierId: string
  fullName: string
  latitude: number | null
  longitude: number | null
  lastUpdated: number | null
  isStale: boolean
  currentJobId: string | null
  vehicleType?: string
}

interface LiveCouriersMapProps {
  couriers: CourierLocation[]
  selectedCourierId?: string | null
  onCourierSelect?: (courierId: string | null) => void
  height?: string
}

// Dark map style for consistency with the app theme
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
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#475569" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#020617" }],
  },
]

export function LiveCouriersMap({ 
  couriers, 
  selectedCourierId, 
  onCourierSelect,
  height = "h-[500px]" 
}: LiveCouriersMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const googleMapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map())
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Filter couriers with valid locations
  const couriersWithLocation = couriers.filter(
    c => c.latitude !== null && 
         c.longitude !== null && 
         !isNaN(c.latitude) && 
         !isNaN(c.longitude)
  )

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

    googleMapRef.current = new google.maps.Map(mapRef.current, {
      center: ATLANTA_CENTER,
      zoom: 11,
      styles: darkMapStyles,
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    })

    infoWindowRef.current = new google.maps.InfoWindow()
  }, [isLoaded])

  // Create marker icon
  const createMarkerIcon = useCallback((isStale: boolean, isSelected: boolean) => {
    const color = isSelected ? '#39FF14' : (isStale ? '#EAB308' : '#22C55E')
    const scale = isSelected ? 12 : 10
    
    return {
      path: google.maps.SymbolPath.CIRCLE,
      scale,
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: isSelected ? 3 : 2,
    }
  }, [])

  // Update markers when couriers change
  useEffect(() => {
    if (!googleMapRef.current || !isLoaded) return

    const map = googleMapRef.current
    const currentMarkers = markersRef.current
    const newMarkerIds = new Set(couriersWithLocation.map(c => c.courierId))

    // Remove markers for couriers no longer in the list
    currentMarkers.forEach((marker, courierId) => {
      if (!newMarkerIds.has(courierId)) {
        marker.setMap(null)
        currentMarkers.delete(courierId)
      }
    })

    // Add or update markers
    couriersWithLocation.forEach(courier => {
      const isSelected = courier.courierId === selectedCourierId
      const position = { lat: courier.latitude!, lng: courier.longitude! }

      let marker = currentMarkers.get(courier.courierId)

      if (marker) {
        // Update existing marker
        marker.setPosition(position)
        marker.setIcon(createMarkerIcon(courier.isStale, isSelected))
        marker.setZIndex(isSelected ? 1000 : 100)
      } else {
        // Create new marker
        marker = new google.maps.Marker({
          position,
          map,
          icon: createMarkerIcon(courier.isStale, isSelected),
          title: courier.fullName,
          zIndex: isSelected ? 1000 : 100,
        })

        // Add click listener
        marker.addListener('click', () => {
          onCourierSelect?.(courier.courierId)
          
          if (infoWindowRef.current) {
            const lastUpdatedText = courier.lastUpdated 
              ? formatDistanceToNow(courier.lastUpdated, { addSuffix: true })
              : 'Unknown'
            
            const statusBadge = courier.isStale 
              ? '<span style="background:#EAB308;color:#000;padding:2px 6px;border-radius:4px;font-size:10px;">STALE</span>'
              : '<span style="background:#22C55E;color:#000;padding:2px 6px;border-radius:4px;font-size:10px;">ACTIVE</span>'
            
            const jobBadge = courier.currentJobId 
              ? '<span style="background:#3B82F6;color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;margin-left:4px;">ON JOB</span>'
              : ''

            infoWindowRef.current.setContent(`
              <div style="padding:8px;min-width:180px;color:#1e293b;">
                <div style="font-weight:bold;font-size:14px;margin-bottom:4px;">${courier.fullName}</div>
                <div style="display:flex;gap:4px;margin-bottom:6px;">${statusBadge}${jobBadge}</div>
                ${courier.vehicleType ? `<div style="font-size:12px;color:#64748b;margin-bottom:2px;">🚗 ${courier.vehicleType}</div>` : ''}
                <div style="font-size:11px;color:#64748b;">📍 ${courier.latitude!.toFixed(5)}, ${courier.longitude!.toFixed(5)}</div>
                <div style="font-size:11px;color:#64748b;">🕐 Updated ${lastUpdatedText}</div>
              </div>
            `)
            infoWindowRef.current.open(map, marker)
          }
        })

        currentMarkers.set(courier.courierId, marker)
      }
    })

    // Fit bounds to show all markers
    if (couriersWithLocation.length > 0) {
      if (couriersWithLocation.length === 1) {
        // Single courier - center and zoom
        const courier = couriersWithLocation[0]
        map.setCenter({ lat: courier.latitude!, lng: courier.longitude! })
        map.setZoom(14)
      } else {
        // Multiple couriers - fit bounds
        const bounds = new google.maps.LatLngBounds()
        couriersWithLocation.forEach(courier => {
          bounds.extend({ lat: courier.latitude!, lng: courier.longitude! })
        })
        map.fitBounds(bounds, 50)
      }
    }
  }, [couriersWithLocation, selectedCourierId, isLoaded, createMarkerIcon, onCourierSelect])

  // Handle selected courier change - pan to marker
  useEffect(() => {
    if (!googleMapRef.current || !selectedCourierId) return

    const selectedCourier = couriersWithLocation.find(c => c.courierId === selectedCourierId)
    if (selectedCourier && selectedCourier.latitude && selectedCourier.longitude) {
      googleMapRef.current.panTo({ lat: selectedCourier.latitude, lng: selectedCourier.longitude })
      
      // Open info window for selected courier
      const marker = markersRef.current.get(selectedCourierId)
      if (marker && infoWindowRef.current) {
        const lastUpdatedText = selectedCourier.lastUpdated 
          ? formatDistanceToNow(selectedCourier.lastUpdated, { addSuffix: true })
          : 'Unknown'
        
        const statusBadge = selectedCourier.isStale 
          ? '<span style="background:#EAB308;color:#000;padding:2px 6px;border-radius:4px;font-size:10px;">STALE</span>'
          : '<span style="background:#22C55E;color:#000;padding:2px 6px;border-radius:4px;font-size:10px;">ACTIVE</span>'
        
        const jobBadge = selectedCourier.currentJobId 
          ? '<span style="background:#3B82F6;color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;margin-left:4px;">ON JOB</span>'
          : ''

        infoWindowRef.current.setContent(`
          <div style="padding:8px;min-width:180px;color:#1e293b;">
            <div style="font-weight:bold;font-size:14px;margin-bottom:4px;">${selectedCourier.fullName}</div>
            <div style="display:flex;gap:4px;margin-bottom:6px;">${statusBadge}${jobBadge}</div>
            ${selectedCourier.vehicleType ? `<div style="font-size:12px;color:#64748b;margin-bottom:2px;">🚗 ${selectedCourier.vehicleType}</div>` : ''}
            <div style="font-size:11px;color:#64748b;">📍 ${selectedCourier.latitude!.toFixed(5)}, ${selectedCourier.longitude!.toFixed(5)}</div>
            <div style="font-size:11px;color:#64748b;">🕐 Updated ${lastUpdatedText}</div>
          </div>
        `)
        infoWindowRef.current.open(googleMapRef.current, marker)
      }
    }
  }, [selectedCourierId, couriersWithLocation])

  // Error state
  if (loadError) {
    return (
      <div className={`${height} bg-slate-900 rounded-lg flex items-center justify-center`}>
        <div className="text-center p-8">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive font-medium">Failed to load map</p>
          <p className="text-sm text-muted-foreground mt-2">{loadError}</p>
        </div>
      </div>
    )
  }

  // No couriers with location
  if (couriersWithLocation.length === 0 && isLoaded) {
    return (
      <div className={`${height} bg-slate-900 rounded-lg relative overflow-hidden`}>
        <div ref={mapRef} className="w-full h-full opacity-30" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center p-8 bg-slate-900/80 rounded-xl backdrop-blur-sm">
            <MapPin className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground">No location data yet</p>
            <p className="text-sm text-muted-foreground/70 mt-2">
              {couriers.length > 0 
                ? "Online couriers haven't shared their location"
                : "No couriers are currently online"}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${height} bg-slate-900 rounded-lg relative overflow-hidden`}>
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}
      
      <div ref={mapRef} className="w-full h-full" />
      
      {/* Legend */}
      {isLoaded && couriersWithLocation.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-sm rounded-lg p-3 text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-slate-300">Active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-slate-300">Stale (&gt;2min)</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Courier count badge */}
      {isLoaded && couriersWithLocation.length > 0 && (
        <div className="absolute top-4 right-4 bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-sm font-bold">
          {couriersWithLocation.length} courier{couriersWithLocation.length !== 1 ? 's' : ''} on map
        </div>
      )}
    </div>
  )
}
