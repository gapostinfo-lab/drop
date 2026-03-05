import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { 
  ArrowLeft, 
  Navigation, 
  Phone, 
  MessageSquare, 
  AlertCircle, 
  Package, 
  Camera,
  CheckCircle2,
  ChevronRight,
  Loader2,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Circle,
  ExternalLink
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/api"
import { Id } from "@convex/dataModel"
import { AppShell } from '@/components/layout/app-shell'
import { BarcodeScanner } from '@/components/courier/barcode-scanner'
import { LabelScanner } from '@/components/courier/label-scanner'
import { PhotoCapture } from '@/components/courier/photo-capture'
import { JobChat } from '@/components/job-chat'
import { GoogleMapRoute } from '@/components/maps/google-map-route'
import { useGeoLocation } from '@/hooks/use-geolocation'

type JobStep = 'navigate-pickup' | 'scan-label' | 'photo-pickup' | 'navigate-dropoff' | 'scan-dropoff' | 'completed'

export default function ActiveJobPage() {
  const navigate = useNavigate()
  const application = useQuery(api.couriers.getMyApplication)
  const myCourierJobs = useQuery(api.jobs.getCourierJobs, {})
  const updateJobStatus = useMutation(api.jobs.updateJobStatus)
  const recordScan = useMutation(api.jobs.recordScan)
  const completeJobMutation = useMutation(api.jobs.completeJob)
  const updateLocation = useMutation(api.locations.updateCourierLocation)

  // Redirect non-approved couriers to status page
  useEffect(() => {
    if (application !== undefined && application?.status !== 'approved') {
      navigate('/courier/status')
    }
  }, [application, navigate])

  const activeJob = myCourierJobs?.find(j => 
    ['matched', 'en_route', 'arrived', 'picked_up', 'dropped_off'].includes(j.status)
  )

  const customerProfile = useQuery(api.profiles.getProfileByUserId, activeJob?.customerId ? { userId: activeJob.customerId } : "skip")
  const jobETA = useQuery(api.eta.getJobETA, activeJob?._id ? { jobId: activeJob._id } : "skip")

  const handleCall = () => {
    const phone = customerProfile?.phone
    if (!phone) {
      toast.error("Customer phone number not available")
      return
    }
    window.open(`tel:${phone}`, '_self')
  }

  const handleMessage = () => {
    const phone = customerProfile?.phone
    if (!phone) {
      toast.error("Customer phone number not available")
      return
    }
    window.open(`sms:${phone}?body=Hi, this is regarding your Droppit pickup!`, '_self')
  }

  const [step, setStep] = useState<JobStep>(() => {
    if (!activeJob) return 'navigate-pickup'
    if (activeJob.status === 'matched') return 'navigate-pickup'
    if (activeJob.status === 'en_route') return 'navigate-pickup'
    if (activeJob.status === 'arrived') {
      // Check if label scan is done
      if (!activeJob.pickupLabelScanVerified) return 'scan-label'
      // Check if photo is done
      if (!activeJob.pickupProofId) return 'photo-pickup'
      return 'navigate-dropoff' // Both done, shouldn't be here
    }
    if (activeJob.status === 'picked_up') return 'navigate-dropoff'
    if (activeJob.status === 'dropped_off') return 'scan-dropoff'
    return 'navigate-pickup'
  })

  // Sync step with activeJob status changes
  useEffect(() => {
    if (!activeJob) return;
    
    const statusToStep: Record<string, JobStep> = {
      matched: "navigate-pickup",
      en_route: "navigate-pickup", 
      arrived: activeJob.pickupLabelScanVerified 
        ? (activeJob.pickupProofId ? "navigate-dropoff" : "photo-pickup")
        : "scan-label",
      picked_up: "navigate-dropoff",
      dropped_off: "scan-dropoff",
    };
    
    const newStep = statusToStep[activeJob.status];
    if (newStep && newStep !== step) {
      console.log(`[ActiveJob] Syncing step: ${step} -> ${newStep} (status: ${activeJob.status})`);
      setStep(newStep);
    }
  }, [activeJob?.status, activeJob?.pickupLabelScanVerified, activeJob?.pickupProofId, step]);

  const geo = useGeoLocation({ 
    enabled: !!activeJob,
    retryInterval: 3000,
  })

  // Send location updates to backend
  useEffect(() => {
    if (!activeJob || !geo.latitude || !geo.longitude) return
    
    const sendUpdate = () => {
      updateLocation({
        latitude: geo.latitude!,
        longitude: geo.longitude!,
        heading: geo.heading ?? undefined,
        speed: geo.speed ?? undefined,
        accuracy: geo.accuracy ?? undefined,
        jobId: activeJob._id,
      }).catch(console.error)
    }
    
    // Send immediately
    sendUpdate()
    
    // Then every 5 seconds
    const interval = setInterval(sendUpdate, 5000)
    
    return () => clearInterval(interval)
  }, [activeJob?._id, geo.latitude, geo.longitude, geo.heading, geo.speed, geo.accuracy, updateLocation])

  const [isUpdating, setIsUpdating] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [scanType, setScanType] = useState<'pickup' | 'dropoff'>('pickup')
  const [isPhotoCaptureOpen, setIsPhotoCaptureOpen] = useState(false)
  const [labelScanValue, setLabelScanValue] = useState<string | null>(null)
  const [isLabelScannerOpen, setIsLabelScannerOpen] = useState(false)
  const [photoType, setPhotoType] = useState<'pickup' | 'dropoff'>('pickup')
  const [pickupProofId, setPickupProofId] = useState<Id<"_storage"> | null>(null)
  const [dropoffProofId, setDropoffProofId] = useState<Id<"_storage"> | null>(null)
  const saveProofPhoto = useMutation(api.jobs.saveProofPhoto)
  const savePickupLabelScan = useMutation(api.jobs.savePickupLabelScan)

  const openNavigation = (address: string, destLat?: number, destLng?: number) => {
    let url: string
    
    if (destLat && destLng) {
      // Use coordinates for destination
      if (geo.latitude && geo.longitude) {
        // Include origin (courier's current location)
        url = `https://www.google.com/maps/dir/?api=1&origin=${geo.latitude},${geo.longitude}&destination=${destLat},${destLng}&travelmode=driving`
      } else {
        // No origin - let Google Maps use user's current location
        url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`
      }
    } else {
      // Fallback to address search
      const encoded = encodeURIComponent(address)
      if (geo.latitude && geo.longitude) {
        url = `https://www.google.com/maps/dir/?api=1&origin=${geo.latitude},${geo.longitude}&destination=${encoded}&travelmode=driving`
      } else {
        url = `https://www.google.com/maps/search/?api=1&query=${encoded}`
      }
    }
    
    window.open(url, '_blank')
  }

  const openDropoffNavigation = () => {
    if (!activeJob) return
    
    let url: string
    
    if (activeJob.dropoffLatitude && activeJob.dropoffLongitude) {
      if (geo.latitude && geo.longitude) {
        url = `https://www.google.com/maps/dir/?api=1&origin=${geo.latitude},${geo.longitude}&destination=${activeJob.dropoffLatitude},${activeJob.dropoffLongitude}&travelmode=driving`
      } else {
        url = `https://www.google.com/maps/dir/?api=1&destination=${activeJob.dropoffLatitude},${activeJob.dropoffLongitude}&travelmode=driving`
      }
    } else if (activeJob.dropoffLocationAddress) {
      const encoded = encodeURIComponent(activeJob.dropoffLocationAddress)
      if (geo.latitude && geo.longitude) {
        url = `https://www.google.com/maps/dir/?api=1&origin=${geo.latitude},${geo.longitude}&destination=${encoded}&travelmode=driving`
      } else {
        url = `https://www.google.com/maps/search/?api=1&query=${encoded}`
      }
    } else {
      // Fallback to carrier name
      openNavigation(activeJob.carrier)
      return
    }
    
    window.open(url, '_blank')
  }

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    // Haversine formula
    const R = 6371e3 // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180
    const φ2 = lat2 * Math.PI / 180
    const Δφ = (lat2 - lat1) * Math.PI / 180
    const Δλ = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c // Distance in meters
  }

  const formatDistance = (meters: number): string => {
    const miles = meters / 1609.34
    if (miles < 0.1) return `${Math.round(meters)} ft`
    return `${miles.toFixed(1)} mi`
  }

  if (application === undefined || myCourierJobs === undefined) {
    return (
      <AppShell>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppShell>
    )
  }

  if (application?.status !== "approved") {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Checking courier status...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!activeJob) {
    return (
      <AppShell>
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-muted-foreground/30" />
          </div>
          <h2 className="text-2xl font-black">NO ACTIVE JOB</h2>
          <p className="text-muted-foreground max-w-xs">You don't have an active job. Head back to the dashboard to find one.</p>
          <Button onClick={() => navigate('/courier/dashboard')} className="bg-primary text-primary-foreground font-bold">
            GO TO DASHBOARD
          </Button>
        </div>
      </AppShell>
    )
  }

  const steps: JobStep[] = ['navigate-pickup', 'scan-label', 'photo-pickup', 'navigate-dropoff', 'scan-dropoff', 'completed']
  const stepIndex = steps.indexOf(step)
  const progress = (stepIndex / (steps.length - 1)) * 100

  const handleScan = (type: 'pickup' | 'dropoff') => {
    if (!activeJob || isScanning) return
    if (!geo.latitude || !geo.longitude) {
      toast.error('Location required for scanning. Please enable GPS.')
      return
    }
    
    setScanType(type)
    setIsScannerOpen(true)
  }

  const handleLabelScan = async (scannedValue: string, scanType: "barcode" | "qr" | "manual" | "ocr") => {
    setIsLabelScannerOpen(false)
    
    if (!activeJob) return

    try {
      const result = await savePickupLabelScan({
        jobId: activeJob._id,
        scanValue: scannedValue,
        scanType,
      })
      
      setLabelScanValue(scannedValue)
      
      if (result.hasExpectedTracking && result.scanMatchesExpected === false) {
        toast.warning("Scan does not match expected tracking number. Please verify this is the correct package.", {
          duration: 5000,
        })
      } else {
        toast.success("Package label scanned successfully!")
      }
      
      // Move to photo step
      setStep('photo-pickup')
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save scan"
      // Extract user-friendly message from error codes
      const friendlyMessage = message.includes("UNAUTHENTICATED") 
        ? "Please sign in again"
        : message.includes("INVALID_SCAN_VALUE")
        ? "Invalid tracking number"
        : message.includes("NOT_ASSIGNED")
        ? "You are not assigned to this job"
        : message.includes("INVALID_STATUS")
        ? "Please arrive at pickup first"
        : message
      toast.error(friendlyMessage)
    }
  }

  const handleScanResult = async (barcode: string) => {
    setIsScannerOpen(false)
    setIsScanning(true)
    const type = scanType

    try {
      await recordScan({
        jobId: activeJob!._id,
        type,
        barcodeData: barcode,
        latitude: geo.latitude!,
        longitude: geo.longitude!,
      })
      toast.success(`${type === 'pickup' ? 'Pickup' : 'Drop-off'} scan recorded!`)
      
      if (type === 'pickup') {
        setStep('photo-pickup')
      } else {
        // Complete the job
        try {
          await completeJobMutation({ jobId: activeJob!._id })
          setStep('completed')
          toast.success("Job completed successfully! 🎉")
          setTimeout(() => navigate('/courier/dashboard'), 2000)
        } catch (completeError) {
          const msg = completeError instanceof Error ? completeError.message : "Failed to complete job"
          toast.error(msg)
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to record scan"
      toast.error(message, {
        action: {
          label: "Retry",
          onClick: () => handleScan(type),
        },
      })
    } finally {
      setIsScanning(false)
    }
  }

  const openPhotoCapture = (type: 'pickup' | 'dropoff') => {
    setPhotoType(type)
    setIsPhotoCaptureOpen(true)
  }

  const handlePhotoCapture = async (storageId: Id<"_storage">) => {
    setIsPhotoCaptureOpen(false)
    
    if (!activeJob) return

    try {
      await saveProofPhoto({
        jobId: activeJob._id,
        type: photoType,
        photoId: storageId,
        latitude: geo.latitude ?? undefined,
        longitude: geo.longitude ?? undefined,
      })

      if (photoType === 'pickup') {
        setPickupProofId(storageId)
        toast.success("Pickup proof photo saved!")
      } else {
        setDropoffProofId(storageId)
        toast.success("Dropoff proof photo saved!")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save proof photo"
      toast.error(message)
    }
  }

  const handleNext = async () => {
    if (!activeJob || isUpdating) return
    
    // Require GPS location for status updates
    if (!geo.latitude || !geo.longitude) {
      toast.error("GPS location required. Please enable location services.", {
        action: {
          label: "Retry",
          onClick: () => geo.requestPermission(),
        },
      })
      return
    }
    
    console.log("[handleNext] Starting:", {
      step,
      currentJobStatus: activeJob.status,
      jobId: activeJob._id,
    })
    
    setIsUpdating(true)
    try {
      if (step === 'navigate-pickup') {
        console.log("[handleNext] navigate-pickup: transitioning to arrived")
        // Handle the status transition properly based on current status
        // Valid transitions: matched → en_route → arrived
        if (activeJob.status === 'matched') {
          console.log("[handleNext] Job is matched, first transitioning to en_route")
          // First transition to en_route
          await updateJobStatus({ 
            jobId: activeJob._id, 
            status: "en_route",
            latitude: geo.latitude,
            longitude: geo.longitude,
          })
          console.log("[handleNext] en_route transition complete")
        }
        // Then transition to arrived (whether we just went to en_route or were already there)
        console.log("[handleNext] Now transitioning to arrived")
        await updateJobStatus({ 
          jobId: activeJob._id, 
          status: "arrived",
          latitude: geo.latitude,
          longitude: geo.longitude,
        })
        console.log("[handleNext] arrived transition complete")
        setStep('scan-label')
        toast.success("Arrived at pickup location!")
      } else if (step === 'photo-pickup') {
        console.log("[handleNext] photo-pickup: transitioning to picked_up")
        // Verify both scan and photo are done before allowing picked_up
        if (!activeJob.pickupLabelScanVerified && !labelScanValue) {
          toast.error("Please scan the package label first")
          setStep('scan-label')
          return
        }
        if (!pickupProofId && !activeJob.pickupProofId) {
          toast.error("Please take a pickup photo first")
          return
        }
        
        await updateJobStatus({ 
          jobId: activeJob._id, 
          status: "picked_up",
          latitude: geo.latitude,
          longitude: geo.longitude,
        })
        console.log("[handleNext] picked_up transition complete")
        setStep('navigate-dropoff')
        toast.success("Package picked up!")
      } else if (step === 'navigate-dropoff') {
        console.log("[handleNext] navigate-dropoff: transitioning to dropped_off", {
          currentStatus: activeJob.status,
          jobId: activeJob._id,
          hasLocation: !!geo.latitude,
          locationLat: geo.latitude,
          locationLng: geo.longitude,
        })
        // Proximity check
        if (geo.latitude && geo.longitude) {
          let destLat, destLng;
          if (activeJob.dropoffLatitude && activeJob.dropoffLongitude) {
            destLat = activeJob.dropoffLatitude;
            destLng = activeJob.dropoffLongitude;
          }

          if (destLat !== undefined && destLng !== undefined) {
            const distance = calculateDistance(geo.latitude, geo.longitude, destLat, destLng)
            if (distance > 500) {
              toast.warning(`You are still ${Math.round(distance)}m away from the destination.`)
            }
          }
        }
        await updateJobStatus({ 
          jobId: activeJob._id, 
          status: "dropped_off",
          latitude: geo.latitude,
          longitude: geo.longitude,
        })
        console.log("[handleNext] dropped_off transition complete")
        setStep('scan-dropoff')
        toast.success("Arrived at drop-off!")
      } else {
        console.log("[handleNext] Unknown step:", step)
      }
    } catch (error) {
      console.error("[handleNext] Error:", error)
      
      // Extract error message - Convex errors have special structure
      let message = "Failed to update job status"
      if (error instanceof Error) {
        message = error.message
        // Check for Convex error data
        if ('data' in error && typeof (error as any).data === 'string') {
          message = (error as any).data
        }
      }
      // Also check if it's a ConvexError with data property
      if (typeof error === 'object' && error !== null && 'data' in error) {
        const data = (error as any).data
        if (typeof data === 'string') {
          message = data
        } else if (typeof data === 'object' && data?.message) {
          message = data.message
        }
      }
      
      console.error("[handleNext] Extracted message:", message)
      
      toast.error(message, {
        action: {
          label: "Retry",
          onClick: () => handleNext(),
        },
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-muted-foreground/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/courier/dashboard')}>
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <div className="space-y-0.5">
              <h1 className="text-sm font-black tracking-widest text-muted-foreground uppercase">ACTIVE JOB</h1>
              <p className="text-sm font-bold">#{activeJob._id.slice(0, 8)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeJob.serviceType === 'amazon_return' ? (
              <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-none uppercase text-[10px]">Amazon Return</Badge>
            ) : (
              <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-none uppercase text-[10px]">Carrier Drop-Off</Badge>
            )}
            <Badge className="bg-primary text-primary-foreground uppercase text-[10px]">{activeJob.status}</Badge>
          </div>
        </div>

        {/* GPS Permission Overlay */}
        {geo.permissionState === 'denied' && (
          <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-6">
            <Card className="max-w-sm w-full">
              <CardContent className="pt-6 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                  <MapPin className="w-8 h-8 text-destructive" />
                </div>
                <h2 className="text-xl font-bold">GPS Required</h2>
                <p className="text-muted-foreground text-sm">
                  Location services are required to complete deliveries. Please enable GPS in your browser settings.
                </p>
                <div className="flex flex-col gap-2">
                  <Button onClick={() => geo.requestPermission()} className="w-full">
                    <MapPin className="w-4 h-4 mr-2" />
                    Enable Location
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/courier/dashboard')} className="w-full">
                    Go Back
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Progress Bar */}
        <div className="px-6 py-4 space-y-4">
          <div className="flex justify-between text-[10px] font-black tracking-widest text-muted-foreground uppercase">
            <span>PICKUP</span>
            <span>DROPOFF</span>
          </div>
          <Progress value={progress} className="h-2 bg-muted-foreground/10" />
          
          <div className="flex flex-col gap-2">
            {geo.latitude && geo.longitude && (
              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <MapPin className="w-3 h-3 text-primary" />
                <span>GPS: {geo.latitude.toFixed(6)}, {geo.longitude.toFixed(6)}</span>
                {geo.accuracy && <span className="text-primary">±{Math.round(geo.accuracy)}m</span>}
              </div>
            )}

            {geo.error && geo.permissionState !== 'denied' && (
              <div className="flex items-center justify-between gap-2 p-2 bg-destructive/10 rounded-lg">
                <div className="flex items-center gap-2 text-[10px] font-bold text-destructive uppercase tracking-wider">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{geo.error}</span>
                </div>
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => geo.requestPermission()}>
                  RETRY
                </Button>
              </div>
            )}

            {geo.permissionState === 'loading' && (
              <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Getting location...</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 p-6 space-y-6">
          {/* Step Content */}
          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight leading-none uppercase">
                {step === 'navigate-pickup' && "NAVIGATE TO PICKUP"}
                {step === 'scan-label' && "SCAN PACKAGE LABEL"}
                {step === 'photo-pickup' && "PROOF OF PICKUP"}
                {step === 'navigate-dropoff' && "NAVIGATE TO DROP-OFF"}
                {step === 'scan-dropoff' && "SCAN AT DROP-OFF"}
                {step === 'completed' && "DELIVERED!"}
              </h2>
              <div className="text-muted-foreground text-sm font-medium">
                {step === 'navigate-pickup' && activeJob.pickupAddress}
                {geo.latitude && geo.longitude && activeJob.pickupLatitude && activeJob.pickupLongitude && (
                  <p className="text-xs text-primary font-medium">
                    📍 {jobETA?.distanceMeters 
                      ? `${(jobETA.distanceMeters / 1609.34).toFixed(1)} mi away`
                      : `${formatDistance(calculateDistance(
                          geo.latitude, geo.longitude,
                          activeJob.pickupLatitude, activeJob.pickupLongitude
                        ))} away`
                    }
                    {jobETA?.etaSeconds && !jobETA.isStale && (
                      <span className="ml-2">• {Math.ceil(jobETA.etaSeconds / 60)} min</span>
                    )}
                  </p>
                )}
                {step === 'scan-label' && "Scan the shipping label barcode or QR code"}
                {step === 'photo-pickup' && "Take a photo of the packages at pickup"}
                {step === 'navigate-dropoff' && (
                  activeJob.dropoffLocationName 
                    ? `Navigate to ${activeJob.dropoffLocationName}`
                    : activeJob.serviceType === 'amazon_return' 
                      ? 'Navigate to Amazon Drop-off'
                      : `Navigate to nearest ${activeJob.carrier} location`
                )}
                {step === 'scan-dropoff' && (
                  activeJob.dropoffLocationName
                    ? `Drop off at ${activeJob.dropoffLocationName}`
                    : activeJob.serviceType === 'amazon_return'
                      ? 'Drop off at Amazon location'
                      : "Scan packages to confirm delivery"
                )}
              {step === 'completed' && "Great job! Your earnings have been updated."}
            </div>

            {/* Manual Address Navigation Card - show when no coordinates */}
            {(activeJob.isManualAddress || (!activeJob.pickupLatitude && !activeJob.pickupLongitude)) && (
              <Card className="bg-yellow-500/10 border-yellow-500/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-yellow-500 mb-1">Manual Address Entry</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        This address was entered manually without GPS coordinates. Use the button below to navigate.
                      </p>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">{activeJob.pickupAddress}</p>
                        {activeJob.pickupStreet1 && (
                          <p className="text-xs text-muted-foreground">
                            {activeJob.pickupStreet1}
                            {activeJob.pickupStreet2 && `, ${activeJob.pickupStreet2}`}
                            {activeJob.pickupCity && `, ${activeJob.pickupCity}`}
                            {activeJob.pickupState && `, ${activeJob.pickupState}`}
                            {activeJob.pickupZipCode && ` ${activeJob.pickupZipCode}`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button 
                    className="w-full mt-4 bg-yellow-500 hover:bg-yellow-600 text-black font-bold"
                    onClick={() => openNavigation(
                      activeJob.pickupAddress, 
                      activeJob.pickupLatitude, 
                      activeJob.pickupLongitude
                    )}
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Open in Google Maps
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Drop-off Location Card - Shows for both Amazon returns and Carrier drop-offs */}
            {activeJob.dropoffLocationId && (step === 'navigate-dropoff' || step === 'scan-dropoff') && (
              <Card className={cn(
                "rounded-2xl overflow-hidden mt-4",
                activeJob.serviceType === 'amazon_return' 
                  ? "bg-orange-500/10 border-orange-500/20" 
                  : activeJob.dropoffLocationType === 'ups'
                    ? "bg-amber-500/10 border-amber-500/20"
                    : activeJob.dropoffLocationType === 'fedex'
                      ? "bg-purple-500/10 border-purple-500/20"
                      : "bg-blue-500/10 border-blue-500/20"
              )}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-lg leading-tight">{activeJob.dropoffLocationName}</h3>
                        <Badge variant="outline" className={cn(
                          "text-[10px] uppercase",
                          activeJob.serviceType === 'amazon_return' 
                            ? "border-orange-500/50 text-orange-500"
                            : activeJob.dropoffLocationType === 'ups'
                              ? "border-amber-500/50 text-amber-500"
                              : activeJob.dropoffLocationType === 'fedex'
                                ? "border-purple-500/50 text-purple-500"
                                : "border-blue-500/50 text-blue-500"
                        )}>
                          {activeJob.dropoffLocationType?.replace('_', ' ') || activeJob.carrier || 'Drop-off'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{activeJob.dropoffLocationAddress}</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={cn(
                      "w-full font-bold h-9",
                      activeJob.serviceType === 'amazon_return' 
                        ? "border-orange-500/20 text-orange-500"
                        : activeJob.dropoffLocationType === 'ups'
                          ? "border-amber-500/20 text-amber-500"
                          : activeJob.dropoffLocationType === 'fedex'
                            ? "border-purple-500/20 text-purple-500"
                            : "border-blue-500/20 text-blue-500"
                    )}
                    onClick={openDropoffNavigation}
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    OPEN IN GOOGLE MAPS
                  </Button>
                </CardContent>
              </Card>
            )}


              {/* Scan Status Indicators */}
              {(step === 'scan-label' || step === 'scan-dropoff' || step === 'photo-pickup' || step === 'navigate-dropoff') && (
                <div className="pt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                    {activeJob.pickupLabelScanVerified || labelScanValue ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className={activeJob.pickupLabelScanVerified || labelScanValue ? "text-green-500" : "text-muted-foreground"}>
                      Label Scan
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                    {activeJob.pickupProofId || pickupProofId ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className={activeJob.pickupProofId || pickupProofId ? "text-green-500" : "text-muted-foreground"}>
                      Pickup Photo
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                    {activeJob.dropoffScan ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className={activeJob.dropoffScan ? "text-green-500" : "text-muted-foreground"}>
                      Drop-off Scan
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Area */}
            <div className="py-10 flex flex-col items-center justify-center gap-8">
              {(step === 'navigate-pickup' || step === 'navigate-dropoff') && (
                <div className="w-full space-y-4">
                  {/* In-App Navigation Map */}
                  <GoogleMapRoute
                    pickupLocation={{
                      lat: activeJob.pickupLatitude || 0,
                      lng: activeJob.pickupLongitude || 0,
                      address: activeJob.pickupAddress,
                    }}
                    dropoffLocation={{
                      lat: activeJob.dropoffLatitude || 0,
                      lng: activeJob.dropoffLongitude || 0,
                      address: activeJob.dropoffLocationAddress || `${activeJob.carrier} Drop-off`,
                    }}
                    courierLocation={geo.latitude && geo.longitude ? {
                      lat: geo.latitude,
                      lng: geo.longitude,
                      heading: geo.heading ?? undefined,
                    } : undefined}
                    status={activeJob.status}
                    etaMinutes={jobETA?.etaSeconds ? Math.ceil(jobETA.etaSeconds / 60) : undefined}
                    distanceMiles={jobETA?.distanceMeters ? jobETA.distanceMeters / 1609.34 : undefined}
                    className="h-64 md:h-80"
                  />
                  
                  {/* ETA Display Card */}
                  {jobETA?.etaSeconds && !jobETA.isStale && (
                    <Card className="bg-primary/10 border-primary/20">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                            <Navigation className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase">Estimated Arrival</p>
                            <p className="text-2xl font-black text-primary">
                              {Math.ceil(jobETA.etaSeconds / 60)} min
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Distance</p>
                          <p className="text-lg font-bold">
                            {((jobETA?.distanceMeters ?? 0) / 1609.34).toFixed(1)} mi
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  {/* Stale location warning */}
                  {jobETA?.isStale && (
                    <div className="flex items-center gap-2 text-xs text-yellow-500 font-medium">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Updating location...</span>
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-3">
                    <Button 
                      onClick={() => {
                        if (step === 'navigate-pickup') {
                          openNavigation(
                            activeJob.pickupAddress, 
                            activeJob.pickupLatitude, 
                            activeJob.pickupLongitude
                          )
                        } else {
                          openDropoffNavigation()
                        }
                      }}
                      variant="outline"
                      className={cn(
                        "w-full h-12 border-primary/20 text-primary font-bold rounded-xl",
                        (activeJob.isManualAddress && step === 'navigate-pickup') && "bg-yellow-500/10 border-yellow-500/30 text-yellow-600"
                      )}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      OPEN IN GOOGLE MAPS
                    </Button>

                    <Button 
                      onClick={handleNext} 
                      disabled={isUpdating}
                      className="w-full h-16 bg-primary hover:bg-primary/90 text-primary-foreground text-lg font-black rounded-2xl shadow-lg"
                    >
                      {isUpdating ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          SAVING...
                        </>
                      ) : step === 'navigate-pickup' ? (
                        <>
                          I'VE ARRIVED
                          <ChevronRight className="w-5 h-5 ml-2" />
                        </>
                      ) : (
                        <>
                          CONFIRM DROP-OFF
                          <ChevronRight className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {step === 'scan-label' && (
                <div className="w-full space-y-6">
                  {/* Scan Status Card */}
                  <Card className={cn(
                    "rounded-2xl overflow-hidden",
                    activeJob.pickupLabelScanVerified || labelScanValue
                      ? "bg-green-500/10 border-green-500/20"
                      : "bg-primary/10 border-primary/20"
                  )}>
                    <CardContent className="p-6 space-y-4">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center",
                          activeJob.pickupLabelScanVerified || labelScanValue
                            ? "bg-green-500/20"
                            : "bg-primary/20"
                        )}>
                          {activeJob.pickupLabelScanVerified || labelScanValue ? (
                            <CheckCircle className="w-7 h-7 text-green-500" />
                          ) : (
                            <Camera className="w-7 h-7 text-primary" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-black text-lg">
                            {activeJob.pickupLabelScanVerified || labelScanValue 
                              ? "Label Scanned ✓" 
                              : "Scan Package Label"}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {activeJob.pickupLabelScanVerified || labelScanValue
                              ? `Tracking: ***${(labelScanValue || activeJob.pickupLabelScanValue || '').slice(-6)}`
                              : "Point camera at the shipping label barcode"}
                          </p>
                        </div>
                      </div>
                      
                      {!(activeJob.pickupLabelScanVerified || labelScanValue) && (
                        <Button 
                          onClick={() => setIsLabelScannerOpen(true)}
                          className="w-full h-16 bg-primary hover:bg-primary/90 text-primary-foreground text-lg font-black rounded-2xl shadow-lg"
                        >
                          <Camera className="w-6 h-6 mr-3" />
                          SCAN LABEL
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  {/* Continue button - only if scan is done */}
                  {(activeJob.pickupLabelScanVerified || labelScanValue) && (
                    <Button 
                      onClick={() => setStep('photo-pickup')}
                      className="w-full h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-black rounded-2xl"
                    >
                      CONTINUE TO PHOTO
                      <ChevronRight className="w-5 h-5 ml-2" />
                    </Button>
                  )}
                  
                  {/* Scan status indicators */}
                  <div className="pt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                      {activeJob.pickupLabelScanVerified || labelScanValue ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className={activeJob.pickupLabelScanVerified || labelScanValue ? "text-green-500" : "text-muted-foreground"}>
                        Label Scan
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                      {activeJob.pickupProofId ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className={activeJob.pickupProofId ? "text-green-500" : "text-muted-foreground"}>
                        Pickup Photo
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {step === 'scan-dropoff' && (
                <div className="w-full space-y-4">
                  <Button 
                    onClick={() => handleScan('dropoff')}
                    disabled={isScanning}
                    className="w-full h-24 bg-primary hover:bg-primary/90 text-primary-foreground text-xl font-black rounded-3xl shadow-xl flex flex-col items-center justify-center gap-2"
                  >
                    {isScanning ? (
                      <>
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span>SCANNING...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-8 h-8" />
                        <span>SCAN BARCODE</span>
                      </>
                    )}
                  </Button>
                  <p className="text-center text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Position barcode within camera view
                  </p>

                  {/* Dropoff proof photo (optional) */}
                  <div className="pt-4 border-t border-muted-foreground/10">
                    <p className="text-center text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                      Optional: Add proof photo
                    </p>
                    {dropoffProofId ? (
                      <div className="space-y-2">
                        <div className="relative w-full h-32 rounded-2xl overflow-hidden bg-muted/30 border border-[#39FF14]/50">
                          <ProofImage storageId={dropoffProofId} />
                          <div className="absolute top-2 right-2 bg-[#39FF14] text-black px-2 py-0.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1">
                            <CheckCircle className="w-2.5 h-2.5" />
                            Saved
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="w-full font-bold rounded-xl border-muted-foreground/20"
                          onClick={() => openPhotoCapture('dropoff')}
                        >
                          <Camera className="w-3 h-3 mr-1" />
                          RETAKE
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        variant="outline" 
                        className="w-full h-12 font-bold rounded-xl border-muted-foreground/20 hover:border-[#39FF14]/50"
                        onClick={() => openPhotoCapture('dropoff')}
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        TAKE DROPOFF PHOTO
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {step === 'photo-pickup' && (
                <div className="flex flex-col items-center gap-6 w-full">
                  {/* Requirements Status */}
                  <div className="w-full space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-green-500">Label Scanned</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        ***{(activeJob.pickupLabelScanValue || labelScanValue || '').slice(-6)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                      {pickupProofId || activeJob.pickupProofId ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Circle className="w-4 h-4 text-primary animate-pulse" />
                      )}
                      <span className={pickupProofId || activeJob.pickupProofId ? "text-green-500" : "text-primary"}>
                        Pickup Photo {pickupProofId || activeJob.pickupProofId ? "" : "(Required)"}
                      </span>
                    </div>
                  </div>

                  {/* Photo preview or capture button */}
                  {pickupProofId || activeJob.pickupProofId ? (
                    <div className="w-full space-y-3">
                      <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-muted/30 border-2 border-[#39FF14]/50">
                        <ProofImage storageId={pickupProofId || activeJob.pickupProofId!} />
                        <div className="absolute top-3 right-3 bg-[#39FF14] text-black px-3 py-1 rounded-full text-xs font-black uppercase flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Captured
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        className="w-full font-bold h-10 rounded-xl border-muted-foreground/20"
                        onClick={() => openPhotoCapture('pickup')}
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        RETAKE PHOTO
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => openPhotoCapture('pickup')}
                      className="w-full aspect-video rounded-3xl bg-muted/30 border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center gap-3 group hover:border-[#39FF14] transition-colors cursor-pointer"
                    >
                      <Camera className="w-12 h-12 text-muted-foreground group-hover:text-[#39FF14]" />
                      <span className="text-sm font-bold text-muted-foreground group-hover:text-[#39FF14] uppercase tracking-widest">
                        Take Pickup Photo
                      </span>
                    </button>
                  )}
                  
                  <div className="flex gap-3 w-full">
                    <Button 
                      variant="outline" 
                      className="flex-1 font-bold h-12 rounded-xl" 
                      onClick={handleNext}
                      disabled={isUpdating}
                    >
                      {pickupProofId || activeJob.pickupProofId ? 'SKIP PHOTO' : 'SKIP'}
                    </Button>
                    <Button 
                      className="flex-[2] bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 rounded-xl" 
                      onClick={handleNext}
                      disabled={isUpdating}
                    >
                      {isUpdating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          SAVING...
                        </>
                      ) : (
                        "CONTINUE"
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {step === 'completed' && (
                <div className="flex flex-col items-center text-center gap-6 animate-in zoom-in duration-500">
                  <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-12 h-12 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black">JOB COMPLETE</h3>
                    <p className="text-primary font-bold text-xl">+${(activeJob.courierPayout || 0).toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Customer Info Card */}
          {step !== 'completed' && (
            <Card className="bg-muted/30 border-muted-foreground/10 rounded-3xl">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Package className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Customer</p>
                    <p className="text-lg font-black leading-tight">{customerProfile?.name || 'Customer'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="icon" 
                    variant="outline" 
                    className="rounded-xl border-muted-foreground/10 h-12 w-12"
                    onClick={handleCall}
                    disabled={!customerProfile?.phone}
                  >
                    <Phone className="w-5 h-5 text-primary" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="outline" 
                    className="rounded-xl border-muted-foreground/10 h-12 w-12"
                    onClick={handleMessage}
                    disabled={!customerProfile?.phone}
                  >
                    <MessageSquare className="w-5 h-5 text-primary" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeJob && (
            <JobChat 
              jobId={activeJob._id}
              viewerRole="courier"
              otherPartyName={customerProfile?.name || 'Customer'}
            />
          )}
        </div>

        {/* Footer Actions */}
        {step !== 'completed' && (
          <div className="p-6 pt-0">
            <Button variant="ghost" className="w-full text-destructive font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> REPORT AN ISSUE
            </Button>
          </div>
        )}

        <LabelScanner
          isOpen={isLabelScannerOpen}
          onClose={() => setIsLabelScannerOpen(false)}
          onScan={handleLabelScan}
          title="Scan Package Label"
        />

        <BarcodeScanner
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScan={handleScanResult}
          title="Scan Drop-off Barcode"
        />

        <PhotoCapture
          isOpen={isPhotoCaptureOpen}
          onClose={() => setIsPhotoCaptureOpen(false)}
          onCapture={handlePhotoCapture}
          title={photoType === 'pickup' ? 'Pickup Proof' : 'Dropoff Proof'}
          description={photoType === 'pickup' ? 'Take a photo of the packages at pickup' : 'Take a photo of the packages at dropoff'}
        />
      </div>
    </AppShell>
  )
}

// Helper component to display proof images
function ProofImage({ storageId }: { storageId: Id<"_storage"> }) {
  const url = useQuery(api.storage.getFileUrl, { storageId })
  
  if (!url) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/50">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return <img src={url} className="w-full h-full object-cover" alt="Proof photo" />
}
