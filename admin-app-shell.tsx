import { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { useAdmin } from '@/contexts/admin-context'
import { 
  Package, 
  Users, 
  LayoutDashboard, 
  LogOut,
  Shield,
  MapPin,
  Settings,
  DollarSign,
  Rocket,
  CreditCard,
  FileText,
  MessageSquare,
  ShieldCheck
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { toast } from 'sonner'

interface AdminAppShellProps {
  children: ReactNode
}

export function AdminAppShell({ children }: AdminAppShellProps) {
  const { adminEmail, logout, isAdminLoggedIn } = useAdmin()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Logged out successfully')
      navigate('/admin-login')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Logout failed')
    }
  }

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
    { icon: Rocket, label: 'Launch Readiness', path: '/admin/readiness' },
    { icon: Users, label: 'Couriers', path: '/admin/couriers' },
    { icon: ShieldCheck, label: 'Verification', path: '/admin/verification' },
    { icon: MapPin, label: 'Live Couriers', path: '/admin/live-couriers' },
    { icon: Package, label: 'Jobs', path: '/admin/jobs' },
    { icon: DollarSign, label: 'Payments', path: '/admin/payments' },
    { icon: FileText, label: 'Transactions', path: '/admin/transactions' },
    { icon: CreditCard, label: 'Payouts', path: '/admin/payouts' },
    { icon: Shield, label: 'Activity Log', path: '/admin/logs' },
    { icon: MapPin, label: 'Locations', path: '/admin/locations' },
    { icon: MessageSquare, label: 'Support', path: '/admin/support' },
    { icon: Settings, label: 'Settings', path: '/admin/settings' },
  ]

  const mobileNavItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
    { icon: Users, label: 'Couriers', path: '/admin/couriers' },
    { icon: ShieldCheck, label: 'Verification', path: '/admin/verification' },
    { icon: MapPin, label: 'Live Couriers', path: '/admin/live-couriers' },
    { icon: Package, label: 'Jobs', path: '/admin/jobs' },
    { icon: MessageSquare, label: 'Support', path: '/admin/support' },
    { icon: Settings, label: 'Settings', path: '/admin/settings' },
  ]

  // If not logged in, don't render (AdminRoute should handle redirect)
  if (!isAdminLoggedIn) {
    return null
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="w-64 border-r border-border bg-card flex flex-col h-screen sticky top-0">
          <div className="p-6 flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Shield className="text-primary-foreground w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">Droppit Admin</span>
          </div>

          <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive 
                    ? "bg-primary text-primary-foreground font-semibold" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5", "group-hover:scale-110 transition-transform")} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 p-2">
              <Avatar>
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Shield className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{adminEmail || 'Admin'}</p>
                <p className="text-xs text-muted-foreground truncate">Administrator</p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </aside>
      )}

      {/* Mobile Top Bar */}
      {isMobile && (
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Shield className="text-primary-foreground w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight">Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          <div className="max-w-6xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <nav className="h-20 border-t border-border bg-card/80 backdrop-blur-md fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2 pb-safe">
          {mobileNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full rounded-xl transition-all duration-200 group",
                isActive 
                  ? "text-primary font-semibold active" 
                  : "text-muted-foreground"
              )}
            >
              <item.icon className="w-6 h-6 transition-all duration-200 group-[.active]:scale-110" />
              <span className="text-[10px] uppercase tracking-wider">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
