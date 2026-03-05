import { useEffect, useRef, useState } from 'react'
import { Loader2, Navigation, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Location {
  lat: number
  lng: number
  address?: string
}

interface GoogleMapRouteProps {
  pickupLocation: Location
  dropoffLocation: Location
  courierLocation?: {
    lat: number
    lng: number
    heading?: number
    updatedAt?: number
  }
  status: string
  etaMinutes?: number
  distanceMiles?: number
  className?: string
}

// Global flag to track if Google Maps is loading
let isLoadingGoogleMaps = false
let googleMapsLoadPromise: Promise<void> | null = null

function loadGoogleMapsScript(): Promise<void> {
  if (window.google?.maps) {
    return Promise.resolve()
  }
  
  if (googleMapsLoadPromise) {
    return googleMapsLoadPromise
  }
  
  if (isLoadingGoogleMaps) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)
    })
  }
  
  isLoadingGoogleMaps = true
  
  googleMapsLoadPromise = new Promise((resolve, reject) => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      reject(new Error('Google Maps API key not configured'))
      return
    }
    
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`
    script.async = true
    script.defer = true
    script.onload = () => {
      isLoadingGoogleMaps = false
      resolve()
    }
    script.onerror = () => {
      isLoadingGoogleMaps = false
      reject(new Error('Failed to load Google Maps'))
    }
    document.head.appendChild(script)
  })
  
  return googleMapsLoadPromise
}

export function GoogleMapRoute({
  pickupLocation,
  dropoffLocation,
  courierLocation,
  status,
  etaMinutes,
  distanceMiles,
  className,
}: GoogleMapRouteProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null)
  const dropoffMarkerRef = useRef<google.maps.Marker | null>(null)
  const courierMarkerRef = useRef<google.maps.Marker | null>(null)
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)
  
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initialize map
  useEffect(() => {
    if (mapInstanceRef.current) return
    
    let mounted = true
    
    async function initMap() {
      try {
        await loadGoogleMapsScript()
        
        if (!mounted || !mapRef.current) return
        
        // Validate we have at least one valid location
        const hasValidLocation = 
          (pickupLocation?.lat && pickupLocation?.lng) ||
          (dropoffLocation?.lat && dropoffLocation?.lng) ||
          (courierLocation?.lat && courierLocation?.lng)

        if (!hasValidLocation) {
          setError('Waiting for location data...')
          setIsLoading(false)
          return
        }

        // Clear waiting error if we now have location
        if (error === 'Waiting for location data...') {
          setError(null)
          setIsLoading(true)
        }

        // Determine initial center - prefer courier, then pickup
        const getInitialCenter = () => {
          if (courierLocation?.lat && courierLocation?.lng) {
            return { lat: courierLocation.lat, lng: courierLocation.lng }
          }
          if (pickupLocation?.lat && pickupLocation?.lng) {
            return { lat: pickupLocation.lat, lng: pickupLocation.lng }
          }
          // Default to a reasonable US location if nothing else
          return { lat: 39.8283, lng: -98.5795 } // Center of US
        }

        // Create map
        const map = new google.maps.Map(mapRef.current, {
          zoom: 14,
          center: getInitialCenter(),
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: [
            // Dark mode styles
            { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a2e' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#8b8b8b' }] },
            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
            { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a1a2e' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e0e1a' }] },
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          ],
        })
        
        mapInstanceRef.current = map
        
        // Create pickup marker (blue)
        pickupMarkerRef.current = new google.maps.Marker({
          position: pickupLocation,
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: '#3b82f6',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          },
          title: 'Pickup',
        })
        
        // Create dropoff marker (green)
        dropoffMarkerRef.current = new google.maps.Marker({
          position: dropoffLocation,
          map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: '#22c55e',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          },
          title: 'Drop-off',
        })
        
        // Create directions renderer
        directionsRendererRef.current = new google.maps.DirectionsRenderer({
          map,
          suppressMarkers: true, // We use custom markers
          polylineOptions: {
            strokeColor: '#BAFF29',
            strokeWeight: 4,
            strokeOpacity: 0.8,
          },
        })
        
        // Fit bounds to show both markers
        const bounds = new google.maps.LatLngBounds()
        bounds.extend(pickupLocation)
        bounds.extend(dropoffLocation)
        map.fitBounds(bounds, 60)
        
        setIsLoading(false)
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load map')
          setIsLoading(false)
        }
      }
    }
    
    initMap()
    
    return () => {
      mounted = false
    }
  }, [pickupLocation, dropoffLocation, courierLocation, error]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update route when locations change
  useEffect(() => {
    if (!mapInstanceRef.current || !directionsRendererRef.current) return
    if (!pickupLocation.lat || !dropoffLocation.lat) return
    
    const directionsService = new google.maps.DirectionsService()
    
    // Determine route origin based on status
    let origin: google.maps.LatLngLiteral
    let destination: google.maps.LatLngLiteral
    
    const isPickedUp = ['picked_up', 'dropped_off', 'completed'].includes(status)
    
    if (courierLocation && !isPickedUp) {
      // Before pickup: route from courier to pickup
      origin = { lat: courierLocation.lat, lng: courierLocation.lng }
      destination = pickupLocation
    } else if (courierLocation && isPickedUp) {
      // After pickup: route from courier to dropoff
      origin = { lat: courierLocation.lat, lng: courierLocation.lng }
      destination = dropoffLocation
    } else {
      // No courier yet: show pickup to dropoff
      origin = pickupLocation
      destination = dropoffLocation
    }
    
    directionsService.route(
      {
        origin,
        destination,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK' && result) {
          directionsRendererRef.current?.setDirections(result)
        }
      }
    )
  }, [pickupLocation, dropoffLocation, courierLocation, status])

  // Update courier marker position
  useEffect(() => {
    if (!mapInstanceRef.current || !courierLocation?.lat || !courierLocation?.lng) return
    
    const position = { lat: courierLocation.lat, lng: courierLocation.lng }
    
    if (!courierMarkerRef.current) {
      // Create courier marker
      courierMarkerRef.current = new google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 8,
          fillColor: '#BAFF29',
          fillOpacity: 1,
          strokeColor: '#000000',
          strokeWeight: 2,
          rotation: courierLocation.heading || 0,
        },
        title: 'Courier',
        zIndex: 100,
      })
    } else {
      // Update existing marker
      courierMarkerRef.current.setPosition(position)
      
      // Update rotation if heading changed
      if (courierLocation.heading !== undefined) {
        const icon = courierMarkerRef.current.getIcon() as google.maps.Symbol
        if (icon) {
          courierMarkerRef.current.setIcon({
            ...icon,
            rotation: courierLocation.heading,
          })
        }
      }
    }
    
    // Smoothly pan map to keep courier in view
    const map = mapInstanceRef.current
    const bounds = map.getBounds()
    if (bounds && !bounds.contains(position)) {
      map.panTo(position)
    }
  }, [courierLocation])

  // Update marker positions
  useEffect(() => {
    if (pickupMarkerRef.current && pickupLocation.lat) {
      pickupMarkerRef.current.setPosition(pickupLocation)
    }
    if (dropoffMarkerRef.current && dropoffLocation.lat) {
      dropoffMarkerRef.current.setPosition(dropoffLocation)
    }
  }, [pickupLocation, dropoffLocation])

  return (
    <div className={cn("relative w-full aspect-video rounded-xl overflow-hidden border border-slate-800", className)}>
      {/* Map Container */}
      <div ref={mapRef} className="absolute inset-0" />
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
          <div className="text-center p-4">
            {error.includes('Waiting') ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{error}</p>
              </>
            ) : (
              <>
                <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
                <p className="text-sm text-destructive">{error}</p>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* ETA Overlay */}
      {!isLoading && etaMinutes !== undefined && (
        <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700">
          <div className="text-xs text-slate-400 uppercase font-bold">ETA</div>
          <div className="text-xl font-bold text-primary">{etaMinutes} min</div>
          {distanceMiles !== undefined && (
            <div className="text-xs text-slate-500">{distanceMiles.toFixed(1)} mi</div>
          )}
        </div>
      )}
      
      {/* Status Badge */}
      {!isLoading && (
        <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-bold text-primary uppercase">
              {status === 'requested' ? 'Finding courier...' :
               status === 'matched' ? 'Courier assigned' :
               status === 'en_route' ? 'En route to pickup' :
               status === 'arrived' ? 'At pickup' :
               status === 'picked_up' ? 'Heading to dropoff' :
               status === 'dropped_off' ? 'At dropoff' :
               status === 'completed' ? 'Complete' : status}
            </span>
          </div>
        </div>
      )}
      
      {/* Legend */}
      {!isLoading && (
        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700 space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-slate-400">Pickup</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-slate-400">Drop-off</span>
          </div>
          {courierLocation && (
            <div className="flex items-center gap-2 text-xs">
              <Navigation className="w-3 h-3 text-primary" />
              <span className="text-slate-400">Courier</span>
            </div>
          )}
        </div>
      )}

      {/* Center on Courier Button */}
      {courierLocation && mapInstanceRef.current && (
        <button
          onClick={() => {
            if (mapInstanceRef.current && courierLocation) {
              mapInstanceRef.current.panTo({ lat: courierLocation.lat, lng: courierLocation.lng })
              mapInstanceRef.current.setZoom(16)
            }
          }}
          className="absolute bottom-4 right-4 z-10 bg-background/90 backdrop-blur-sm p-2 rounded-full shadow-lg border border-border hover:bg-muted transition-colors"
          title="Center on courier"
        >
          <Navigation className="w-5 h-5 text-primary" />
        </button>
      )}
    </div>
  )
}
