import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  ChevronLeft, 
  Phone, 
  MessageSquare, 
  User, 
  Package, 
  Loader2, 
  Clock, 
  AlertTriangle,
  FileText,
  UserCheck,
  Navigation,
  MapPin,
  Building,
  CheckCircle,
  Star,
  Bell,
  RefreshCw,
  Sparkles,
  Search,
  ExternalLink
} from 'lucide-react'
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/api"
import { Id } from "@convex/dataModel"
import { cn } from '@/lib/utils'
import { toast } from "sonner"
import { formatDistanceToNow } from 'date-fns'
import { AppShell } from '@/components/layout/app-shell'
import { RatingDialog } from '@/components/customer/rating-dialog'
import { LiveMap } from '@/components/tracking/live-map'
import { JobChat } from '@/components/job-chat'

// Live ETA countdown component
function ETACountdown({ etaSeconds, isStale }: { etaSeconds: number; isStale?: boolean }) {
  const [remainingSeconds, setRemainingSeconds] = useState(etaSeconds)
  
  useEffect(() => {
    setRemainingSeconds(etaSeconds)
  }, [etaSeconds])
  
  useEffect(() => {
    if (remainingSeconds <= 0) return
    
    const interval = setInterval(() => {
      setRemainingSeconds(prev => Math.max(0, prev - 1))
    }, 1000)
    
    return () => clearInterval(interval)
  }, [remainingSeconds > 0])
  
  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  
  if (isStale) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Updating...</span>
      </div>
    )
  }
  
  return (
    <div className="text-4xl font-black tabular-nums">
      {minutes > 0 ? (
        <span>{minutes} <span className="text-lg font-medium text-muted-foreground">min</span></span>
      ) : (
        <span>{seconds} <span className="text-lg font-medium text-muted-foreground">sec</span></span>
      )}
    </div>
  )
}

export default function TrackingPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  
  const [isRatingOpen, setIsRatingOpen] = useState(false)
  const [hasShownRating, setHasShownRating] = useState(false)
  const [lastStatus, setLastStatus] = useState<string | null>(null)
  const [showPulse, setShowPulse] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const job = useQuery(api.jobs.getJobById, orderId ? { jobId: orderId as Id<"jobs"> } : "skip")
  const jobETA = useQuery(api.eta.getJobETA, orderId ? { jobId: orderId as Id<"jobs"> } : "skip")
  const courierLocation = useQuery(api.locations.getCourierLocationForJob, orderId ? { jobId: orderId as Id<"jobs"> } : "skip")
  const courierInfo = useQuery(api.couriers.getCourierPublicProfile, job?.courierId ? { userId: job.courierId } : "skip")
  const courierImageUrl = useQuery(api.storage.getFileUrl, courierInfo?.profileImageId ? { storageId: courierInfo.profileImageId } : "skip")
  
  const allNotifications = useQuery(api.customerNotifications.getMyNotifications, { limit: 20 })
  const jobNotifications = allNotifications?.filter(n => n.jobId === orderId) ?? []

  const cancelJob = useMutation(api.jobs.cancelJob)

  // Auto-show rating dialog when job is completed and not rated
  useEffect(() => {
    if (job?.status === 'completed' && !job.rating && !hasShownRating) {
      setIsRatingOpen(true)
      setHasShownRating(true)
    }
  }, [job?.status, job?.rating, hasShownRating])

  // Status change pulse effect
  useEffect(() => {
    if (job?.status && lastStatus && job.status !== lastStatus) {
      setShowPulse(true)
      const timer = setTimeout(() => setShowPulse(false), 1000)
      toast.info(`Status updated: ${job.status.replace('_', ' ')}`, {
        icon: <Sparkles className="w-4 h-4 text-primary" />
      })
      return () => clearTimeout(timer)
    }
    if (job?.status) {
      setLastStatus(job.status)
    }
  }, [job?.status, lastStatus])

  const handleRefresh = useCallback(() => {
    setLastRefresh(new Date())
    toast.success("Tracking updated", { duration: 1000 })
  }, [])

  if (job === undefined) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppShell>
    )
  }

  if (job === null) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold mb-4">Pickup not found</h2>
          <Link to="/customer/dashboard">
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </AppShell>
    )
  }

  const statusSteps = [
    { key: 'requested', label: 'Requested', icon: FileText, time: job.createdAt, description: 'Pickup request received' },
    { key: 'matched', label: 'Courier Matched', icon: UserCheck, time: job.matchedAt, description: 'A courier has accepted your request' },
    { key: 'en_route', label: 'En Route', icon: Navigation, time: job.matchedAt ? job.matchedAt + 60000 : null, description: 'Courier is heading to your location' },
    { key: 'arrived', label: 'Arrived at Pickup', icon: MapPin, time: job.arrivedAt, description: 'Courier is at the pickup location' },
    { key: 'picked_up', label: 'Package Picked Up', icon: Package, time: job.pickedUpAt, description: 'Courier has collected your package(s)' },
    { key: 'dropped_off', label: 'Dropped Off', icon: Building, time: job.droppedOffAt, description: 'Package delivered to carrier' },
    { key: 'completed', label: 'Completed', icon: CheckCircle, time: job.completedAt, description: 'Pickup successfully completed' },
  ]

  const statusOrder = ['requested', 'matched', 'en_route', 'arrived', 'picked_up', 'dropped_off', 'completed']
  const currentIndex = statusOrder.indexOf(job.status || 'requested')

  const getETA = () => {
    if (job.status === 'requested') return 'Waiting for courier...'
    if (job.status === 'completed') return 'Delivered!'
    
    // Use real ETA if available
    if (jobETA?.etaSeconds) {
      const minutes = Math.ceil(jobETA.etaSeconds / 60)
      if (jobETA.isStale) {
        return 'Updating location...'
      }
      return `${minutes} min`
    }
    
    // Fallback estimates
    if (job.status === 'matched') return 'Calculating...'
    if (job.status === 'en_route') return 'Calculating...'
    if (job.status === 'arrived') return 'Courier at pickup'
    if (job.status === 'picked_up') return 'Calculating...'
    if (job.status === 'dropped_off') return 'At drop-off location'
    return ''
  }

  const getHeroMessage = () => {
    const etaText = jobETA?.etaSeconds && !jobETA.isStale 
      ? `Arrives in ${Math.ceil(jobETA.etaSeconds / 60)} min`
      : undefined

    switch (job.status) {
      case 'requested': return { title: "Finding your courier...", description: "Usually takes 2-5 minutes", pulse: true }
      case 'matched': return { title: `Courier assigned!`, description: etaText || `${courierInfo?.firstName || 'Your courier'} is on their way.`, pulse: false }
      case 'en_route': return { title: "Your courier is heading to you", description: etaText || "Calculating arrival time...", pulse: true }
      case 'arrived': return { title: "Courier has arrived! 📍", description: "Please have your packages ready for pickup.", highlight: true }
      case 'picked_up': return { title: "Package collected!", description: etaText ? `Drop-off in ${etaText}` : "Heading to the drop-off location now.", pulse: false }
      case 'dropped_off': return { title: "Package dropped off successfully!", description: "Finalizing the delivery details.", highlight: true }
      case 'completed': return { title: "Delivery complete! 🎉", description: "Thanks for using Droppit!", highlight: true }
      default: return null
    }
  }

  const hero = getHeroMessage()
  const canCancel = ['requested', 'matched', 'en_route'].includes(job.status)

  const handleCancel = async () => {
    if (confirm('Are you sure you want to cancel this pickup?')) {
      try {
        await cancelJob({ jobId: job._id })
        toast.success('Pickup cancelled')
        navigate('/customer/dashboard')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to cancel pickup")
      }
    }
  }

  // Phone/message contact disabled for privacy - will use in-app messaging in future

  const openInGoogleMaps = () => {
    // Determine destination based on status
    const isPickedUp = ['picked_up', 'dropped_off', 'completed'].includes(job.status)
    const destLat = isPickedUp ? job.dropoffLatitude : job.pickupLatitude
    const destLng = isPickedUp ? job.dropoffLongitude : job.pickupLongitude
    
    if (!destLat || !destLng) {
      toast.error("Location coordinates not available")
      return
    }
    
    // Include courier origin if available
    let url = `https://www.google.com/maps/dir/?api=1`
    if (courierLocation) {
      url += `&origin=${courierLocation.latitude},${courierLocation.longitude}`
    }
    url += `&destination=${destLat},${destLng}&travelmode=driving`
    
    window.open(url, '_blank')
  }

  return (
    <AppShell>
      <div className={cn(
        "max-w-4xl mx-auto px-4 py-8 space-y-8 transition-all duration-500",
        showPulse && "bg-primary/5 ring-4 ring-primary/20 rounded-3xl"
      )}>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/customer/dashboard">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ChevronLeft className="w-6 h-6" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold font-outfit">Track Pickup</h1>
              <p className="text-sm text-muted-foreground">Order ORD-{job._id.slice(-4).toUpperCase()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end mr-2">
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Live Updates</p>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500">Last updated {formatDistanceToNow(lastRefresh)} ago</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 rounded-full hover:bg-primary/10 hover:text-primary"
                  onClick={handleRefresh}
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {canCancel && (
              <Button 
                variant="outline" 
                className="text-destructive border-destructive hover:bg-destructive/10 h-9"
                onClick={handleCancel}
              >
                Cancel
              </Button>
            )}
            {job.status === 'completed' && !job.rating && (
              <Button 
                variant="outline" 
                className="text-primary border-primary hover:bg-primary/10 h-9"
                onClick={() => setIsRatingOpen(true)}
              >
                <Star className="w-4 h-4 mr-2" />
                Rate
              </Button>
            )}
            <Badge className={cn(
              "text-primary-foreground font-bold px-3 py-1 capitalize h-9",
              job.status === 'cancelled' ? "bg-destructive" : "bg-primary"
            )}>
              {job.status.replace('_', ' ')}
            </Badge>
          </div>
        </div>

        {/* Live ETA Section - Uber style */}
        {job.status && ['matched', 'en_route', 'arrived', 'picked_up'].includes(job.status) && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    {job.status === 'matched' || job.status === 'en_route' 
                      ? 'Courier arriving in' 
                      : job.status === 'arrived'
                      ? 'At pickup location'
                      : 'Dropping off in'}
                  </p>
                  {jobETA?.etaSeconds && !jobETA.isStale ? (
                    <ETACountdown etaSeconds={jobETA.etaSeconds} isStale={jobETA.isStale} />
                  ) : job.status === 'arrived' ? (
                    <div className="text-2xl font-bold text-primary">Picking up package</div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Calculating ETA...</span>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  {jobETA?.distanceMeters && (
                    <div>
                      <p className="text-sm text-muted-foreground">Distance</p>
                      <p className="text-xl font-bold">
                        {(jobETA.distanceMeters / 1609.34).toFixed(1)} mi
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Progress indicator */}
              <div className="mt-4 flex items-center gap-3">
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  job.status === 'matched' ? "bg-primary animate-pulse" : "bg-primary"
                )} />
                <div className={cn(
                  "flex-1 h-1 rounded-full",
                  job.status === 'en_route' || job.status === 'arrived' || job.status === 'picked_up' 
                    ? "bg-primary" : "bg-muted"
                )} />
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  job.status === 'arrived' ? "bg-primary animate-pulse" : 
                  job.status === 'picked_up' ? "bg-primary" : "bg-muted"
                )} />
                <div className={cn(
                  "flex-1 h-1 rounded-full",
                  job.status === 'picked_up' ? "bg-primary" : "bg-muted"
                )} />
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  job.status === 'picked_up' ? "bg-primary animate-pulse" : "bg-muted"
                )} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>Matched</span>
                <span>Pickup</span>
                <span>Drop-off</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Message */}
        <div className="text-center py-4">
          {job.status === 'requested' && (
            <p className="text-muted-foreground">Looking for a courier nearby...</p>
          )}
          {job.status === 'matched' && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{courierInfo?.firstName || 'Your courier'}</span> is heading to pick up your package
            </p>
          )}
          {job.status === 'en_route' && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{courierInfo?.firstName || 'Your courier'}</span> is on the way to pickup
            </p>
          )}
          {job.status === 'arrived' && (
            <p className="text-primary font-medium">
              Courier has arrived at pickup location! 📍
            </p>
          )}
          {job.status === 'picked_up' && (
            <p className="text-muted-foreground">
              Package picked up! Heading to {job.dropoffLocationName || 'drop-off'}
            </p>
          )}
          {job.status === 'dropped_off' && (
            <p className="text-primary font-medium">
              Package has been dropped off! ✅
            </p>
          )}
          {job.status === 'completed' && (
            <p className="text-green-500 font-medium">
              Delivery completed! 🎉
            </p>
          )}
        </div>

        {hero && (
          <div className={cn(
            "p-6 rounded-2xl border transition-all duration-500",
            hero.highlight ? "bg-primary/10 border-primary/30" : "bg-slate-900 border-slate-800"
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                hero.highlight ? "bg-primary/20 text-primary" : "bg-slate-800 text-slate-400"
              )}>
                {job.status === 'requested' ? <Loader2 className="w-6 h-6 animate-spin" /> :
                 job.status === 'completed' ? <Sparkles className="w-6 h-6" /> :
                 <Clock className={cn("w-6 h-6", hero.pulse && "animate-pulse")} />}
              </div>
              <div className="space-y-1">
                <h2 className={cn(
                  "text-xl font-bold font-outfit leading-none",
                  hero.highlight && "text-primary"
                )}>
                  {hero.title}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {hero.description}
                </p>
              </div>
            </div>
          </div>
        )}

        {job.status === 'cancelled' ? (
          <Card className="p-12 border-slate-800 bg-slate-900/50 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold font-outfit">Pickup Cancelled</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                This pickup request has been cancelled. If you believe this is an error or need a refund, please contact support.
              </p>
            </div>
            <div className="pt-4">
              <Link to="/customer/book">
                <Button size="lg" className="rounded-xl px-8">Book a New Pickup</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Map & Courier */}
            <div className="lg:col-span-2 space-y-6">
              {/* Live Map */}
              <LiveMap 
                status={job.status}
                eta={getETA()}
                etaMinutes={jobETA?.etaSeconds ? Math.ceil(jobETA.etaSeconds / 60) : undefined}
                distanceMiles={jobETA?.distanceMeters ? jobETA.distanceMeters / 1609.34 : undefined}
                pickupLocation={{ 
                  lat: job.pickupLatitude || 0, 
                  lng: job.pickupLongitude || 0, 
                  address: job.pickupAddress 
                }}
                dropoffLocation={job.serviceType === 'amazon_return' ? {
                  lat: job.dropoffLatitude || 0,
                  lng: job.dropoffLongitude || 0,
                  address: job.dropoffLocationAddress || 'Amazon Drop-off'
                } : {
                  lat: 0,
                  lng: 0,
                  address: `${job.carrier} Drop-off`
                }}
                courierLocation={courierLocation ? {
                  latitude: courierLocation.latitude,
                  longitude: courierLocation.longitude,
                  heading: courierLocation.heading,
                  updatedAt: courierLocation.updatedAt,
                } : undefined}
              />
              
              {job.courierId ? (
                <Card className="p-6 bg-slate-900 border-slate-800 overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-4">
                    <div className="flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">Active</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center border-2 border-primary/20 overflow-hidden">
                        {courierInfo?.firstName ? (
                          <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                            {courierInfo.firstName.charAt(0)}
                          </div>
                        ) : (
                          <User className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{courierInfo?.firstName || 'Assigned Courier'}</h3>
                        <div className="flex items-center gap-2 text-sm text-primary">
                          <div className="flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-primary" />
                            <span className="font-bold">5.0</span>
                          </div>
                          <span className="text-slate-500">•</span>
                          <span>{courierInfo?.vehicleColor} {courierInfo?.vehicleType}</span>
                        </div>
                        {/* Vehicle plate hidden for privacy */}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="rounded-full border-slate-700 bg-slate-800 hover:bg-slate-700 opacity-50 cursor-not-allowed"
                        disabled
                        title="Contact through app coming soon"
                      >
                        <Phone className="w-4 h-4 text-primary" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="rounded-full border-slate-700 bg-slate-800 hover:bg-slate-700 opacity-50 cursor-not-allowed"
                        disabled
                        title="Contact through app coming soon"
                      >
                        <MessageSquare className="w-4 h-4 text-primary" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-xs"
                        onClick={openInGoogleMaps}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Open in Maps
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase font-medium">Scheduled</p>
                      <p className="font-bold text-xl text-primary font-outfit">
                        {job.isAsap ? 'ASAP' : job.scheduledTime}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase font-medium">Package Count</p>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-slate-400" />
                        <p className="font-bold text-lg">{job.packageCount} {job.packageCount === 1 ? 'Package' : 'Packages'}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card className="p-8 bg-slate-900 border-slate-800 text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
                  <div className="relative z-10">
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4 border-2 border-primary/20">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                        <Search className="w-8 h-8 text-primary relative z-10" />
                      </div>
                    </div>
                    <h3 className="font-bold text-xl mb-1 font-outfit tracking-tight">Finding a Courier</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-4">We're matching your request with nearby couriers. Usually takes 2-5 minutes.</p>
                    <div className="flex justify-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <div 
                          key={i} 
                          className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" 
                          style={{ animationDelay: `${i * 0.2}s` }}
                        />
                      ))}
                    </div>
                  </div>
                </Card>
              )}

              {job.courierId && (
                <JobChat 
                  jobId={job._id}
                  viewerRole="customer"
                  otherPartyName={courierInfo?.firstName || 'Courier'}
                />
              )}

              {/* Verification Proof Display */}
              {(job.pickupScan || job.dropoffScan || job.pickupLabelScanVerified) && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                    Verification Proof
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Label Scan Verification */}
                    {job.pickupLabelScanVerified && (
                      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <div className="flex items-center gap-2 text-blue-500 mb-2">
                          <Package className="w-5 h-5" />
                          <span className="font-bold">Label Scanned</span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {job.pickupLabelScanTimestamp 
                            ? `Scanned at ${new Date(job.pickupLabelScanTimestamp).toLocaleTimeString()}`
                            : 'Verified'}
                        </p>
                        <p className="text-[10px] font-mono text-slate-500 mt-1">
                          {job.pickupLabelScanValueMasked || '***verified'}
                        </p>
                        {job.pickupLabelScanType && (
                          <Badge variant="outline" className="mt-2 text-[10px] border-blue-500/30 text-blue-400">
                            {job.pickupLabelScanType.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Pickup Scan */}
                    {job.pickupScan && (
                      <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                        <div className="flex items-center gap-2 text-green-500 mb-2">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-bold">Pickup Verified</span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Scanned at {new Date(job.pickupScan.timestamp).toLocaleTimeString()}
                        </p>
                        <p className="text-[10px] font-mono text-slate-500 mt-1 truncate">
                          ID: {job.pickupScan.barcodeData}
                        </p>
                      </div>
                    )}

                    {/* Dropoff Scan */}
                    {job.dropoffScan && (
                      <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                        <div className="flex items-center gap-2 text-green-500 mb-2">
                          <CheckCircle className="w-5 h-5" />
                          <span className="font-bold">Drop-off Verified</span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Scanned at {new Date(job.dropoffScan.timestamp).toLocaleTimeString()}
                        </p>
                        <p className="text-[10px] font-mono text-slate-500 mt-1 truncate">
                          ID: {job.dropoffScan.barcodeData}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Proof Photos Display */}
              {(job.pickupProofUrl || job.dropoffProofUrl) && (
                <Card className="bg-slate-900 border-slate-800 overflow-hidden">
                  <CardContent className="p-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">
                      Delivery Proof Photos
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Pickup Proof Photo */}
                      {job.pickupProofUrl && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-primary uppercase">Pickup Photo</span>
                            {job.pickupProofTimestamp && (
                              <span className="text-[10px] text-slate-500">
                                {new Date(job.pickupProofTimestamp).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-800 border border-slate-700">
                            <img 
                              src={job.pickupProofUrl} 
                              alt="Pickup proof" 
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 left-2 bg-green-500/90 text-white px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Verified
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Dropoff Proof Photo */}
                      {job.dropoffProofUrl && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-primary uppercase">Drop-off Photo</span>
                            {job.dropoffProofTimestamp && (
                              <span className="text-[10px] text-slate-500">
                                {new Date(job.dropoffProofTimestamp).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-800 border border-slate-700">
                            <img 
                              src={job.dropoffProofUrl} 
                              alt="Drop-off proof" 
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 left-2 bg-green-500/90 text-white px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Verified
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column: Timeline */}
            <div className="lg:col-span-1">
              <Card className="p-6 bg-slate-900 border-slate-800 h-full">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold font-outfit">Delivery Progress</h3>
                  <div className="h-1.5 w-24 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-1000" 
                      style={{ width: `${(currentIndex + 1) / statusSteps.length * 100}%` }}
                    />
                  </div>
                </div>
                
                <div className="space-y-8">
                  {statusSteps.map((step, index) => {
                    const isPast = index < currentIndex
                    const isActive = job.status === step.key
                    const Icon = step.icon
                    
                    return (
                      <div key={step.key} className="relative flex gap-4">
                        {/* Connector Line */}
                        {index !== statusSteps.length - 1 && (
                          <div 
                            className={cn(
                              "absolute left-[19px] top-10 w-[2px] h-[calc(100%+16px)]",
                              isPast ? "bg-primary" : "bg-slate-800"
                            )} 
                          />
                        )}

                        {/* Icon Circle */}
                        <div 
                          className={cn(
                            "relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-500",
                            isPast ? "bg-primary border-primary text-primary-foreground" : 
                            isActive ? "bg-slate-900 border-primary text-primary shadow-[0_0_15px_rgba(186,255,41,0.3)]" : 
                            "bg-slate-900 border-slate-800 text-slate-600"
                          )}
                        >
                          {isPast ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                        </div>

                        {/* Content */}
                        <div className="pt-1 pb-2">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className={cn(
                              "font-bold font-outfit transition-colors",
                              isActive ? "text-primary" : isPast ? "text-slate-100" : "text-slate-500"
                            )}>
                              {step.label}
                            </h4>
                            {step.time && (
                              <span className="text-[10px] text-slate-500 font-medium">
                                {new Date(step.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                          <p className={cn(
                            "text-xs transition-colors",
                            isActive ? "text-slate-300" : "text-slate-500"
                          )}>
                            {step.description}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Job Updates */}
                {jobNotifications.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-slate-800">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Latest Updates</h4>
                    <div className="space-y-3">
                      {jobNotifications.map((notif) => (
                        <div key={notif._id} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Bell className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm text-slate-200 leading-tight font-medium">
                                {notif.title}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                {notif.message}
                              </p>
                              <p className="text-[10px] text-slate-500 mt-1">
                                {formatDistanceToNow(notif.createdAt, { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>

      <RatingDialog 
        jobId={job._id}
        isOpen={isRatingOpen}
        onClose={() => setIsRatingOpen(false)}
        courierName={courierInfo?.firstName}
        courierPhotoUrl={courierImageUrl}
      />
    </AppShell>
  )
}
