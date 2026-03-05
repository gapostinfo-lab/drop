import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useMutation } from 'convex/react'
import { api } from '@convex/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Shield, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'

export default function ForceChangePasswordPage() {
  const navigate = useNavigate()
  const changePassword = useMutation(api.adminAuth.changeAdminPassword)
  
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const adminEmail = localStorage.getItem('adminEmail')

  // Redirect if not logged in
  useEffect(() => {
    if (!adminEmail || localStorage.getItem('adminLoggedIn') !== 'true') {
      navigate('/admin-login')
    }
  }, [adminEmail, navigate])

  // Password strength indicators
  const hasMinLength = newPassword.length >= 10
  const hasUppercase = /[A-Z]/.test(newPassword)
  const hasLowercase = /[a-z]/.test(newPassword)
  const hasNumber = /[0-9]/.test(newPassword)
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)

    try {
      await changePassword({
        email: adminEmail!,
        currentPassword,
        newPassword,
      })
      
      toast.success('Password changed successfully')
      navigate('/admin/dashboard')
    } catch (err: any) {
      const message = err?.data || err?.message || 'Failed to change password'
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const StrengthIndicator = ({ met, label }: { met: boolean; label: string }) => (
    <div className={`flex items-center gap-2 text-xs ${met ? 'text-green-500' : 'text-muted-foreground'}`}>
      {met ? <CheckCircle className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-muted-foreground" />}
      {label}
    </div>
  )

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />

      <Card className="w-full max-w-md relative z-10 bg-card/80 backdrop-blur-xl border-amber-500/30">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/30">
            <Shield className="w-8 h-8 text-amber-500" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-amber-500">Password Change Required</CardTitle>
            <CardDescription className="text-muted-foreground">
              For security, you must set a new password before continuing
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showPasswords ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="bg-background/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="bg-background/50"
                />
              </div>
              
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
                  disabled={isLoading}
                  className="bg-background/50"
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
              disabled={isLoading || !hasMinLength || !hasUppercase || !hasLowercase || !hasNumber || !passwordsMatch}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Updating...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Set New Password
                </div>
              )}
            </Button>

            <div className="pt-4 border-t border-border/50">
              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={async () => {
                  try {
                    // For now, just navigate to dashboard
                    // The admin route will handle the mustChangePassword check
                    toast.info('Skipping password change...')
                    navigate('/admin/dashboard')
                  } catch (err) {
                    toast.error('Failed to skip')
                  }
                }}
              >
                Skip for now (not recommended)
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
