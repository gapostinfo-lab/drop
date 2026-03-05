import { useState, useRef, useEffect } from 'react'
import { useBookingStore } from '@/stores/booking-store'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MapPin, Clock, Navigation, AlertCircle, Package, RefreshCw, MessageSquare, Loader2, List, Map as MapIcon } from 'lucide-react'
import { useQuery } from "convex/react"
import { api } from "@convex/api"
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AddressMapPreview } from '@/components/address/address-map-preview'
import { ManualHubPicker } from './manual-hub-picker'

// Type colors for badges
const typeColors: Record<string, string> = {
  amazon_hub: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  amazon_locker: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  amazon_counter: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  amazon_wholefoods: 'bg-green-500/20 text-green-400 border-green-500/30',
  amazon_kohls: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  ups: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  fedex: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  usps: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  dhl: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
  other: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

const typeLabels: Record<string, string> = {
  amazon_hub: 'Amazon Hub',
  amazon_locker: 'Amazon Locker',
  amazon_counter: 'Amazon Counter',
  amazon_wholefoods: 'Whole Foods',
  amazon_kohls: "Kohl's",
  ups: 'UPS Store',
  fedex: 'FedEx Office',
  usps: 'USPS',
  dhl: 'DHL',
  other: 'Other',
}

const CITY_CENTERS = {
  'New York': { lat: 40.7128, lng: -74.0060, label: 'New York City' },
  'Atlanta': { lat: 33.7490, lng: -84.3880, label: 'Atlanta, GA' },
  'Los Angeles': { lat: 34.0522, lng: -118.2437, label: 'Los Angeles, CA' },
}

// Common ZIP code prefixes to city mapping
const ZIP_TO_CITY: Record<string, string> = {
  '100': 'New York', '101': 'New York', '102': 'New York', '103': 'New York', '104': 'New York',
  '110': 'New York', '111': 'New York', '112': 'New York', '113': 'New York', '114': 'New York',
  '300': 'Atlanta', '303': 'Atlanta', '304': 'Atlanta', '305': 'Atlanta',
  '900': 'Los Angeles', '901': 'Los Angeles', '902': 'Los Angeles', '903': 'Los Angeles',
  '904': 'Los Angeles', '905': 'Los Angeles', '906': 'Los Angeles', '907': 'Los Angeles',
  '908': 'Los Angeles', '910': 'Los Angeles', '911': 'Los Angeles', '912': 'Los Angeles',
}

function detectCityFromZip(zipCode: string | undefined): string | null {
  if (!zipCode || zipCode.length < 3) return null
  const prefix = zipCode.substring(0, 3)
  return ZIP_TO_CITY[prefix] || null
}

export function StepLocation() {
  const { 
    pickupAddress, 
    dropoffLocationId, 
    dropoffLocationName,
    dropoffLocationAddress,
    dropoffLocationType,
    dropoffLatitude,
    dropoffLongitude,
    updateBooking, 
    serviceType, 
    carrier,
    isManualAddress 
  } = useBookingStore()
  const [filter, setFilter] = useState<string | null>(null)
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [selectionMode, setSelectionMode] = useState<'map' | 'manual'>('manual')
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})

  // Determine coordinates to use
  const hasCoordinates = !isManualAddress && !!(pickupAddress?.latitude && pickupAddress?.longitude)
  
  const coordinates = hasCoordinates 
    ? { lat: pickupAddress.latitude!, lng: pickupAddress.longitude! }
    : selectedCity 
      ? CITY_CENTERS[selectedCity as keyof typeof CITY_CENTERS]
      : null

  // Auto-detect city from ZIP for manual addresses
  useEffect(() => {
    if (isManualAddress && !hasCoordinates && !selectedCity && pickupAddress?.zipCode) {
      const detectedCity = detectCityFromZip(pickupAddress.zipCode)
      if (detectedCity) {
        setSelectedCity(detectedCity)
      }
    }
  }, [isManualAddress, hasCoordinates, selectedCity, pickupAddress?.zipCode])

  const locations = useQuery(
    api.hubLocations.getNearbyLocations,
    coordinates 
      ? {
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          limit: 15,
        }
      : "skip"
  )

  // Filter logic
  const filteredLocations = locations?.filter(loc => {
    const isAmazon = ['amazon_hub', 'amazon_locker', 'amazon_counter'].includes(loc.type)
    
    // For Amazon returns, show Amazon locations first
    if (serviceType === 'amazon_return') {
      if (filter) return loc.type === filter
      // Show all Amazon locations by default
      return isAmazon
    }
    
    // For other service types
    if (filter) {
      if (filter === 'amazon_all') return isAmazon
      return loc.type === filter
    }
    return true
  })

  // Get selected location details
  const selectedLocation = locations?.find(loc => loc._id === dropoffLocationId)

  // Handle location selection
  const handleSelect = (loc: any) => {
    updateBooking({
      dropoffLocationId: loc._id,
      dropoffLocationName: loc.name,
      dropoffLocationAddress: `${loc.address}, ${loc.city}, ${loc.state} ${loc.zipCode}`,
      dropoffLocationType: loc.type,
      dropoffLatitude: loc.latitude,
      dropoffLongitude: loc.longitude,
    })
  }

  const handleSelectById = (locationId: string) => {
    const loc = locations?.find(l => l._id === locationId)
    if (loc) handleSelect(loc)
  }

  // Scroll selected location into view
  useEffect(() => {
    if (dropoffLocationId && itemRefs.current[dropoffLocationId]) {
      itemRefs.current[dropoffLocationId]?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      })
    }
  }, [dropoffLocationId])

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold font-outfit">Select Drop-off Location</h2>
        <p className="text-muted-foreground">
          {serviceType === 'amazon_return' 
            ? 'Choose an Amazon return location near your pickup address'
            : `Choose a ${carrier || 'carrier'} drop-off location`}
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold">How would you like to select a drop-off location?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card
            className={cn(
              "p-4 cursor-pointer transition-all border-2",
              selectionMode === 'manual'
                ? "border-primary bg-primary/5"
                : "border-transparent bg-slate-900/50 hover:border-primary/50"
            )}
            onClick={() => setSelectionMode('manual')}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                selectionMode === 'manual' ? "bg-primary text-primary-foreground" : "bg-slate-800 text-slate-400"
              )}>
                <List className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium">
                  {serviceType === 'carrier_dropoff' && carrier 
                    ? `Choose ${carrier} Location` 
                    : 'Choose from Atlanta Hubs'}
                </p>
                <p className="text-xs text-muted-foreground">Browse verified drop-off locations</p>
              </div>
            </div>
          </Card>
          
          <Card
            className={cn(
              "p-4 cursor-pointer transition-all border-2",
              selectionMode === 'map'
                ? "border-primary bg-primary/5"
                : "border-transparent bg-slate-900/50 hover:border-primary/50"
            )}
            onClick={() => setSelectionMode('map')}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                selectionMode === 'map' ? "bg-primary text-primary-foreground" : "bg-slate-800 text-slate-400"
              )}>
                <MapIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium">Use Map / Nearby Search</p>
                <p className="text-xs text-muted-foreground">Find locations near your pickup address</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Selected Location Preview */}
      {dropoffLocationId && (
        <Card className="p-4 bg-primary/10 border-primary/30">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary text-primary-foreground shrink-0">
              <MapPin className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-bold font-outfit text-primary">{dropoffLocationName}</h3>
                <Badge className={typeColors[dropoffLocationType || ''] || typeColors.other}>
                  {typeLabels[dropoffLocationType || ''] || dropoffLocationType || 'Location'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {dropoffLocationAddress}
              </p>
              {selectedLocation?.distance !== undefined && (
                <p className="text-xs text-primary mt-1">{selectedLocation.distance.toFixed(1)} miles away</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => {
                // Open in maps
                const lat = dropoffLatitude || selectedLocation?.latitude
                const lng = dropoffLongitude || selectedLocation?.longitude
                const url = lat && lng 
                  ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dropoffLocationAddress || '')}`
                window.open(url, '_blank')
              }}
            >
              <Navigation className="w-4 h-4 mr-1" />
              Directions
            </Button>
          </div>
        </Card>
      )}

      {/* Manual Hub Picker Mode */}
      {selectionMode === 'manual' && (
        <ManualHubPicker
          selectedHubId={dropoffLocationId}
          onSelect={(hub) => {
            updateBooking({
              dropoffLocationId: hub._id as any,
              dropoffLocationName: hub.name,
              dropoffLocationAddress: `${hub.address}, ${hub.city}, ${hub.state} ${hub.zipCode}`,
              dropoffLocationType: hub.type as any,
              dropoffLatitude: hub.latitude,
              dropoffLongitude: hub.longitude,
            })
          }}
carrierType={serviceType === 'carrier_dropoff' && carrier ? carrier.toLowerCase() as 'ups' | 'fedex' | 'usps' | 'dhl' : undefined}
        />
      )}

      {/* Map-based Mode */}
      {selectionMode === 'map' && (
        <>
          {!hasCoordinates && !selectedCity && (
            <Card className="p-6 bg-slate-900/50 border-slate-700">
              <div className="text-center space-y-4">
                {isManualAddress ? (
                  <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto">
                    <AlertCircle className="w-6 h-6 text-yellow-500" />
                  </div>
                ) : (
                  <MapPin className="w-12 h-12 text-primary mx-auto" />
                )}
                <div>
                  <h3 className="font-semibold text-lg">
                    {isManualAddress ? "Manual Address Entered" : "Select Your City"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {isManualAddress 
                      ? "Since you entered your address manually, please select your city to find nearby drop-off locations."
                      : "Choose your city to see nearby drop-off locations"}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  {Object.entries(CITY_CENTERS).map(([key, city]) => (
                    <Button
                      key={key}
                      variant="outline"
                      onClick={() => setSelectedCity(key)}
                      className="min-w-[140px]"
                    >
                      {city.label}
                    </Button>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {isManualAddress && selectedCity && (
            <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg text-sm">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1">
                <span className="text-primary font-medium">Manual address: </span>
                <span className="text-muted-foreground">
                  {pickupAddress?.street1}, {pickupAddress?.city}, {pickupAddress?.state} {pickupAddress?.zipCode}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-500">
                  Manual Entry
                </Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2 text-primary hover:text-primary/80 hover:bg-primary/10"
                  onClick={() => setSelectedCity(null)}
                >
                  Change City
                </Button>
              </div>
            </div>
          )}

          {!isManualAddress && !hasCoordinates && selectedCity && (
            <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-500">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Showing locations near {CITY_CENTERS[selectedCity as keyof typeof CITY_CENTERS].label}. Distances are approximate.</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="ml-auto text-yellow-500 hover:text-yellow-400"
                onClick={() => setSelectedCity(null)}
              >
                Change
              </Button>
            </div>
          )}

          {/* Map Preview */}
          {!isManualAddress && (hasCoordinates || selectedCity) && (
            <AddressMapPreview 
              address={hasCoordinates ? pickupAddress : {
                street1: CITY_CENTERS[selectedCity as keyof typeof CITY_CENTERS].label,
                city: selectedCity!,
                state: '',
                zipCode: '',
                country: 'US',
                latitude: CITY_CENTERS[selectedCity as keyof typeof CITY_CENTERS].lat,
                longitude: CITY_CENTERS[selectedCity as keyof typeof CITY_CENTERS].lng
              }}
              nearbyLocations={filteredLocations}
              selectedLocationId={dropoffLocationId}
              onLocationSelect={handleSelectById}
              height="h-64"
            />
          )}

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            {serviceType === 'amazon_return' ? (
              <>
                <Button
                  variant={filter === null ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(null)}
                >
                  All Amazon
                </Button>
                <Button
                  variant={filter === 'amazon_locker' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('amazon_locker')}
                >
                  Lockers
                </Button>
                <Button
                  variant={filter === 'amazon_hub' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('amazon_hub')}
                >
                  Hubs
                </Button>
                <Button
                  variant={filter === 'amazon_counter' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('amazon_counter')}
                >
                  Counters
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant={filter === null ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(null)}
                >
                  All
                </Button>
                <Button
                  variant={filter === 'amazon_all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('amazon_all')}
                >
                  Amazon
                </Button>
                <Button
                  variant={filter === 'ups' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('ups')}
                >
                  UPS
                </Button>
                <Button
                  variant={filter === 'fedex' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('fedex')}
                >
                  FedEx
                </Button>
                <Button
                  variant={filter === 'usps' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('usps')}
                >
                  USPS
                </Button>
                <Button
                  variant={filter === 'dhl' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('dhl')}
                >
                  DHL
                </Button>
              </>
            )}
          </div>

          {/* Location List */}
          <div className="space-y-3">
            {locations === undefined ? (
              // Loading state
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <p className="text-sm font-medium">Searching for nearby locations...</p>
                </div>
                {Array(4).fill(0).map((_, i) => (
                  <Card key={i} className="p-4 bg-slate-900/50 border-transparent">
                    <div className="flex gap-4">
                      <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-5 w-2/3" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-1/4" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : filteredLocations && filteredLocations.length === 0 ? (
              // Empty state
              <Card className="p-8 bg-slate-900/50 border-slate-800 text-center">
                <Package className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No Locations Found</h3>
                <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
                  {serviceType === 'amazon_return'
                    ? "No Amazon drop-off locations found near your pickup address. Try expanding your search radius or contact support."
                    : "No drop-off locations found near your pickup address. Please try a different filter or contact our support team."}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {filter && (
                    <Button variant="outline" onClick={() => setFilter(null)}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Show All Locations
                    </Button>
                  )}
                  <Button variant="secondary">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Contact Support
                  </Button>
                </div>
              </Card>
            ) : (
              // Location cards
              filteredLocations?.map((loc: any) => {
                const isSelected = dropoffLocationId === loc._id
                return (
                  <Card
                    key={loc._id}
                    ref={el => { itemRefs.current[loc._id] = el }}
                    className={cn(
                      "p-4 cursor-pointer transition-all border-2",
                      isSelected 
                        ? "border-primary bg-primary/5" 
                        : "border-transparent bg-slate-900/50 hover:border-primary/50"
                    )}
                    onClick={() => handleSelect(loc)}
                  >
                    <div className="flex gap-4">
                      <div className={cn(
                        "p-3 rounded-xl shrink-0",
                        isSelected ? "bg-primary text-primary-foreground" : "bg-slate-800 text-slate-400"
                      )}>
                        <MapPin className="w-6 h-6" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className={cn(
                            "font-bold font-outfit",
                            isSelected ? "text-primary" : "text-slate-200"
                          )}>
                            {loc.name}
                          </h3>
                          <Badge className={typeColors[loc.type] || typeColors.other}>
                            {typeLabels[loc.type] || loc.type}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground">
                          {loc.address}, {loc.city}, {loc.state}
                        </p>
                        
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                          {loc.distance !== undefined && (
                            <span className="font-medium text-primary">
                              {loc.distance.toFixed(1)} mi
                            </span>
                          )}
                          {loc.hours && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {loc.hours}
                            </span>
                          )}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="flex items-center">
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <svg className="w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        </>
      )}

      {/* Help text */}
      {!selectedLocation && filteredLocations && filteredLocations.length > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          Tap a location to select it as your drop-off point
        </p>
      )}
    </div>
  )
}
