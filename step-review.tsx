import { useBookingStore } from '@/stores/booking-store'
import { Card } from '@/components/ui/card'
import { MapPin, Clock, Truck, Package, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPriceBreakdown, getPackageSummary, formatCents } from '@/lib/pricing'

export function StepReview() {
  const { 
    pickupAddress, 
    pickupNotes, 
    isAsap, 
    scheduledDate, 
    scheduledTime, 
    carrier, 
    smallQty,
    mediumQty,
    largeQty,
    oversizedQty,
    isSealed,
    serviceType,
    dropoffLocationName,
    dropoffLocationAddress,
  } = useBookingStore()

  const breakdown = getPriceBreakdown({ smallQty, mediumQty, largeQty, oversizedQty })
  const packageSummary = getPackageSummary({ smallQty, mediumQty, largeQty, oversizedQty })

  const timeLabel = isAsap ? 'ASAP' : `${scheduledDate} at ${scheduledTime}`
  const formattedAddress = pickupAddress 
    ? `${pickupAddress.street1}${pickupAddress.street2 ? ', ' + pickupAddress.street2 : ''}, ${pickupAddress.city}, ${pickupAddress.state} ${pickupAddress.zipCode}`
    : 'Not set'

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold font-outfit text-primary">Review Booking</h2>
        <p className="text-muted-foreground">Make sure everything looks correct.</p>
      </div>

      <div className="space-y-3">
        <ReviewItem 
          icon={Package} 
          label="Service Type" 
          value={serviceType === 'amazon_return' ? 'Amazon Return' : 'Carrier Drop-Off'} 
        />
        <ReviewItem 
          icon={MapPin} 
          label="Pickup Address" 
          value={formattedAddress} 
          subValue={pickupNotes}
        />
        {serviceType === 'amazon_return' && (
          <ReviewItem 
            icon={MapPin} 
            label="Drop-off Location" 
            value={dropoffLocationName || 'Not selected'} 
            subValue={dropoffLocationAddress}
          />
        )}
        <ReviewItem 
          icon={Clock} 
          label="Pickup Time" 
          value={timeLabel} 
        />
        {serviceType !== 'amazon_return' && (
          <ReviewItem 
            icon={Truck} 
            label="Carrier" 
            value={carrier || 'Not selected'} 
          />
        )}
        <ReviewItem 
          icon={Package} 
          label="Packages" 
          value={packageSummary} 
          subValue={isSealed ? 'Sealed & Labeled' : 'Not Sealed/Labeled'}
          status={isSealed}
        />
      </div>

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

      <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-slate-300 leading-relaxed">
          Review your booking details above. Click "Proceed to Checkout" to complete your payment.
        </p>
      </div>
    </div>
  )
}

function ReviewItem({ icon: Icon, label, value, subValue, status }: any) {
  return (
    <Card className="p-4 bg-slate-900/40 border-slate-800 flex items-start gap-4">
      <div className="p-2 rounded-lg bg-slate-800 text-primary shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p className="font-semibold text-slate-100">{value}</p>
        {subValue && (
          <p className={cn(
            "text-sm",
            status === false ? "text-destructive" : "text-muted-foreground"
          )}>{subValue}</p>
        )}
      </div>
    </Card>
  )
}
