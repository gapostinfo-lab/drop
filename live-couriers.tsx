import { useState, useEffect } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@convex/api'
import { AdminAppShell } from '@/components/layout/admin-app-shell'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  MapPin, 
  Car, 
  Clock, 
  RefreshCw, 
  Users, 
  AlertCircle,
  Navigation,
  Phone,
  Mail
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdmin } from '@/contexts/admin-context'
import { formatDistanceToNow } from 'date-fns'
import { LiveCouriersMap } from '@/components/admin/live-couriers-map'

export default function LiveCouriersPage() {
  const { isAdminLoggedIn } = useAdmin()
  const [, setRefreshKey] = useState(0)
  const [selectedCourier, setSelectedCourier] = useState<string | null>(null)

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(k => k + 1)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const onlineCouriers = useQuery(
    api.locations.getAllOnlineCouriers,
    isAdminLoggedIn ? {} : "skip"
  )

  const handleManualRefresh = () => {
    setRefreshKey(k => k + 1)
  }

  if (!isAdminLoggedIn) {
    return (
      <AdminAppShell>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-xl font-bold">Admin Access Required</h2>
            <p className="text-muted-foreground">Please log in to view live couriers.</p>
          </div>
        </div>
      </AdminAppShell>
    )
  }

  const activeCouriers = onlineCouriers?.filter(c => !c.isStale && c.latitude !== null) || []
  const staleCouriers = onlineCouriers?.filter(c => c.isStale || c.latitude === null) || []

  return (
    <AdminAppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Live Couriers</h1>
            <p className="text-muted-foreground">Real-time location tracking for online couriers</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2" />
              {activeCouriers.length} Active
            </Badge>
            <Button variant="outline" size="sm" onClick={handleManualRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <Users className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCouriers.length}</p>
                <p className="text-sm text-muted-foreground">Active Couriers</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-500/10">
                <AlertCircle className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{staleCouriers.length}</p>
                <p className="text-sm text-muted-foreground">Stale/No Location</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Car className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{onlineCouriers?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Online</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Map Placeholder + Courier List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map Area */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Live Map
              </CardTitle>
              <CardDescription>
                Real-time courier locations (updates every 5 seconds)
              </CardDescription>
            </CardHeader>
          <CardContent>
            <LiveCouriersMap 
              couriers={onlineCouriers || []}
              selectedCourierId={selectedCourier}
              onCourierSelect={setSelectedCourier}
            />
          </CardContent>
          </Card>

          {/* Courier List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Online Couriers
              </CardTitle>
              <CardDescription>
                {onlineCouriers?.length || 0} couriers online
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {onlineCouriers === undefined ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : onlineCouriers.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground">No couriers online</p>
                </div>
              ) : (
                <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                  {onlineCouriers.map(courier => (
                    <div
                      key={courier.courierId}
                      className={cn(
                        "p-4 hover:bg-muted/50 cursor-pointer transition-colors",
                        selectedCourier === courier.courierId && "bg-muted"
                      )}
                      onClick={() => setSelectedCourier(
                        selectedCourier === courier.courierId ? null : courier.courierId
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
                            courier.isStale 
                              ? "bg-yellow-500/20 text-yellow-500" 
                              : "bg-green-500/20 text-green-500"
                          )}>
                            {courier.fullName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-medium">{courier.fullName}</p>
                            <p className="text-xs text-muted-foreground">{courier.vehicleType}</p>
                          </div>
                        </div>
                        <Badge 
                          variant={courier.isStale ? "secondary" : "default"}
                          className={cn(
                            "text-xs",
                            !courier.isStale && "bg-green-500"
                          )}
                        >
                          {courier.isStale ? "Stale" : "Active"}
                        </Badge>
                      </div>
                      
                      {selectedCourier === courier.courierId && (
                        <div className="mt-3 pt-3 border-t border-border space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="w-4 h-4" />
                            <span>{courier.email}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="w-4 h-4" />
                            <span>{courier.phone}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Car className="w-4 h-4" />
                            <span>{courier.vehiclePlate}</span>
                          </div>
                          {courier.latitude && courier.longitude && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Navigation className="w-4 h-4" />
                              <span>{courier.latitude.toFixed(5)}, {courier.longitude.toFixed(5)}</span>
                            </div>
                          )}
                          {courier.lastUpdated && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="w-4 h-4" />
                              <span>Last ping: {formatDistanceToNow(courier.lastUpdated, { addSuffix: true })}</span>
                            </div>
                          )}
                          {courier.currentJobId && (
                            <Badge variant="outline" className="mt-2">
                              On active job
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live indicator */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span>Live • Auto-refreshes every 5 seconds</span>
        </div>
      </div>
    </AdminAppShell>
  )
}
