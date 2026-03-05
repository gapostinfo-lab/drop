import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation, Outlet } from 'react-router'
import { useConvexAuth, useQuery } from "convex/react"
import { useAuthActions } from "@convex-dev/auth/react"
import { api } from "@convex/api"
import { Loader2, Package, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { hasStoredTokens } from '@/lib/auth-storage'

// Routes that don't require Convex Auth (admin uses separate auth)
const PUBLIC_ROUTES = [
  '/', 
  '/auth', 
  '/book',
  '/admin-login',
  '/admin/login',
  '/admin',           // Add all admin routes
  '/admin/dashboard',
  '/admin/couriers',
  '/admin/jobs',
  '/admin/transactions',
  '/admin/settings',
  '/admin/logs',
  '/admin/readiness',
  '/admin/payouts',
  '/admin/payments',
  '/admin/locations',
  '/admin/health',
  '/admin/profile',
  '/admin/force-change-password',
  '/payment/success',
  '/payment/cancel',
  '/terms',
  '/privacy',
]

// Role-based dashboard routes (admin excluded - uses separate auth)
const ROLE_DASHBOARDS: Record<string, string> = {
  customer: '/customer/dashboard',
  courier: '/courier/status',
}

// Routes each role can access (prefixes) - admin excluded
const ROLE_ROUTES: Record<string, string[]> = {
  customer: ['/customer', '/payment', '/profile'],
  courier: ['/courier', '/payment', '/profile'],
}

const LOADING_TIMEOUT_MS = 10000 // 10 second timeout

export function AuthLayout() {
  const location = useLocation()
  const currentPath = location.pathname
  
  // EARLY RETURN: For public routes, render immediately without any auth checks
  const isPublicPath = currentPath === '/' || 
    currentPath === '/auth' || 
    currentPath === '/terms' || 
    currentPath === '/privacy' ||
    currentPath === '/book' ||
    currentPath.startsWith('/admin') ||
    currentPath === '/admin-login' ||
    currentPath.startsWith('/payment/')
  
  // For public routes, skip ALL auth logic and render immediately
  if (isPublicPath) {
    return <Outlet />
  }
  
  return <AuthGuard />
}

function AuthGuard() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth()
  const { signOut } = useAuthActions()
  const navigate = useNavigate()
  const location = useLocation()
  const [hasRedirected, setHasRedirected] = useState(false)
  const [authReady, setAuthReady] = useState(false) // Tracks when auth is fully ready
  const [error, setError] = useState<{
    type: 'timeout' | 'profile_missing' | 'network' | 'unknown';
    message: string;
  } | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const restorationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Track auth ready state - CRITICAL for PWA
  useEffect(() => {
    // Clear any existing restoration timeout
    if (restorationTimeoutRef.current) {
      clearTimeout(restorationTimeoutRef.current);
      restorationTimeoutRef.current = null;
    }

    if (authLoading) {
      // Still loading, not ready
      return;
    }
    
    // Auth loading complete
    const tokensExist = hasStoredTokens();
    
    if (isAuthenticated) {
      // Authenticated - ready!
      console.log('[AUTH_GUARD] Auth ready: authenticated');
      setAuthReady(true);
    } else if (!tokensExist) {
      // No tokens and not authenticated - ready (but logged out)
      console.log('[AUTH_GUARD] Auth ready: no tokens');
      setAuthReady(true);
    } else {
      // Has tokens but not authenticated - give Convex more time to refresh
      // This is the PWA cold start case
      console.log('[AUTH_GUARD] Tokens exist, waiting for Convex to restore session...');
      
      // Wait up to 5 seconds for session restoration
      restorationTimeoutRef.current = setTimeout(() => {
        console.log('[AUTH_GUARD] Session restoration timeout - marking ready');
        setAuthReady(true);
      }, 5000);
    }

    return () => {
      if (restorationTimeoutRef.current) {
        clearTimeout(restorationTimeoutRef.current);
      }
    };
  }, [authLoading, isAuthenticated]);

  // Fetch profile
  const profile = useQuery(
    api.profiles.getMyProfile,
    isAuthenticated ? {} : "skip"
  )

  // For couriers, get application status
  const courierApplication = useQuery(
    api.couriers.getMyApplication,
    isAuthenticated && profile?.role === 'courier' ? {} : "skip"
  )

  // Loading state
  const isProfileLoading = isAuthenticated && profile === undefined
  const isCourierLoading = profile?.role === 'courier' && courierApplication === undefined
  const isLoading = authLoading || isProfileLoading || isCourierLoading

  // Derived values
  const currentPath = location.pathname
  const isAdminRoute = currentPath.startsWith('/admin') || currentPath === '/admin-login'
  const isPublicRoute = PUBLIC_ROUTES.some(route => 
    currentPath === route || (route !== '/' && currentPath.startsWith(route + '/'))
  ) || currentPath === '/'

  const role = profile?.role as 'customer' | 'courier' | 'admin' | undefined
  const isApprovedCourier = courierApplication?.status === 'approved'

  // Set up loading timeout
  useEffect(() => {
    if (isLoading && !error) {
      timeoutRef.current = setTimeout(() => {
        setError({
          type: 'timeout',
          message: 'Loading took too long. This may be due to a slow connection or a temporary issue.'
        })
      }, LOADING_TIMEOUT_MS)
    } else if (!isLoading && timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isLoading, error])

  // Check for profile missing error
  useEffect(() => {
    if (isAuthenticated && !authLoading && profile === null && !isProfileLoading) {
      // Authenticated but no profile after loading complete
      // This is an error state
      setError({
        type: 'profile_missing',
        message: 'Your account profile could not be found. This may happen if your signup was interrupted.'
      })
    }
  }, [isAuthenticated, authLoading, profile, isProfileLoading])

  useEffect(() => {
    // IMPORTANT: Don't redirect until authReady
    if (!authReady) {
      console.log('[AUTH_GUARD] Waiting for auth to be ready...');
      return; // Don't do any redirects until ready
    }

    if (isLoading && !error) {
      setHasRedirected(false)
      return
    }

    const currentPath = location.pathname
    const fromPath = (location.state as { from?: string })?.from

    // Admin routes use separate auth - don't interfere
    if (isAdminRoute) {
      return // Let admin routes handle their own auth via AdminProvider
    }

    // AUTHENTICATED USER
    if (isAuthenticated && role) {
      // Skip redirect for admin role - admin uses separate auth system
      if (role === 'admin') {
        return // Let them stay on public routes, admin auth is separate
      }
      
      // On public routes (except payment), redirect to dashboard
      if (isPublicRoute && !currentPath.startsWith('/payment')) {
        if (!hasRedirected) {
          // If we have a "from" path and user can access it, go there
          if (fromPath && canAccessRoute(role, fromPath)) {
            setHasRedirected(true)
            navigate(fromPath, { replace: true })
            return
          }
          
          // Otherwise go to role-specific dashboard
          let dashboard = ROLE_DASHBOARDS[role]
          if (role === 'courier') {
            // Check courier application status
            const courierStatus = courierApplication?.status
            if (courierStatus === 'approved') {
              dashboard = '/courier/dashboard'
            } else if (courierStatus === 'draft' || !courierApplication) {
              dashboard = '/courier/onboarding'
            } else {
              dashboard = '/courier/status'
            }
          }
          
          if (dashboard && currentPath !== dashboard) {
            setHasRedirected(true)
            navigate(dashboard, { replace: true })
          }
        }
        return
      }

      // Check route access
      if (!canAccessRoute(role, currentPath) && !isPublicRoute) {
        // Redirect to their dashboard
        let dashboard = ROLE_DASHBOARDS[role]
        if (role === 'courier') {
          dashboard = isApprovedCourier ? '/courier/dashboard' : '/courier/status'
        }
        navigate(dashboard, { replace: true })
        return
      }
    }
    
    // AUTHENTICATED but no profile yet - might be new signup
    if (isAuthenticated && !role && !isLoading) {
      // Don't redirect, let the page handle it
    }
    
    // NOT AUTHENTICATED - trying to access protected route
    // authReady ensures we've waited for token restoration
    if (!isAuthenticated && !isPublicRoute && !isAdminRoute) {
      // No tokens or restoration failed - safe to redirect to auth
      console.log('[AUTH_GUARD] Auth ready but not authenticated, redirecting to /auth');
      navigate('/auth', { replace: true, state: { from: currentPath } })
    }
  }, [authReady, isAuthenticated, isLoading, error, role, isApprovedCourier, courierApplication, location.pathname, navigate, hasRedirected, location.state, isPublicRoute, isAdminRoute])

  // Reset redirect flag when path changes
  useEffect(() => {
    setHasRedirected(false)
  }, [location.pathname])

  // Handle potential stale auth state - log for debugging but don't interfere
  // The authReady state now handles the waiting logic properly
  useEffect(() => {
    if (authReady && !isAuthenticated && hasStoredTokens()) {
      console.log('[AUTH_GUARD] Auth ready but tokens exist without authentication - tokens may be expired');
      // Don't clear tokens automatically - let user manually sign out if needed
      // This prevents accidental logouts on slow connections
    }
  }, [authReady, isAuthenticated])

  // Handle retry
  const handleRetry = () => {
    setError(null)
    window.location.reload()
  }

  const handleSignOutAndRetry = async () => {
    try {
      await signOut()
      // Only remove Convex auth related keys, not everything
      localStorage.removeItem('convex-auth-token')
      localStorage.removeItem('convex-auth-refresh-token')
      // Don't clear sessionStorage entirely - it might affect other things
    } catch (e) {
      // Ignore errors
    }
    window.location.href = '/auth'
  }

  // Show error UI
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 p-8 max-w-md text-center">
          <AlertCircle className="text-destructive w-16 h-16" />
          <div className="space-y-2">
            <h2 className="text-xl font-bold">
              {error.type === 'timeout' ? 'Loading took too long' : 
               error.type === 'profile_missing' ? 'Profile Not Found' :
               error.type === 'network' ? 'Network Error' : 'Something went wrong'}
            </h2>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
          <div className="flex flex-col gap-3 w-full">
            <Button onClick={handleRetry} className="w-full gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            <Button variant="outline" onClick={handleSignOutAndRetry} className="w-full">
              Sign Out and Start Over
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Show loading while auth is being restored
  if (!authReady && !isPublicRoute && !isAdminRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 animate-pulse">
            <Package className="text-primary-foreground w-10 h-10" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Restoring session...</p>
          </div>
        </div>
      </div>
    )
  }

  // Also show loading while profile is being fetched after auth is ready
  if (isLoading && !isPublicRoute && !isAdminRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 animate-pulse">
            <Package className="text-primary-foreground w-10 h-10" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return <Outlet />
}

// Helper to check if a role can access a route
function canAccessRoute(role: string, path: string): boolean {
  const allowedPrefixes = ROLE_ROUTES[role] || []
  return allowedPrefixes.some(prefix => path.startsWith(prefix))
}
