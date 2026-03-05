import { ReactNode, useState } from 'react'
import { NavLink, useNavigate } from 'react-router'
import { useAuth } from '@/hooks/use-auth'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@convex/api'
import { 
  Home, 
  Package, 
  History, 
  User, 
  Settings, 
  DollarSign, 
  Users, 
  LayoutDashboard, 
  LogOut,
  Shield,
  MapPin,
  FileText,
  Rocket,
  CreditCard,
  MessageSquare
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { useIsMobile } from '@/hooks/use-is-mobile'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { toast } from 'sonner'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { role, signOut, userName, isApprovedCourier } = useAuth()
  const courierApplication = useQuery(
    api.couriers.getMyApplication,
    role === 'courier' ? {} : 'skip'
  )
  const profileImageUrl = useQuery(api.profiles.getProfileImageUrl)
  const toggleOnlineMutation = useMutation(api.couriers.toggleOnline)
  const [isTogglingOnline, setIsTogglingOnline] = useState(false)
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  // Get online status from Convex
  const isOnline = courierApplication?.isOnline ?? false
  const courierStatus = courierApplication?.status

  const handleToggleOnline = async () => {
    if (isTogglingOnline) return // Prevent double-tap
    
    setIsTogglingOnline(true)
    try {
      const newOnlineState = !isOnline
      const result = await toggleOnlineMutation({ isOnline: newOnlineState })
      toast.success(result.isOnline ? "You're now online!" : "You're now offline")
    } catch (error: any) {
      console.error('[APP_SHELL] toggleOnline error:', error)
      
      // ConvexError has a 'data' property with the error code
      const errorData = error?.data
      const message = error?.message || String(error)
      
      if (errorData === 'UNAUTHENTICATED' || message.includes('UNAUTHENTICATED')) {
        toast.error('Session expired. Please sign in again.')
        navigate('/auth')
      } else if (errorData === 'COURIER_NOT_FOUND_CREATED_PENDING' || message.includes('COURIER_NOT_FOUND_CREATED_PENDING')) {
        toast.info('Complete your profile to go online.')
        navigate('/courier/onboarding')
      } else if (errorData === 'COURIER_NOT_APPROVED' || message.includes('COURIER_NOT_APPROVED')) {
        toast.info('Verification pending. You can\'t go online until approved.')
      } else if (errorData === 'PAYOUT_REQUIRED' || message.includes('PAYOUT_REQUIRED')) {
        toast.error('Complete payout setup in your Profile first.')
        navigate('/courier/profile')
      } else {
        toast.error(message || 'Failed to update status')
      }
    } finally {
      setIsTogglingOnline(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    toast.success('Logged out successfully')
  }

  const currentRole = (role || 'customer') as 'customer' | 'courier' | 'admin'

  const courierNavItems = isApprovedCourier 
    ? [
        { icon: Home, label: 'Dashboard', path: '/courier/dashboard' },
        { icon: MapPin, label: 'Available Jobs', path: '/courier/available-jobs' },
        { icon: Package, label: 'Active Job', path: '/courier/active-job' },
        { icon: DollarSign, label: 'Earnings', path: '/courier/earnings' },
        { icon: MessageSquare, label: 'Support', path: '/courier/support' },
        { icon: User, label: 'Profile', path: '/profile' },
      ]
    : [
        { icon: FileText, label: 'Application Status', path: '/courier/status' },
        { icon: MessageSquare, label: 'Support', path: '/courier/support' },
        { icon: User, label: 'Profile', path: '/profile' },
      ]

  const navItems = ({
    customer: [
      { icon: Home, label: 'Home', path: '/customer/dashboard' },
      { icon: Package, label: 'Book', path: '/customer/book' },
      { icon: History, label: 'History', path: '/customer/history' },
      { icon: MessageSquare, label: 'Support', path: '/customer/support' },
      { icon: User, label: 'Profile', path: '/profile' },
    ],
    courier: courierNavItems,
    admin: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
      { icon: Rocket, label: 'Launch Readiness', path: '/admin/readiness' },
      { icon: Users, label: 'Couriers', path: '/admin/couriers' },
      { icon: Package, label: 'Jobs', path: '/admin/jobs' },
      { icon: DollarSign, label: 'Payments', path: '/admin/payments' },
      { icon: DollarSign, label: 'Transactions', path: '/admin/transactions' },
      { icon: CreditCard, label: 'Payouts', path: '/admin/payouts' },
      { icon: Shield, label: 'Activity Log', path: '/admin/logs' },
      { icon: MapPin, label: 'Locations', path: '/admin/locations' },
      { icon: MessageSquare, label: 'Support', path: '/admin/support' },
      { icon: Settings, label: 'Settings', path: '/admin/settings' },
      { icon: User, label: 'Profile', path: '/profile' },
    ],
  }[currentRole]) || []

  const mobileNavItems = {
    customer: [
      { icon: Home, label: 'Home', path: '/customer/dashboard' },
      { icon: Package, label: 'Book', path: '/customer/book' },
      { icon: History, label: 'History', path: '/customer/history' },
      { icon: MessageSquare, label: 'Support', path: '/customer/support' },
      { icon: User, label: 'Profile', path: '/profile' },
    ],
    courier: isApprovedCourier 
      ? [
          { icon: Home, label: 'Dashboard', path: '/courier/dashboard' },
          { icon: MapPin, label: 'Jobs', path: '/courier/available-jobs' },
          { icon: Package, label: 'Active', path: '/courier/active-job' },
          { icon: MessageSquare, label: 'Support', path: '/courier/support' },
          { icon: User, label: 'Profile', path: '/profile' },
        ]
      : [
          { icon: FileText, label: 'Status', path: '/courier/status' },
          { icon: MessageSquare, label: 'Support', path: '/courier/support' },
          { icon: User, label: 'Profile', path: '/profile' },
        ],
    admin: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
      { icon: Users, label: 'Couriers', path: '/admin/couriers' },
      { icon: Package, label: 'Jobs', path: '/admin/jobs' },
      { icon: MessageSquare, label: 'Support', path: '/admin/support' },
      { icon: Settings, label: 'Settings', path: '/admin/settings' },
      { icon: User, label: 'Profile', path: '/profile' },
    ],
  }[currentRole] || []

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="w-64 border-r border-border bg-card flex flex-col h-screen sticky top-0">
          <div className="p-6 flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Package className="text-primary-foreground w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">Droppit</span>
          </div>

          <nav className="flex-1 px-4 py-2 space-y-1">
            {navItems.map((item: any) => (
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

          <div className="p-4 border-t border-border space-y-4">
            {currentRole === 'courier' && courierStatus === 'approved' && (
              <div className="bg-muted/50 p-4 rounded-xl flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Go Online</p>
                  <p className="text-xs text-muted-foreground">{isOnline ? 'Active' : 'Offline'}</p>
                </div>
                <Switch 
                  checked={isOnline} 
                  onCheckedChange={handleToggleOnline}
                  disabled={isTogglingOnline || courierStatus !== 'approved'}
                />
              </div>
            )}
            
            <div className="flex items-center gap-3 p-2">
              <Avatar>
                {profileImageUrl ? (
                  <AvatarImage src={profileImageUrl} alt={userName || 'User'} />
                ) : (
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}`} />
                )}
                <AvatarFallback>{userName?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{userName || 'User'}</p>
                <p className="text-xs text-muted-foreground truncate capitalize">{currentRole}</p>
              </div>
              <NotificationBell type={currentRole} isAdmin={role === 'admin'} />
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
                <Package className="text-primary-foreground w-5 h-5" />
              </div>
              <span className="font-bold text-lg tracking-tight">Droppit</span>
          </div>
          <div className="flex items-center gap-2">
            {currentRole === 'courier' && courierStatus === 'approved' && (
              <Switch 
                checked={isOnline} 
                onCheckedChange={handleToggleOnline}
                disabled={isTogglingOnline || courierStatus !== 'approved'}
              />
            )}
            <NotificationBell type={currentRole} isAdmin={role === 'admin'} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="w-8 h-8">
                    {profileImageUrl ? (
                      <AvatarImage src={profileImageUrl} alt={userName || 'User'} />
                    ) : (
                      <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}`} />
                    )}
                    <AvatarFallback>{userName?.[0]}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(`/profile`)}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          <div className="max-w-5xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <nav className="h-20 border-t border-border bg-card/80 backdrop-blur-md fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2 pb-safe">
            {mobileNavItems.map((item: any) => (
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
