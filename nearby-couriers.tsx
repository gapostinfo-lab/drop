import { useEffect, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@convex/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { MapPin, Clock, Car, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NearbyCouriersProps {
  latitude?: number
  longitude?: number
  className?: string
}

export function NearbyCouriers({ latitude, longitude, className }: NearbyCouriersProps) {
  const [, setRefreshKey] = useState(0)

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(k => k + 1)
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  // Query nearby couriers
  const nearbyData = useQuery(
    api.locations.getNearbyCouriers,
    latitude && longitude 
      ? { latitude, longitude, radiusMiles: 5 }
      : "skip"
  )

  // Don't render if no coordinates
  if (!latitude || !longitude) {
    return null
  }

  // Loading state
  if (nearbyData === undefined) {
    return (
      <Card className={cn("border-primary/20 bg-primary/5", className)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const { count, nearestDistance, estimatedPickupMinutes, couriers } = nearbyData

  // No couriers nearby
  if (count === 0) {
    return (
      <Card className={cn("border-yellow-500/20 bg-yellow-500/5", className)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="font-medium text-yellow-500">No couriers nearby</p>
              <p className="text-sm text-muted-foreground">
                Couriers will be notified when you book
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("border-primary/20 bg-primary/5 overflow-hidden", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Car className="w-5 h-5 text-primary" />
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                {count}
              </div>
            </div>
            <div>
              <p className="font-medium">
                {count} courier{count !== 1 ? 's' : ''} nearby
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-3 h-3" />
                <span>Nearest: {nearestDistance} mi</span>
              </div>
            </div>
          </div>
          
          {estimatedPickupMinutes && (
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              <Clock className="w-3 h-3 mr-1" />
              ~{estimatedPickupMinutes} min
            </Badge>
          )}
        </div>

        {/* Courier avatars row */}
        {couriers.length > 0 && (
          <div className="mt-3 pt-3 border-t border-primary/10">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {couriers.slice(0, 5).map((courier) => (
                  <div
                    key={courier.courierId}
                    className="w-8 h-8 rounded-full bg-slate-700 border-2 border-background flex items-center justify-center text-xs font-bold"
                    title={`${courier.firstName} - ${courier.distanceMiles} mi away`}
                  >
                    {courier.firstName[0]}
                  </div>
                ))}
                {couriers.length > 5 && (
                  <div className="w-8 h-8 rounded-full bg-slate-600 border-2 border-background flex items-center justify-center text-xs font-bold">
                    +{couriers.length - 5}
                  </div>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                Ready to pick up your package
              </span>
            </div>
          </div>
        )}

        {/* Live indicator */}
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span>Live • Updates every 10s</span>
        </div>
      </CardContent>
    </Card>
  )
}
