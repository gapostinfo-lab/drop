import { useCallback, useRef, useEffect } from 'react'
import { GoogleMap, useLoadScript, Marker, Circle } from '@react-google-maps/api'
import { Loader2 } from 'lucide-react'

interface AdminServiceAreaMapProps {
  center: { lat: number; lng: number }
  radiusMiles: number
}

const mapContainerStyle = {
  width: '100%',
  height: '280px',
  borderRadius: '12px',
}

const defaultMapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
  ],
}

const circleOptions: google.maps.CircleOptions = {
  strokeColor: '#3b82f6',
  strokeOpacity: 0.8,
  strokeWeight: 2,
  fillColor: '#3b82f6',
  fillOpacity: 0.15,
  clickable: false,
}

// Convert miles to meters
const milesToMeters = (miles: number) => miles * 1609.344

export function AdminServiceAreaMap({ center, radiusMiles }: AdminServiceAreaMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null)
  
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  })

  // Fit bounds to circle when center or radius changes
  const fitBoundsToCircle = useCallback(() => {
    if (!mapRef.current) return
    
    const radiusMeters = milesToMeters(radiusMiles)
    
    // Create a circle to get bounds
    const circle = new google.maps.Circle({
      center,
      radius: radiusMeters,
    })
    
    const bounds = circle.getBounds()
    if (bounds) {
      mapRef.current.fitBounds(bounds, 20) // 20px padding
    }
  }, [center, radiusMiles])

  // Fit bounds when center or radius changes
  useEffect(() => {
    if (isLoaded && mapRef.current) {
      fitBoundsToCircle()
    }
  }, [isLoaded, fitBoundsToCircle])

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
    fitBoundsToCircle()
  }, [fitBoundsToCircle])

  if (loadError) {
    return (
      <div className="h-[280px] w-full bg-muted rounded-xl flex items-center justify-center border-2 border-dashed border-destructive/30">
        <p className="text-sm text-destructive">Failed to load Google Maps</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="h-[280px] w-full bg-muted rounded-xl flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const radiusMeters = milesToMeters(radiusMiles)

  return (
    <div className="relative">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={10}
        options={defaultMapOptions}
        onLoad={onMapLoad}
      >
        {/* Center Marker */}
        <Marker
          position={center}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#3b82f6',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          }}
        />
        
        {/* Service Area Circle */}
        <Circle
          center={center}
          radius={radiusMeters}
          options={circleOptions}
        />
      </GoogleMap>
    </div>
  )
}
