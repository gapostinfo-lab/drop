import { useState } from "react"
import { useQuery } from "convex/react"
import { api } from "@convex/api"
import { isGoogleMapsLoaded } from "@/lib/google-maps"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Bug, ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react"

interface MapsDebugPanelProps {
  pickupAddress?: {
    latitude?: number
    longitude?: number
    street1?: string
    city?: string
  } | null
  nearbyLocationsCount?: number
  lastError?: string | null
}

export function MapsDebugPanel({
  pickupAddress,
  nearbyLocationsCount,
  lastError,
}: MapsDebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Check if user is admin
  const profile = useQuery(api.profiles.getMyProfile)
  const isAdmin = profile?.role === "admin"

  if (!isAdmin) return null

  const mapsLoaded = isGoogleMapsLoaded()
  const placesAvailable = !!window.google?.maps?.places
  const apiKeyPresent = !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-background/80 backdrop-blur-sm shadow-md border-primary/20 hover:bg-background"
      >
        <Bug className="h-4 w-4 mr-2 text-primary" />
        Debug
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 ml-2" />
        ) : (
          <ChevronUp className="h-4 w-4 ml-2" />
        )}
      </Button>

      {isExpanded && (
        <div className="w-80 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-lg shadow-2xl overflow-hidden text-[11px] font-mono text-slate-300">
          <div className="bg-slate-900 px-3 py-2 border-b border-slate-800 flex justify-between items-center">
            <span className="font-bold text-slate-100 uppercase tracking-wider">Maps Debug Panel</span>
          </div>
          
          <div className="p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span>Google Maps:</span>
              <StatusBadge loaded={mapsLoaded} label={mapsLoaded ? "Loaded" : "Not Loaded"} />
            </div>
            
            <div className="flex justify-between items-center">
              <span>Places API:</span>
              <StatusBadge loaded={placesAvailable} label={placesAvailable ? "Available" : "Missing"} />
            </div>
            
            <div className="flex justify-between items-center">
              <span>API Key:</span>
              <StatusBadge loaded={apiKeyPresent} label={apiKeyPresent ? "Present" : "Missing"} />
            </div>

            <div className="pt-1 border-t border-slate-800 mt-2">
              <div className="flex justify-between mb-1">
                <span className="text-slate-500 text-[10px]">PICKUP LAT/LNG</span>
              </div>
              <div className="bg-slate-900/50 p-1.5 rounded border border-slate-800/50">
                {pickupAddress?.latitude && pickupAddress?.longitude ? (
                  <span className="text-emerald-400">
                    {pickupAddress.latitude.toFixed(6)}, {pickupAddress.longitude.toFixed(6)}
                  </span>
                ) : (
                  <span className="text-slate-500 italic">Not set</span>
                )}
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-500 text-[10px]">NEARBY RESULTS</span>
                <span className={cn(
                  "font-bold",
                  (nearbyLocationsCount ?? 0) > 0 ? "text-emerald-400" : "text-amber-400"
                )}>
                  {nearbyLocationsCount ?? 0}
                </span>
              </div>
            </div>

            {lastError && (
              <div className="pt-1 border-t border-slate-800">
                <div className="text-rose-400 mb-1 text-[10px] font-bold">LAST ERROR</div>
                <div className="bg-rose-950/30 p-1.5 rounded border border-rose-900/30 text-rose-300 break-words">
                  {lastError}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ loaded, label }: { loaded: boolean; label: string }) {
  return (
    <div className={cn(
      "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
      loaded ? "bg-emerald-950/30 text-emerald-400 border border-emerald-900/30" : "bg-rose-950/30 text-rose-400 border border-rose-900/30"
    )}>
      {loaded ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </div>
  )
}
