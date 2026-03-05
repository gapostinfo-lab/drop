import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '@convex/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { 
  MapPin, Home, Briefcase, Star, Plus, Edit2, 
  Check, Loader2, AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { AddressMapPreview } from './address-map-preview'
import { 
  loadGoogleMapsScript, 
  geocodeAddress as clientGeocode,
  setupPlacesAutocomplete,
  isGoogleMapsLoaded,
  type GeocodedLocation 
} from '@/lib/google-maps'

export interface StructuredAddress {
  street1: string
  street2?: string
  city: string
  state: string
  zipCode: string
  country: string
  latitude?: number
  longitude?: number
  placeId?: string
  label?: string
}

function buildFullAddressString(addr: StructuredAddress): string {
  const parts = [addr.street1]
  if (addr.street2) parts.push(addr.street2)
  parts.push(addr.city)
  parts.push(addr.state)
  parts.push(addr.zipCode)
  parts.push(addr.country || 'United States')
  return parts.filter(Boolean).join(', ')
}

interface AddressInputProps {
  value: StructuredAddress | null
  onChange: (address: StructuredAddress | null) => void
  onValidChange?: (isValid: boolean) => void
}

const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
]

export function AddressInput({ value, onChange, onValidChange }: AddressInputProps) {
  const savedAddresses = useQuery(api.addresses.getMySavedAddresses)
  const saveAddress = useMutation(api.addresses.saveAddress)
  const serverGeocode = useAction(api.geocoding.geocodeAddress)
  
  const [mode, setMode] = useState<'select' | 'manual'>('select')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveLabel, setSaveLabel] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(isGoogleMapsLoaded())
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const geocodeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Form state for manual entry
  const [formData, setFormData] = useState<StructuredAddress>({
    street1: '',
    street2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
  })

  // Load Google Maps on mount
  useEffect(() => {
    if (!isGoogleLoaded) {
      loadGoogleMapsScript()
        .then(() => setIsGoogleLoaded(true))
        .catch(() => {
          toast.error("Failed to load Google Maps. Address autocomplete may not work.")
        })
    }
  }, [isGoogleLoaded])

  // Sync form data with value prop
  useEffect(() => {
    if (value) {
      setFormData(value)
    }
  }, [value])

  const hasCoordinates = !!(formData.latitude && formData.longitude)
  const hasRequiredFields = !!(formData.street1 && formData.city && formData.state && formData.zipCode)
  const isValid = hasRequiredFields // Allow proceeding with just the required fields

  useEffect(() => {
    onValidChange?.(isValid)
  }, [isValid, onValidChange])

  // Geocode when address fields change (debounced fallback for manual entry)
  const triggerGeocode = useCallback(async (address: StructuredAddress) => {
    if (!address.street1 || !address.city || !address.state || !address.zipCode) {
      return
    }

    if (address.latitude && address.longitude) {
      return
    }

    setIsGeocoding(true)
    setGeocodeError(null)

    const fullAddress = buildFullAddressString(address)
    
    try {
      // Try server-side first (more reliable)
      const serverResult = await serverGeocode({ address: fullAddress })
      
      if (serverResult.success && serverResult.result) {
        const updated = {
          ...address,
          latitude: serverResult.result.lat,
          longitude: serverResult.result.lng,
          placeId: serverResult.result.placeId,
          city: address.city || serverResult.result.components.city,
          state: address.state || serverResult.result.components.state,
          zipCode: address.zipCode || serverResult.result.components.zipCode,
        }
        setFormData(updated)
        onChange(updated)
        setGeocodeError(null)
        return
      }
      
      // Server failed, try client-side fallback
      await loadGoogleMapsScript()
      const clientResult = await clientGeocode(fullAddress)
      
      if (clientResult) {
        const updated = {
          ...address,
          latitude: clientResult.lat,
          longitude: clientResult.lng,
          placeId: clientResult.placeId,
          city: address.city || clientResult.components.city,
          state: address.state || clientResult.components.state,
          zipCode: address.zipCode || clientResult.components.zipCode,
        }
        setFormData(updated)
        onChange(updated)
        setGeocodeError(null)
      } else {
        setGeocodeError("Address not found. Please check the street, city, and ZIP code.")
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to verify address"
      setGeocodeError(errorMsg)
    } finally {
      setIsGeocoding(false)
    }
  }, [onChange, serverGeocode])

  const handlePlaceSelected = useCallback((place: GeocodedLocation) => {
    const updated: StructuredAddress = {
      street1: place.components.street1 || formData.street1,
      street2: formData.street2,
      city: place.components.city || formData.city,
      state: place.components.state || formData.state,
      zipCode: place.components.zipCode || formData.zipCode,
      country: place.components.country || 'US',
      latitude: place.lat,
      longitude: place.lng,
      placeId: place.placeId,
    }
    
    setFormData(updated)
    onChange(updated)
    setGeocodeError(null)
    
    // If Places didn't return coordinates, trigger manual geocode
    if (!place.lat || !place.lng) {
      triggerGeocode(updated)
    }
  }, [onChange, formData, triggerGeocode])

  // Setup autocomplete when Google is loaded and input exists
  useEffect(() => {
    if (isGoogleLoaded && inputRef.current && mode === 'manual') {
      try {
        autocompleteRef.current = setupPlacesAutocomplete(
          inputRef.current,
          handlePlaceSelected,
          { types: ['address'], componentRestrictions: { country: 'us' } }
        )
      } catch (error) {
        // Silently fail
      }
    }
    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, [isGoogleLoaded, mode, handlePlaceSelected])

  // Debounced geocoding effect
  useEffect(() => {
    if (geocodeTimeoutRef.current) {
      clearTimeout(geocodeTimeoutRef.current)
    }

    const areFieldsComplete = !!(
      formData.street1 &&
      formData.city &&
      formData.state &&
      formData.zipCode &&
      formData.zipCode.length >= 5
    )

    if (areFieldsComplete && !hasCoordinates && mode === 'manual') {
      geocodeTimeoutRef.current = setTimeout(() => {
        triggerGeocode(formData)
      }, 1000)
    }

    return () => {
      if (geocodeTimeoutRef.current) {
        clearTimeout(geocodeTimeoutRef.current)
      }
    }
  }, [formData.street1, formData.city, formData.state, formData.zipCode, hasCoordinates, mode, triggerGeocode])

  const handleSelectSaved = (address: NonNullable<typeof savedAddresses>[number]) => {
    if (!address) return
    const structured: StructuredAddress = {
      street1: address.street1,
      street2: address.street2,
      city: address.city,
      state: address.state,
      zipCode: address.zipCode,
      country: address.country,
      latitude: address.latitude,
      longitude: address.longitude,
      placeId: address.placeId,
      label: address.label,
    }
    setFormData(structured)
    onChange(structured)
    
    // If saved address doesn't have coordinates, geocode it
    if (!structured.latitude || !structured.longitude) {
      triggerGeocode(structured)
    }
  }

  const handleFormChange = (field: keyof StructuredAddress, value: string) => {
    const updated = { 
      ...formData, 
      [field]: value,
      latitude: undefined,
      longitude: undefined,
    }
    setFormData(updated)
    onChange(updated)
    setGeocodeError(null)
  }

  const handleSaveAddress = async () => {
    if (!saveLabel.trim()) {
      toast.error('Please enter a label for this address')
      return
    }
    
    try {
      await saveAddress({
        label: saveLabel,
        street1: formData.street1,
        street2: formData.street2 || undefined,
        city: formData.city,
        state: formData.state,
        zipCode: formData.zipCode,
        country: formData.country,
        latitude: formData.latitude,
        longitude: formData.longitude,
        placeId: formData.placeId,
        isDefault,
      })
      toast.success('Address saved!')
      setShowSaveDialog(false)
      setSaveLabel('')
      setIsDefault(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save address')
    }
  }

  const getAddressIcon = (label: string) => {
    const lower = label.toLowerCase()
    if (lower.includes('home')) return Home
    if (lower.includes('work') || lower.includes('office')) return Briefcase
    return MapPin
  }

  const formatFullAddress = (addr: StructuredAddress) => {
    const parts = [addr.street1]
    if (addr.street2) parts.push(addr.street2)
    parts.push(`${addr.city}, ${addr.state} ${addr.zipCode}`)
    return parts.join(', ')
  }

  return (
    <div className="space-y-4">
      <AddressMapPreview address={formData} />
      
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === 'select' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('select')}
          className="flex-1"
        >
          <Star className="w-4 h-4 mr-2" />
          Saved Addresses
        </Button>
        <Button
          type="button"
          variant={mode === 'manual' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('manual')}
          className="flex-1"
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Enter Manually
        </Button>
      </div>

      {/* Saved Addresses Selection */}
      {mode === 'select' && (
        <div className="space-y-3">
          {savedAddresses === undefined ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : savedAddresses.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-6 text-center">
                <MapPin className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  No saved addresses yet
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMode('manual')}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Address
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2">
              {savedAddresses.map((addr) => {
                const Icon = getAddressIcon(addr.label)
                const isSelected = value?.street1 === addr.street1 && 
                                   value?.zipCode === addr.zipCode
                const hasCoords = !!(addr.latitude && addr.longitude)
                return (
                  <Card
                    key={addr._id}
                    className={cn(
                      "cursor-pointer transition-all hover:border-primary/50",
                      isSelected && "border-primary bg-primary/5"
                    )}
                    onClick={() => handleSelectSaved(addr)}
                  >
                    <CardContent className="p-3 flex items-start gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{addr.label}</p>
                          {addr.isDefault && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                          {!hasCoords && (
                            <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/30">
                              No GPS
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {addr.street1}, {addr.city}, {addr.state}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="w-5 h-5 text-primary shrink-0" />
                      )}
                    </CardContent>
                  </Card>
                )
              })}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setMode('manual')}
              >
                <Plus className="w-4 h-4 mr-2" />
                Use Different Address
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Manual Entry Form */}
      {mode === 'manual' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="street1">Street Address *</Label>
            <div className="relative">
              <Input
                id="street1"
                ref={inputRef}
                placeholder="Start typing your address..."
                value={formData.street1}
                onChange={(e) => handleFormChange('street1', e.target.value)}
                autoComplete="off"
              />
              {!isGoogleLoaded && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="street2">Apt, Suite, Unit (Optional)</Label>
            <Input
              id="street2"
              placeholder="Apt 4B"
              value={formData.street2 || ''}
              onChange={(e) => handleFormChange('street2', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                placeholder="New York"
                value={formData.city}
                onChange={(e) => handleFormChange('city', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Select
                value={formData.state}
                onValueChange={(v) => handleFormChange('state', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state.code} value={state.code}>
                      {state.code} - {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="zipCode">ZIP Code *</Label>
              <Input
                id="zipCode"
                placeholder="10001"
                maxLength={10}
                value={formData.zipCode}
                onChange={(e) => handleFormChange('zipCode', e.target.value.replace(/[^\d-]/g, ''))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value="United States"
                disabled
                className="bg-muted"
              />
            </div>
          </div>

          {/* Powered by Google Attribution */}
          <div className="flex justify-end">
            <img 
              src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png" 
              alt="Powered by Google"
              className="h-4 opacity-50 grayscale hover:opacity-100 transition-opacity"
            />
          </div>

          {/* Geocoding Status & Verification */}
          <div className="space-y-3">
            {!hasCoordinates && hasRequiredFields && !isGeocoding && !geocodeError && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => triggerGeocode(formData)}
                className="w-full"
              >
                <MapPin className="w-4 h-4 mr-2" />
                Verify Address
              </Button>
            )}

            {isGeocoding && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled
                className="w-full"
              >
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </Button>
            )}

            {geocodeError && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{geocodeError}</p>
                    <p className="text-xs mt-1 opacity-70">
                      Tried: {buildFullAddressString(formData)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {geocodeError && hasRequiredFields && !hasCoordinates && !isGeocoding && (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => triggerGeocode(formData)}
                  className="w-full"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Retry Verification
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    // Mark as valid even without coordinates
                    onValidChange?.(true)
                    toast.info("You can proceed. You'll select your city on the next step.")
                  }}
                  className="w-full"
                >
                  Continue Without Verification
                </Button>
              </div>
            )}

            {!geocodeError && !isGeocoding && hasRequiredFields && (
              hasCoordinates ? (
                <div className="p-3 rounded-lg bg-green-500/10 text-green-500 border border-green-500/20 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">Location verified</span>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">Address entered - you'll select your city on the next step</span>
                </div>
              )
            )}
          </div>

          {/* Save Address Button */}
          {isValid && !savedAddresses?.some(a => 
            a.street1 === formData.street1 && a.zipCode === formData.zipCode
          ) && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setShowSaveDialog(true)}
            >
              <Star className="w-4 h-4 mr-2" />
              Save This Address
            </Button>
          )}
        </div>
      )}

      {/* Selected Address Preview */}
      {value && isValid && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">Pickup Location</p>
                <p className="text-sm text-muted-foreground truncate">
                  {formatFullAddress(value)}
                </p>
                {value.latitude && value.longitude && (
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[10px] font-mono text-primary/70 uppercase tracking-wider">
                      {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
                    </p>
                    <Badge variant="outline" className="h-4 px-1 text-[9px] border-primary/20 text-primary/70">
                      GPS ACTIVE
                    </Badge>
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setMode('manual')}
                className="shrink-0"
              >
                <Edit2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Address Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Address</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Address Label</Label>
              <Input
                placeholder="Home, Work, etc."
                value={saveLabel}
                onChange={(e) => setSaveLabel(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-input bg-background"
              />
              <Label htmlFor="isDefault" className="text-sm font-normal">
                Set as default address
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAddress}>
              Save Address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
