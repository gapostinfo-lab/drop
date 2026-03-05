import { Navigate, Outlet, useLocation } from 'react-router'
import { useAdmin } from '@/contexts/admin-context'
import { Loader2, Package } from 'lucide-react'

export function AdminRoute() {
  const { isAdminLoggedIn, isLoading } = useAdmin()
  const location = useLocation()

  // Show loading while checking session
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 animate-pulse">
            <Package className="text-primary-foreground w-10 h-10" />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Verifying admin session...</p>
          </div>
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!isAdminLoggedIn) {
    console.log('[AdminRoute] Not authenticated, redirecting to /admin-login')
    return <Navigate to="/admin-login" state={{ from: location.pathname }} replace />
  }

  // Render child routes
  return <Outlet />
}
