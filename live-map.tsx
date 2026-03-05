import { GoogleMapRoute } from '@/components/maps'

interface LiveMapProps {
  pickupLocation?: { lat: number; lng: number; address: string }
  dropoffLocation?: { lat: number; lng: number; address: string }
  courierLocation?: { 
    latitude: number; 
    longitude: number; 
    heading?: number;
    updatedAt: number;
  }
  status: string
  eta?: string
  etaMinutes?: number
  distanceMiles?: number
}

export function LiveMap({ 
  pickupLocation, 
  dropoffLocation, 
  courierLocation, 
  status, 
  eta,
  etaMinutes: propEtaMinutes,
  distanceMiles
}: LiveMapProps) {
  // Parse numeric ETA from string if not provided as prop
  const etaMinutes = propEtaMinutes ?? (eta ? parseInt(eta.match(/\d+/)?.[0] || '0') : undefined)

  if (!pickupLocation || !dropoffLocation) {
    return (
      <div className="relative w-full aspect-video bg-slate-950 flex items-center justify-center rounded-xl border border-slate-800">
        <div className="text-slate-500 text-sm">Loading map data...</div>
      </div>
    )
  }

  return (
    <GoogleMapRoute
      pickupLocation={{
        lat: pickupLocation.lat,
        lng: pickupLocation.lng,
        address: pickupLocation.address
      }}
      dropoffLocation={{
        lat: dropoffLocation.lat,
        lng: dropoffLocation.lng,
        address: dropoffLocation.address
      }}
      courierLocation={courierLocation ? {
        lat: courierLocation.latitude,
        lng: courierLocation.longitude,
        heading: courierLocation.heading,
        updatedAt: courierLocation.updatedAt
      } : undefined}
      status={status}
      etaMinutes={etaMinutes}
      distanceMiles={distanceMiles}
      className="w-full h-full"
    />
  )
}
