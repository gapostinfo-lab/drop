import { useQuery } from 'convex/react'
import { api } from '@convex/api'
import { Id } from '@convex/dataModel'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Package, 
  MapPin, 
  Clock, 
  User, 
  Truck, 
  CheckCircle,
  AlertTriangle,
  Scan,
  Image
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface JobDetailDialogProps {
  jobId: string | null
  isOpen: boolean
  onClose: () => void
}

export function JobDetailDialog({ jobId, isOpen, onClose }: JobDetailDialogProps) {
  const job = useQuery(
    api.jobs.getJobById, 
    jobId ? { jobId: jobId as Id<"jobs"> } : "skip"
  )
  
  const customerProfile = useQuery(
    api.profiles.getProfileByUserId,
    job?.customerId ? { userId: job.customerId } : "skip"
  )
  
  const courierProfile = useQuery(
    api.profiles.getProfileByUserId,
    job?.courierId ? { userId: job.courierId } : "skip"
  )

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Job Details
            {jobId && (
              <span className="text-sm font-normal text-muted-foreground">
                #{jobId.slice(0, 8)}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {job === undefined ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : job === null ? (
          <div className="py-8 text-center text-muted-foreground">
            Job not found
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status & Basic Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase">Status</p>
                <Badge className={cn(
                  "capitalize",
                  job.status === 'completed' && "bg-green-500",
                  job.status === 'cancelled' && "bg-destructive",
                  ['matched', 'en_route', 'arrived', 'picked_up', 'dropped_off'].includes(job.status) && "bg-blue-500"
                )}>
                  {job.status.replace('_', ' ')}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase">Payment</p>
                <Badge variant={job.paymentStatus === 'paid' ? 'default' : 'secondary'}>
                  {job.paymentStatus}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase">Total</p>
                <p className="font-bold">${job.totalPrice.toFixed(2)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase">Created</p>
                <p className="text-sm">{new Date(job.createdAt).toLocaleString()}</p>
              </div>
            </div>

            {/* Customer & Courier */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-bold uppercase text-muted-foreground">Customer</span>
                </div>
                <p className="font-medium">{customerProfile?.name || 'Unknown'}</p>
                <p className="text-sm text-muted-foreground">{customerProfile?.email}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-bold uppercase text-muted-foreground">Courier</span>
                </div>
                {job.courierId ? (
                  <>
                    <p className="font-medium">{courierProfile?.name || 'Assigned'}</p>
                    <p className="text-sm text-muted-foreground">{courierProfile?.email}</p>
                  </>
                ) : (
                  <p className="text-muted-foreground">Not assigned</p>
                )}
              </div>
            </div>

            {/* Addresses */}
            <div className="p-4 rounded-lg bg-muted/50 border space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase text-muted-foreground">Pickup</span>
              </div>
              <p className="text-sm">{job.pickupAddress}</p>
              {job.dropoffLocationName && (
                <>
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <MapPin className="h-4 w-4 text-green-500" />
                    <span className="text-xs font-bold uppercase text-muted-foreground">Drop-off</span>
                  </div>
                  <p className="text-sm">{job.dropoffLocationName}</p>
                  <p className="text-xs text-muted-foreground">{job.dropoffLocationAddress}</p>
                </>
              )}
            </div>

            {/* Verification Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                <Scan className="h-4 w-4" />
                Verification Data
              </h3>

              {/* Label Scan */}
              {job.pickupLabelScanVerified && (
                <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-blue-500">
                      <Package className="h-5 w-5" />
                      <span className="font-bold">Label Scan Verified</span>
                    </div>
                    {job.pickupLabelScanType && (
                      <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                        {job.pickupLabelScanType.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Scan Value (masked)</p>
                      <p className="font-mono">{job.pickupLabelScanValueMasked || '***verified'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Timestamp</p>
                      <p>{job.pickupLabelScanTimestamp 
                        ? new Date(job.pickupLabelScanTimestamp).toLocaleString()
                        : 'N/A'}</p>
                    </div>
                  </div>
                  {job.expectedTrackingNumber && (
                    <div className="mt-3 pt-3 border-t border-blue-500/20">
                      <div className="flex items-center gap-2">
                        {job.scanMatchesExpected ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                        <span className="text-xs">
                          {job.scanMatchesExpected 
                            ? 'Matches expected tracking number' 
                            : 'Does NOT match expected tracking number'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Barcode Scans */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {job.pickupScan && (
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-2 text-green-500 mb-2">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-bold">Pickup Scan</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(job.pickupScan.timestamp).toLocaleString()}
                    </p>
                    <p className="text-xs font-mono mt-1 truncate">
                      {job.pickupScan.barcodeData}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      GPS: {job.pickupScan.latitude.toFixed(6)}, {job.pickupScan.longitude.toFixed(6)}
                    </p>
                  </div>
                )}
                {job.dropoffScan && (
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-2 text-green-500 mb-2">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-bold">Drop-off Scan</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(job.dropoffScan.timestamp).toLocaleString()}
                    </p>
                    <p className="text-xs font-mono mt-1 truncate">
                      {job.dropoffScan.barcodeData}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      GPS: {job.dropoffScan.latitude.toFixed(6)}, {job.dropoffScan.longitude.toFixed(6)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Proof Photos */}
            {(job.pickupProofUrl || job.dropoffProofUrl) && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Proof Photos
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {job.pickupProofUrl && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary uppercase">Pickup Proof</span>
                        {job.pickupProofTimestamp && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(job.pickupProofTimestamp).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
                        <img 
                          src={job.pickupProofUrl} 
                          alt="Pickup proof" 
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(job.pickupProofUrl!, '_blank')}
                        />
                        <div className="absolute top-2 left-2 bg-green-500/90 text-white px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Verified
                        </div>
                      </div>
                      {job.pickupProofLocation && (
                        <p className="text-[10px] text-muted-foreground">
                          GPS: {job.pickupProofLocation.latitude.toFixed(6)}, {job.pickupProofLocation.longitude.toFixed(6)}
                        </p>
                      )}
                    </div>
                  )}
                  {job.dropoffProofUrl && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-green-500 uppercase">Drop-off Proof</span>
                        {job.dropoffProofTimestamp && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(job.dropoffProofTimestamp).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
                        <img 
                          src={job.dropoffProofUrl} 
                          alt="Drop-off proof" 
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(job.dropoffProofUrl!, '_blank')}
                        />
                        <div className="absolute top-2 left-2 bg-green-500/90 text-white px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Verified
                        </div>
                      </div>
                      {job.dropoffProofLocation && (
                        <p className="text-[10px] text-muted-foreground">
                          GPS: {job.dropoffProofLocation.latitude.toFixed(6)}, {job.dropoffProofLocation.longitude.toFixed(6)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Timeline
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{new Date(job.createdAt).toLocaleString()}</span>
                </div>
                {job.paidAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paid</span>
                    <span>{new Date(job.paidAt).toLocaleString()}</span>
                  </div>
                )}
                {job.matchedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Matched</span>
                    <span>{new Date(job.matchedAt).toLocaleString()}</span>
                  </div>
                )}
                {job.arrivedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Arrived at Pickup</span>
                    <span>{new Date(job.arrivedAt).toLocaleString()}</span>
                  </div>
                )}
                {job.pickedUpAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Picked Up</span>
                    <span>{new Date(job.pickedUpAt).toLocaleString()}</span>
                  </div>
                )}
                {job.droppedOffAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Dropped Off</span>
                    <span>{new Date(job.droppedOffAt).toLocaleString()}</span>
                  </div>
                )}
                {job.completedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Completed</span>
                    <span>{new Date(job.completedAt).toLocaleString()}</span>
                  </div>
                )}
                {job.cancelledAt && (
                  <div className="flex justify-between text-destructive">
                    <span>Cancelled</span>
                    <span>{new Date(job.cancelledAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
