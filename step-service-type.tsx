import { useBookingStore } from '@/stores/booking-store'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Package, Truck } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

export function StepServiceType() {
  const { serviceType, amazonLabelConfirmed, updateBooking } = useBookingStore()

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold font-outfit">Select Service Type</h2>
        <p className="text-muted-foreground">How can we help you today?</p>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        <Card
          className={cn(
            "p-6 cursor-pointer transition-all border-2 flex items-start gap-4",
            serviceType === 'amazon_return'
              ? "border-primary bg-primary/5"
              : "border-transparent bg-slate-900/50 hover:border-primary/50"
          )}
          onClick={() => updateBooking({ serviceType: 'amazon_return' })}
        >
          <div className={cn(
            "p-3 rounded-xl shrink-0",
            serviceType === 'amazon_return' ? "bg-primary text-primary-foreground" : "bg-slate-800 text-slate-400"
          )}>
            <div className="relative">
              <Package className="w-8 h-8" />
              <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                <div className="bg-orange-500 rounded-full w-4 h-4 flex items-center justify-center">
                   <span className="text-[10px] text-white font-bold">a</span>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-1 text-left">
            <h3 className={cn(
              "font-bold text-lg font-outfit",
              serviceType === 'amazon_return' ? "text-primary" : "text-slate-200"
            )}>Amazon Return</h3>
            <p className="text-sm text-muted-foreground">Return an Amazon package to a nearby drop-off location</p>
          </div>
        </Card>

        <Card
          className={cn(
            "p-6 cursor-pointer transition-all border-2 flex items-start gap-4",
            serviceType === 'carrier_dropoff'
              ? "border-primary bg-primary/5"
              : "border-transparent bg-slate-900/50 hover:border-primary/50"
          )}
          onClick={() => updateBooking({ serviceType: 'carrier_dropoff' })}
        >
          <div className={cn(
            "p-3 rounded-xl shrink-0",
            serviceType === 'carrier_dropoff' ? "bg-primary text-primary-foreground" : "bg-slate-800 text-slate-400"
          )}>
            <Truck className="w-8 h-8" />
          </div>
          <div className="space-y-1 text-left">
            <h3 className={cn(
              "font-bold text-lg font-outfit",
              serviceType === 'carrier_dropoff' ? "text-primary" : "text-slate-200"
            )}>Courier Drop-Off</h3>
            <p className="text-sm text-muted-foreground">Drop off a pre-labeled package at UPS, FedEx, USPS, or DHL</p>
          </div>
        </Card>
      </div>

      {serviceType === 'amazon_return' && (
        <div className="mt-8 p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <Checkbox 
            id="label-confirm" 
            checked={amazonLabelConfirmed}
            onCheckedChange={(checked) => updateBooking({ amazonLabelConfirmed: !!checked })}
            className="mt-1 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          />
          <Label 
            htmlFor="label-confirm" 
            className="text-sm font-medium leading-relaxed cursor-pointer text-slate-300"
          >
            I confirm my package has an Amazon return label printed and attached
          </Label>
        </div>
      )}
    </div>
  )
}
