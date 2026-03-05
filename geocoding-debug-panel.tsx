import { useState } from "react"
import { useQuery } from "convex/react"
import { api } from "@convex/api"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface GeocodingDebugPanelProps {
  mode: 'autocomplete' | 'manual'
  fullAddressString: string
  placeId?: string | null
  lastGeocodeType?: 'address' | 'place_id' | 'autocomplete' | null
  lastGeocodeStatus?: string | null  // OK, ZERO_RESULTS, REQUEST_DENIED, etc.
  lastError?: string | null
  pickupLat?: number | null
  pickupLng?: number | null
  isGeocoding?: boolean
}

export function GeocodingDebugPanel({
  mode,
  fullAddressString,
  placeId,
  lastGeocodeType,
  lastGeocodeStatus,
  lastError,
  pickupLat,
  pickupLng,
  isGeocoding,
}: GeocodingDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const profile = useQuery(api.profiles.getMyProfile)
  const isAdmin = profile?.role === 'admin'

  if (!isAdmin) return null

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button 
        size="sm" 
        onClick={() => setIsExpanded(!isExpanded)}
        className="shadow-lg"
      >
        🔍 Geocode Debug
      </Button>
      
      {isExpanded && (
        <div className="mt-2 bg-slate-950/95 backdrop-blur border border-slate-800 rounded-lg p-4 w-80 text-xs font-mono shadow-2xl">
          <h3 className="font-bold text-slate-100 mb-3">Geocoding Debug</h3>
          
          <div className="space-y-2 text-slate-300">
            <Row label="Mode" value={mode} />
            <Row label="Address" value={fullAddressString || '(empty)'} truncate />
            <Row label="Place ID" value={placeId || '(none)'} truncate />
            <Row label="Last Request" value={lastGeocodeType || '(none)'} />
            <Row 
              label="Status" 
              value={lastGeocodeStatus || (isGeocoding ? 'Geocoding...' : '(none)')} 
              status={lastGeocodeStatus}
              loading={isGeocoding}
            />
            <Row 
              label="Lat/Lng" 
              value={pickupLat && pickupLng ? `${pickupLat.toFixed(6)}, ${pickupLng.toFixed(6)}` : '(not set)'} 
            />
            {lastError && <Row label="Error" value={lastError} error />}
          </div>
          
          <div className="mt-3 pt-3 border-t border-slate-800 text-[10px] text-slate-500">
            Hostname: {window.location.hostname}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ 
  label, 
  value, 
  truncate, 
  status, 
  error, 
  loading 
}: { 
  label: string; 
  value: string | null | undefined; 
  truncate?: boolean;
  status?: string | null;
  error?: boolean;
  loading?: boolean;
}) {
  const getStatusColor = (s: string | null | undefined) => {
    if (loading) return "text-blue-400"
    if (!s) return "text-slate-400"
    switch (s) {
      case 'OK': return "text-green-400"
      case 'ZERO_RESULTS': return "text-yellow-400"
      case 'REQUEST_DENIED':
      case 'NETWORK_ERROR':
      case 'CONFIG_ERROR':
        return "text-red-400"
      default: return "text-slate-400"
    }
  }

  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500 shrink-0">{label}:</span>
      <span className={cn(
        "text-right break-all",
        truncate && "truncate",
        error ? "text-red-400" : (status || loading ? getStatusColor(status) : "text-slate-300")
      )} title={value || ''}>
        {value}
      </span>
    </div>
  )
}
