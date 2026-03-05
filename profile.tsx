import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@convex/api'
import { useAuth } from '@/hooks/use-auth'
import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger, 
  DialogFooter, 
  DialogClose,
  DialogDescription
} from '@/components/ui/dialog'
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'
import { 
  User,
  Mail, 
  Phone, 
  LogOut, 
  Edit2, 
  Shield,
  Key,
  Loader2,
  Camera,
  MapPin,
  Plus,
  Trash2,
  Star,
  Home,
  Building2,
  Car,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Users,
  Package,
  Settings,
  CreditCard,
  ArrowRight,
  Calendar,
  Landmark,
  DollarSign,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Payout method types
type PayoutMethod = "bank_transfer" | "cashapp" | "zelle"

const PAYOUT_METHODS: { value: PayoutMethod; label: string; icon: React.ReactNode; description: string }[] = [
  { value: "zelle", label: "Zelle", icon: <Landmark className="w-5 h-5" />, description: "Receive via email or phone" },
  { value: "cashapp", label: "Cash App", icon: <DollarSign className="w-5 h-5" />, description: "Receive via $cashtag" },
  { value: "bank_transfer", label: "Bank Transfer", icon: <Building2 className="w-5 h-5" />, description: "Direct bank deposit" },
]

// Helper functions for masking sensitive info
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  const maskedLocal = local.charAt(0) + '***'
  return `${maskedLocal}@${domain}`
}

function maskPhone(phone: string): string {
  if (phone.length < 4) return phone
  return '***' + phone.slice(-4)
}

// Payout Setup Sheet Content Component
interface PayoutFormState {
  method: PayoutMethod | ""
  email: string
  phone: string
  bankName: string
  accountLast4: string
  handle: string
}

function PayoutSetupSheetContent({
  payoutForm,
  setPayoutForm,
  isSavingPayout,
  onSave,
}: {
  payoutForm: PayoutFormState
  setPayoutForm: React.Dispatch<React.SetStateAction<PayoutFormState>>
  isSavingPayout: boolean
  onSave: () => void
}) {
  return (
    <SheetContent className="w-full sm:max-w-md overflow-y-auto">
      <SheetHeader>
        <SheetTitle>Set Up Your Payout Method</SheetTitle>
        <SheetDescription>
          Choose how you'd like to receive your earnings
        </SheetDescription>
      </SheetHeader>
      
      <div className="py-6 space-y-6">
        {/* Method Selection */}
        <RadioGroup
          value={payoutForm.method}
          onValueChange={(value) => setPayoutForm(prev => ({ 
            ...prev, 
            method: value as PayoutMethod,
            // Reset fields when changing method
            email: "",
            phone: "",
            bankName: "",
            accountLast4: "",
            handle: "",
          }))}
          className="space-y-3"
        >
          {PAYOUT_METHODS.map((method) => (
            <div key={method.value} className="flex items-center space-x-3">
              <RadioGroupItem value={method.value} id={method.value} />
              <Label 
                htmlFor={method.value} 
                className="flex items-center gap-3 cursor-pointer flex-1 p-3 rounded-lg hover:bg-slate-800/50 transition-colors"
              >
                <div className="p-2 rounded-lg bg-slate-700">
                  {method.icon}
                </div>
                <div>
                  <p className="font-medium">{method.label}</p>
                  <p className="text-sm text-muted-foreground">{method.description}</p>
                </div>
              </Label>
            </div>
          ))}
        </RadioGroup>

        {/* Conditional Fields */}
        {payoutForm.method && (
          <div className="space-y-4 pt-4 border-t border-slate-700">
            {payoutForm.method === "zelle" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="zelle-email">Email</Label>
                  <Input
                    id="zelle-email"
                    type="email"
                    value={payoutForm.email}
                    onChange={(e) => setPayoutForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="your@email.com"
                  />
                </div>
                <div className="text-center text-sm text-muted-foreground">or</div>
                <div className="space-y-2">
                  <Label htmlFor="zelle-phone">Phone Number</Label>
                  <Input
                    id="zelle-phone"
                    type="tel"
                    value={payoutForm.phone}
                    onChange={(e) => setPayoutForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </>
            )}

            {payoutForm.method === "cashapp" && (
              <div className="space-y-2">
                <Label htmlFor="cashapp-handle">Cash App $cashtag *</Label>
                <Input
                  id="cashapp-handle"
                  value={payoutForm.handle}
                  onChange={(e) => setPayoutForm(prev => ({ ...prev, handle: e.target.value }))}
                  placeholder="$yourcashtag"
                />
              </div>
            )}

            {payoutForm.method === "bank_transfer" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="bank-name">Bank Name *</Label>
                  <Input
                    id="bank-name"
                    value={payoutForm.bankName}
                    onChange={(e) => setPayoutForm(prev => ({ ...prev, bankName: e.target.value }))}
                    placeholder="Chase, Bank of America, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account-last4">Last 4 Digits of Account *</Label>
                  <Input
                    id="account-last4"
                    value={payoutForm.accountLast4}
                    onChange={(e) => setPayoutForm(prev => ({ ...prev, accountLast4: e.target.value.slice(0, 4) }))}
                    placeholder="1234"
                    maxLength={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    We'll contact you securely to collect full bank details for direct deposit.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <SheetFooter className="gap-2">
        <SheetClose asChild>
          <Button variant="outline">Cancel</Button>
        </SheetClose>
        <Button onClick={onSave} disabled={isSavingPayout || !payoutForm.method}>
          {isSavingPayout ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Payout Method'
          )}
        </Button>
      </SheetFooter>
    </SheetContent>
  )
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { role, signOut } = useAuth()
  
  // State
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', phone: '' })
  const [isSaving, setIsSaving] = useState(false)
  const [isAddingAddress, setIsAddingAddress] = useState(false)
  const [isPayoutSheetOpen, setIsPayoutSheetOpen] = useState(false)
  const [isSavingPayout, setIsSavingPayout] = useState(false)
  const [payoutForm, setPayoutForm] = useState<{
    method: PayoutMethod | ""
    email: string
    phone: string
    bankName: string
    accountLast4: string
    handle: string
  }>({
    method: "",
    email: "",
    phone: "",
    bankName: "",
    accountLast4: "",
    handle: "",
  })
  const [newAddress, setNewAddress] = useState({
    label: '',
    street1: '',
    street2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
    isDefault: false,
  })

  // Queries
  const profile = useQuery(api.profiles.getMyProfile)
  const addresses = useQuery(api.addresses.getMySavedAddresses)
  const courierApplication = useQuery(
    api.couriers.getMyApplication,
    role === 'courier' ? {} : 'skip'
  )
  const payoutStatus = useQuery(
    api.payouts.getPayoutStatus,
    role === 'courier' ? {} : 'skip'
  )
  const profileImageUrl = useQuery(api.profiles.getProfileImageUrl)
  const updateProfileImage = useMutation(api.profiles.updateProfileImage)
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)

  // Mutations
  const updateProfile = useMutation(api.profiles.updateProfile)
  const saveAddress = useMutation(api.addresses.saveAddress)
  const deleteAddress = useMutation(api.addresses.deleteAddress)
  const updateAddress = useMutation(api.addresses.updateAddress)
  const savePayoutMethod = useMutation(api.payouts.savePayoutMethod)

  // Handle legacy payout setup URL params (can be removed later)
  useEffect(() => {
    const status = searchParams.get('payout_setup')
    if (status) {
      searchParams.delete('payout_setup')
      setSearchParams(searchParams)
    }
  }, [searchParams, setSearchParams])

  // Initialize payout form when opening sheet with existing data
  const handleOpenPayoutSheet = () => {
    if (payoutStatus) {
      setPayoutForm({
        method: payoutStatus.payoutMethod || "",
        email: payoutStatus.payoutEmail || "",
        phone: payoutStatus.payoutPhone || "",
        bankName: payoutStatus.payoutBankName || "",
        accountLast4: payoutStatus.payoutAccountLast4 || "",
        handle: payoutStatus.payoutHandle || "",
      })
    }
    setIsPayoutSheetOpen(true)
  }

  // Handlers
  const handleSavePayoutMethod = async () => {
    if (!payoutForm.method) {
      toast.error("Please select a payout method")
      return
    }

    setIsSavingPayout(true)
    try {
      await savePayoutMethod({
        method: payoutForm.method as PayoutMethod,
        email: payoutForm.email || undefined,
        phone: payoutForm.phone || undefined,
        bankName: payoutForm.bankName || undefined,
        accountLast4: payoutForm.accountLast4 || undefined,
        handle: payoutForm.handle || undefined,
      })
      toast.success("Payout method saved successfully!")
      setIsPayoutSheetOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save payout method")
    } finally {
      setIsSavingPayout(false)
    }
  }
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingPhoto(true)
    try {
      // Upload to storage
      const uploadUrl = await generateUploadUrl()
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      })
      const { storageId } = await result.json()

      // Update profile
      await updateProfileImage({ imageId: storageId })
      toast.success("Profile photo updated!")
    } catch (error) {
      toast.error("Failed to upload photo")
      console.error(error)
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out successfully')
  }

  const handleSaveProfile = async () => {
    if (!editForm.name.trim()) {
      toast.error('Name is required')
      return
    }
    
    // Phone validation
    if (editForm.phone && !/^[\d\s\-\(\)\+]*$/.test(editForm.phone)) {
      toast.error('Please enter a valid phone number')
      return
    }

    setIsSaving(true)
    try {
      await updateProfile({
        name: editForm.name,
        phone: editForm.phone || undefined,
      })
      toast.success('Profile updated successfully')
      setIsEditing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveAddress = async () => {
    if (!newAddress.label || !newAddress.street1 || !newAddress.city || !newAddress.state || !newAddress.zipCode) {
      toast.error('Please fill in all required fields')
      return
    }
    try {
      await saveAddress(newAddress)
      toast.success('Address saved')
      setIsAddingAddress(false)
      setNewAddress({
        label: '',
        street1: '',
        street2: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US',
        isDefault: false,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save address')
    }
  }

  const handleDeleteAddress = async (addressId: string) => {
    try {
      await deleteAddress({ addressId: addressId as any })
      toast.success('Address deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete address')
    }
  }

  const handleSetDefault = async (addressId: string) => {
    try {
      await updateAddress({ addressId: addressId as any, isDefault: true })
      toast.success('Default address updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set default')
    }
  }

  // Helpers
  const getLabelIcon = (label: string) => {
    const lower = label.toLowerCase()
    if (lower.includes('home')) return Home
    if (lower.includes('work') || lower.includes('office')) return Building2
    return MapPin
  }

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { icon: any; color: string; label: string }> = {
      draft: { icon: Clock, color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', label: 'Draft' },
      pending_review: { icon: Clock, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'Pending Review' },
      approved: { icon: CheckCircle2, color: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Approved' },
      denied: { icon: XCircle, color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Denied' },
      suspended: { icon: AlertTriangle, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', label: 'Suspended' },
    }
    return configs[status] || configs.draft
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-primary/20 text-primary border-primary/30'
      case 'courier': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30'
    }
  }

  // Loading state (undefined means still fetching)
  if (profile === undefined) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  // Error state (null means no profile found)
  if (profile === null) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4 text-center">
            <User className="w-12 h-12 text-muted-foreground" />
            <div>
              <h2 className="text-xl font-semibold">Profile Not Found</h2>
              <p className="text-sm text-muted-foreground mt-1">
                There was an issue loading your profile. Please try signing out and back in.
              </p>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const statusConfig = courierApplication ? getStatusConfig(courierApplication.status) : null

  return (
    <AppShell>
      <div className="space-y-8 pb-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="relative group">
            <Avatar className="w-20 h-20 border-4 border-primary/20">
              {profileImageUrl ? (
                <AvatarImage src={profileImageUrl} alt={profile?.name || 'Profile'} />
              ) : (
                <AvatarImage 
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.name || 'user'}`} 
                  alt={profile?.name || 'Profile'} 
                />
              )}
              <AvatarFallback className="text-2xl font-bold">
                {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            
            {/* Upload overlay */}
            <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              {isUploadingPhoto ? (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              ) : (
                <Camera className="w-6 h-6 text-white" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                disabled={isUploadingPhoto}
              />
            </label>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold font-outfit">{profile.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge className={cn("capitalize", getRoleBadgeColor(role || 'customer'))}>
                {role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                {role || 'Customer'}
              </Badge>
              {role === 'courier' && statusConfig && (
                <Badge variant="outline" className={statusConfig.color}>
                  <statusConfig.icon className="w-3 h-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              {profile.email}
            </p>
          </div>
        </div>

        {/* Account Information */}
        <Card className="bg-slate-900/60 border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-outfit flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Account Information
                </CardTitle>
                <CardDescription>Manage your personal details</CardDescription>
              </div>
              {!isEditing && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setEditForm({ name: profile.name, phone: profile.phone || '' })
                    setIsEditing(true)
                  }}
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input 
                    id="name"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input 
                    id="phone"
                    value={editForm.phone}
                    onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveProfile} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="font-medium">{profile.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="font-medium">{profile.phone || 'Not set'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium">{profile.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Member Since</p>
                    <p className="font-medium">
                      {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Security Section */}
        <Card className="bg-slate-900/60 border-slate-700">
          <CardHeader>
            <CardTitle className="font-outfit flex items-center gap-2">
              <Key className="w-5 h-5" />
              Security
            </CardTitle>
            <CardDescription>Manage your account security</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Key className="w-4 h-4 mr-2" />
                  Change Password
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Change Password</DialogTitle>
                  <DialogDescription>
                    For security, password changes are handled via email verification.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <div className="p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                    <p>To change your password:</p>
                    <ol className="list-decimal list-inside mt-2 space-y-1">
                      <li>Sign out of your account</li>
                      <li>Click "Forgot Password" on the login page</li>
                      <li>Follow the email instructions</li>
                    </ol>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Close</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Customer: Saved Addresses */}
        {role === 'customer' && (
          <Card className="bg-slate-900/60 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-outfit flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Saved Addresses
                  </CardTitle>
                  <CardDescription>Quick access addresses for booking</CardDescription>
                </div>
                <Dialog open={isAddingAddress} onOpenChange={setIsAddingAddress}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Address
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Address</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                      <div className="space-y-2">
                        <Label>Label *</Label>
                        <Input 
                          value={newAddress.label}
                          onChange={(e) => setNewAddress(prev => ({ ...prev, label: e.target.value }))}
                          placeholder="Home, Work, etc."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Street Address *</Label>
                        <Input 
                          value={newAddress.street1}
                          onChange={(e) => setNewAddress(prev => ({ ...prev, street1: e.target.value }))}
                          placeholder="123 Main St"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Apt, Suite, etc.</Label>
                        <Input 
                          value={newAddress.street2}
                          onChange={(e) => setNewAddress(prev => ({ ...prev, street2: e.target.value }))}
                          placeholder="Apt 4B"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>City *</Label>
                          <Input 
                            value={newAddress.city}
                            onChange={(e) => setNewAddress(prev => ({ ...prev, city: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>State *</Label>
                          <Input 
                            value={newAddress.state}
                            onChange={(e) => setNewAddress(prev => ({ ...prev, state: e.target.value }))}
                            placeholder="GA"
                            maxLength={2}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>ZIP Code *</Label>
                        <Input 
                          value={newAddress.zipCode}
                          onChange={(e) => setNewAddress(prev => ({ ...prev, zipCode: e.target.value }))}
                          placeholder="30301"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="isDefault"
                          checked={newAddress.isDefault}
                          onChange={(e) => setNewAddress(prev => ({ ...prev, isDefault: e.target.checked }))}
                          className="rounded border-input"
                        />
                        <Label htmlFor="isDefault" className="cursor-pointer font-normal">
                          Set as default address
                        </Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button onClick={handleSaveAddress}>Save Address</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {addresses === undefined ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : addresses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No saved addresses yet</p>
                  <p className="text-sm">Add addresses for faster booking</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map((addr) => {
                    const Icon = getLabelIcon(addr.label)
                    return (
                      <div 
                        key={addr._id} 
                        className="flex items-start gap-4 p-4 rounded-lg bg-slate-800/50 border border-slate-700"
                      >
                        <div className="p-2 rounded-lg bg-slate-700">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{addr.label}</p>
                            {addr.isDefault && (
                              <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                                <Star className="w-3 h-3 mr-1" />
                                Default
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {addr.street1}{addr.street2 ? `, ${addr.street2}` : ''}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {addr.city}, {addr.state} {addr.zipCode}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!addr.isDefault && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleSetDefault(addr._id)}
                            >
                              Set Default
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Address</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{addr.label}"? This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteAddress(addr._id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Courier: Vehicle & Status */}
        {role === 'courier' && courierApplication && (
          <Card className="bg-slate-900/60 border-slate-700">
            <CardHeader>
              <CardTitle className="font-outfit flex items-center gap-2">
                <Car className="w-5 h-5" />
                Courier Information
              </CardTitle>
              <CardDescription>Your verification status and vehicle details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status */}
              {statusConfig && (
                <div className={cn("p-4 rounded-lg flex items-center gap-3", statusConfig.color)}>
                  <statusConfig.icon className="w-6 h-6" />
                  <div>
                    <p className="font-semibold">{statusConfig.label}</p>
                    <p className="text-sm opacity-80">
                      {courierApplication.status === 'approved' && 'You are verified and can accept jobs'}
                      {courierApplication.status === 'pending_review' && 'Your application is being reviewed'}
                      {courierApplication.status === 'denied' && (courierApplication.denialReason || 'Your application was not approved')}
                      {courierApplication.status === 'suspended' && (courierApplication.suspensionReason || 'Your account has been suspended')}
                      {courierApplication.status === 'draft' && 'Complete your application to get verified'}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Vehicle Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <p className="text-xs text-muted-foreground">Vehicle</p>
                  <p className="font-medium">
                    {courierApplication.vehicleYear} {courierApplication.vehicleMake} {courierApplication.vehicleModel}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <p className="text-xs text-muted-foreground">Color</p>
                  <p className="font-medium">{courierApplication.vehicleColor}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <p className="text-xs text-muted-foreground">License Plate</p>
                  <p className="font-medium">{courierApplication.vehiclePlate}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="font-medium">{courierApplication.phone || profile.phone || 'Not set'}</p>
                </div>
              </div>

              {(courierApplication.status === 'denied' || courierApplication.status === 'suspended') && (
                <Button variant="outline" onClick={() => navigate('/courier/onboarding')}>
                  Update Application
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Courier: Payouts */}
        {role === 'courier' && (
          <Card className="bg-slate-900/60 border-slate-700">
            <CardHeader>
              <CardTitle className="font-outfit flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payouts
              </CardTitle>
              <CardDescription>Set up your payout method to receive earnings</CardDescription>
            </CardHeader>
            <CardContent>
              {payoutStatus === undefined ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : !payoutStatus ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Payout information not available.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {payoutStatus.status === 'not_started' && (
                    <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                        <div>
                          <p className="font-semibold text-yellow-500">Status: Not set up</p>
                          <p className="text-sm text-yellow-500/80">Complete payout setup to start earning</p>
                        </div>
                      </div>
                      <Sheet open={isPayoutSheetOpen} onOpenChange={setIsPayoutSheetOpen}>
                        <SheetTrigger asChild>
                          <Button 
                            onClick={handleOpenPayoutSheet}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground"
                          >
                            <ArrowRight className="w-4 h-4 mr-2" />
                            Set Up Payouts
                          </Button>
                        </SheetTrigger>
                        <PayoutSetupSheetContent
                          payoutForm={payoutForm}
                          setPayoutForm={setPayoutForm}
                          isSavingPayout={isSavingPayout}
                          onSave={handleSavePayoutMethod}
                        />
                      </Sheet>
                    </div>
                  )}

                  {payoutStatus.status === 'complete' && payoutStatus.payoutMethod && (
                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                          <div>
                            <p className="font-semibold text-green-500">Status: Ready</p>
                            <p className="text-sm text-green-500/80">Your payout method is set up. You can now go online and accept jobs.</p>
                          </div>
                        </div>
                        <Sheet open={isPayoutSheetOpen} onOpenChange={setIsPayoutSheetOpen}>
                          <SheetTrigger asChild>
                            <Button 
                              variant="outline" 
                              onClick={handleOpenPayoutSheet}
                            >
                              Change
                            </Button>
                          </SheetTrigger>
                          <PayoutSetupSheetContent
                            payoutForm={payoutForm}
                            setPayoutForm={setPayoutForm}
                            isSavingPayout={isSavingPayout}
                            onSave={handleSavePayoutMethod}
                          />
                        </Sheet>
                      </div>
                      {/* Display current payout method */}
                      <div className="mt-4 p-3 rounded-lg bg-slate-800/50 flex items-center gap-3">
                        {PAYOUT_METHODS.find(m => m.value === payoutStatus.payoutMethod)?.icon}
                        <div>
                          <p className="font-medium capitalize">
                            {payoutStatus.payoutMethod?.replace('_', ' ')}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {payoutStatus.payoutMethod === 'cashapp' && payoutStatus.payoutHandle}
                            {payoutStatus.payoutMethod === 'zelle' && (payoutStatus.payoutEmail ? maskEmail(payoutStatus.payoutEmail) : maskPhone(payoutStatus.payoutPhone || ''))}
                            {payoutStatus.payoutMethod === 'bank_transfer' && `${payoutStatus.payoutBankName} ****${payoutStatus.payoutAccountLast4}`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Admin: Quick Links */}
        {role === 'admin' && (
          <Card className="bg-slate-900/60 border-slate-700">
            <CardHeader>
              <CardTitle className="font-outfit flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Admin Quick Actions
              </CardTitle>
              <CardDescription>Manage platform resources</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { icon: Users, label: 'Manage Couriers', path: '/admin/couriers', color: 'text-blue-400' },
                  { icon: Package, label: 'Manage Jobs', path: '/admin/jobs', color: 'text-green-400' },
                  { icon: MapPin, label: 'Hub Locations', path: '/admin/locations', color: 'text-orange-400' },
                  { icon: CreditCard, label: 'Payments', path: '/admin/payments', color: 'text-purple-400' },
                  { icon: Settings, label: 'Platform Settings', path: '/admin/settings', color: 'text-slate-400' },
                ].map((item) => (
                  <Button
                    key={item.path}
                    variant="outline"
                    className="h-auto py-4 px-4 justify-start gap-3 bg-slate-800/50 border-slate-700 hover:bg-slate-800"
                    onClick={() => navigate(item.path)}
                  >
                    <item.icon className={cn("w-5 h-5", item.color)} />
                    <span>{item.label}</span>
                    <ArrowRight className="w-4 h-4 ml-auto opacity-50" />
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Support */}
        <Card className="bg-slate-900/60 border-slate-700">
          <CardHeader>
            <CardTitle className="font-outfit flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Need Help?
            </CardTitle>
            <CardDescription>Get in touch with our support team</CardDescription>
          </CardHeader>
          <CardContent>
            <a href="mailto:support@droppit.app">
              <Button variant="outline" className="w-full">
                <Mail className="w-4 h-4 mr-2" />
                support@droppit.app
              </Button>
            </a>
          </CardContent>
        </Card>

        {/* Sign Out */}
        <Card className="bg-slate-900/60 border-slate-700">
          <CardHeader>
            <CardTitle className="font-outfit flex items-center gap-2 text-destructive">
              <LogOut className="w-5 h-5" />
              Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sign Out</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to sign out? You'll need to sign in again to access your account.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSignOut} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Sign Out
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
