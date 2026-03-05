import { useState, useEffect, useCallback } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@convex/api'
import { AdminAppShell } from '@/components/layout/admin-app-shell'
import { AdminServiceAreaMap } from '@/components/admin/admin-service-area-map'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { 
  Settings, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  LogOut, 
  DollarSign, 
  Percent, 
  MapPin, 
  Save, 
  RotateCcw,
  ShieldCheck,
  Globe,
  Database,
  RefreshCw as RefreshIcon,
  CheckCircle2,
  AlertTriangle,
  Play,
  Loader2
} from 'lucide-react'
import { useNavigate } from 'react-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"

import { useAdmin } from '@/contexts/admin-context'

function AdminCredentialsSection() {
  const navigate = useNavigate()
  const { adminEmail, login, logout, sessionToken, isLoading } = useAdmin()
  
  const changeEmail = useMutation(api.adminAuth.changeAdminEmail)
  const changePassword = useMutation(api.adminAuth.changeAdminPassword)
  const adminInfo = useQuery(api.adminAuth.getAdminInfo, adminEmail ? { email: adminEmail } : "skip")
  
  // Email change state
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [isChangingEmail, setIsChangingEmail] = useState(false)
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  
  // Password strength indicators
  const hasMinLength = newPassword.length >= 10
  const hasUppercase = /[A-Z]/.test(newPassword)
  const hasLowercase = /[a-z]/.test(newPassword)
  const hasNumber = /[0-9]/.test(newPassword)
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0

  // Show loading state if admin context is still loading
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // Redirect if not logged in
  if (!adminEmail) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground mb-4">Please sign in to manage your credentials</p>
          <Button onClick={() => navigate('/admin-login')}>
            Sign In
          </Button>
        </CardContent>
      </Card>
    )
  }

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminEmail) {
      toast.error('Please sign in first')
      return
    }
    setIsChangingEmail(true)

    try {
      await changeEmail({
        currentEmail: adminEmail,
        newEmail,
        password: emailPassword,
      })
      
      // Update context with new email
      if (sessionToken) {
        login(newEmail, sessionToken)
      }
      
      toast.success('Email updated successfully')
      setNewEmail('')
      setEmailPassword('')
    } catch (err: unknown) {
      // Handle Convex structured errors
      let message = 'Failed to change email'
      
      if (err && typeof err === 'object') {
        const convexErr = err as { data?: { message?: string; code?: string } | string; message?: string }
        
        if (convexErr.data && typeof convexErr.data === 'object' && convexErr.data.message) {
          message = convexErr.data.message
        } else if (typeof convexErr.data === 'string') {
          message = convexErr.data
        } else if (convexErr.message) {
          message = convexErr.message
        }
      }
      
      toast.error(message)
      console.error('[AdminSettings] Email change error:', err)
    } finally {
      setIsChangingEmail(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adminEmail) {
      toast.error('Please sign in first')
      return
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    
    setIsChangingPassword(true)

    try {
      await changePassword({
        email: adminEmail,
        currentPassword,
        newPassword,
      })
      
      toast.success('Password updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      // Handle Convex structured errors
      let message = 'Failed to change password'
      
      if (err && typeof err === 'object') {
        const convexErr = err as { data?: { message?: string; code?: string } | string; message?: string }
        
        // ConvexError with structured data: { data: { code, message } }
        if (convexErr.data && typeof convexErr.data === 'object' && convexErr.data.message) {
          message = convexErr.data.message
        }
        // ConvexError with string data
        else if (typeof convexErr.data === 'string') {
          message = convexErr.data
        }
        // Standard Error
        else if (convexErr.message) {
          message = convexErr.message
        }
      }
      
      toast.error(message)
      console.error('[AdminSettings] Password change error:', err)
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleLogout = () => {
    logout()
    toast.success('Logged out successfully')
    navigate('/admin-login')
  }

  const StrengthIndicator = ({ met, label }: { met: boolean; label: string }) => (
    <div className={`flex items-center gap-2 text-xs ${met ? 'text-green-500' : 'text-muted-foreground'}`}>
      {met ? <CheckCircle className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-muted-foreground" />}
      {label}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Current Info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Account Information</CardTitle>
            <CardDescription>Your current admin account details</CardDescription>
          </div>
          <Button variant="outline" onClick={handleLogout} className="text-destructive border-destructive/30">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{adminEmail}</span>
          </div>
          {adminInfo?.lastLoginAt && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Last Login</span>
              <span className="font-medium">{new Date(adminInfo.lastLoginAt).toLocaleString()}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Change Email */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Change Email
            </CardTitle>
            <CardDescription>Update your admin email address</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newEmail">New Email</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new@email.com"
                  required
                  disabled={isChangingEmail}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emailPassword">Current Password</Label>
                <Input
                  id="emailPassword"
                  type="password"
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  placeholder="Enter your current password"
                  required
                  disabled={isChangingEmail}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isChangingEmail || !newEmail || !emailPassword}>
                {isChangingEmail ? 'Updating...' : 'Update Email'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Change Password
            </CardTitle>
            <CardDescription>Update your admin password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type={showPasswords ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  disabled={isChangingPassword}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isChangingPassword}
                />
                {/* Password strength indicators */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <StrengthIndicator met={hasMinLength} label="10+ characters" />
                  <StrengthIndicator met={hasUppercase} label="Uppercase" />
                  <StrengthIndicator met={hasLowercase} label="Lowercase" />
                  <StrengthIndicator met={hasNumber} label="Number" />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showPasswords ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isChangingPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && !passwordsMatch && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={isChangingPassword || !currentPassword || !hasMinLength || !hasUppercase || !hasLowercase || !hasNumber || !passwordsMatch}
              >
                {isChangingPassword ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function PlatformSettingsSection() {
  const settings = useQuery(api.settings.getAllSettings)
  const updateSetting = useMutation(api.settings.updateSetting)
  const platformConfig = useQuery(api.platformConfig.get)
  const updatePlatformConfig = useMutation(api.platformConfig.update)
  const [loading, setLoading] = useState(false)
  
  const [pricing, setPricing] = useState({
    baseFee: 15.00,
    additionalPackageFee: 3.00,
    commissionPercent: 25,
  })

  const [serviceArea, setServiceArea] = useState({
    city: 'New York',
    radius: 25,
  })

  const [centerLat, setCenterLat] = useState(33.749)  // Atlanta default
  const [centerLng, setCenterLng] = useState(-84.388)
  const [isGeocoding, setIsGeocoding] = useState(false)

  useEffect(() => {
    if (settings) {
      setPricing({
        baseFee: (settings.baseFee as number) || 15.00,
        additionalPackageFee: (settings.additionalPackageFee as number) || 3.00,
        commissionPercent: (settings.commissionPercent as number) || 25,
      })
      setServiceArea({
        city: (settings.serviceArea as string) || 'New York',
        radius: (settings.radius as number) || 25,
      })
    }
  }, [settings])

  useEffect(() => {
    if (platformConfig) {
      setServiceArea(prev => ({
        city: platformConfig.primaryCity || prev.city,
        radius: platformConfig.radiusMiles || prev.radius,
      }))
      setCenterLat(platformConfig.centerLat || 33.749)
      setCenterLng(platformConfig.centerLng || -84.388)
    }
  }, [platformConfig])

  // Geocode city name to coordinates
  const geocodeCity = useCallback(async (cityName: string) => {
    if (!cityName.trim() || !window.google?.maps) return
    
    setIsGeocoding(true)
    try {
      const geocoder = new google.maps.Geocoder()
      const result = await geocoder.geocode({ address: cityName })
      
      if (result.results && result.results.length > 0) {
        const location = result.results[0].geometry.location
        setCenterLat(location.lat())
        setCenterLng(location.lng())
      }
    } catch (error) {
      console.error('Geocoding failed:', error)
    } finally {
      setIsGeocoding(false)
    }
  }, [])

  // Debounced geocoding when city changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (serviceArea.city && serviceArea.city !== platformConfig?.primaryCity) {
        geocodeCity(serviceArea.city)
      }
    }, 800)
    
    return () => clearTimeout(timer)
  }, [serviceArea.city, platformConfig?.primaryCity, geocodeCity])

  const handleSave = async () => {
    setLoading(true)
    try {
      await updateSetting({ key: "baseFee", value: pricing.baseFee })
      await updateSetting({ key: "additionalPackageFee", value: pricing.additionalPackageFee })
      await updateSetting({ key: "commissionPercent", value: pricing.commissionPercent })
      await updateSetting({ key: "serviceArea", value: serviceArea.city })
      await updateSetting({ key: "radius", value: serviceArea.radius })

      // Save platform config with map coordinates
      await updatePlatformConfig({
        primaryCity: serviceArea.city,
        radiusMiles: serviceArea.radius,
        centerLat,
        centerLng,
      })

      toast.success("Settings saved successfully!")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings")
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    if (settings) {
      setPricing({
        baseFee: (settings.baseFee as number) || 15.00,
        additionalPackageFee: (settings.additionalPackageFee as number) || 3.00,
        commissionPercent: (settings.commissionPercent as number) || 25,
      })
      setServiceArea({
        city: (settings.serviceArea as string) || 'New York',
        radius: (settings.radius as number) || 25,
      })

      if (platformConfig) {
        setCenterLat(platformConfig.centerLat || 33.749)
        setCenterLng(platformConfig.centerLng || -84.388)
      }

      toast.info("Settings reset to current values")
    }
  }

  if (settings === undefined) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Skeleton className="lg:col-span-2 h-[600px]" />
          <Skeleton className="h-[400px]" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Platform Configuration</h2>
          <p className="text-muted-foreground">Configure platform pricing, service areas, and global rules.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reset
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSave} disabled={loading}>
            <Save className="mr-2 h-4 w-4" /> {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" /> Pricing Configuration
              </CardTitle>
              <CardDescription>Set the fees for customers and commission from couriers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="baseFee">Base Delivery Fee</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input 
                      id="baseFee" 
                      type="number" 
                      className="pl-7 bg-card" 
                      value={pricing.baseFee}
                      onChange={(e) => setPricing({...pricing, baseFee: parseFloat(e.target.value)})}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">The minimum fee for any delivery.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="packageFee">Additional Package Fee</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input 
                      id="packageFee" 
                      type="number" 
                      className="pl-7 bg-card" 
                      value={pricing.additionalPackageFee}
                      onChange={(e) => setPricing({...pricing, additionalPackageFee: parseFloat(e.target.value)})}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Charged per additional item in a single job.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commission">Platform Commission</Label>
                  <div className="relative">
                    <Input 
                      id="commission" 
                      type="number" 
                      className="pr-7 bg-card" 
                      value={pricing.commissionPercent}
                      onChange={(e) => setPricing({...pricing, commissionPercent: parseInt(e.target.value)})}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><Percent className="h-4 w-4" /></span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">The percentage Droppit takes from each job.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" /> Service Area
              </CardTitle>
              <CardDescription>Define the geographical boundaries for Droppit operations.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="city">Primary Region/City</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="city" 
                      className="pl-10 bg-card" 
                      value={serviceArea.city}
                      onChange={(e) => setServiceArea({...serviceArea, city: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="radius">Operation Radius (miles)</Label>
                  <Input 
                    id="radius" 
                    type="number" 
                    className="bg-card" 
                    value={serviceArea.radius}
                    onChange={(e) => setServiceArea({...serviceArea, radius: parseInt(e.target.value)})}
                  />
                </div>
              </div>
              <AdminServiceAreaMap 
                center={{ lat: centerLat, lng: centerLng }}
                radiusMiles={serviceArea.radius || 25}
              />
              <p className="text-xs text-muted-foreground text-center mt-2">
                {isGeocoding ? (
                  <span className="flex items-center justify-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Locating city...
                  </span>
                ) : (
                  `Coverage: ${serviceArea.radius} miles from ${serviceArea.city}`
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider text-muted-foreground">General Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">Auto-approve Couriers</Label>
                  <p className="text-xs text-muted-foreground">Skip manual review for verified IDs</p>
                </div>
                <Switch />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">Surge Pricing</Label>
                  <p className="text-xs text-muted-foreground">Apply multipliers during peak hours</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">SMS Notifications</Label>
                  <p className="text-xs text-muted-foreground">Send updates to customers/couriers</p>
                </div>
                <Switch defaultChecked />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-primary flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" /> Safety First
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Changes to pricing and commission will take effect immediately for all new jobs. Existing jobs will keep their original pricing. 
                Always communicate major fee changes to your courier network in advance.
              </p>
              <Button variant="outline" size="sm" className="w-full mt-4 border-primary/20 hover:bg-primary/10 hover:text-primary">
                Download Audit Log
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function DataMigrationSection() {
  const migrationStatus = useQuery(api.couriers.checkMigrationStatus)
  const runMigration = useMutation(api.couriers.migrateCouriers_v1)
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<{
    success: boolean;
    migratedCount: number;
    skippedCount: number;
    totalRecords: number;
  } | null>(null)

  const handleRunMigration = async () => {
    setIsRunning(true)
    setResult(null)
    try {
      const res = await runMigration({})
      setResult({
        success: res.success,
        migratedCount: res.migratedCount,
        skippedCount: res.skippedCount,
        totalRecords: res.totalRecords,
      })
      toast.success(`Migration complete! ${res.migratedCount} records updated.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Migration failed')
    } finally {
      setIsRunning(false)
    }
  }

  if (migrationStatus === undefined) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Data Migration</h2>
        <p className="text-muted-foreground">Run one-time migrations to normalize database records.</p>
      </div>

      {/* Migration Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            Courier Data Migration v1
          </CardTitle>
          <CardDescription>
            Normalizes courier records to use a single source of truth for status fields.
            Safe to run multiple times (idempotent).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Status */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold">{migrationStatus?.totalRecords ?? 0}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Total Records</div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{migrationStatus?.alreadyNormalized ?? 0}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Normalized</div>
            </div>
            <div className={`rounded-lg p-4 text-center ${(migrationStatus?.needsMigration ?? 0) > 0 ? 'bg-yellow-500/10' : 'bg-green-500/10'}`}>
              <div className={`text-2xl font-bold ${(migrationStatus?.needsMigration ?? 0) > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                {migrationStatus?.needsMigration ?? 0}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Need Migration</div>
            </div>
          </div>

          {/* Issues List */}
          {migrationStatus?.issues && migrationStatus.issues.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Issues Found ({migrationStatus.issues.length})
              </h4>
              <div className="bg-muted/30 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                {migrationStatus.issues.map((issue, i) => (
                  <div key={i} className="text-xs text-muted-foreground">
                    <span className="font-medium">{issue.email}:</span> {issue.issue}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Migration Result */}
          {result && (
            <div className={`rounded-lg p-4 ${result.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
              <div className="flex items-center gap-2 mb-2">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                )}
                <span className="font-medium">{result.success ? 'Migration Complete' : 'Migration Failed'}</span>
              </div>
              {result.success && (
                <div className="text-sm text-muted-foreground">
                  Migrated: {result.migratedCount} | Skipped: {result.skippedCount} | Total: {result.totalRecords}
                </div>
              )}
            </div>
          )}

          {/* Run Button */}
          <div className="flex items-center gap-4 pt-2">
            <Button 
              onClick={handleRunMigration} 
              disabled={isRunning || (migrationStatus?.needsMigration ?? 0) === 0}
              className="gap-2"
            >
              {isRunning ? (
                <>
                  <RefreshIcon className="h-4 w-4 animate-spin" />
                  Running Migration...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Migration
                </>
              )}
            </Button>
            {(migrationStatus?.needsMigration ?? 0) === 0 && !result && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                All records are already normalized
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardHeader>
          <CardTitle className="text-blue-600 flex items-center gap-2 text-sm">
            <Database className="h-4 w-4" /> Migration Details
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p><strong>What this migration does:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Syncs <code>verificationStatus</code> with <code>status</code> field</li>
            <li>Forces non-approved couriers offline</li>
            <li>Copies denial reasons between fields</li>
            <li>Sets <code>verifiedAt</code> for approved couriers</li>
          </ul>
          <p className="pt-2"><strong>Safe to run multiple times</strong> - only updates records that need changes.</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AdminSettings() {
  return (
    <AdminAppShell>
      <div className="space-y-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Settings className="w-8 h-8 text-primary" />
              Settings
            </h1>
            <p className="text-muted-foreground">Manage platform configuration and your admin account credentials.</p>
          </div>

          <Tabs defaultValue="platform" className="space-y-6">
            <TabsList className="bg-muted/50 p-1">
              <TabsTrigger value="platform" className="gap-2">
                <Globe className="w-4 h-4" />
                Platform Configuration
              </TabsTrigger>
              <TabsTrigger value="credentials" className="gap-2">
                <ShieldCheck className="w-4 h-4" />
                Admin Credentials
              </TabsTrigger>
              <TabsTrigger value="migration" className="gap-2">
                <Database className="w-4 h-4" />
                Data Migration
              </TabsTrigger>
            </TabsList>

            <TabsContent value="platform" className="space-y-6 outline-none">
              <PlatformSettingsSection />
            </TabsContent>

            <TabsContent value="credentials" className="space-y-6 outline-none">
              <AdminCredentialsSection />
            </TabsContent>

            <TabsContent value="migration" className="space-y-6 outline-none">
              <DataMigrationSection />
            </TabsContent>
          </Tabs>
        </div>
      </AdminAppShell>
  )
}
