import { useBookingStore } from '@/stores/booking-store'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Clock, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

export function StepTime() {
  const { isAsap, scheduledDate, scheduledTime, updateBooking } = useBookingStore()

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-center justify-between p-6 rounded-2xl bg-muted/50 border border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <span className="font-bold text-lg">ASAP Pickup</span>
          </div>
          <p className="text-sm text-muted-foreground">Courier will arrive in 15-30 mins</p>
        </div>
        <Switch 
          checked={isAsap} 
          onCheckedChange={(checked) => updateBooking({ isAsap: checked })}
          className="scale-125"
        />
      </div>

      {!isAsap && (
        <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="text-sm font-semibold">Pickup Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="date"
                  type="date"
                  className="pl-10 h-12 rounded-xl"
                  value={scheduledDate}
                  onChange={(e) => updateBooking({ scheduledDate: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="time" className="text-sm font-semibold">Pickup Time</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="time"
                  type="time"
                  className="pl-10 h-12 rounded-xl"
                  value={scheduledTime}
                  onChange={(e) => updateBooking({ scheduledTime: e.target.value })}
                />
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-xl bg-muted/30 text-sm text-muted-foreground flex gap-3">
             <Info className="w-5 h-5 shrink-0" />
             <p>Scheduled pickups have a 1-hour arrival window from the selected time.</p>
          </div>
        </div>
      )}

      {isAsap && (
        <div className="flex flex-col items-center justify-center p-10 text-center space-y-4">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
            <Clock className="w-10 h-10 text-primary" />
          </div>
          <p className="text-muted-foreground">Couriers are active in your area and ready for pickup.</p>
        </div>
      )}
    </div>
  )
}

function Info({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={cn("lucide lucide-info", className)}
    >
      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
    </svg>
  )
}
