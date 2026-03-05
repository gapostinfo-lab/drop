import { useParams, Link } from 'react-router'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OrderTimeline, type OrderStep } from '@/components/tracking/order-timeline'
import { RatingStars } from '@/components/shared/rating-stars'
import { 
  ChevronLeft, 
  Download, 
  AlertTriangle, 
  MapPin, 
  Clock, 
  Truck, 
  Package, 
  Camera,
  CheckCircle2,
  Loader2
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/api"
import { Id } from "@convex/dataModel"
import { AppShell } from '@/components/layout/app-shell'

export default function OrderDetailPage() {
  const { orderId } = useParams()
  const job = useQuery(api.jobs.getJobById, orderId ? { jobId: orderId as Id<"jobs"> } : "skip")
  const courierProfile = useQuery(api.profiles.getProfileByUserId, job?.courierId ? { userId: job.courierId } : "skip")
  const rateJob = useMutation(api.jobs.rateJob)
  
  const [isRating, setIsRating] = useState(false)

  const handleRate = async (newRating: number) => {
    if (!orderId) return
    
    setIsRating(true)
    try {
      await rateJob({ 
        jobId: orderId as Id<"jobs">, 
        rating: newRating 
      })
      toast.success("Thank you for your rating!")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit rating")
    } finally {
      setIsRating(false)
    }
  }

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
          <h2 className="text-2xl font-bold mb-4">Order not found</h2>
          <Link to="/customer/history">
            <Button>Back to History</Button>
          </Link>
        </div>
      </AppShell>
    )
  }

  const getCompletedSteps = (status: string): OrderStep[] => {
    const steps: OrderStep[] = ['requested']
    if (['matched', 'en_route', 'arrived', 'picked_up', 'dropped_off', 'completed'].includes(status)) steps.push('matched')
    if (['en_route', 'arrived', 'picked_up', 'dropped_off', 'completed'].includes(status)) steps.push('en_route')
    if (['arrived', 'picked_up', 'dropped_off', 'completed'].includes(status)) steps.push('arrived')
    if (['picked_up', 'dropped_off', 'completed'].includes(status)) steps.push('picked_up')
    if (['dropped_off', 'completed'].includes(status)) steps.push('dropped_off')
    if (status === 'completed') steps.push('completed')
    return steps
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/customer/history">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ChevronLeft className="w-6 h-6" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold font-outfit">Order ORD-{job._id.slice(-4).toUpperCase()}</h1>
              <p className="text-sm text-muted-foreground">
                {job.completedAt 
                  ? `Completed on ${new Date(job.completedAt).toLocaleDateString()} • ${new Date(job.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : `Created on ${new Date(job.createdAt).toLocaleDateString()}`
                }
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-slate-800 bg-slate-900 rounded-xl">
              <Download className="w-4 h-4 mr-2" />
              Receipt
            </Button>
            <Button variant="destructive" className="bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20 rounded-xl">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Dispute
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Summary & Photos */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6 bg-slate-900 border-slate-800 space-y-6">
              <h2 className="text-xl font-bold font-outfit">Pickup Summary</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SummaryItem 
                  icon={MapPin} 
                  label="Pickup Address" 
                  value={job.pickupAddress} 
                />
                <SummaryItem 
                  icon={Truck} 
                  label="Carrier Drop-off" 
                  value={job.carrier} 
                />
                <SummaryItem 
                  icon={Package} 
                  label="Packages" 
                  value={`${job.packageCount} ${job.packageSize} ${job.packageCount === 1 ? 'Package' : 'Packages'}`} 
                />
                <SummaryItem 
                  icon={Clock} 
                  label="Courier" 
                  value={courierProfile?.name || 'Assigned Courier'} 
                />
              </div>

              <div className="pt-6 border-t border-slate-800">
                <p className="text-sm font-semibold mb-4">Proof of Pickup & Delivery</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="aspect-square rounded-2xl bg-slate-800 flex flex-col items-center justify-center gap-2 border border-slate-700 group cursor-pointer hover:border-primary/50 transition-colors">
                    <Camera className="w-8 h-8 text-slate-500 group-hover:text-primary transition-colors" />
                    <span className="text-xs text-muted-foreground font-medium">Pickup Photo</span>
                  </div>
                  <div className="aspect-square rounded-2xl bg-slate-800 flex flex-col items-center justify-center gap-2 border border-slate-700 group cursor-pointer hover:border-primary/50 transition-colors">
                    <CheckCircle2 className="w-8 h-8 text-slate-500 group-hover:text-primary transition-colors" />
                    <span className="text-xs text-muted-foreground font-medium">Drop-off Receipt</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-slate-900 border-slate-800 space-y-4">
              <h2 className="text-xl font-bold font-outfit">Payment</h2>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Base Fee</span>
                  <span className="font-medium">${job.baseFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Additional Packages ({job.packageCount - 1})</span>
                  <span className="font-medium">${job.additionalFee.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span className="text-primary">${job.totalPrice.toFixed(2)}</span>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Payment Status: {job.paymentStatus}</span>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 capitalize">
                  {job.paymentStatus}
                </Badge>
              </div>
            </Card>

            {/* Review Section */}
            {job.status === 'completed' && (
              <Card className="p-8 bg-primary/5 border-primary/20 text-center space-y-4">
                <h3 className="text-xl font-bold font-outfit">How was your experience?</h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  Your feedback helps us maintain high quality couriers and improve our service.
                </p>
                <div className="flex justify-center py-2">
                  <RatingStars 
                    rating={job.rating || 0} 
                    size={40} 
                    onChange={job.rating !== undefined || isRating ? undefined : handleRate} 
                    className="gap-2"
                  />
                </div>
                {(job.rating !== undefined || isRating) && (
                  <p className="text-primary font-bold animate-in fade-in slide-in-from-bottom-2">
                    {isRating ? "Submitting..." : `Thanks for the ${job.rating} stars!`}
                  </p>
                )}
              </Card>
            )}
          </div>

          {/* Right: Timeline */}
          <div className="lg:col-span-1">
            <Card className="p-6 bg-slate-900 border-slate-800 h-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold font-outfit">Timeline</h3>
                <Badge variant="outline" className="text-[10px] uppercase font-bold">
                  {job.status === 'completed' ? 'Archived' : 'Live'}
                </Badge>
              </div>
              <OrderTimeline 
                currentStep={job.status as OrderStep} 
                completedSteps={getCompletedSteps(job.status)} 
              />
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function SummaryItem({ icon: Icon, label, value }: any) {
  return (
    <div className="flex gap-4">
      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="space-y-0.5">
        <p className="text-xs text-muted-foreground uppercase font-medium">{label}</p>
        <p className="font-bold text-slate-100">{value}</p>
      </div>
    </div>
  )
}
