import { useState, useEffect } from 'react'
import { MapPin, Package, Navigation, Clock, CheckCircle2, Loader2 } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Job } from '@/hooks/use-courier-store'

interface JobCardProps {
  job: Job
  onAccept?: (job: Job) => void
  onComplete?: (job: Job) => void
  variant?: 'available' | 'active' | 'completed'
  isLoading?: boolean
}

export function JobCard({ job, onAccept, onComplete, variant = 'available', isLoading }: JobCardProps) {
  const [timeLeft, setTimeLeft] = useState(30)

  useEffect(() => {
    if (variant !== 'available') return
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [variant])

  return (
    <Card className={cn(
      "border-2 transition-all duration-300 overflow-hidden",
      variant === 'active' ? "border-primary shadow-[0_0_20px_rgba(var(--primary),0.1)] bg-primary/5" : "border-muted-foreground/10"
    )}>
      <CardHeader className="p-4 flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-primary/50 text-primary font-bold">
            {job.carrierType}
          </Badge>
          {job.isManualAddress && (
            <Badge variant="outline" className="border-yellow-500/30 text-yellow-500 text-[10px]">
              Manual Address
            </Badge>
          )}
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" /> {job.distance}
          </span>
        </div>
        <div className="text-2xl font-black text-primary">
          ${(job.payout || 0).toFixed(2)}
        </div>
      </CardHeader>
      
      <CardContent className="p-4 pt-0 space-y-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 flex flex-col items-center">
              <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
              <div className="w-0.5 h-8 bg-muted-foreground/20" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Pickup</p>
              <p className="text-sm font-semibold leading-tight">{job.pickupAddress}</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-6 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Drop-off</p>
              <p className="text-sm font-semibold leading-tight">{job.dropoffAddress}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 py-3 border-y border-muted-foreground/10">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{job.packageCount} Packages</span>
          </div>
          {job.customerName && (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{job.customerName}</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex gap-2">
        {variant === 'available' && (
          <>
            <Button 
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
              onClick={() => onAccept?.(job)}
              disabled={timeLeft === 0 || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ACCEPTING...
                </>
              ) : (
                `ACCEPT JOB (${timeLeft}s)`
              )}
            </Button>
            <Button variant="outline" className="px-3 border-muted-foreground/20">
              <Navigation className="w-4 h-4" />
            </Button>
          </>
        )}
        {variant === 'active' && (
          <Button 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
            onClick={() => onComplete?.(job)}
          >
            VIEW DETAILS
          </Button>
        )}
        {variant === 'completed' && (
          <Badge className="w-full justify-center bg-green-500/20 text-green-500 border-none py-2">
            COMPLETED
          </Badge>
        )}
      </CardFooter>
    </Card>
  )
}
