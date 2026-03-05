import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { UserRole } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Package, Mail, Lock, User, Loader2, Shield, AlertCircle, Phone } from 'lucide-react'
import { useAuthActions } from "@convex-dev/auth/react"
import { useMutation } from "convex/react"
import { api } from "@convex/api"

export function AuthForm() {
  const [role, setRole] = useState<UserRole>('customer')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logoTaps, setLogoTaps] = useState(0)
  const [showAdminHint, setShowAdminHint] = useState(false)
  const navigate = useNavigate()

  const { signIn, signOut } = useAuthActions()
  const createOrUpdateProfile = useMutation(api.profiles.createOrUpdateProfile)
  const ensureProfile = useMutation(api.profiles.ensureProfileExists)

  const handleLogoTap = () => {
    const newCount = logoTaps + 1
    setLogoTaps(newCount)
    
    if (newCount >= 5) {
      setShowAdminHint(true)
      setTimeout(() => setShowAdminHint(false), 5000)
      setLogoTaps(0)
    }
    
    setTimeout(() => setLogoTaps(0), 2000)
  }

  // Reset error when switching modes
  useEffect(() => {
    setError(null)
  }, [isLogin, role])

const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[USER_AUTH_FORM] Attempting user auth for:', email, 'flow:', isLogin ? 'signIn' : 'signUp')
    setError(null)
    
    if (!email || !password || (!isLogin && (!name || !phone))) {
      setError('Please fill in all fields')
      return
    }

    if (!isLogin) {
      const digits = phone.replace(/\D/g, '')
      if (digits.length < 10) {
        setError('Please enter a valid phone number (10+ digits)')
        return
      }
    }

    setIsLoading(true)
    
    try {
      const flow = isLogin ? "signIn" : "signUp"
      
      // Step 1: Sign in/up with Convex Auth
      try {
        await signIn("password", { email, password, flow, name, phone })
        console.log('[USER_AUTH_FORM] Convex Auth signIn successful')
      } catch (authError: any) {
        console.error('[USER_AUTH_FORM] Auth error:', authError)
        const msg = String(authError?.message || authError)
        
        if (msg.includes("InvalidAccountId") || msg.includes("InvalidSecret") || msg.includes("invalid")) {
          setError("Invalid email or password")
        } else if (msg.includes("already exists") || msg.includes("already registered")) {
          setError("An account with this email already exists. Please sign in instead.")
        } else {
          setError(msg || "Authentication failed. Please try again.")
        }
        setIsLoading(false)
        return
      }
      
      // Step 2: Wait for session to propagate
      await new Promise(r => setTimeout(r, 500))
      
      // Step 3: Handle signup vs login
      if (!isLogin) {
        // SIGNUP: Create profile
        try {
          await createOrUpdateProfile({ 
            role: role as "customer" | "courier" | "admin", 
            name, 
            email,
            phone
          })
          toast.success('Account created successfully!')
          
          // Redirect based on role
          if (role === 'courier') {
            navigate('/courier/onboarding', { replace: true })
          } else {
            navigate('/customer/dashboard', { replace: true })
          }
        } catch (profileError: any) {
          // User is authenticated but profile failed - still redirect, they can retry
          toast.warning('Account created. Setting up profile...')
          if (role === 'courier') {
            navigate('/courier/onboarding', { replace: true })
          } else {
            navigate('/customer/dashboard', { replace: true })
          }
        }
      } else {
        // LOGIN: Verify profile exists and redirect
        try {
          const profileInfo = await ensureProfile({ intendedRole: role as "customer" | "courier" | "admin" })
          
          if (!profileInfo.exists) {
            setError("No account found with this email. Please sign up first.")
            setIsLoading(false)
            return
          }
          
          // Redirect based on actual role (not selected role)
          const actualRole = profileInfo.role

          // Notify if role doesn't match selected tab
          if (actualRole !== role) {
            if (actualRole === 'admin') {
              toast.error("This account is registered as an Admin. Please use the admin login page.")
            } else {
              toast.error(`This account is registered as a ${actualRole}. Please use the ${actualRole} tab to login.`)
            }
            // CRITICAL: sign out to clear the session and stay on login page
            if (signOut) {
              await signOut()
            }
            setIsLoading(false)
            return
          }

          toast.success('Welcome back!')

          if (actualRole === 'courier') {
            const status = profileInfo.courierStatus
            if (status === 'approved') {
              navigate('/courier/dashboard', { replace: true })
            } else if (status === 'draft' || !status) {
              navigate('/courier/onboarding', { replace: true })
            } else {
              navigate('/courier/status', { replace: true })
            }
          } else if (actualRole === 'admin') {
            navigate('/admin/dashboard', { replace: true })
          } else {
            navigate('/customer/dashboard', { replace: true })
          }
        } catch (profileError: any) {
          const msg = String(profileError?.message || profileError)
          
          if (msg.includes('SESSION_NOT_ESTABLISHED') || msg.includes('sign in')) {
            setError('Session error. Please try again.')
          } else {
            // User is authenticated, just redirect to home and let AuthLayout handle it
            navigate('/', { replace: true })
          }
        }
      }
    } catch (error: any) {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <div onClick={handleLogoTap} className="flex flex-col items-center text-center space-y-2 cursor-pointer select-none">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 rotate-3">
            <Package className="text-primary-foreground w-10 h-10" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mt-4">Droppit</h1>
          <p className="text-muted-foreground">On-demand package pickup & delivery</p>
        </div>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm relative">
          <CardHeader>
            <Tabs defaultValue="customer" onValueChange={(v) => setRole(v as UserRole)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="customer" disabled={isLoading}>Customer</TabsTrigger>
                <TabsTrigger value="courier" disabled={isLoading}>Courier</TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-xs text-muted-foreground text-center mt-2">
              {isLogin 
                ? "Sign in to your existing account" 
                : `Create a new ${role} account`}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="name" 
                        placeholder="John Doe" 
                        className="pl-10"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        id="phone" 
                        type="tel"
                        placeholder="(555) 123-4567" 
                        className="pl-10"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@example.com" 
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type="password" 
                    className="pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-12 text-lg font-semibold rounded-xl" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isLogin ? 'Signing in...' : 'Creating account...'}
                  </>
                ) : (
                  isLogin ? 'Sign In' : 'Create Account'
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button 
              variant="link" 
              onClick={() => setIsLogin(!isLogin)}
              className="text-muted-foreground"
              disabled={isLoading}
            >
              {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </Button>
          </CardFooter>
        </Card>
        
        {showAdminHint && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4">
            <Button
              variant="outline"
              size="sm"
              className="border-primary/30 text-primary"
              onClick={() => navigate('/admin-login')}
            >
              <Shield className="w-4 h-4 mr-2" />
              Admin Access
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
