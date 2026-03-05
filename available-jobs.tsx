import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Filter, Map, List, Search, Loader2, ShieldX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { JobCard } from '@/components/courier/job-card'
import { toast } from 'sonner'
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/api"
import { AppShell } from '@/components/layout/app-shell'

export default function AvailableJobsPage() {
  const navigate = useNavigate()
  const [view, setView] = useState<'list' | 'map'>('list')
  const [search, setSearch] = useState('')
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null)

  const application = useQuery(api.couriers.getMyApplication)
  const verificationStatus = useQuery(api.couriers.getMyVerificationStatus)
  const availableJobs = useQuery(api.jobs.getAvailableJobs)
  const acceptJobMutation = useMutation(api.jobs.acceptJob)

  // Redirect non-submitted couriers to onboarding
  useEffect(() => {
    if (verificationStatus !== undefined && verificationStatus?.status === 'not_submitted') {
      navigate('/courier/onboarding')
    }
  }, [verificationStatus, navigate])

  const handleAcceptJob = async (job: any) => {
    if (acceptingJobId) return // Prevent double-tap
    
    setAcceptingJobId(job._id)
    try {
      await acceptJobMutation({ jobId: job._id })
      toast.success("Job accepted! Head to the pickup location.")
      navigate('/courier/active-job')
    } catch (error: any) {
      // Extract error code from ConvexError
      // ConvexError stores the message in error.data for string errors
      const errorCode = error?.data || error?.message || "UNKNOWN_ERROR"
      
      // Map error codes to user-friendly messages
      let userMessage: string
      let shouldRefresh = false
      
      switch (errorCode) {
        case "AUTH_REQUIRED":
          userMessage = "Session expired. Please sign in again."
          break
        case "COURIER_NOT_FOUND":
          userMessage = "Courier profile not found. Please re-login or contact support."
          break
        case "COURIER_NOT_APPROVED":
          userMessage = "Your verification is pending. You can't accept jobs yet."
          break
        case "COURIER_OFFLINE":
          userMessage = "You must go Online to accept jobs."
          break
        case "PAYOUT_REQUIRED":
          userMessage = "Please complete payout setup in your Profile before accepting jobs."
          break
        case "JOB_NOT_FOUND":
          userMessage = "This job no longer exists. Refreshing..."
          shouldRefresh = true
          break
        case "JOB_NOT_AVAILABLE":
          userMessage = "This job is no longer available. Refreshing..."
          shouldRefresh = true
          break
        case "JOB_ALREADY_TAKEN":
          userMessage = "Another courier accepted this job. Refreshing..."
          shouldRefresh = true
          break
        default:
          // For any other error, show the raw message
          userMessage = typeof errorCode === 'string' ? errorCode : "Failed to accept job. Please try again."
      }
      
      toast.error(userMessage)
      
      // For job-related errors, the useQuery will auto-refresh the list
      // but we can add a small delay to ensure the UI updates
      if (shouldRefresh) {
        // The Convex useQuery subscription will automatically update
        // when the job status changes, so no manual refresh needed
      }
    } finally {
      setAcceptingJobId(null)
    }
  }

  if (application === undefined || availableJobs === undefined || verificationStatus === undefined) {
    return (
      <AppShell>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppShell>
    )
  }

  // If not approved, show a message instead of the job list
  if (verificationStatus && verificationStatus.status !== "approved") {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
          <ShieldX className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold mb-2">Verification Required</h2>
          <p className="text-muted-foreground max-w-md">
            {verificationStatus.status === "pending" 
              ? "Your verification is being reviewed. You'll be able to accept jobs once approved."
              : "Complete your verification to start accepting jobs."}
          </p>
          {verificationStatus.status !== "pending" && (
            <Button className="mt-4" onClick={() => navigate('/courier/onboarding')}>
              Complete Verification
            </Button>
          )}
        </div>
      </AppShell>
    )
  }

  const mappedJobs = availableJobs.map(job => ({
    id: job._id,
    _id: job._id,
    pickupAddress: job.pickupAddress,
    dropoffAddress: "Destination TBD",
    distance: "2.4 miles",
    packageCount: job.packageCount,
    carrierType: job.carrier as any,
    payout: job.courierPayout,
    status: 'Available' as const,
    customerName: "Customer"
  }))

  const filteredJobs = mappedJobs.filter(job => 
    job.pickupAddress.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <AppShell>
      <div className="min-h-screen bg-background pb-20">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md p-4 border-b border-muted-foreground/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/courier/dashboard')}>
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <h1 className="text-xl font-black tracking-tight">AVAILABLE JOBS</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className={view === 'map' ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground/20"}
              onClick={() => setView(view === 'list' ? 'map' : 'list')}
            >
              {view === 'list' ? <Map className="w-4 h-4 mr-2" /> : <List className="w-4 h-4 mr-2" />}
              {view === 'list' ? 'MAP' : 'LIST'}
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Search & Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search pickups..." 
                className="pl-10 bg-muted/30 border-muted-foreground/10 rounded-xl" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" className="rounded-xl border-muted-foreground/10">
              <Filter className="w-4 h-4" />
            </Button>
          </div>

          {view === 'list' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  {filteredJobs.length} JOBS NEARBY
                </span>
                <span className="text-xs font-bold text-primary uppercase tracking-widest">
                  SORT BY: DISTANCE
                </span>
              </div>
              
              {filteredJobs.map((job) => (
                <JobCard 
                  key={job.id} 
                  job={job as any} 
                  variant="available" 
                  onAccept={() => handleAcceptJob(job)}
                  isLoading={acceptingJobId === job._id}
                />
              ))}

              {filteredJobs.length === 0 && (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto">
                    <Search className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                  <p className="text-muted-foreground font-medium">No jobs found matching your search.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="h-[60vh] bg-muted/30 rounded-3xl border-2 border-dashed border-muted-foreground/20 flex flex-col items-center justify-center gap-4 text-center p-8">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                <Map className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black">INTERACTIVE MAP</h3>
                <p className="text-sm text-muted-foreground">
                  Map view is currently being optimized for your area. Please use the list view to accept jobs.
                </p>
              </div>
              <Button 
                variant="outline" 
                className="border-primary text-primary font-bold"
                onClick={() => setView('list')}
              >
                SWITCH TO LIST
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
