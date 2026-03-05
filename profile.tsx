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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { 
  Mail, 
  Phone, 
  MapPin, 
  LogOut, 
  Edit2, 
  Plus, 
  Trash2, 
  Star,
  Loader2,
  Home,
  Building2
} from 'lucide-react'

export default function CustomerProfilePage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', phone: '' })
  const [isAddingAddress, setIsAddingAddress] = useState(false)
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

  const profile = useQuery(api.profiles.getMyProfile)
  const addresses = useQuery(api.addresses.getMySavedAddresses)
  const updateProfile = useMutation(api.profiles.updateProfile)
  const saveAddress = useMutation(api.addresses.saveAddress)
  const deleteAddress = useMutation(api.addresses.deleteAddress)
  const updateAddress = useMutation(api.addresses.updateAddress)

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

  const getLabelIcon = (label: string) => {
    const lower = label.toLowerCase()
    if (lower.includes('home')) return Home
    if (lower.includes('work') || lower.includes('office')) return Building2
    return MapPin
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

  return (
    <AppShell>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold font-outfit">Profile</h1>
          <p className="text-muted-foreground">Manage your account and saved addresses</p>
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
                    <Badge variant="outline" className="capitalize">{profile.role}</Badge>
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
                  <p className="font-medium">{profile.phone || 'Not set'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Saved Addresses */}
        <Card className="bg-slate-900/60 border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-outfit">Saved Addresses</CardTitle>
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
                          placeholder="NY"
                          maxLength={2}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>ZIP Code *</Label>
                      <Input 
                        value={newAddress.zipCode}
                        onChange={(e) => setNewAddress(prev => ({ ...prev, zipCode: e.target.value }))}
                        placeholder="10001"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isDefault"
                        checked={newAddress.isDefault}
                        onChange={(e) => setNewAddress(prev => ({ ...prev, isDefault: e.target.checked }))}
                        className="rounded"
                      />
                      <Label htmlFor="isDefault" className="cursor-pointer">Set as default address</Label>
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
            {!addresses || addresses.length === 0 ? (
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
                            <Badge variant="outline" className="text-xs">
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
                            <Button variant="ghost" size="icon" className="text-destructive">
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
