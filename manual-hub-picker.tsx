import { useState, useEffect } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@convex/api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Search, Check, RefreshCw } from 'lucide-react'

export interface Hub {
  _id: string
  name: string
  type: string
  address: string
  city: string
  state: string
  zipCode: string
  notes?: string
  hours?: string
  latitude?: number
  longitude?: number
}

interface ManualHubPickerProps {
  selectedHubId: string | null
  onSelect: (hub: Hub) => void
  carrierType?: 'ups' | 'fedex' | 'usps' | 'dhl' | null  // Filter by carrier type
}

const getTypeBadge = (type: string) => {
  const colors: Record<string, string> = {
    ups: 'bg-amber-500/20 text-amber-400',
    fedex: 'bg-purple-500/20 text-purple-400',
    usps: 'bg-blue-500/20 text-blue-400',
    dhl: 'bg-yellow-500/20 text-yellow-500',
    amazon_wholefoods: 'bg-green-500/20 text-green-400',
    amazon_kohls: 'bg-orange-500/20 text-orange-400',
  };
  return colors[type] || 'bg-gray-500/20 text-gray-400';
};

export function ManualHubPicker({ selectedHubId, onSelect, carrierType }: ManualHubPickerProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false)

  const locations = useQuery(
    carrierType 
      ? api.hubLocations.listHubsByCarrier 
      : api.hubLocations.listActiveLocations,
    carrierType 
      ? { carrier: carrierType }
      : {}
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTimeoutMessage(true)
    }, 10000)
    return () => clearTimeout(timer)
  }, [])

  // Still loading
  if (locations === undefined) {
    return (
      <div className="space-y-4 p-2">
        <div className="p-8 bg-gray-800/50 border border-gray-700 rounded-xl text-center">
          <RefreshCw className="w-10 h-10 animate-spin mx-auto mb-4 text-primary" />
          <p className="font-bold text-lg">Loading drop-off locations...</p>
          {showTimeoutMessage && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-gray-400">Having trouble loading? Try refreshing the page or check your connection.</p>
              <Button 
                onClick={() => window.location.reload()}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Page
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Filter by carrier type if specified
  let filtered = locations;

  // Then filter by search query
  if (searchQuery) {
    filtered = filtered.filter(h => 
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.zipCode.includes(searchQuery)
    )
  }

  if (carrierType && locations && locations.length === 0) {
    return (
      <div className="p-8 bg-gray-800/50 border border-gray-700 rounded-xl text-center">
        <p className="text-gray-400">No {carrierType.toUpperCase()} locations found in this area.</p>
        <p className="text-sm text-gray-500 mt-2">Try selecting a different carrier or contact support.</p>
      </div>
    )
  }

  if (locations.length === 0) {
    return (
      <div className="p-8 bg-gray-800/50 border border-gray-700 rounded-xl text-center">
        <p className="text-gray-400">No locations found.</p>
        <Button 
          onClick={() => window.location.reload()}
          variant="link"
          className="mt-2 text-primary"
        >
          Try Refreshing
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Status */}
      <div className="p-2 rounded text-sm text-center text-white bg-green-600/20 border border-green-500/30">
        <span className="text-green-400">✅ Loaded {locations.length} total locations</span>
        {carrierType && (
          <span className="text-gray-400 ml-1">
            (showing {filtered.length} {carrierType.toUpperCase()} locations)
          </span>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <Input 
          placeholder="Search locations..." 
          className="pl-10 h-12 text-lg"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Count */}
      <p className="text-center text-sm text-gray-400">
        {filtered.length === 0 ? 'No matching locations' : `${filtered.length} locations - tap to select`}
      </p>

      {/* List */}
      <div className="space-y-2 pb-40">
        {filtered.map((hub) => {
          const isSelected = selectedHubId === hub._id
          return (
            <div
              key={hub._id}
              onClick={() => onSelect(hub)}
              className={cn(
                "p-4 rounded-xl border-2 cursor-pointer transition-all active:scale-[0.98]",
                isSelected 
                  ? "border-green-500 bg-green-500/20" 
                  : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "font-bold",
                    isSelected ? "text-green-400" : "text-white"
                  )}>
                    {hub.name}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    {hub.address}, {hub.city}, {hub.state}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("text-xs px-2 py-0.5 rounded", getTypeBadge(hub.type))}>
                      {hub.type.toUpperCase()}
                    </span>
                  </div>
                  {hub.notes && (
                    <p className="text-xs text-green-400 mt-1">{hub.notes}</p>
                  )}
                  {hub.hours && (
                    <p className="text-xs text-gray-500 mt-1">Hours: {hub.hours}</p>
                  )}
                </div>
                {isSelected && (
                  <Check className="w-6 h-6 text-green-500 ml-2 shrink-0" />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
