import { useQuery, useMutation } from 'convex/react'
import { api } from '@convex/api'
import { AdminAppShell } from '@/components/layout/admin-app-shell'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { useAdmin } from '@/contexts/admin-context'
import { 
  CheckCircle, XCircle, AlertTriangle, Play, Trash2, 
  Loader2, RefreshCw, DollarSign, Users, Package,
  Shield, Bell, Settings, Rocket, ArrowRight,
  Database, Activity, Lock, CreditCard
} from 'lucide-react'
import { toast } from 'sonner'
import { useState, useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Link } from 'react-router'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function ReadinessPage() {
  const { isAdminLoggedIn } = useAdmin()
  const mode = useQuery(api.platform.getMode, isAdminLoggedIn ? undefined : "skip")
  const setMode = useMutation(api.platform.setMode)
  const runHealthChecks = useMutation(api.platform.runHealthChecks)
  const healthResults = useQuery(api.platform.getHealthCheckResults, isAdminLoggedIn ? undefined : "skip")
  const revenueReport = useQuery(api.platform.getRevenueReport, isAdminLoggedIn ? {} : "skip")
  const generateDemoData = useMutation(api.demo.generateDemoData)
  const createTestJob = useMutation(api.demo.createTestLifecycleJob)
  const cleanupTestData = useMutation(api.demo.cleanupTestData)

  const [isRunningTests, setIsRunningTests] = useState(false)
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false)
  const [isCreatingTestJob, setIsCreatingTestJob] = useState(false)
  const [isCleaningUp, setIsCleaningUp] = useState(false)
  const [isModeDialogOpen, setIsModeDialogOpen] = useState(false)

  const [demoOptions, setDemoOptions] = useState({
    includeCustomer: true,
    includeCourier: true,
    includeJobs: true
  })

  const handleRunTests = async () => {
    setIsRunningTests(true)
    try {
      await runHealthChecks()
      toast.success("Health checks completed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to run health checks")
    } finally {
      setIsRunningTests(false)
    }
  }

  const handleModeToggle = (checked: boolean) => {
    const newMode = checked ? 'live' : 'test'
    if (newMode === 'live') {
      setIsModeDialogOpen(true)
    } else {
      confirmModeChange('test')
    }
  }

  const confirmModeChange = async (newMode: 'test' | 'live') => {
    try {
      await setMode({ mode: newMode })
      toast.success(`Switched to ${newMode} mode`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change mode")
    } finally {
      setIsModeDialogOpen(false)
    }
  }

  const handleGenerateDemo = async () => {
    setIsGeneratingDemo(true)
    try {
      const results = await generateDemoData(demoOptions)
      results.forEach(msg => toast.info(msg))
      toast.success("Demo data generation complete")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate demo data")
    } finally {
      setIsGeneratingDemo(false)
    }
  }

  const handleCreateTestJob = async () => {
    setIsCreatingTestJob(true)
    try {
      const result = await createTestJob()
      toast.success(result.message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create test job")
    } finally {
      setIsCreatingTestJob(false)
    }
  }

  const handleCleanup = async () => {
    if (!confirm("Are you sure you want to clean up ALL test data? This cannot be undone.")) return
    
    setIsCleaningUp(true)
    try {
      const results = await cleanupTestData({
        cleanJobs: true,
        cleanTransactions: true,
        cleanHealthChecks: false
      })
      results.forEach(msg => toast.info(msg))
      toast.success("Cleanup complete")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clean up data")
    } finally {
      setIsCleaningUp(false)
    }
  }

  const groupedResults = useMemo(() => {
    if (!healthResults?.results) return {}
    return healthResults.results.reduce((acc: any, curr: any) => {
      if (!acc[curr.category]) acc[curr.category] = []
      acc[curr.category].push(curr)
      return acc
    }, {})
  }, [healthResults])

  const categories = [
    { id: 'auth', label: 'Auth & Roles', icon: Lock },
    { id: 'courier', label: 'Courier System', icon: Users },
    { id: 'jobs', label: 'Jobs & Bookings', icon: Package },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'audit', label: 'Audit & Security', icon: Shield },
  ]

  return (
    <AdminAppShell>
      <div className="space-y-8 pb-12">
        {/* Mode Banners */}
        <AnimatePresence mode="wait">
          {mode === 'live' ? (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-destructive text-destructive-foreground px-4 py-2 text-center font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              ⚠️ LIVE MODE - Real transactions are being processed
            </motion.div>
          ) : (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-blue-600 text-white px-4 py-2 text-center font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <Activity className="h-4 w-4" />
              🧪 TEST MODE - No real money is processed
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-4 md:px-0">
          <div>
            <h1 className="text-4xl font-black text-foreground tracking-tight flex items-center gap-3">
              <Rocket className="h-10 w-10 text-primary" />
              Launch Readiness
            </h1>
            <p className="text-muted-foreground mt-1">
              {healthResults?.runAt ? (
                <>Last check: {formatDistanceToNow(healthResults.runAt, { addSuffix: true })}</>
              ) : (
                "No health checks run yet"
              )}
            </p>
          </div>

          <div className="flex items-center gap-6 bg-card border p-4 rounded-xl shadow-sm">
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Platform Mode</span>
              <div className="flex items-center gap-3">
                <span className={cn("text-sm font-bold", mode === 'test' ? "text-primary" : "text-muted-foreground")}>TEST</span>
                <Switch 
                  checked={mode === 'live'} 
                  onCheckedChange={handleModeToggle}
                  className="data-[state=checked]:bg-destructive"
                />
                <span className={cn("text-sm font-bold", mode === 'live' ? "text-destructive" : "text-muted-foreground")}>LIVE</span>
              </div>
            </div>
            
            <div className="w-px h-10 bg-border mx-2" />

            <Button 
              size="lg" 
              onClick={handleRunTests} 
              disabled={isRunningTests}
              className="font-bold gap-2"
            >
              {isRunningTests ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <RefreshCw className="h-5 w-5" />
              )}
              Run All Tests
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Health Check Results Grid */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Health Check Results
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories.map((cat) => (
                <Card key={cat.id} className="overflow-hidden border-muted/40 bg-card/50 backdrop-blur-sm">
                  <CardHeader className="py-4 px-5 border-b bg-muted/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <cat.icon className="h-4 w-4 text-primary" />
                        <CardTitle className="text-sm font-bold uppercase tracking-wider">{cat.label}</CardTitle>
                      </div>
                      <Badge variant="outline" className="bg-background/50">
                        {groupedResults[cat.id]?.length || 0} checks
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-muted/30">
                      {groupedResults[cat.id] ? (
                        groupedResults[cat.id].map((result: any, idx: number) => (
                          <div key={idx} className="px-5 py-3 flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <p className="text-sm font-medium leading-none">{result.testName}</p>
                              <p className="text-xs text-muted-foreground">{result.message}</p>
                            </div>
                            <StatusBadge status={result.status} />
                          </div>
                        ))
                      ) : (
                        <div className="px-5 py-8 text-center">
                          <p className="text-xs text-muted-foreground italic">No results yet. Run tests to see status.</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            {/* Revenue Report Card */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Revenue Report
              </h2>
              <Card className="bg-primary text-primary-foreground border-none shadow-xl shadow-primary/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest opacity-80">Net Revenue (30d)</CardTitle>
                  <div className="text-4xl font-black">
                    ${revenueReport?.revenue?.netRevenue.toFixed(2) || "0.00"}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase opacity-70">Gross Bookings</p>
                      <p className="text-lg font-bold">${revenueReport?.revenue?.grossBookings.toFixed(2) || "0.00"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase opacity-70">Commission</p>
                      <p className="text-lg font-bold">${revenueReport?.revenue?.platformCommission.toFixed(2) || "0.00"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase opacity-70">Payouts</p>
                      <p className="text-lg font-bold">${revenueReport?.revenue?.courierPayouts.toFixed(2) || "0.00"}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase opacity-70">Refunds</p>
                      <p className="text-lg font-bold">${revenueReport?.revenue?.refunds.toFixed(2) || "0.00"}</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-primary-foreground/20">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-bold">Pending Payouts</p>
                      <p className="text-sm font-black">${revenueReport?.payouts?.pendingAmount.toFixed(2) || "0.00"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Play className="h-5 w-5 text-primary" />
                Quick Actions
              </h2>
              <div className="grid grid-cols-1 gap-3">
                <QuickActionLink href="/admin/couriers" icon={Users} label="Verification Queue" />
                <QuickActionLink href="/admin/jobs" icon={Package} label="Jobs Management" />
                <QuickActionLink href="/admin/settings" icon={Settings} label="Platform Settings" />
                <QuickActionLink href="/admin/transactions" icon={CreditCard} label="Transactions" />
              </div>
            </div>

            {/* Demo Data Generator */}
            {mode === 'test' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Demo Data Generator
                </h2>
                <Card className="border-dashed border-primary/50 bg-primary/5">
                  <CardHeader className="pb-4">
                    <CardDescription className="text-foreground/80">
                      Populate your environment with sample data for testing.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="customer" 
                          checked={demoOptions.includeCustomer}
                          onCheckedChange={(checked) => setDemoOptions(prev => ({ ...prev, includeCustomer: !!checked }))}
                        />
                        <label htmlFor="customer" className="text-sm font-medium">Generate demo customer</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="courier" 
                          checked={demoOptions.includeCourier}
                          onCheckedChange={(checked) => setDemoOptions(prev => ({ ...prev, includeCourier: !!checked }))}
                        />
                        <label htmlFor="courier" className="text-sm font-medium">Generate demo courier</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="jobs" 
                          checked={demoOptions.includeJobs}
                          onCheckedChange={(checked) => setDemoOptions(prev => ({ ...prev, includeJobs: !!checked }))}
                        />
                        <label htmlFor="jobs" className="text-sm font-medium">Generate demo jobs</label>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Button 
                        variant="outline" 
                        className="w-full justify-start gap-2 border-primary/30 hover:bg-primary/10"
                        onClick={handleGenerateDemo}
                        disabled={isGeneratingDemo}
                      >
                        {isGeneratingDemo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                        Generate Demo Data
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-start gap-2 border-primary/30 hover:bg-primary/10"
                        onClick={handleCreateTestJob}
                        disabled={isCreatingTestJob}
                      >
                        {isCreatingTestJob ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                        Create Test Lifecycle Job
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10"
                        onClick={handleCleanup}
                        disabled={isCleaningUp}
                      >
                        {isCleaningUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Clean Up Test Data
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={isModeDialogOpen} onOpenChange={setIsModeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Switch to LIVE Mode?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? Live Mode will process real payments and interactions. 
              This should only be enabled when you are ready for actual production use.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => confirmModeChange('live')}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Enable Live Mode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminAppShell>
  )
}

function StatusBadge({ status }: { status: 'pass' | 'fail' | 'warning' }) {
  switch (status) {
    case 'pass':
      return (
        <Badge className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/20 gap-1 px-2">
          <CheckCircle className="h-3 w-3" />
          PASS
        </Badge>
      )
    case 'fail':
      return (
        <Badge variant="destructive" className="gap-1 px-2">
          <XCircle className="h-3 w-3" />
          FAIL
        </Badge>
      )
    case 'warning':
      return (
        <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/20 gap-1 px-2">
          <AlertTriangle className="h-3 w-3" />
          WARN
        </Badge>
      )
    default:
      return null
  }
}

function QuickActionLink({ href, icon: Icon, label }: { href: string, icon: any, label: string }) {
  return (
    <Link to={href}>
      <Button variant="outline" className="w-full justify-between group hover:border-primary/50 transition-all">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
          <span>{label}</span>
        </div>
        <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
      </Button>
    </Link>
  )
}
