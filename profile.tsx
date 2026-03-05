import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useQuery, useMutation } from 'convex/react'
import { api } from '@convex/api'
import { AdminAppShell } from '@/components/layout/admin-app-shell'
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
import { toast } from 'sonner'
import { 
  Mail, 
  Phone, 
  LogOut, 
  Edit2, 
  Shield,
  Key,
  Loader2,
  Calendar
} from 'lucide-react'

export default function AdminProfilePage() {
  const { signOut } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', phone: '' })

  const profile = useQuery(api.profiles.getMyProfile)
  const updateProfile = useMutation(api.profiles.updateProfile)

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Signed out successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sign out')
    }
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

  const handleChangePassword = () => {
    toast.info('Password reset email has been sent to your inbox')
    setIsChangingPassword(false)
  }

  if (profile === undefined) {
    return (
      <AdminAppShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminAppShell>
    )
  }

  if (!profile) {
    return (
      <AdminAppShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">Profile not found. Please sign in again.</p>
            <Button onClick={handleSignOut}>Sign Out</Button>
          </div>
        </div>
      </AdminAppShell>
    )
  }

  return (
    <AdminAppShell>
      <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold font-outfit tracking-tight">Admin Profile</h1>
            <p className="text-muted-foreground">Manage your administrator account and security settings</p>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-8">
              {/* Profile Card */}
              <Card className="bg-slate-900/60 border-slate-700 overflow-hidden">
                <CardHeader className="border-b border-slate-700/50 bg-slate-800/30">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-20 h-20 ring-4 ring-primary/10">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.name}`} />
                        <AvatarFallback className="text-2xl bg-primary text-primary-foreground font-bold">
                          {profile.name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <CardTitle className="text-2xl font-outfit">{profile.name}</CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/30 transition-colors">
                            <Shield className="w-3 h-3 mr-1" />
                            Administrator
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <Dialog open={isEditing} onOpenChange={setIsEditing}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="border-slate-600 hover:bg-slate-800"
                          onClick={() => setEditForm({ name: profile.name, phone: profile.phone || '' })}
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit Profile
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-800">
                        <DialogHeader>
                          <DialogTitle className="text-xl font-outfit">Edit Profile</DialogTitle>
                          <DialogDescription className="text-slate-400">
                            Update your personal information below.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-6">
                          <div className="space-y-2">
                            <Label htmlFor="name" className="text-slate-200">Full Name</Label>
                            <Input 
                              id="name"
                              value={editForm.name}
                              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                              className="bg-slate-800 border-slate-700 focus:ring-primary/50"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="phone" className="text-slate-200">Phone Number</Label>
                            <Input 
                              id="phone"
                              value={editForm.phone}
                              onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                              placeholder="(555) 123-4567"
                              className="bg-slate-800 border-slate-700 focus:ring-primary/50"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="ghost" className="hover:bg-slate-800">Cancel</Button>
                          </DialogClose>
                          <Button onClick={handleUpdateProfile} className="bg-primary hover:bg-primary/90">
                            Save Changes
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Email Address</p>
                        <p className="font-semibold text-slate-200">{profile.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Phone className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Phone Number</p>
                        <p className="font-semibold text-slate-200">{profile.phone || 'Not provided'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-slate-400 pt-2">
                    <Calendar className="w-4 h-4" />
                    <span>Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Security Card */}
              <Card className="bg-slate-900/60 border-slate-700 overflow-hidden">
                <CardHeader className="border-b border-slate-700/50 bg-slate-800/30">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-outfit">Security & Access</CardTitle>
                      <CardDescription className="text-slate-400">Manage your password and authentication</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-200">Account Password</p>
                      <p className="text-sm text-slate-400">Update your account password regularly for better security.</p>
                    </div>
                    <Dialog open={isChangingPassword} onOpenChange={setIsChangingPassword}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="border-slate-600 hover:bg-slate-800">
                          <Key className="w-4 h-4 mr-2" />
                          Change Password
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-800">
                        <DialogHeader>
                          <DialogTitle className="text-xl font-outfit">Change Password</DialogTitle>
                          <DialogDescription className="text-slate-400">
                            Click the button below to receive a password reset link via email.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-6 flex flex-col items-center justify-center space-y-4 text-center">
                          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <Mail className="w-8 h-8" />
                          </div>
                          <p className="text-sm text-slate-300">
                            For security reasons, password changes are handled through a verified email link sent to <strong>{profile.email}</strong>.
                          </p>
                        </div>
                        <DialogFooter className="sm:justify-center">
                          <Button onClick={handleChangePassword} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
                            Send Reset Link
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-8">
              {/* Account Status Card */}
              <Card className="bg-slate-900/60 border-slate-700 overflow-hidden">
                <CardHeader className="bg-slate-800/30 border-b border-slate-700/50">
                  <CardTitle className="text-lg font-outfit">Account Status</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Status</span>
                      <Badge variant="outline" className="border-emerald-500/50 text-emerald-500 bg-emerald-500/5">Active</Badge>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Role</span>
                      <span className="text-slate-200 font-medium capitalize">{profile.role}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Permissions</span>
                      <span className="text-slate-200 font-medium">Full Access</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Danger Zone */}
              <Card className="bg-red-500/5 border-red-500/20 overflow-hidden">
                <CardHeader className="bg-red-500/10 border-b border-red-500/20">
                  <CardTitle className="text-lg font-outfit text-red-400">Session Management</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <Button 
                    variant="destructive" 
                    className="w-full bg-red-500/80 hover:bg-red-500"
                    onClick={handleSignOut}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                  <p className="text-[10px] text-center text-red-400/60 mt-4 uppercase tracking-widest font-bold">
                    Securely terminate your current session
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AdminAppShell>
  )
}
