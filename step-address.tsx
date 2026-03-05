import { useState } from 'react'
import { AddressInput } from '@/components/address/address-input'
import { ManualAddressForm } from '@/components/address/manual-address-form'
import { AddressMapPreview } from '@/components/address/address-map-preview'
import { NearbyCouriers } from '@/components/booking/nearby-couriers'
import { useBookingStore, StructuredAddress } from '@/stores/booking-store'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useQuery } from "convex/react"
import { api } from "@convex/api"
import { cn } from '@/lib/utils'
import { MapPin, Home, Building2, Star, ChevronDown, ChevronUp, Map, PenLine } from 'lucide-react'

export function StepAddress() {
  const { 
    pickupAddress, 
    pickupNotes, 
    isManualAddress,
    setPickupAddress,
    setAddressValid,
    updateBooking 
  } = useBookingStore()
  
  const [showSaved, setShowSaved] = useState(true)
  const savedAddresses = useQuery(api.addresses.getMySavedAddresses)

  const handleSelectSaved = (addr: any) => {
    const structuredAddress: StructuredAddress = {
      street1: addr.street1,
      street2: addr.street2,
      city: addr.city,
      state: addr.state,
      zipCode: addr.zipCode,
      country: addr.country,
      latitude: addr.latitude,
      longitude: addr.longitude,
      placeId: addr.placeId,
      label: addr.label,
    }
    setPickupAddress(structuredAddress)
    setAddressValid(true)
  }

  const getLabelIcon = (label: string) => {
    const lower = label.toLowerCase()
    if (lower.includes('home')) return Home
    if (lower.includes('work') || lower.includes('office')) return Building2
    return MapPin
  }

  const isAddressSelected = (addr: any) => {
    if (!pickupAddress) return false
    return (
      pickupAddress.street1 === addr.street1 &&
      pickupAddress.city === addr.city &&
      pickupAddress.zipCode === addr.zipCode
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* Mode Toggle */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">How would you like to enter your address?</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card
            className={cn(
              "p-4 cursor-pointer transition-all border-2",
              !isManualAddress
                ? "border-primary bg-primary/5"
                : "border-transparent bg-slate-900/50 hover:border-primary/50"
            )}
            onClick={() => {
              updateBooking({ isManualAddress: false })
              setAddressValid(false)
              setPickupAddress(null)
            }}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                !isManualAddress ? "bg-primary text-primary-foreground" : "bg-slate-800 text-slate-400"
              )}>
                <Map className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium">Use Map / Autocomplete</p>
                <p className="text-xs text-muted-foreground">Google-powered address lookup</p>
              </div>
            </div>
          </Card>
          
          <Card
            className={cn(
              "p-4 cursor-pointer transition-all border-2",
              isManualAddress
                ? "border-primary bg-primary/5"
                : "border-transparent bg-slate-900/50 hover:border-primary/50"
            )}
            onClick={() => {
              updateBooking({ isManualAddress: true })
              setAddressValid(false)
              setPickupAddress(null)
            }}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                isManualAddress ? "bg-primary text-primary-foreground" : "bg-slate-800 text-slate-400"
              )}>
                <PenLine className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium">Enter Manually</p>
                <p className="text-xs text-muted-foreground">No map required</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {!isManualAddress ? (
        <>
          {/* Saved Addresses Section */}
          {savedAddresses && savedAddresses.length > 0 && (
            <div className="space-y-3">
              <button
                onClick={() => setShowSaved(!showSaved)}
                className="flex items-center justify-between w-full text-left"
              >
                <div>
                  <h3 className="text-lg font-semibold">Saved Addresses</h3>
                  <p className="text-sm text-muted-foreground">
                    Quick select from your saved locations
                  </p>
                </div>
                {showSaved ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </button>

              {showSaved && (
                <div className="grid gap-2">
                  {savedAddresses.map((addr) => {
                    const Icon = getLabelIcon(addr.label)
                    const isSelected = isAddressSelected(addr)
                    
                    return (
                      <Card
                        key={addr._id}
                        className={cn(
                          "p-3 cursor-pointer transition-all border-2",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-transparent bg-slate-900/50 hover:border-primary/50"
                        )}
                        onClick={() => handleSelectSaved(addr)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg shrink-0",
                            isSelected ? "bg-primary text-primary-foreground" : "bg-slate-800 text-slate-400"
                          )}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={cn(
                                "font-medium",
                                isSelected && "text-primary"
                              )}>
                                {addr.label}
                              </p>
                              {addr.isDefault && (
                                <Badge variant="outline" className="text-[10px]">
                                  <Star className="w-2.5 h-2.5 mr-1" />
                                  Default
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {addr.street1}, {addr.city}, {addr.state}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                              <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-700" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or enter a new address
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Manual Address Entry */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-1">Pickup Address</h3>
              <p className="text-sm text-muted-foreground">
                Where should the courier pick up your package?
              </p>
            </div>
            
            <AddressInput
              value={pickupAddress}
              onChange={setPickupAddress}
              onValidChange={setAddressValid}
            />
          </div>

          {/* Map Preview */}
          <AddressMapPreview address={pickupAddress} />

          {/* Nearby Couriers */}
          {pickupAddress?.latitude && pickupAddress?.longitude && (
            <NearbyCouriers 
              latitude={pickupAddress.latitude} 
              longitude={pickupAddress.longitude}
            />
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-1">Manual Address</h3>
            <p className="text-sm text-muted-foreground">
              Enter your pickup details below
            </p>
          </div>
          <ManualAddressForm
            value={pickupAddress}
            onChange={(addr) => {
              setPickupAddress(addr)
              // For manual addresses, require coordinates to be valid
              const hasRequiredFields = !!(addr.street1 && addr.city && addr.state && addr.zipCode)
              const hasCoordinates = !!(addr.latitude && addr.longitude)
              setAddressValid(hasRequiredFields && hasCoordinates)
            }}
          />

          {/* Nearby Couriers for manual address */}
          {pickupAddress?.latitude && pickupAddress?.longitude && (
            <NearbyCouriers 
              latitude={pickupAddress.latitude} 
              longitude={pickupAddress.longitude}
              className="mt-4"
            />
          )}
        </div>
      )}

      {/* Pickup Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Pickup Instructions (Optional)</Label>
        <Textarea
          id="notes"
          placeholder="e.g., Ring doorbell, package is by the front door, gate code is 1234..."
          value={pickupNotes}
          onChange={(e) => updateBooking({ pickupNotes: e.target.value })}
          rows={3}
        />
      </div>
    </div>
  )
}
