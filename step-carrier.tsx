import { useBookingStore, Carrier } from '@/stores/booking-store'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Truck, HelpCircle } from 'lucide-react'

const CARRIERS: { id: Carrier; name: string; icon: any }[] = [
  { id: 'UPS', name: 'UPS', icon: Truck },
  { id: 'FedEx', name: 'FedEx', icon: Truck },
  { id: 'USPS', name: 'USPS', icon: Truck },
  { id: 'DHL', name: 'DHL', icon: Truck },
  { id: 'Other', name: 'Other', icon: HelpCircle },
]

export function StepCarrier() {
  const { carrier, updateBooking } = useBookingStore()

  return (
    <div className="space-y-4">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold font-outfit">Select Carrier</h2>
        <p className="text-muted-foreground">Which carrier are we picking up for?</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {CARRIERS.map((c) => {
          const Icon = c.icon
          const isSelected = carrier === c.id
          return (
            <Card
              key={c.id}
              className={cn(
                "p-6 cursor-pointer transition-all border-2 flex flex-col items-center justify-center gap-3",
                isSelected 
                  ? "border-primary bg-primary/5" 
                  : "border-transparent bg-slate-900/50 hover:border-primary/50"
              )}
              onClick={() => updateBooking({ carrier: c.id })}
            >
              <div className={cn(
                "p-3 rounded-full",
                isSelected ? "bg-primary text-primary-foreground" : "bg-slate-800 text-slate-400"
              )}>
                <Icon className="w-6 h-6" />
              </div>
              <span className={cn(
                "font-semibold",
                isSelected ? "text-primary" : "text-slate-300"
              )}>{c.name}</span>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
