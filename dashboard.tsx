import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Package, Clock, CheckCircle2, ChevronRight, ArrowUpRight, Loader2, Bell } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import { useQuery } from "convex/react"
import { api } from "@convex/api"
import { AppShell } from '@/components/layout/app-shell'

import { useAuth } from '@/hooks/use-auth'

export default function CustomerDashboard() {
  const { userName } = useAuth()
  const myJobs = useQuery(api.jobs.getMyJobs)
  const notifications = useQuery(api.customerNotifications.getMyNotifications, { limit: 5 })
  
  const activeJobs = myJobs?.filter(j => !['completed', 'cancelled'].includes(j.status))
  const completedJobs = myJobs?.filter(j => j.status === 'completed')
  const recentJobs = completedJobs?.slice(0, 5)

  if (myJobs === undefined || userName === undefined) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppShell>
    )
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const totalPackages = myJobs.reduce((acc, job) => acc + job.packageCount, 0)
  const firstName = userName?.split(' ')[0] || 'there'

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-bold font-outfit tracking-tight">
              {getGreeting()}, <span className="text-primary">{firstName}</span>!
            </h1>
            <p className="text-muted-foreground mt-1">
              {activeJobs?.length ? `You have ${activeJobs.length} active ${activeJobs.length === 1 ? 'pickup' : 'pickups'} in progress.` : "Ready to schedule your next pickup?"}
            </p>
          </div>
          <Link to="/customer/book">
            <Button size="lg" className="h-14 px-8 rounded-2xl font-bold text-lg shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
              <Plus className="mr-2 w-6 h-6" />
              Book Pickup
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Pickups" value={myJobs.length.toString()} icon={Package} />
          <StatCard label="Packages" value={totalPackages.toString()} icon={Package} />
          <StatCard label="Active" value={(activeJobs?.length || 0).toString()} icon={Clock} color="text-primary" />
          <StatCard label="Completed" value={(completedJobs?.length || 0).toString()} icon={CheckCircle2} color="text-green-500" />
        </div>

        {/* Notifications */}
        {notifications && notifications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                Recent Updates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {notifications.slice(0, 3).map((notif) => (
                <div 
                  key={notif._id}
                  className={`p-3 rounded-lg border ${!notif.isRead ? 'bg-primary/5 border-primary/20' : 'border-border'}`}
                >
                  <p className="font-medium text-sm">{notif.title}</p>
                  <p className="text-xs text-muted-foreground">{notif.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Active Orders */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-outfit flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Active Pickups
            </h2>
          </div>
          
          {activeJobs && activeJobs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeJobs.map((job) => (
                <Link key={job._id} to={`/customer/tracking/${job._id}`}>
                  <Card className="p-5 bg-slate-900/50 border-slate-800 hover:border-primary/50 transition-colors group">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 mb-2 capitalize">
                          {job.status.replace('_', ' ')}
                        </Badge>
                        <h3 className="font-bold text-lg">ORD-{job._id.slice(-4).toUpperCase()}</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground uppercase">Scheduled</p>
                        <p className="font-bold text-primary">{job.isAsap ? 'ASAP' : job.scheduledTime}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-slate-400">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        <span>{job.packageCount} {job.packageCount === 1 ? 'Package' : 'Packages'} • {job.carrier}</span>
                      </div>
                      <p className="truncate">{job.pickupAddress}</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-primary font-bold text-sm">
                      <span>Track Live</span>
                      <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="p-12 border-dashed border-slate-800 bg-transparent flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center mb-4">
                <Package className="w-6 h-6 text-slate-600" />
              </div>
              <h3 className="font-bold text-lg">No active pickups</h3>
              <p className="text-muted-foreground max-w-[250px] mt-1">When you book a pickup, it will appear here for live tracking.</p>
            </Card>
          )}
        </section>

        {/* Recent Activity */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-outfit">Recent History</h2>
            <Link to="/customer/history" className="text-sm text-primary font-bold flex items-center gap-1 hover:underline">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          
          {recentJobs && recentJobs.length > 0 ? (
            <Card className="overflow-hidden border-slate-800 bg-slate-900/30">
              <div className="divide-y divide-slate-800">
                {recentJobs.map((job) => (
                  <Link key={job._id} to={`/customer/order/${job._id}`} className="block p-4 hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                          <p className="font-bold">ORD-{job._id.slice(-4).toUpperCase()}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(job.createdAt).toLocaleDateString()} • {job.carrier}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">${job.totalPrice.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">{job.packageCount} pkg</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          ) : (
            <Card className="p-8 border-slate-800 bg-slate-900/30 text-center">
              <p className="text-muted-foreground">No completed pickups yet.</p>
            </Card>
          )}
        </section>
      </div>
    </AppShell>
  )
}

function StatCard({ label, value, icon: Icon, color = "text-slate-100" }: any) {
  return (
    <Card className="p-4 bg-slate-900/50 border-slate-800 flex flex-col gap-1">
      <div className="flex items-center justify-between mb-1">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <p className={cn("text-2xl font-bold font-outfit", color)}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
    </Card>
  )
}
