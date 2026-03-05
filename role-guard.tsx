import { useAuth } from '@/hooks/use-auth'
import { Navigate, useLocation } from 'react-router'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: ('customer' | 'courier' | 'admin')[]
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const { isAuthenticated, isLoading, role } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }

  // Check if trying to access admin routes without admin role
  if (allowedRoles.includes('admin') && role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Unauthorized</h1>
            <p className="text-muted-foreground mt-2">
              You do not have permission to access this area. This incident has been logged.
            </p>
          </div>
          <Button onClick={() => window.history.back()} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  if (!role || !allowedRoles.includes(role as any)) {
    // Redirect to appropriate dashboard based on role
    const redirectPath = role === 'courier' ? '/courier/dashboard' 
                       : role === 'admin' ? '/admin/dashboard'
                       : '/customer/dashboard'
    return <Navigate to={redirectPath} replace />
  }

  return <>{children}</>
}
