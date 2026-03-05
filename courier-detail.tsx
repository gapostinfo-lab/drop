import { AdminAppShell } from '@/components/layout/admin-app-shell'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  ArrowLeft, 
  Phone, 
  Truck, 
  Calendar, 
  ShieldCheck, 
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MapPin,
  User,
  Info,
  Clock,
  ExternalLink,
  ShieldAlert,
  Ban,
  ClipboardCheck,
  CreditCard,
  Copy,
  Check,
  DollarSign,
  Mail,
  Building2
} from "lucide-react"
import { useNavigate, useParams } from "react-router"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/api"
import { Id } from "@convex/dataModel"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useAdmin } from '@/contexts/admin-context'

export default function AdminCourierDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdminLoggedIn } = useAdmin()
  const [internalNote, setInternalNote] = useState('')
  const [actionReason, setActionReason] = useState('')
  const [actionType, setActionType] = useState<'deny' | 'suspend' | null>(null)
  
  // Verification statuses state
  const [bgStatus, setBgStatus] = useState<string>('not_started')
  const [licenseStatus, setLicenseStatus] = useState<string>('not_started')
  const [licenseVerified, setLicenseVerified] = useState(false)
  const [insuranceVerified, setInsuranceVerified] = useState(false)
  const [manualScreeningComplete, setManualScreeningComplete] = useState(false)
  const [copied, setCopied] = useState(false)

  const application = useQuery(api.couriers.getApplicationById, 
    isAdminLoggedIn && id ? { applicationId: id as Id<"courierApplications"> } : "skip"
  )
  
  const profilePhotoUrl = useQuery(api.storage.getFileUrl, 
    isAdminLoggedIn && application?.profilePhotoId ? { storageId: application.profilePhotoId } : "skip"
  )

  const copyToClipboard = (text: string, label: string = "Payment info") => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success(`${label} copied!`)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    if (application) {
      setBgStatus(application.backgroundCheckStatus || 'not_started')
      setLicenseStatus(application.licenseCheckStatus || 'not_started')
      setInternalNote(application.adminNotes || '')
      setLicenseVerified(application.licenseVerified || false)
      setInsuranceVerified(application.insuranceVerified || false)
      setManualScreeningComplete(application.manualScreeningComplete || false)
    }
  }, [application])

  const updateVerificationStatus = useMutation(api.couriers.updateVerificationStatus)
  const updateApplicationStatus = useMutation(api.couriers.updateApplicationStatus)

  const handleUpdateVerification = async () => {
    if (!id) return
    try {
      await updateVerificationStatus({
        applicationId: id as Id<"courierApplications">,
        backgroundCheckStatus: bgStatus as any,
        licenseCheckStatus: licenseStatus as any,
        adminNotes: internalNote,
        licenseVerified,
        insuranceVerified,
        manualScreeningComplete,
      })
      toast.success("Verification status updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update verification")
    }
  }

  const handleStatusChange = async (status: "approved" | "denied" | "suspended") => {
    if (!id) return
    
    if ((status === 'denied' || status === 'suspended') && !actionReason) {
      toast.error(`Please provide a reason for ${status === 'denied' ? 'denial' : 'suspension'}`)
      return
    }

    try {
      await updateApplicationStatus({ 
        applicationId: id as Id<"courierApplications">, 
        status,
        internalReason: (status === 'denied' || status === 'suspended') ? actionReason : undefined
      })
      toast.success(`Courier application ${status}`)
      setActionType(null)
      setActionReason('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${status} application`)
    }
  }

  const handleRevoke = async () => {
    if (!id) return
    try {
      await updateApplicationStatus({
        applicationId: id as Id<"courierApplications">,
        status: "pending_review"
      })
      toast.success("Approval revoked, status set back to pending review")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke approval")
    }
  }

  if (application === undefined) {
    return (
      <AdminAppShell>
        <div className="space-y-8">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Skeleton className="h-[600px]" />
            <Skeleton className="lg:col-span-2 h-[600px]" />
          </div>
        </div>
      </AdminAppShell>
    )
  }

  if (!application) {
    return (
      <AdminAppShell>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold">Application not found</h2>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/couriers')}>
            Back to Couriers
          </Button>
        </div>
      </AdminAppShell>
    )
  }

  const statusColors = {
    draft: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    pending_review: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    approved: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    denied: "bg-destructive/10 text-destructive border-destructive/20",
    suspended: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  }

  return (
    <AdminAppShell>
      <div className="space-y-8 pb-20">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/admin/couriers')} className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Avatar className="h-16 w-16 border-2 border-primary/10">
                <AvatarImage src={profilePhotoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${application.fullName}`} />
                <AvatarFallback>{application.fullName[0]}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">{application.fullName}</h1>
                  <Badge variant="outline" className={cn("uppercase font-bold text-[10px]", statusColors[application.status])}>
                    {application.status.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{application.email}</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {application.status === 'pending_review' && (
                <>
                  <Button variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/5" onClick={() => setActionType('deny')}>
                    <XCircle className="mr-2 h-4 w-4" /> Deny
                  </Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleStatusChange('approved')}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                  </Button>
                </>
              )}
              {application.status === 'approved' && (
                <>
                  <Button variant="outline" className="text-orange-500 border-orange-500/20 hover:bg-orange-500/5" onClick={() => setActionType('suspend')}>
                    <Ban className="mr-2 h-4 w-4" /> Suspend
                  </Button>
                  <Button variant="outline" onClick={handleRevoke}>
                    Revoke Approval
                  </Button>
                </>
              )}
              {application.status === 'suspended' && (
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleStatusChange('approved')}>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Reactivate
                </Button>
              )}
              {application.status === 'denied' && (
                <Button variant="outline" onClick={handleRevoke}>
                  Reconsider Application
                </Button>
              )}
            </div>
          </div>

          {actionType && (
            <Card className="border-destructive/20 bg-destructive/5 animate-in fade-in slide-in-from-top-4">
              <CardHeader>
                <CardTitle className="text-destructive flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5" /> 
                  {actionType === 'deny' ? 'Denial Reason' : 'Suspension Reason'}
                </CardTitle>
                <CardDescription>Provide a clear reason for the applicant. This will be visible to them.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea 
                  placeholder={`e.g. ${actionType === 'deny' ? "Driver's license is expired or blurry..." : "Multiple reports of late deliveries..."}`} 
                  className="bg-card border-destructive/20 min-h-[100px]"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                />
                <div className="flex gap-3 justify-end">
                  <Button variant="ghost" onClick={() => { setActionType(null); setActionReason(''); }}>Cancel</Button>
                  <Button variant="destructive" onClick={() => handleStatusChange(actionType === 'deny' ? 'denied' : 'suspended')}>
                    Confirm {actionType === 'deny' ? 'Denial' : 'Suspension'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Personal Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" /> Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Full Name</p>
                      <p className="text-sm font-semibold">{application.fullName}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Email Address</p>
                      <p className="text-sm font-semibold flex items-center gap-2">
                        {application.email}
                        <a href={`mailto:${application.email}`} className="text-primary hover:underline"><ExternalLink className="h-3 w-3" /></a>
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Phone Number</p>
                      <p className="text-sm font-semibold flex items-center gap-2">
                        {application.phone}
                        <a href={`tel:${application.phone}`} className="text-primary hover:underline"><Phone className="h-3 w-3" /></a>
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Date of Birth</p>
                      <p className="text-sm font-semibold">{application.dateOfBirth || 'Not provided'}</p>
                    </div>
                      <div className="space-y-1 md:col-span-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase">Home Address</p>
                        <p className="text-sm font-semibold flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {application.homeAddress || 'Not provided'}
                        </p>
                      </div>

                    </div>
                </CardContent>
              </Card>

              {/* Documents */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" /> Documents
                  </CardTitle>
                  <CardDescription>Click on a document to view full size</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <DocumentViewer 
                      label="Profile Photo" 
                      storageId={application.profilePhotoId} 
                    />
                    <DocumentViewer 
                      label="Driver's License (Front)" 
                      storageId={application.licenseFrontId} 
                    />
                    <DocumentViewer 
                      label="Driver's License (Back)" 
                      storageId={application.licenseBackId} 
                    />
                    <DocumentViewer 
                      label="Proof of Insurance" 
                      storageId={application.insuranceId} 
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Vehicle Information */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" /> Vehicle Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Make</p>
                      <p className="text-sm font-semibold">{application.vehicleMake}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Model</p>
                      <p className="text-sm font-semibold">{application.vehicleModel}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Year</p>
                      <p className="text-sm font-semibold">{application.vehicleYear}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase">Color</p>
                      <p className="text-sm font-semibold">{application.vehicleColor}</p>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase">License Plate</p>
                      <p className="text-sm font-bold tracking-widest bg-muted px-3 py-1 rounded w-fit border border-border">
                        {application.vehiclePlate}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-8">
              {/* Payout Information */}
              <Card className="border-emerald-500/20 shadow-md overflow-hidden">
                <CardHeader className="pb-3 bg-emerald-500/5">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-emerald-600" /> Payout Information
                  </CardTitle>
                  <CardDescription>Courier payment method and details</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground font-medium">Status</span>
                    {application.payoutSetupStatus === 'complete' ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider">
                        <CheckCircle2 className="h-3 w-3" /> Ready ✓
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider">
                        Not Set Up
                      </Badge>
                    )}
                  </div>

                  {application.payoutSetupStatus === 'complete' ? (
                    <>
                      <div className="flex items-center justify-between py-2 border-b border-border">
                        <span className="text-sm text-muted-foreground font-medium">Method</span>
                        <span className="text-sm font-semibold capitalize">
                          {application.payoutMethod?.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="pt-2 space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="h-px flex-1 bg-border" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2">Payment Details</span>
                          <div className="h-px flex-1 bg-border" />
                        </div>

                        {application.payoutMethod === 'zelle' && (
                          <div className="space-y-3">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">Email/Phone</span>
                              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                                {application.payoutEmail ? (
                                  <Mail className="h-4 w-4 text-primary" />
                                ) : (
                                  <Phone className="h-4 w-4 text-primary" />
                                )}
                                <span className="text-sm font-medium">{application.payoutEmail || application.payoutPhone}</span>
                              </div>
                            </div>
                            <Button 
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" 
                              onClick={() => copyToClipboard(application.payoutEmail || application.payoutPhone || '', "Payment info")}
                            >
                              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                              {copied ? "Copied!" : "Copy Payment Info"}
                            </Button>
                          </div>
                        )}

                        {application.payoutMethod === 'cashapp' && (
                          <div className="space-y-3">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-muted-foreground">$Cashtag</span>
                              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                                <DollarSign className="h-4 w-4 text-primary" />
                                <span className="text-sm font-medium">
                                  {application.payoutHandle?.startsWith('$') ? application.payoutHandle : `$${application.payoutHandle}`}
                                </span>
                              </div>
                            </div>
                            <Button 
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" 
                              onClick={() => copyToClipboard(application.payoutHandle || '', "Payment info")}
                            >
                              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                              {copied ? "Copied!" : "Copy Payment Info"}
                            </Button>
                          </div>
                        )}

                        {application.payoutMethod === 'bank_transfer' && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-muted-foreground">Bank Name</span>
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                                  <Building2 className="h-4 w-4 text-primary" />
                                  <span className="text-sm font-medium truncate">{application.payoutBankName}</span>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-muted-foreground">Account</span>
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                                  <CreditCard className="h-4 w-4 text-primary" />
                                  <span className="text-sm font-medium">****{application.payoutAccountLast4}</span>
                                </div>
                              </div>
                            </div>
                            <Button 
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" 
                              onClick={() => copyToClipboard(`${application.payoutBankName} - ****${application.payoutAccountLast4}`, "Payment info")}
                            >
                              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                              {copied ? "Copied!" : "Copy Payment Info"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
                      <AlertTriangle className="h-8 w-8 text-yellow-500 opacity-50" />
                      <p className="text-sm text-muted-foreground">Courier has not set up payouts</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Verification Status (Admin Only) */}
              <Card className="border-primary/20 shadow-md">
                <CardHeader className="pb-3 bg-primary/5">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" /> Verification Status
                  </CardTitle>
                  <CardDescription>Internal verification results</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Background Check</label>
                    <Select value={bgStatus} onValueChange={setBgStatus}>
                      <SelectTrigger className={cn(
                        bgStatus === 'cleared' && "border-emerald-500/50 text-emerald-600 bg-emerald-50",
                        bgStatus === 'flagged' && "border-destructive/50 text-destructive bg-destructive/5",
                        bgStatus === 'in_progress' && "border-yellow-500/50 text-yellow-600 bg-yellow-50"
                      )}>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">Not Started</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="cleared">Cleared</SelectItem>
                        <SelectItem value="flagged">Flagged</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Driver's License</label>
                    <Select value={licenseStatus} onValueChange={setLicenseStatus}>
                      <SelectTrigger className={cn(
                        licenseStatus === 'verified' && "border-emerald-500/50 text-emerald-600 bg-emerald-50",
                        (licenseStatus === 'expired' || licenseStatus === 'mismatch') && "border-destructive/50 text-destructive bg-destructive/5"
                      )}>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">Not Started</SelectItem>
                        <SelectItem value="verified">Verified</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="mismatch">Mismatch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button className="w-full" onClick={handleUpdateVerification}>
                    Update Verification
                  </Button>
                </CardContent>
              </Card>

              {/* Manual Review Checklist */}
              <Card className="border-amber-500/20">
                <CardHeader className="pb-3 bg-amber-500/5">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-amber-600" /> Manual Review Checklist
                  </CardTitle>
                  <CardDescription>Internal verification steps (not visible to courier)</CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors">
                      <Checkbox 
                        checked={licenseVerified} 
                        onCheckedChange={(checked) => setLicenseVerified(!!checked)}
                      />
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">License Valid & Not Expired</p>
                        <p className="text-xs text-muted-foreground">Verified expiration date is in the future</p>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors">
                      <Checkbox 
                        checked={insuranceVerified} 
                        onCheckedChange={(checked) => setInsuranceVerified(!!checked)}
                      />
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">Insurance Active</p>
                        <p className="text-xs text-muted-foreground">Proof of insurance is valid and current</p>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors">
                      <Checkbox 
                        checked={manualScreeningComplete} 
                        onCheckedChange={(checked) => setManualScreeningComplete(!!checked)}
                      />
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">Manual Screening Complete</p>
                        <p className="text-xs text-muted-foreground">Background review performed outside app</p>
                      </div>
                    </label>
                  </div>
                  
                  <div className="pt-2 border-t border-border">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Checklist Progress</span>
                      <span className={cn(
                        "font-bold",
                        [licenseVerified, insuranceVerified, manualScreeningComplete].filter(Boolean).length === 3 
                          ? "text-emerald-600" 
                          : "text-amber-600"
                      )}>
                        {[licenseVerified, insuranceVerified, manualScreeningComplete].filter(Boolean).length}/3 Complete
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Admin Notes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Info className="h-5 w-5 text-primary" /> Admin Notes
                  </CardTitle>
                  <CardDescription>Private notes, not visible to courier</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea 
                    placeholder="Add internal notes about this application..." 
                    className="min-h-[120px] text-sm"
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                  />
                  <Button variant="outline" size="sm" className="w-full" onClick={handleUpdateVerification}>
                    Save Notes
                  </Button>
                  
                  {application.adminNotes && (
                    <div className="p-3 bg-muted/50 rounded-lg border border-border">
                      <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Last updated: {new Date(application.reviewedAt || application.createdAt).toLocaleString()}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{application.adminNotes}</p>
                    </div>
                  )}
                  
                  {application.denialReason && (
                    <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                      <p className="text-xs text-destructive font-bold uppercase mb-1">Denial Reason</p>
                      <p className="text-sm">{application.denialReason}</p>
                    </div>
                  )}
                  
                  {application.suspensionReason && (
                    <div className="p-3 bg-orange-500/5 rounded-lg border border-orange-500/20">
                      <p className="text-xs text-orange-600 font-bold uppercase mb-1">Suspension Reason</p>
                      <p className="text-sm">{application.suspensionReason}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Timestamps */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <TimelineItem 
                    label="Application Created" 
                    date={application.createdAt} 
                    icon={<Calendar className="h-3 w-3" />}
                  />
                  <TimelineItem 
                    label="Submitted for Review" 
                    date={application.submittedAt} 
                    icon={<ShieldCheck className="h-3 w-3" />}
                  />
                  {application.reviewedAt && (
                    <TimelineItem 
                      label={`Reviewed (${application.status})`} 
                      date={application.reviewedAt} 
                      icon={<Clock className="h-3 w-3" />}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
      </div>
    </AdminAppShell>
  )
}

function DocumentViewer({ label, storageId }: { label: string, storageId?: Id<"_storage"> }) {
  const url = useQuery(api.storage.getFileUrl, storageId ? { storageId } : "skip")
  
  if (!storageId) {
    return (
      <div className="aspect-[4/3] border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center bg-muted/30 text-muted-foreground p-4 text-center">
        <ShieldAlert className="h-8 w-8 mb-2 opacity-20" />
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[10px]">Not uploaded</p>
      </div>
    )
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="group relative aspect-[4/3] border border-border rounded-xl overflow-hidden bg-muted hover:border-primary/50 transition-all text-left">
          {url ? (
            <img src={url} alt={label} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Skeleton className="w-full h-full" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <p className="text-white text-xs font-bold flex items-center gap-2">
              <ExternalLink className="h-4 w-4" /> View Full Size
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
            <p className="text-white text-[10px] font-bold uppercase">{label}</p>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-none">
        <DialogHeader className="sr-only">
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <div className="relative w-full h-full flex items-center justify-center min-h-[50vh]">
          {url && <img src={url} alt={label} className="max-w-full max-h-[85vh] object-contain" />}
          <div className="absolute bottom-4 left-4 right-4 text-white text-center">
            <p className="text-sm font-bold">{label}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TimelineItem({ label, date, icon }: { label: string, date?: number, icon: React.ReactNode }) {
  if (!date) return null
  
  return (
    <div className="flex gap-3">
      <div className="mt-1 p-1 rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold">{label}</p>
        <p className="text-[10px] text-muted-foreground">{new Date(date).toLocaleString()}</p>
      </div>
    </div>
  )
}
