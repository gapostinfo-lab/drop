import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ShieldX, Home, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router'

export default function UnauthorizedPage() {
  const { role, signOut, getDashboardUrl } = useAuth()
  const navigate = useNavigate()

  const handleGoToDashboard = () => {
    const dashboardUrl = getDashboardUrl()
    navigate(dashboardUrl, { replace: true })
  }

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full bg-slate-900/60 border-slate-700">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldX className="w-8 h-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-outfit">Access Denied</CardTitle>
          <CardDescription>
            You don't have permission to access this page.
            {role && (
              <span className="block mt-2">
                Your current role: <span className="font-medium capitalize text-foreground">{role}</span>
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            className="w-full" 
            onClick={handleGoToDashboard}
          >
            <Home className="w-4 h-4 mr-2" />
            Go to My Dashboard
          </Button>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out & Switch Account
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
