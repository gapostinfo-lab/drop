import { useState } from 'react'
import { useBookingStore } from '@/stores/booking-store'
import { useQuery } from 'convex/react'
import { api } from '@convex/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Minus, Plus, Camera, X } from 'lucide-react'
import { PhotoCapture } from '@/components/courier/photo-capture'
import { packageSizes, getPriceBreakdown, formatCents } from '@/lib/pricing'

export function StepPackages() {
  const { 
    smallQty, mediumQty, largeQty, oversizedQty,
    isSealed, packagePhotoId, expectedTrackingNumber, updateBooking 
  } = useBookingStore()
  
  const [showPhotoCapture, setShowPhotoCapture] = useState(false)
  
  const photoUrl = useQuery(
    api.storage.getFileUrl,
    packagePhotoId ? { storageId: packagePhotoId as any } : "skip"
  )

  const quantities = {
    small: smallQty,
    medium: mediumQty,
    large: largeQty,
    oversized: oversizedQty,
  }

  const setQuantity = (size: 'small' | 'medium' | 'large' | 'oversized', value: number) => {
    const clamped = Math.max(0, Math.min(10, value))
    updateBooking({ [`${size}Qty`]: clamped })
  }

  const breakdown = getPriceBreakdown({ smallQty, mediumQty, largeQty, oversizedQty })

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold font-outfit">Package Details</h2>
        <p className="text-muted-foreground">How many packages of each size?</p>
      </div>

      {/* Package Size Selectors */}
      <div className="space-y-3">
        {packageSizes.map((size) => (
          <Card 
            key={size.id}
            className={cn(
              "p-4 bg-slate-900/60 border-slate-700 transition-all",
              quantities[size.id] > 0 && "border-primary/50 bg-primary/5"
            )}
          >
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📦</span>
                  <span className="font-semibold">{size.label}</span>
                  <span className="text-primary font-bold">{formatCents(size.priceCents)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{size.desc}</p>
              </div>
              
              {/* Quantity Stepper */}
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full border-2"
                  onClick={() => setQuantity(size.id, quantities[size.id] - 1)}
                  disabled={quantities[size.id] === 0}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-2xl font-bold font-outfit w-8 text-center">
                  {quantities[size.id]}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full border-2"
                  onClick={() => setQuantity(size.id, quantities[size.id] + 1)}
                  disabled={quantities[size.id] >= 10}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Price Summary */}
      <Card className="p-4 bg-slate-900/60 border-slate-700">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Pickup Fee</span>
            <span>{formatCents(breakdown.pickupFeeCents)}</span>
          </div>
          {breakdown.totalPackages > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Packages ({breakdown.totalPackages})</span>
              <span>{formatCents(breakdown.packagesCents)}</span>
            </div>
          )}
          <div className="border-t border-slate-700 pt-2 flex justify-between font-bold text-lg">
            <span>Estimated Total</span>
            <span className="text-primary">{formatCents(breakdown.totalCents)}</span>
          </div>
        </div>
      </Card>

      {/* Validation Warning */}
      {breakdown.totalPackages === 0 && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-500 text-sm text-center">
          Please select at least one package to continue
        </div>
      )}

      {/* Photo Section */}
      <div className="space-y-2">
        <Label className="text-sm uppercase tracking-wider text-muted-foreground">Photo (Optional)</Label>
        
        {photoUrl ? (
          <div className="relative rounded-xl overflow-hidden border-2 border-slate-700">
            <img 
              src={photoUrl} 
              alt="Package" 
              className="w-full h-48 object-cover cursor-pointer"
              onClick={() => setShowPhotoCapture(true)}
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 rounded-full"
              onClick={() => updateBooking({ packagePhotoId: undefined })}
            >
              <X className="w-4 h-4" />
            </Button>
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-xs text-white">
              Tap to retake
            </div>
          </div>
        ) : (
          <div 
            onClick={() => setShowPhotoCapture(true)}
            className="border-2 border-dashed border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center gap-2 bg-slate-900/30 hover:bg-slate-900/50 hover:border-primary/50 transition-all cursor-pointer"
          >
            <Camera className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Tap to add a photo of your package(s)</span>
          </div>
        )}
      </div>
      
      {/* Optional Tracking Number */}
      <div className="space-y-2">
        <Label htmlFor="trackingNumber" className="flex items-center gap-2">
          Tracking Number
          <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
        </Label>
        <Input
          id="trackingNumber"
          placeholder="e.g. 1Z999AA10123456784"
          value={expectedTrackingNumber}
          onChange={(e) => updateBooking({ expectedTrackingNumber: e.target.value })}
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          If provided, we'll verify the courier picks up the correct package.
        </p>
      </div>

      {/* Sealed Confirmation */}
      <div className="flex items-start space-x-3 p-4 bg-slate-900/50 rounded-xl border border-slate-800">
        <Checkbox 
          id="sealed" 
          checked={isSealed} 
          onCheckedChange={(checked) => updateBooking({ isSealed: !!checked })}
          className="mt-1"
        />
        <div className="grid gap-1.5 leading-none">
          <label
            htmlFor="sealed"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            Package(s) are sealed and pre-labeled
          </label>
          <p className="text-xs text-muted-foreground">
            Droppit couriers only transport items that are ready for shipment.
          </p>
        </div>
      </div>

      {/* Photo Capture Dialog */}
      <PhotoCapture
        isOpen={showPhotoCapture}
        onClose={() => setShowPhotoCapture(false)}
        onCapture={(storageId) => {
          updateBooking({ packagePhotoId: storageId as any })
          setShowPhotoCapture(false)
        }}
        title="Package Photo"
        description="Take a photo of your package(s)"
      />
    </div>
  )
}
