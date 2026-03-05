import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/api"
import { AdminAppShell } from '@/components/layout/admin-app-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useAdmin } from '@/contexts/admin-context'
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Database, 
  Server, 
  CreditCard, 
  MapPin, 
  Package,
  Activity,
  Globe
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

export default function AdminHealthPage() {
  const { isAdminLoggedIn } = useAdmin()
  const health = useQuery(api.health.getSystemHealth, isAdminLoggedIn ? undefined : "skip")
  const seedHubs = useMutation(api.health.seedAllHubs)
  const [isSeeding, setIsSeeding] = useState(false)

  const handleSeedHubs = async () => {
    setIsSeeding(true)
    try {
      await seedHubs()
      toast.success("Hubs seeded successfully")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to seed hubs")
    } finally {
      setIsSeeding(false)
    }
  }

  if (!health) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const hostname = window.location.hostname
  const isProduction = !hostname.includes("surgent") && !hostname.includes("localhost")
  const envType = isProduction ? "Production" : "Preview/Dev"

  const StatusIcon = health.status === "healthy" ? CheckCircle : AlertCircle

  return (
    <AdminAppShell>
      <div className="container mx-auto p-4 md:p-8 space-y-8 max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">System Health</h1>
              <p className="text-muted-foreground">Droppit production diagnostics and environment status</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={health.status === "healthy" ? "default" : "destructive"} className="px-3 py-1 text-sm font-medium">
                <StatusIcon className="w-4 h-4 mr-2" />
                {health.status.toUpperCase()}
              </Badge>
              <div className="flex flex-col items-end">
                <span className="text-xs text-muted-foreground">
                  Last updated: {new Date(health.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Environment Parity Check */}
            <Card className="col-span-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  Environment Parity
                </CardTitle>
                <CardDescription>Preview and Live should match</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="p-3 bg-slate-800 rounded">
                    <p className="text-muted-foreground text-xs">Client Hostname</p>
                    <p className="font-mono font-bold truncate">{window.location.hostname}</p>
                  </div>
                  <div className="p-3 bg-slate-800 rounded">
                    <p className="text-muted-foreground text-xs">Client Origin</p>
                    <p className="font-mono font-bold truncate">{window.location.origin}</p>
                  </div>
                  <div className="p-3 bg-slate-800 rounded">
                    <p className="text-muted-foreground text-xs">Convex URL</p>
                    <p className="font-mono font-bold truncate">{import.meta.env.VITE_CONVEX_URL || 'NOT SET'}</p>
                  </div>
                  <div className="p-3 bg-slate-800 rounded">
                    <p className="text-muted-foreground text-xs">Server SITE_URL</p>
                    <p className="font-mono font-bold truncate">{health?.env?.siteUrl || 'Loading...'}</p>
                  </div>
                </div>
                
                {/* Parity Status */}
                <div className="mt-4 p-3 rounded border">
                  {health?.env?.siteUrl === 'https://droppit.app' ? (
                    <div className="flex items-center gap-2 text-green-500">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Production configuration verified</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-yellow-500">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-medium">Configuration mismatch - check SITE_URL</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Environment Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-primary" />
                  Environment
                </CardTitle>
                <CardDescription>Server and configuration status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Hostname:</span>
                  <span className="font-mono truncate text-right">{hostname}</span>
                  
                  <span className="text-muted-foreground">Mode:</span>
                  <div className="flex justify-end">
                    <Badge variant="outline" className="w-fit">{envType}</Badge>
                  </div>
                  
                  <span className="text-muted-foreground">SITE_URL:</span>
                  <span className="font-mono truncate text-right">{health.env.siteUrl || "Not set"}</span>
                </div>

                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-muted-foreground" />
                      Surgent API Key
                    </span>
                    <div className="flex items-center gap-2">
                      {health.env.hasSurgentApiKey ? (
                        <>
                          <Badge variant="secondary" className="text-[10px] uppercase h-5">
                            {health.env.surgentKeyType}
                          </Badge>
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        </>
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                      Whop API Key
                    </span>
                    {health.env.hasWhopApiKey ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-muted-foreground" />
                      Whop Company ID
                    </span>
                    {health.env.hasWhopCompanyId ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Hub Locations Card */}
            <Card>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    Hub Locations
                  </CardTitle>
                  <CardDescription>Service center distribution</CardDescription>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleSeedHubs} 
                  disabled={isSeeding}
                  className="h-8"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5 mr-2", isSeeding && "animate-spin")} />
                  Seed Hubs
                </Button>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-4">{health.hubs.total} Total Hubs</div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amazon</span>
                    <span className="font-medium">{health.hubs.amazon}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">UPS</span>
                    <span className="font-medium">{health.hubs.ups}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">FedEx</span>
                    <span className="font-medium">{health.hubs.fedex}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">USPS</span>
                    <span className="font-medium">{health.hubs.usps}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">DHL</span>
                    <span className="font-medium">{health.hubs.dhl}</span>
                  </div>
                </div>
                
                {Object.entries(health.hubs.byType).length > 0 && (
                  <div className="mt-6 pt-4 border-t">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Detailed Breakdown</p>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                      {Object.entries(health.hubs.byType).map(([type, count]) => (
                        <div key={type} className="flex justify-between text-sm">
                          <span className="text-muted-foreground capitalize">{type}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Booking Drafts Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  Booking Drafts
                </CardTitle>
                <CardDescription>Draft status breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-4">{health.drafts.total} Total Drafts</div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]" />
                      <span className="text-sm font-medium">Pending</span>
                    </div>
                    <span className="font-mono font-semibold">{health.drafts.pending}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                      <span className="text-sm font-medium">Processing</span>
                    </div>
                    <span className="font-mono font-semibold">{health.drafts.processing}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                      <span className="text-sm font-medium">Paid</span>
                    </div>
                    <span className="font-mono font-semibold">{health.drafts.paid}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Jobs Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Jobs
                </CardTitle>
                <CardDescription>Courier job performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-4">{health.jobs.total} Total Jobs</div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Requested</span>
                    <span className="font-mono font-medium">{health.jobs.requested}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Completed</span>
                    <span className="font-mono font-medium text-green-500">{health.jobs.completed}</span>
                  </div>
                  <div className="pt-2">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      <span>Completion Rate</span>
                      <span>{health.jobs.total > 0 ? Math.round((health.jobs.completed / health.jobs.total) * 100) : 0}%</span>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-primary h-full transition-all duration-500 ease-out" 
                        style={{ width: `${health.jobs.total > 0 ? (health.jobs.completed / health.jobs.total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cache Management */}
            <Card className="col-span-full">
              <CardHeader>
                <CardTitle>Cache Management</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    if ('caches' in window) {
                      caches.keys().then(names => {
                        names.forEach(name => caches.delete(name))
                      })
                    }
                    window.location.reload()
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Clear Cache & Reload
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = window.location.origin + '?v=' + Date.now()}
                >
                  Force Fresh Load
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </AdminAppShell>
  )
}
