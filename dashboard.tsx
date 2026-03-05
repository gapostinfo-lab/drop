import { useNavigate } from 'react-router'
import { useState, useEffect } from 'react'
import { 
  TrendingUp, 
  CheckCircle2, 
  Star, 
  Clock, 
  ChevronRight, 
  AlertCircle,
  Loader2,
  MapPin,
  XCircle,
  AlertTriangle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { OnlineToggle } from '@/components/courier/online-toggle'
import { JobCard } from '@/components/courier/job-card'
import { cn } from '@/lib/utils'
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/api"
import { toast } from "sonner"
import { AppShell } from '@/components/layout/app-shell'

import { useAuth } from '@/hooks/use-auth'
import { useCourierLocation } from '@/hooks/use-courier-location'

export default function CourierDashboardPage() {
  const navigate = useNavigate()
  const { userName } = useAuth()
  const [isTogglingOnline, setIsTogglingOnline] = useState(false)
  
  // SINGLE SOURCE OF TRUTH for courier status
  const courierStatus = useQuery(api.couriers.getMyCourierStatus)
  const myApplication = useQuery(api.couriers.getMyApplication) // Keep for other data like name, vehicle, etc.
  const setOnlineStatusMutation = useMutation(api.couriers.setOnlineStatus)
  const ensureCourierExists = useMutation(api.couriers.ensureMyCourierExists)

  // Auto-heal: Ensure courier record exists on mount
  useEffect(() => {
    const ensureCourier = async () => {
      try {
        const result = await ensureCourierExists({ roleHint: "courier" })
        console.log('[COURIER_DASHBOARD] ensureMyCourierExists result:', result)
      } catch (error) {
        console.error('[COURIER_DASHBOARD] ensureMyCourierExists error:', error)
        // Don't show toast - this is a background operation
      }
    }
    ensureCourier()
  }, [ensureCourierExists])
  
  // Debug: Log courier status
  console.log('[COURIER_DASHBOARD] courierStatus:', courierStatus)
  const myCourierJobs = useQuery(api.jobs.getCourierJobs, {})
  const profileImageUrl = useQuery(api.profiles.getProfileImageUrl)
  const payoutStatus = useQuery(api.payouts.getPayoutStatus)

  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt' | 'checking'>('checking')
  const [locationError, setLocationError] = useState<string | null>(null)

  // Check location permission on mount
  useEffect(() => {
    const checkLocationPermission = async () => {
      try {
        if (!navigator.geolocation) {
          setLocationPermission('denied')
          setLocationError('Geolocation is not supported by your browser')
          return
        }
        
        // Check permission status
        if (navigator.permissions) {
          const result = await navigator.permissions.query({ name: 'geolocation' })
          setLocationPermission(result.state as 'granted' | 'denied' | 'prompt')
          
          // Listen for permission changes
          result.addEventListener('change', () => {
            setLocationPermission(result.state as 'granted' | 'denied' | 'prompt')
          })
        } else {
          // Fallback for browsers without permissions API
          setLocationPermission('prompt')
        }
      } catch (err) {
        console.error('[LOCATION_CHECK] Error:', err)
        setLocationPermission('prompt')
      }
    }
    
    checkLocationPermission()
  }, [])

  const requestLocationAndGetCoords = async (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          })
        },
        (error) => {
          console.error('[LOCATION_REQUEST] Error:', error)
          switch (error.code) {
            case error.PERMISSION_DENIED:
              setLocationError('Location permission denied. Please enable location in your browser settings.')
              setLocationPermission('denied')
              break
            case error.POSITION_UNAVAILABLE:
              setLocationError('Location unavailable. Please check your GPS/location settings.')
              break
            case error.TIMEOUT:
              setLocationError('Location request timed out. Please try again.')
              break
            default:
              setLocationError('Failed to get your location.')
          }
          resolve(null)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    })
  }

  // SINGLE SOURCE OF TRUTH: Use courierStatus from dedicated query
  // Handle null (no auth) and missing applicationStatus
  const effectiveStatus = courierStatus?.applicationStatus ?? "not_found";
  const canGoOnline = courierStatus?.canGoOnline ?? false;
  const isOnline = courierStatus?.isOnline ?? false;

  // If courierStatus is null (no auth) or doesn't exist, show not_found state
  const hasValidStatus = courierStatus !== null && courierStatus?.exists !== false;

  // Debug: Log the full courierStatus for troubleshooting
  console.log('[COURIER_DASHBOARD] Full courierStatus:', courierStatus);
  console.log('[COURIER_DASHBOARD] Computed values:', {
    effectiveStatus,
    hasValidStatus,
    canGoOnline,
    isOnline,
  });

  // Debug logging
  console.log('[COURIER_DASHBOARD] Status from single source:', {
    applicationStatus: courierStatus?.applicationStatus,
    isOnline: courierStatus?.isOnline,
    canGoOnline: courierStatus?.canGoOnline,
    payoutStatus: courierStatus?.payoutStatus,
  });

  const { location, error: trackingError, isTracking } = useCourierLocation({
    isOnline: isOnline && canGoOnline,
  });

  // Wait for courierStatus to load (undefined = loading, null = no auth or not found)
  if (courierStatus === undefined || userName === undefined) {
    return (
      <AppShell>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading courier status...</p>
        </div>
      </AppShell>
    )
  }

  // Issue 2: Add check for jobs loading
  if (myCourierJobs === undefined) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading your jobs...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const status = effectiveStatus;
  
  const activeJob = myCourierJobs?.find(j => 
    ['matched', 'en_route', 'arrived', 'picked_up'].includes(j.status)
  )

  const completedJobs = myCourierJobs?.filter(j => j.status === 'completed') || []
  
  const completedToday = completedJobs.filter(j => {
    const today = new Date().toDateString()
    const jobDate = new Date(j._creationTime).toDateString()
    return today === jobDate
  }).length

  const thisWeekEarnings = completedJobs.filter(j => {
    const jobDate = new Date(j._creationTime)
    const now = new Date()
    const weekAgo = new Date(now.setDate(now.getDate() - 7))
    return jobDate > weekAgo
  }).reduce((acc, job) => acc + (job.courierPayout || 0), 0)

  const ratings = completedJobs.filter(j => j.rating !== undefined).map(j => j.rating!)
  const rating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 5.0

  const handleToggleOnline = async () => {
    if (isTogglingOnline) return;
    
    // Clear previous errors
    setLocationError(null);
    
    console.log('[GO_ONLINE] Toggle requested', {
      currentStatus: isOnline,
      canGoOnline,
      applicationStatus: effectiveStatus,
    });
    
    // Pre-flight checks
    if (!canGoOnline) {
      if (effectiveStatus !== "approved") {
        toast.error('Your application must be approved before going online.');
      } else if (courierStatus?.payoutStatus !== "complete") {
        toast.error('Please complete payout setup in your Profile first.', {
          action: {
            label: 'Go to Profile',
            onClick: () => navigate('/courier/profile'),
          },
        });
      }
      return;
    }
    
    // Check location permission when going online
    let coords: { latitude: number; longitude: number } | null = null;
    if (!isOnline) {
      if (locationPermission === 'denied') {
        toast.error('Location permission is required to go online.');
        return;
      }
      
      setIsTogglingOnline(true);
      toast.info('Getting your location...');
      
      coords = await requestLocationAndGetCoords();
      if (!coords) {
        setIsTogglingOnline(false);
        toast.error(locationError || 'Could not get your location.');
        return;
      }
    }
    
    // Call the mutation
    setIsTogglingOnline(true);
    try {
      const result = await setOnlineStatusMutation({
        isOnline: !isOnline,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      });
      
      console.log('[GO_ONLINE] Success', result);
      toast.success(result.isOnline ? "You're now online!" : "You're now offline");
      
    } catch (error: any) {
      console.error('[GO_ONLINE] Error:', error);
      
      // ConvexError has a 'data' property with the error code
      const errorData = error?.data;
      const message = error?.message || String(error);
      
      console.log('[GO_ONLINE] Error details:', { errorData, message });
      
      // Parse error codes from backend (ConvexError puts code in data)
      if (errorData === 'UNAUTHENTICATED' || message.includes('UNAUTHENTICATED')) {
        toast.error('Session expired. Please sign in again.', {
          action: {
            label: 'Sign In',
            onClick: () => navigate('/auth'),
          },
        });
      } else if (errorData === 'COURIER_NOT_FOUND_CREATED_PENDING' || message.includes('COURIER_NOT_FOUND_CREATED_PENDING')) {
        toast.info('Verification pending. Complete your profile to go online.', {
          action: {
            label: 'Complete Profile',
            onClick: () => navigate('/courier/onboarding'),
          },
        });
      } else if (errorData === 'COURIER_NOT_FOUND' || message.includes('COURIER_NOT_FOUND')) {
        toast.error('Courier profile not found. Please refresh the page.', {
          action: {
            label: 'Refresh',
            onClick: () => window.location.reload(),
          },
        });
      } else if (errorData === 'COURIER_NOT_APPROVED' || message.includes('COURIER_NOT_APPROVED')) {
        toast.info('Verification pending. You can\'t go online until approved.');
      } else if (errorData === 'PAYOUT_REQUIRED' || message.includes('PAYOUT_REQUIRED')) {
        toast.error('Please complete payout setup first.', {
          action: {
            label: 'Setup Payout',
            onClick: () => navigate('/courier/profile'),
          },
        });
      } else {
        // Show the actual error message for debugging
        toast.error(`Failed to go online: ${message}`);
      }
    } finally {
      setIsTogglingOnline(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-500/20 text-green-600 border-green-500/50'
      case 'pending':
      case 'pending_review': return 'bg-yellow-500/20 text-yellow-600 border-yellow-500/50'
      case 'denied': return 'bg-red-500/20 text-red-600 border-red-500/50'
      case 'not_found':
      case 'draft': return 'bg-blue-500/20 text-blue-600 border-blue-500/50'
      case 'suspended': return 'bg-orange-500/20 text-orange-600 border-orange-500/50'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  // Determine if toggle should be disabled
  const isToggleDisabled = !canGoOnline || 
    (locationPermission === 'denied' && !isOnline);

  return (
    <AppShell>
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="p-6 space-y-6">
          {/* Show verification banner only if NOT approved AND we have a valid courier record */}
          {hasValidStatus && effectiveStatus !== "approved" && (
            <Card key={`verification-${effectiveStatus}`} className={cn(
              "border-2",
              effectiveStatus === "pending" && "border-yellow-500/50 bg-yellow-500/10",
              effectiveStatus === "denied" && "border-red-500/50 bg-red-500/10",
              (effectiveStatus === "draft" || effectiveStatus === "not_found") && "border-blue-500/50 bg-blue-500/10"
            )}>
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  {effectiveStatus === "pending" && (
                    <>
                      <Clock className="w-6 h-6 text-yellow-500 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-bold text-yellow-500">Verification Pending</h3>
                        <p className="text-sm text-muted-foreground">
                          Your documents are being reviewed. You'll be notified when approved.
                        </p>
                      </div>
                    </>
                  )}
                  {effectiveStatus === "denied" && (
                    <>
                      <XCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-bold text-red-500">Verification Denied</h3>
                        <p className="text-sm text-muted-foreground">
                          {myApplication?.denialReason || myApplication?.verificationDenialReason || "Your verification was not approved. Please contact support."}
                        </p>
                      </div>
                    </>
                  )}
                  {(effectiveStatus === "draft" || effectiveStatus === "not_found") && (
                    <>
                      <AlertTriangle className="w-6 h-6 text-blue-500 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-bold text-blue-500">Complete Verification</h3>
                        <p className="text-sm text-muted-foreground">
                          Please complete your profile to start accepting jobs.
                        </p>
                        <Button 
                          size="sm" 
                          className="mt-2"
                          onClick={() => navigate('/courier/onboarding')}
                        >
                          Complete Profile
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Location Permission Banner */}
          {locationPermission === 'denied' && canGoOnline && (
            <Card className="border-2 border-orange-500/50 bg-orange-500/10">
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  <MapPin className="w-6 h-6 text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-orange-500">Location Access Required</h3>
                    <p className="text-sm text-muted-foreground">
                      Please enable location access in your browser settings to go online and receive jobs.
                    </p>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="mt-2 border-orange-500/50 text-orange-500 hover:bg-orange-500/10"
                      onClick={() => {
                        // Try to trigger permission prompt
                        navigator.geolocation.getCurrentPosition(
                          () => setLocationPermission('granted'),
                          () => toast.error('Please enable location in your browser settings'),
                          { timeout: 5000 }
                        )
                      }}
                    >
                      Enable Location
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payout Setup Banner */}
          {payoutStatus?.isApproved && payoutStatus?.status !== 'complete' && (
            <Card 
              className="bg-yellow-500/10 border-yellow-500/20 cursor-pointer hover:bg-yellow-500/20 transition-colors"
              onClick={() => navigate('/courier/profile')}
            >
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-yellow-500/20">
                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="font-bold text-yellow-500 text-sm uppercase tracking-tight">Payout Setup Required</p>
                    <p className="text-xs text-yellow-500/80">Complete payout setup to start accepting jobs</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-yellow-500" />
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-3xl font-black tracking-tighter uppercase">Welcome, {userName?.split(' ')[0] || 'Courier'}</h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("font-bold", getStatusColor(status))}>
                  {status === "approved" ? "APPROVED" :
                   status === "denied" ? "DENIED" :
                   status === "pending" ? "PENDING" :
                   status === "not_found" ? "NOT FOUND" :
                   status === "draft" ? "DRAFT" :
                   (status as string).replace('_', ' ').toUpperCase()}
                </Badge>
                {status === 'pending' && (
                  <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" /> REVIEW IN PROGRESS
                  </span>
                )}
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-muted border-2 border-primary/20 overflow-hidden">
              {profileImageUrl ? (
                <img src={profileImageUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}`} alt="Avatar" />
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-card/50 border-muted-foreground/10">
              <CardContent className="p-4 flex flex-col items-center text-center gap-1">
                <TrendingUp className="w-5 h-5 text-primary" />
                <div className="text-lg font-black">${thisWeekEarnings.toFixed(2)}</div>
                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Weekly</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-muted-foreground/10">
              <CardContent className="p-4 flex flex-col items-center text-center gap-1">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <div className="text-lg font-black">{completedToday}</div>
                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Today</div>
              </CardContent>
            </Card>
            <Card className="bg-card/50 border-muted-foreground/10">
              <CardContent className="p-4 flex flex-col items-center text-center gap-1">
                <Star className="w-5 h-5 text-primary" />
                <div className="text-lg font-black">{rating.toFixed(1)}</div>
                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Rating</div>
              </CardContent>
            </Card>
          </div>

          {/* Debug info - only in development */}
          {import.meta.env.DEV && courierStatus?._debug && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-3">
                <p className="text-xs font-mono text-slate-400">
                  Debug: authId={courierStatus._debug.authId?.slice(0, 8)}... | 
                  email={courierStatus._debug.email || 'none'} | 
                  appId={courierStatus._debug.applicationId?.slice(0, 8) || 'none'}... | 
                  rawStatus={courierStatus._debug.rawStatus}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Online Toggle */}
          <div className="space-y-3">
            <OnlineToggle 
              isOnline={isOnline} 
              onToggle={handleToggleOnline}
              isLoading={isTogglingOnline}
              disabled={isToggleDisabled}
            />
            {!canGoOnline && (
              <p className="text-center text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Complete verification to go online
              </p>
            )}
            {canGoOnline && locationPermission === 'denied' && !isOnline && (
              <p className="text-center text-xs text-orange-500 font-medium uppercase tracking-wider">
                Enable location to go online
              </p>
            )}
            {canGoOnline && locationPermission !== 'denied' && payoutStatus?.status !== 'complete' && !isOnline && (
              <p className="text-center text-xs text-yellow-500 font-medium uppercase tracking-wider">
                Complete payout setup to go online
              </p>
            )}
            {/* Location Status */}
            {canGoOnline && isOnline && (
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                {isTracking ? (
                  <>
                    <MapPin className="w-3 h-3 text-green-500 animate-pulse" />
                    <span>Location sharing active</span>
                    {location && (
                      <span className="text-green-500">
                        ({location.latitude.toFixed(4)}, {location.longitude.toFixed(4)})
                      </span>
                    )}
                  </>
                ) : trackingError ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-destructive" />
                    <span className="text-destructive">{trackingError}</span>
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span>Starting location tracking...</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Active Job Section */}
          {activeJob && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black tracking-tight">ACTIVE JOB</h2>
                <Badge className="bg-primary text-primary-foreground animate-pulse">LIVE</Badge>
              </div>
              <JobCard 
                job={{
                  ...activeJob,
                  id: activeJob._id,
                  dropoffAddress: "Carrier Drop-off",
                  distance: "2.4 miles",
                  carrierType: activeJob.carrier as any,
                  payout: activeJob.courierPayout || 0,
                  packageCount: activeJob.packageCount,
                  status: 'Active'
                } as any} 
                variant="active" 
                onComplete={() => navigate('/courier/active-job')} 
              />
            </div>
          )}

          {/* Available Jobs CTA */}
          {canGoOnline && isOnline && !activeJob && (
            <Button 
              onClick={() => navigate('/courier/available-jobs')}
              className="w-full h-20 bg-primary hover:bg-primary/90 text-primary-foreground text-xl font-black rounded-3xl shadow-[0_10px_30px_rgba(var(--primary),0.2)] group"
            >
              VIEW AVAILABLE JOBS
              <ChevronRight className="w-6 h-6 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          )}

          {/* Quick Earnings Summary */}
          <Card className="border-muted-foreground/10 bg-card/30">
            <CardHeader className="p-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Today's Earnings</CardTitle>
              <Button variant="ghost" size="sm" className="text-primary font-bold" onClick={() => navigate('/courier/earnings')}>
                VIEW ALL
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex items-end gap-2">
                <span className="text-4xl font-black tracking-tighter">${(completedToday * 12.50).toFixed(2)}</span>
                <span className="text-xs text-green-500 font-bold mb-1.5 flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" /> +12% vs yesterday
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
