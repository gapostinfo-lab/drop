import * as React from "react"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertTriangle, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { StructuredAddress } from "@/stores/booking-store"
import { useAction } from "convex/react"
import { api } from "@convex/api"
import { Button } from "@/components/ui/button"

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

interface ManualAddressFormProps {
  value: StructuredAddress | null
  onChange: (address: StructuredAddress) => void
}

export function ManualAddressForm({ value, onChange }: ManualAddressFormProps) {
  const geocodeAddress = useAction(api.geocoding.geocodeAddressPublic)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  
  const address = value || {
    street1: "",
    street2: "",
    city: "",
    state: "",
    zipCode: "",
    country: "US",
  }

  const isVerified = !!(address.latitude && address.longitude)
  const canVerify = !!(address.street1 && address.city && address.state && address.zipCode)

  const handleVerifyAddress = async () => {
    if (!canVerify) return
    
    setIsGeocoding(true)
    setGeocodeError(null)
    
    try {
      const fullAddress = `${address.street1}, ${address.city}, ${address.state} ${address.zipCode}, USA`
      const response = await geocodeAddress({ address: fullAddress })
      
      if (response.success && response.result) {
        onChange({
          ...address,
          latitude: response.result.lat,
          longitude: response.result.lng,
        })
      } else {
        setGeocodeError(response.error || "Address not found. Please check and try again.")
      }
    } catch (error) {
      setGeocodeError(error instanceof Error ? error.message : "Address verification failed")
    } finally {
      setIsGeocoding(false)
    }
  }

  const updateField = (field: keyof StructuredAddress, newValue: string) => {
    setGeocodeError(null)
    onChange({
      ...address,
      [field]: newValue,
      country: "US",
      latitude: undefined,
      longitude: undefined,
    })
  }

  const handleZipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9-]/g, "").slice(0, 10)
    updateField("zipCode", val)
  }

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-sm flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Manual address entry may reduce location accuracy. Your courier will navigate using the address text.
        </span>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="street1">Street Address</Label>
          <Input
            id="street1"
            placeholder="123 Main St"
            value={address.street1}
            onChange={(e) => updateField("street1", e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="street2">Apt / Suite / Unit (Optional)</Label>
          <Input
            id="street2"
            placeholder="Apt 4B"
            value={address.street2 || ""}
            onChange={(e) => updateField("street2", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              placeholder="City"
              value={address.city}
              onChange={(e) => updateField("city", e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="state">State</Label>
            <Select
              value={address.state}
              onValueChange={(val) => updateField("state", val)}
            >
              <SelectTrigger id="state">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((state) => (
                  <SelectItem key={state.code} value={state.code}>
                    {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="zipCode">ZIP Code</Label>
            <Input
              id="zipCode"
              placeholder="12345"
              value={address.zipCode}
              onChange={handleZipChange}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value="United States"
              disabled
              className="bg-muted"
            />
          </div>
        </div>
      </div>

      {canVerify && !isVerified && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleVerifyAddress}
          disabled={isGeocoding}
        >
          {isGeocoding ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying address...
            </>
          ) : (
            "Verify Address"
          )}
        </Button>
      )}

      {isVerified && (
        <div className="flex items-center gap-2 text-green-500 text-sm bg-green-500/10 p-2 rounded-md border border-green-500/20">
          <CheckCircle className="w-4 h-4" />
          Address verified
        </div>
      )}

      {geocodeError && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-500/10 p-2 rounded-md border border-red-500/20">
          <AlertCircle className="w-4 h-4" />
          {geocodeError}
        </div>
      )}
    </div>
  )
}
