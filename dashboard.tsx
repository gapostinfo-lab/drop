import { AdminAppShell } from '@/components/layout/admin-app-shell'
import { StatsCard } from "@/components/admin/stats-card"
import { cn } from "@/lib/utils"
import { 
  DollarSign, 
  Package, 
  Users, 
  UserPlus, 
  ArrowRight,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Rocket,
  Star,
  TrendingUp,
  Activity,
  Wallet,
  Settings
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useNavigate, Link } from "react-router"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts'
import { useQuery } from "convex/react"
import { api } from "@convex/api"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"

import { useAdmin } from '@/contexts/admin-context'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { isAdminLoggedIn, isLoading: isAdminLoading, adminEmail } = useAdmin()
  
  // Debug logging (TEMP)
  console.log('[AdminDashboard] isAdminLoggedIn:', isAdminLoggedIn, 'isAdminLoading:', isAdminLoading, 'adminEmail:', adminEmail)
  
  // Only fetch data if admin is logged in
  const stats = useQuery(api.analytics.getPlatformStats, isAdminLoggedIn ? {} : "skip")
  const revenueByDay = useQuery(api.analytics.getRevenueByDay, isAdminLoggedIn ? { days: 7 } : "skip")
  const topCouriers = useQuery(api.analytics.getTopCouriers, isAdminLoggedIn ? { limit: 5 } : "skip")
  const allJobs = useQuery(api.jobs.listAllJobs, isAdminLoggedIn ? {} : "skip")
  const allCouriers = useQuery(api.couriers.listApplications, isAdminLoggedIn ? {} : "skip")
  const recentUsers = useQuery(api.profiles.listRecentUsers, isAdminLoggedIn ? { limit: 8 } : "skip")

  // Debug logging (TEMP)
  console.log('[AdminDashboard] Query states:', {
    stats: stats === undefined ? 'loading' : stats === null ? 'null' : 'loaded',
    revenueByDay: revenueByDay === undefined ? 'loading' : revenueByDay === null ? 'null' : 'loaded',
    topCouriers: topCouriers === undefined ? 'loading' : topCouriers === null ? 'null' : 'loaded',
    allJobs: allJobs === undefined ? 'loading' : allJobs === null ? 'null' : 'loaded',
    allCouriers: allCouriers === undefined ? 'loading' : allCouriers === null ? 'null' : 'loaded',
    recentUsers: recentUsers === undefined ? 'loading' : recentUsers === null ? 'null' : 'loaded',
  })

  // If admin context is still loading, show loading
  if (isAdminLoading) {
    return (
      <AdminAppShell>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Verifying admin session...</p>
          </div>
        </div>
      </AdminAppShell>
    )
  }

  // If not logged in as admin, show message
  if (!isAdminLoggedIn) {
    return (
      <AdminAppShell>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-xl font-bold">Admin Access Required</h2>
            <p className="text-muted-foreground">Please log in to access the admin dashboard.</p>
            <Button onClick={() => navigate('/admin-login')}>
              Go to Admin Login
            </Button>
          </div>
        </div>
      </AdminAppShell>
    )
  }

  // Check if any query is still loading
  const isDataLoading = stats === undefined || revenueByDay === undefined || topCouriers === undefined || allJobs === undefined || allCouriers === undefined || recentUsers === undefined

  if (isDataLoading) {
    return (
      <AdminAppShell>
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <Skeleton className="h-10 w-64" />
            <div className="flex gap-3">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Skeleton className="lg:col-span-2 h-[400px]" />
            <Skeleton className="h-[400px]" />
          </div>
        </div>
      </AdminAppShell>
    )
  }

  // Use safe defaults if data is null (shouldn't happen but just in case)
  const safeStats = stats || {
    revenue: { total: 0, today: 0, week: 0, month: 0 },
    jobs: { total: 0, active: 0, completedTotal: 0, completedToday: 0, todayNew: 0, avgValue: 0 },
    customers: { total: 0, newToday: 0 },
    couriers: { approved: 0, online: 0, pending: 0 },
    payouts: { pendingCount: 0, pendingAmount: 0 },
  }
  const safeRevenueByDay = revenueByDay || []
  const safeTopCouriers = topCouriers || []
  const safeAllJobs = allJobs || []

  // Calculate trends
  const avgRevenue = safeStats.revenue.week / 7
  const revenueTrend = avgRevenue > 0 ? ((safeStats.revenue.today - avgRevenue) / avgRevenue) * 100 : 0

  const weekJobs = safeRevenueByDay.reduce((acc, curr) => acc + curr.jobs, 0)
  const avgJobs = weekJobs / 7
  const jobsTrend = avgJobs > 0 ? ((safeStats.jobs.todayNew - avgJobs) / avgJobs) * 100 : 0

  const avgCustomers = safeStats.customers.total / 30 // Assuming 30 days for total
  const customersTrend = avgCustomers > 0 ? ((safeStats.customers.newToday - avgCustomers) / avgCustomers) * 100 : 0

  const recentActivities = safeAllJobs.slice(0, 5).map(job => ({
    id: job._id,
    type: job.status === 'completed' ? 'job_completed' : job.status === 'cancelled' ? 'job_cancelled' : 'job_update',
    user: job.customerId.substring(0, 8),
    time: new Date(job.createdAt).toLocaleTimeString(),
    amount: `$${job.totalPrice.toFixed(2)}`
  }))

  return (
    <AdminAppShell>
      <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Welcome{adminEmail ? `, ${adminEmail.split('@')[0]}` : ''}</h1>
              <p className="text-muted-foreground">Here's what's happening today.</p>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/admin/settings">
                <Button variant="ghost" size="icon">
                  <Settings className="w-5 h-5" />
                </Button>
              </Link>
              <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10" onClick={() => navigate('/admin/readiness')}>
                <Rocket className="mr-2 h-4 w-4" />
                Launch Readiness
              </Button>
              <Button variant="outline" onClick={() => navigate('/admin/settings')}>
                Settings
              </Button>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => navigate('/admin/jobs')}>
                <PlusCircle className="mr-2 h-4 w-4" />
                View Jobs
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard 
              label="Total Revenue" 
              value={`$${safeStats.revenue.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
              icon={DollarSign} 
              trend={{ value: Math.abs(Math.round(revenueTrend)), isPositive: revenueTrend >= 0 }} 
            />
            <StatsCard 
              label="Active Jobs" 
              value={safeStats.jobs.active.toString()} 
              icon={Package} 
              trend={{ value: Math.abs(Math.round(jobsTrend)), isPositive: jobsTrend >= 0 }} 
            />
            <StatsCard 
              label="Pending Couriers" 
              value={safeStats.couriers.pending.toString()} 
              icon={UserPlus} 
              trend={{ value: 0, isPositive: false }} 
            />
            <StatsCard 
              label="Total Customers" 
              value={safeStats.customers.total.toString()} 
              icon={Users} 
              trend={{ value: Math.abs(Math.round(customersTrend)), isPositive: customersTrend >= 0 }} 
            />
          </div>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-muted/30 border-none">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Online Couriers</p>
                  <p className="text-xl font-bold">{safeStats.couriers.online} / {safeStats.couriers.approved}</p>
                </div>
                <Activity className="h-4 w-4 text-emerald-500" />
              </CardContent>
            </Card>
            <Card className="bg-muted/30 border-none">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Today's Revenue</p>
                  <p className="text-xl font-bold">${safeStats.revenue.today.toFixed(2)}</p>
                </div>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardContent>
            </Card>
            <Card className="bg-muted/30 border-none">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Jobs Completed Today</p>
                  <p className="text-xl font-bold">{safeStats.jobs.completedToday}</p>
                </div>
                <CheckCircle2 className="h-4 w-4 text-blue-500" />
              </CardContent>
            </Card>
            <Card className="bg-muted/30 border-none">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Pending Payouts</p>
                  <p className="text-xl font-bold">{safeStats.payouts.pendingCount} (${safeStats.payouts.pendingAmount.toFixed(2)})</p>
                </div>
                <Wallet className="h-4 w-4 text-orange-500" />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Revenue Overview</CardTitle>
                <CardDescription>Daily revenue for the last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={safeRevenueByDay}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ 
                          backgroundColor: 'var(--card)', 
                          borderColor: 'var(--border)',
                          color: 'var(--foreground)'
                        }}
                        itemStyle={{ color: 'var(--primary)' }}
                      />
                      <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                        {safeRevenueByDay.map((_, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={index === safeRevenueByDay.length - 1 ? 'var(--primary)' : 'var(--primary-foreground)'} 
                            fillOpacity={index === safeRevenueByDay.length - 1 ? 1 : 0.2}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest events from the platform</CardDescription>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/admin/jobs')}>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {recentActivities.length > 0 ? recentActivities.map((activity) => (
                    <div key={activity.id} className="flex gap-4">
                      <div className={cn(
                        "mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        activity.type === 'job_completed' ? "bg-emerald-500/10 text-emerald-500" :
                        activity.type === 'new_courier' ? "bg-blue-500/10 text-blue-500" :
                        activity.type === 'job_cancelled' ? "bg-destructive/10 text-destructive" :
                        "bg-purple-500/10 text-purple-500"
                      )}>
                        {activity.type === 'job_completed' && <CheckCircle2 className="w-4 h-4" />}
                        {activity.type === 'new_courier' && <UserPlus className="w-4 h-4" />}
                        {activity.type === 'job_cancelled' && <AlertCircle className="w-4 h-4" />}
                        {activity.type === 'job_update' && <Package className="w-4 h-4" />}
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {activity.type === 'job_completed' && `Job completed`}
                          {activity.type === 'new_courier' && `New courier application`}
                          {activity.type === 'job_cancelled' && `Job cancelled`}
                          {activity.type === 'job_update' && `Job updated`}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{activity.time}</span>
                          {activity.amount && (
                            <>
                              <span>•</span>
                              <span className="font-semibold text-primary">{activity.amount}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                  )}
                </div>
                <Button variant="outline" className="w-full mt-6" onClick={() => navigate('/admin/jobs')}>
                  View All Activity
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Top Couriers</CardTitle>
                <CardDescription>Performance leaderboard</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {safeTopCouriers.map((courier, index) => (
                    <div key={courier.courierId} className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-6 text-sm font-bold text-muted-foreground">
                        {index + 1}
                      </div>
                      <Avatar className="h-9 w-9 border border-border">
                        <AvatarImage src={`https://avatar.vercel.sh/${courier.courierId}.png`} />
                        <AvatarFallback>{courier.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-none truncate">{courier.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{courier.jobCount} jobs</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-primary">${courier.earnings.toFixed(0)}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                          <span className="text-xs font-medium">{courier.avgRating}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full mt-6" onClick={() => navigate('/admin/couriers')}>
                  Manage Couriers
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-1">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>New Users</CardTitle>
                  <CardDescription>Recent sign-ups</CardDescription>
                </div>
                <UserPlus className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {recentUsers && recentUsers.length > 0 ? (
                    recentUsers.map((user) => (
                      <div key={user.id} className="flex items-center gap-4">
                        <Avatar className="h-9 w-9 border border-border">
                          <AvatarImage src={`https://avatar.vercel.sh/${user.id}.png`} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {user.name ? (
                              user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
                            ) : (
                              <Users className="w-4 h-4" />
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium leading-none truncate">{user.name || 'Anonymous'}</p>
                            <Badge variant="outline" className="text-[10px] h-4 px-1 capitalize">
                              {user.role}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">{user.email}</p>
                        </div>
                        <div className="text-right whitespace-nowrap">
                          <p className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Users className="h-8 w-8 text-muted-foreground/20 mb-2" />
                      <p className="text-sm text-muted-foreground">No new users found</p>
                    </div>
                  )}
                </div>
                <Button variant="outline" className="w-full mt-6" onClick={() => navigate('/admin/couriers')}>
                  Manage Platform
                </Button>
              </CardContent>
            </Card>

            <div className="lg:col-span-1 grid grid-cols-1 gap-4">
              <Card className="bg-primary/5 border-primary/20 h-fit">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold">Review Couriers</h3>
                    <p className="text-sm text-muted-foreground">{safeStats.couriers.pending} applications waiting</p>
                  </div>
                  <Button variant="ghost" size="icon" className="ml-auto" onClick={() => navigate('/admin/couriers')}>
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </CardContent>
              </Card>
              
              <Card className="bg-card hover:bg-muted/50 transition-colors cursor-pointer h-fit" onClick={() => navigate('/admin/jobs')}>
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-foreground">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold">Live Jobs</h3>
                    <p className="text-sm text-muted-foreground">{safeStats.jobs.active} jobs in progress</p>
                  </div>
                  <Button variant="ghost" size="icon" className="ml-auto">
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card hover:bg-muted/50 transition-colors cursor-pointer h-fit" onClick={() => navigate('/admin/transactions')}>
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-foreground">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold">Financials</h3>
                    <p className="text-sm text-muted-foreground">Payouts and logs</p>
                  </div>
                  <Button variant="ghost" size="icon" className="ml-auto">
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-card hover:bg-muted/50 transition-colors cursor-pointer h-fit" onClick={() => navigate('/admin/settings')}>
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-foreground">
                    <PlusCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold">Settings</h3>
                    <p className="text-sm text-muted-foreground">Platform configuration</p>
                  </div>
                  <Button variant="ghost" size="icon" className="ml-auto">
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
      </div>
    </AdminAppShell>
  )
}
