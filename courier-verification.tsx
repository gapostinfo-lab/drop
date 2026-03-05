import { useState } from 'react'
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/api"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Car, 
  Calendar,
  MapPin,
  Phone,
  Mail,
  Loader2,
  AlertTriangle,
  Eye,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { Id } from "@convex/dataModel"

export default function CourierVerificationPage() {
  const [selectedId, setSelectedId] = useState<Id<"courierApplications"> | null>(null)
  const [denyDialogOpen, setDenyDialogOpen] = useState(false)
  const [denyReason, setDenyReason] = useState('')
  const [isApproving, setIsApproving] = useState(false)
  const [isDenying, setIsDenying] = useState(false)

  const pendingVerifications = useQuery(api.couriers.listPendingVerifications)
  const approveVerification = useMutation(api.couriers.approveVerification)
  const denyVerification = useMutation(api.couriers.denyVerification)

  const selectedCourier = pendingVerifications?.find(c => c._id === selectedId)

  const handleApprove = async () => {
    if (!selectedId) return
    setIsApproving(true)
    try {
      await approveVerification({ applicationId: selectedId })
      toast.success("Courier approved successfully!")
      setSelectedId(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve courier")
    } finally {
      setIsApproving(false)
    }
  }

  const handleDeny = async () => {
    if (!selectedId || !denyReason.trim()) {
      toast.error("Please provide a reason for denial")
      return
    }
    setIsDenying(true)
    try {
      await denyVerification({ applicationId: selectedId, reason: denyReason })
      toast.success("Courier denied")
      setSelectedId(null)
      setDenyDialogOpen(false)
      setDenyReason('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to deny courier")
    } finally {
      setIsDenying(false)
    }
  }

  if (pendingVerifications === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Courier Verification</h1>
        <p className="text-muted-foreground">Review and approve courier applications</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-yellow-500/10">
                <Clock className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingVerifications.length}</p>
                <p className="text-sm text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Add more stats as needed */}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Pending Verifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingVerifications.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                <p className="font-medium">All caught up!</p>
                <p className="text-sm">No pending verifications</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingVerifications.map((courier) => (
                  <div
                    key={courier._id}
                    onClick={() => setSelectedId(courier._id)}
                    className={cn(
                      "p-4 rounded-lg border-2 cursor-pointer transition-all",
                      selectedId === courier._id
                        ? "border-primary bg-primary/5"
                        : "border-transparent bg-muted/50 hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      {courier.selfieUrl ? (
                        <img 
                          src={courier.selfieUrl} 
                          alt={courier.fullName}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <User className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{courier.fullName}</p>
                        <p className="text-sm text-muted-foreground">{courier.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Submitted {courier.submittedAt ? formatDistanceToNow(courier.submittedAt, { addSuffix: true }) : 'recently'}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail View */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Verification Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedCourier ? (
              <div className="text-center py-12 text-muted-foreground">
                <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a courier to review</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Selfie */}
                <div className="text-center">
                  {selectedCourier.selfieUrl ? (
                    <img 
                      src={selectedCourier.selfieUrl} 
                      alt="Selfie"
                      className="w-32 h-32 rounded-full object-cover mx-auto border-4 border-primary/20"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-muted flex items-center justify-center mx-auto">
                      <User className="w-16 h-16 text-muted-foreground" />
                    </div>
                  )}
                  <h3 className="text-xl font-bold mt-4">{selectedCourier.fullName}</h3>
                </div>

                {/* License Photos */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-bold mb-2">License Front</p>
                    {selectedCourier.licenseFrontUrl ? (
                      <img 
                        src={selectedCourier.licenseFrontUrl} 
                        alt="License Front"
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                    ) : (
                      <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-yellow-500" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold mb-2">License Back</p>
                    {selectedCourier.licenseBackUrl ? (
                      <img 
                        src={selectedCourier.licenseBackUrl} 
                        alt="License Back"
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                    ) : (
                      <div className="w-full h-32 bg-muted rounded-lg flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-yellow-500" />
                      </div>
                    )}
                  </div>
                </div>

                {/* License Details */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-xs text-muted-foreground">License #</p>
                    <p className="font-mono font-bold">{selectedCourier.licenseNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">State</p>
                    <p className="font-bold">{selectedCourier.licenseState || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Expires</p>
                    <p className="font-bold">{selectedCourier.licenseExpiresAt || 'N/A'}</p>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    {selectedCourier.email}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    {selectedCourier.phone}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    DOB: {selectedCourier.dateOfBirth || 'N/A'}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    {selectedCourier.homeAddress || 'N/A'}
                  </div>
                </div>

                {/* Vehicle Info */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Car className="w-4 h-4" />
                    <span className="font-bold">Vehicle</span>
                  </div>
                  <p className="text-sm">
                    {selectedCourier.vehicleYear} {selectedCourier.vehicleMake} {selectedCourier.vehicleModel} ({selectedCourier.vehicleColor})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Plate: {selectedCourier.vehiclePlate}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button 
                    onClick={handleApprove}
                    disabled={isApproving}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {isApproving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Approve
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => setDenyDialogOpen(true)}
                    className="flex-1"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Deny
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deny Dialog */}
      <Dialog open={denyDialogOpen} onOpenChange={setDenyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny Verification</DialogTitle>
            <DialogDescription>
              Please provide a reason for denying this courier's verification.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for denial..."
            value={denyReason}
            onChange={(e) => setDenyReason(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenyDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeny}
              disabled={isDenying || !denyReason.trim()}
            >
              {isDenying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Deny Courier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
