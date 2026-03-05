import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useMutation } from 'convex/react'
import { api } from '@convex/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Shield, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAdmin } from '@/contexts/admin-context'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const adminLogin = useMutation(api.adminAuth.adminLogin)
  const { login } = useAdmin()

  // SAFETY GUARD: Only run on /admin-login route
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/admin-login')) {
      console.error('[AdminLoginPage] ERROR: Mounted on wrong route:', window.location.pathname)
      return
    }
  }, [])

  // Early return if not on correct route
  if (typeof window !== 'undefined' && !window.location.pathname.includes('/admin-login')) {
    console.error('[AdminLoginPage] Blocked: wrong route', window.location.pathname)
    return null
  }
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showInitAdmin, setShowInitAdmin] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const ensureAdminMutation = useMutation(api.adminAuth.ensureAdmin)

  const [searchParams] = useSearchParams()
  const showBootstrap = searchParams.get('bootstrap') === '1'
  const [bootstrapToken, setBootstrapToken] = useState('')
  const [bootstrapResult, setBootstrapResult] = useState<{
    exists?: boolean;
    hashLen?: number;
    email?: string | null;
    message?: string;
    created?: boolean;
  } | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(false)

  const bootstrapAdminMutation = useMutation(api.adminAuth.bootstrapAdmin)

  const handleBootstrap = async () => {
    if (!bootstrapToken.trim()) {
      toast.error('Please enter the bootstrap token')
      return
    }
    
    setIsBootstrapping(true)
    setBootstrapResult(null)
    
    try {
      // First, try to create the admin
      const createResult = await bootstrapAdminMutation({ token: bootstrapToken.trim() })
      console.log('[Bootstrap] Create result:', createResult)
      
      setBootstrapResult({
        exists: createResult.ok,
        created: createResult.created,
        email: createResult.email,
        hashLen: createResult.hashLen,
        message: createResult.message,
      })
      
      if (createResult.created) {
        toast.success('Admin created! You can now login.')
      } else {
        toast.info('Admin already exists. Try logging in.')
      }
    } catch (err: unknown) {
      console.error('[Bootstrap] Error:', err)
      const message = err instanceof Error ? err.message : 'Bootstrap failed'
      setBootstrapResult({ message })
      toast.error(message)
    } finally {
      setIsBootstrapping(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[ADMIN_LOGIN_PAGE] Attempting admin login for:', email)
    setError(null)
    setIsLoading(true)

    try {
      // Validate admin credentials against adminCredentials table
      const result = await adminLogin({ email, password })
      console.log('[ADMIN_LOGIN_PAGE] Admin validation result:', { 
        success: result.success, 
        email: result.email,
        hasToken: !!result.sessionToken 
      })
      
      if (!result.success) {
        throw new Error('Invalid credentials')
      }
      
      if (!result.sessionToken) {
        throw new Error('Session creation failed')
      }

      // Store admin session in context with the session token
      login(result.email, result.sessionToken)
      
      // Navigate based on password change requirement
      if (result.mustChangePassword) {
        toast.info('Please change your password to continue')
        navigate('/admin/force-change-password')
      } else {
        toast.success('Welcome, Administrator')
        navigate('/admin/dashboard')
      }
    } catch (err: unknown) {
      console.error('[ADMIN_LOGIN_PAGE] Error:', err)
      let message = 'Authentication failed'
      if (typeof err === 'string') {
        message = err
      } else if (err && typeof err === 'object') {
        const errObj = err as { data?: string | { message?: string }; message?: string }
        if (errObj.data) {
          message = typeof errObj.data === 'string' ? errObj.data : errObj.data.message || message
        } else if (errObj.message) {
          message = errObj.message
        }
      }
      
      // Show Initialize Admin button if admin not found
      if (message.includes('ADMIN_NOT_FOUND') || message.includes('not found')) {
        setShowInitAdmin(true)
      }
      
      setError(message)
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInitializeAdmin = async () => {
    setIsInitializing(true)
    try {
      const result = await ensureAdminMutation({})
      console.log('[ADMIN_LOGIN_PAGE] Initialize result:', result)
      if (result.created) {
        toast.success('Admin account initialized! Please login.')
        setShowInitAdmin(false)
        setError(null)
      } else {
        toast.info('Admin already exists. Try logging in.')
        setShowInitAdmin(false)
      }
    } catch (err) {
      console.error('[ADMIN_LOGIN_PAGE] Initialize error:', err)
      toast.error('Failed to initialize admin')
    } finally {
      setIsInitializing(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
      
      {/* Security grid pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 50px, rgba(57, 255, 20, 0.1) 50px, rgba(57, 255, 20, 0.1) 51px),
                           repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(57, 255, 20, 0.1) 50px, rgba(57, 255, 20, 0.1) 51px)`
        }} />
      </div>

      <Card className="w-full max-w-md relative z-10 bg-card/80 backdrop-blur-xl border-primary/20">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/30">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Admin Access</CardTitle>
            <CardDescription className="text-muted-foreground">
              Authorized personnel only
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            {showInitAdmin && (
              <Button
                type="button"
                variant="outline"
                className="w-full mt-2"
                onClick={handleInitializeAdmin}
                disabled={isInitializing}
              >
                {isInitializing ? 'Initializing...' : '🔧 Initialize Admin Account'}
              </Button>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@droppit.com"
                required
                disabled={isLoading}
                className="bg-background/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  className="bg-background/50 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Authenticating...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Sign In
                </div>
              )}
            </Button>
          </form>

          {showBootstrap && (
            <div className="mt-6 pt-6 border-t border-border/50">
              <div className="text-xs text-muted-foreground mb-3 font-mono">
                🔧 Bootstrap Mode (hidden)
              </div>
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="bootstrap-token" className="text-xs">Bootstrap Token</Label>
                  <Input
                    id="bootstrap-token"
                    type="password"
                    value={bootstrapToken}
                    onChange={(e) => setBootstrapToken(e.target.value)}
                    placeholder="Enter ADMIN_BOOTSTRAP_TOKEN"
                    className="bg-background/50 text-xs h-8"
                  />
                </div>
                
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm"
                  onClick={handleBootstrap}
                  disabled={isBootstrapping}
                  className="w-full text-xs"
                >
                  {isBootstrapping ? 'Bootstrapping...' : 'Bootstrap Admin'}
                </Button>
                
                {bootstrapResult && (
                  <div className="p-2 rounded bg-muted/50 text-xs font-mono space-y-1">
                    <div>exists: {String(bootstrapResult.exists ?? 'unknown')}</div>
                    <div>created: {String(bootstrapResult.created ?? 'n/a')}</div>
                    <div>email: {bootstrapResult.email ?? 'null'}</div>
                    <div>hashLen: {bootstrapResult.hashLen ?? 0}</div>
                    {bootstrapResult.message && <div>message: {bootstrapResult.message}</div>}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="absolute bottom-4 text-xs text-muted-foreground/50 text-center">
        Unauthorized access attempts are logged and monitored
      </p>
    </div>
  )
}
