import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/api"
import { useAuth } from '@/hooks/use-auth'
import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { 
  Mail, 
  Phone, 
  LogOut, 
  Edit2, 
  Car,
  Shield,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Loader2
} from 'lucide-react'

const statusConfig: Record<string, { icon: any, color: string, label: string }> = {
  draft: { icon: Clock, color: 'bg-slate-500/20 text-slate-400', label: 'Draft' },
  pending_review: { icon: Clock, color: 'bg-yellow-500/20 text-yellow-400', label: 'Pending Review' },
  approved: { icon: CheckCircle2, color: 'bg-green-500/20 text-green-400', label: 'Approved' },
  denied: { icon: XCircle, color: 'bg-red-500/20 text-red-400', label: 'Denied' },
  suspended: { icon: AlertTriangle, color: 'bg-orange-500/20 text-orange-400', label: 'Suspended' },
}

export default function CourierProfilePage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', phone: '' })

  const profile = useQuery(api.profiles.getMyProfile)
  const application = useQuery(api.couriers.getMyApplication) as any
  const updateProfile = useMutation(api.profiles.updateProfile)

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out successfully')
    navigate('/auth')
  }

  const handleUpdateProfile = async () => {
    try {
      await updateProfile({
        name: editForm.name || undefined,
        phone: editForm.phone || undefined,
      })
      toast.success('Profile updated')
      setIsEditing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile')
    }
  }

  if (!profile) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppShell>
    )
  }

  const status = application?.status || 'draft'
  const StatusIcon = statusConfig[status]?.icon || Clock
  const statusColor = statusConfig[status]?.color || statusConfig.draft.color
  const statusLabel = statusConfig[status]?.label || 'Unknown'

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold font-outfit">Profile</h1>
          <p className="text-muted-foreground">Manage your courier account</p>
        </div>

        {/* Profile Card */}
        <Card className="bg-slate-900/60 border-slate-700">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.name}`} />
                  <AvatarFallback className="text-xl">{profile.name?.[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-xl font-outfit">{profile.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">Courier</Badge>
                  </CardDescription>
                </div>
              </div>
              <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setEditForm({ name: profile.name, phone: profile.phone || '' })}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Profile</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input 
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Phone</Label>
                      <Input 
                        value={editForm.phone}
                        onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button onClick={handleUpdateProfile}>Save Changes</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{profile.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50">
                <Phone className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="font-medium">{profile.phone || application?.phone || 'Not set'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Verification Status */}
        <Card className="bg-slate-900/60 border-slate-700">
          <CardHeader>
            <CardTitle className="font-outfit flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Verification Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`p-4 rounded-lg ${statusColor} flex items-center gap-3`}>
              <StatusIcon className="w-6 h-6" />
              <div>
                <p className="font-semibold">{statusLabel}</p>
                <p className="text-sm opacity-80">
                  {status === 'approved' && 'You are verified and can accept jobs'}
                  {status === 'pending_review' && 'Your application is being reviewed'}
                  {status === 'denied' && (application?.denialReason || 'Your application was not approved')}
                  {status === 'suspended' && (application?.suspensionReason || 'Your account has been suspended')}
                  {status === 'draft' && 'Complete your application to get verified'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Info */}
        {application && (
          <Card className="bg-slate-900/60 border-slate-700">
            <CardHeader>
              <CardTitle className="font-outfit flex items-center gap-2">
                <Car className="w-5 h-5" />
                Vehicle Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <p className="text-xs text-muted-foreground">Vehicle</p>
                  <p className="font-medium">
                    {application.vehicleYear} {application.vehicleMake} {application.vehicleModel}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <p className="text-xs text-muted-foreground">Color</p>
                  <p className="font-medium">{application.vehicleColor}</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <p className="text-xs text-muted-foreground">License Plate</p>
                  <p className="font-medium">{application.vehiclePlate}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sign Out */}
        <Card className="bg-slate-900/60 border-slate-700">
          <CardContent className="pt-6">
            <Button 
              variant="destructive" 
              className="w-full"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
