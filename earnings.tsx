import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { 
  ArrowLeft, 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Wallet,
  CreditCard,
  Building2,
  Smartphone,
  ChevronRight,
  History
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuery } from "convex/react"
import { api } from "@convex/api"
import { cn } from "@/lib/utils"
import { AppShell } from '@/components/layout/app-shell'
import { format } from 'date-fns'

export default function CourierEarningsPage() {
  const navigate = useNavigate()
  const application = useQuery(api.couriers.getMyApplication)
  const payouts = useQuery(api.payouts.getMyCourierPayouts)
  const summary = useQuery(api.payouts.getMyCourierEarningsSummary)
  const payoutStatus = useQuery(api.payouts.getPayoutStatus)

  // Redirect non-approved couriers to status page
  useEffect(() => {
    if (application !== undefined && application?.status !== 'approved') {
      navigate('/courier/status')
    }
  }, [application, navigate])

  if (application === undefined || payouts === undefined || summary === undefined || payoutStatus === undefined) {
    return (
      <AppShell>
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="w-10 h-10 rounded-full" />
              <Skeleton className="h-10 w-48" />
            </div>
          </div>
          <Skeleton className="h-64 w-full rounded-[2rem]" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
              <Skeleton className="h-20 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </AppShell>
    )
  }

  // If not approved, show nothing (redirect will happen)
  if (application?.status !== 'approved') {
    return null
  }

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return <CheckCircle2 className="w-5 h-5 text-primary" />
      case 'pending':
      case 'processing':
        return <Clock className="w-5 h-5 text-yellow-500" />
      default:
        return <AlertCircle className="w-5 h-5 text-muted-foreground" />
    }
  }

  const getMethodIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case 'bank_transfer':
        return <Building2 className="w-5 h-5" />
      case 'cashapp':
      case 'zelle':
        return <Smartphone className="w-5 h-5" />
      default:
        return <CreditCard className="w-5 h-5" />
    }
  }

  const isPayoutSetUp = payoutStatus?.status === 'complete'
  const payoutMethod = payoutStatus?.payoutMethod || ''
  let payoutDetails = ''
  if (payoutMethod === 'zelle') {
    payoutDetails = payoutStatus?.payoutEmail || payoutStatus?.payoutPhone || ''
  } else if (payoutMethod === 'cashapp') {
    payoutDetails = payoutStatus?.payoutHandle ? `$${payoutStatus.payoutHandle.replace(/^\$/, '')}` : ''
  } else if (payoutMethod === 'bank_transfer') {
    payoutDetails = payoutStatus?.payoutBankName ? `${payoutStatus.payoutBankName} ****${payoutStatus.payoutAccountLast4}` : ''
  }

  return (
    <AppShell>
      <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/courier/dashboard')}
              className="rounded-full bg-secondary/50 hover:bg-primary/20 hover:text-primary transition-all active:scale-90"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic leading-none">EARNINGS</h1>
          </div>
          {!isPayoutSetUp && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/profile')}
              className="border-primary text-primary font-black text-[10px] uppercase tracking-widest h-8 px-4 rounded-full hover:bg-primary hover:text-black transition-all"
            >
              Set Up Payouts
            </Button>
          )}
        </div>

        {/* Balance Card */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-primary/20 rounded-[2.1rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
          <Card className="bg-secondary/40 border-primary/20 rounded-[2rem] overflow-hidden relative border-2">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <Wallet className="w-48 h-48 -mr-12 -mt-12 rotate-12" />
            </div>
            <CardContent className="p-10 text-center space-y-4 relative z-10">
              <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.3em]">Pending Balance</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-7xl font-black tracking-tighter text-primary drop-shadow-[0_0_15px_rgba(57,255,20,0.3)]">
                  ${(summary?.pendingAmount || 0).toFixed(2)}
                </span>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-black uppercase tracking-tight text-foreground/90">
                  {summary?.pendingCount || 0} payout{(summary?.pendingCount || 0) !== 1 ? 's' : ''} pending
                </p>
                {(summary?.pendingAmount || 0) > 0 && (
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                    <Clock className="w-3 h-3 text-primary" />
                    <p className="text-[10px] text-primary font-black uppercase tracking-widest">
                      Processed weekly on Mondays
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: "Today", value: summary?.paidTodayAmount || 0, icon: TrendingUp },
            { label: "This Week", value: summary?.paidThisWeekAmount || 0, icon: Calendar },
            { label: "This Month", value: summary?.paidThisMonthAmount || 0, icon: History },
            { label: "Total Paid", value: summary?.paidTotalAmount || 0, icon: DollarSign },
          ].map((stat) => (
            <Card key={stat.label} className="bg-secondary/20 border-border/50 hover:border-primary/30 transition-all duration-300 rounded-2xl group">
              <CardContent className="p-5 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <stat.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-0.5">{stat.label}</p>
                  <p className="text-2xl font-black italic tracking-tight text-foreground group-hover:text-primary transition-colors">${stat.value.toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Payout Method */}
        <Card className={cn(
          "border-2 border-dashed rounded-[1.5rem] transition-all duration-300",
          isPayoutSetUp ? "bg-secondary/10 border-border/50 hover:border-primary/30" : "bg-destructive/5 border-destructive/30 animate-pulse"
        )}>
          <CardContent className="p-5 flex items-center gap-5">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0",
              isPayoutSetUp ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
            )}>
              {isPayoutSetUp ? getMethodIcon(payoutMethod) : <AlertCircle className="w-7 h-7" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Payout Method</p>
                {!isPayoutSetUp && (
                  <Badge variant="destructive" className="text-[8px] h-4 px-1.5 font-black uppercase tracking-tighter">Action Required</Badge>
                )}
              </div>
              <p className="text-base font-black truncate tracking-tight">
                {isPayoutSetUp ? `${payoutMethod.replace('_', ' ').toUpperCase()}: ${payoutDetails}` : "Configure Payout Method"}
              </p>
            </div>
            <Button 
              variant="secondary" 
              size="sm" 
              className="font-black text-[10px] uppercase tracking-widest h-8 px-4 rounded-full bg-secondary/80 hover:bg-primary hover:text-black transition-all"
              onClick={() => navigate('/profile')}
            >
              {isPayoutSetUp ? "Edit" : "Set Up"}
            </Button>
          </CardContent>
        </Card>

        {/* Payout History */}
        <div className="space-y-6 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black tracking-tighter uppercase italic leading-none">Payout History</h2>
            <Badge variant="secondary" className="bg-secondary/50 text-muted-foreground font-black text-[10px] uppercase tracking-widest px-3 py-1">
              {(payouts || []).length} Total
            </Badge>
          </div>
          
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="w-full bg-secondary/50 p-1 rounded-2xl h-14 border border-border/50">
              <TabsTrigger value="all" className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-black transition-all">All</TabsTrigger>
              <TabsTrigger value="pending" className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-black transition-all">Pending</TabsTrigger>
              <TabsTrigger value="paid" className="flex-1 rounded-xl font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-primary data-[state=active]:text-black transition-all">Paid</TabsTrigger>
            </TabsList>

            {["all", "pending", "paid"].map((tab) => (
              <TabsContent key={tab} value={tab} className="mt-6 space-y-4 outline-none">
                {(payouts || [])
                  .filter(p => {
                    if (tab === "all") return true;
                    if (tab === "pending") return p.status === "pending" || p.status === "processing";
                    return p.status === "paid";
                  })
                  .map((payout) => (
                    <Card key={payout._id} className="bg-secondary/10 border-border/50 hover:border-primary/40 hover:bg-secondary/20 transition-all duration-300 rounded-2xl group cursor-pointer overflow-hidden border-2">
                      <CardContent className="p-5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-5 min-w-0">
                          <div className={cn(
                            "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 duration-300",
                            payout.status === 'paid' ? "bg-primary/10" : "bg-yellow-500/10"
                          )}>
                            {getStatusIcon(payout.status)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-xl font-black italic tracking-tighter text-foreground group-hover:text-primary transition-colors">${payout.amount.toFixed(2)}</p>
                              <Badge className={cn(
                                "text-[9px] h-4 px-1.5 font-black uppercase border-none tracking-tighter",
                                payout.status === 'paid' ? "bg-primary text-black" : "bg-yellow-500 text-black"
                              )}>
                                {payout.status}
                              </Badge>
                            </div>
                            <p className="text-xs font-bold text-muted-foreground truncate uppercase tracking-tight max-w-[200px] sm:max-w-md">
                              {payout.jobPickupAddress || "Multi-job payout"}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                               <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">
                                {payout.status === 'paid' && payout.paidAt 
                                  ? format(new Date(payout.paidAt), 'MMM d, yyyy')
                                  : format(new Date(payout._creationTime), 'MMM d, yyyy')}
                              </p>
                              {payout.paymentMethod && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-muted-foreground/20" />
                                  <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">via {payout.paymentMethod}</p>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="bg-secondary/50 p-2 rounded-full group-hover:bg-primary/20 group-hover:text-primary transition-all">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                
                {(payouts || []).filter(p => {
                    if (tab === "all") return true;
                    if (tab === "pending") return p.status === "pending" || p.status === "processing";
                    return p.status === "paid";
                  }).length === 0 && (
                  <div className="text-center py-20 space-y-5 bg-secondary/5 rounded-[2rem] border-2 border-dashed border-border/50">
                    <div className="w-20 h-20 bg-secondary/20 rounded-full flex items-center justify-center mx-auto ring-8 ring-secondary/5">
                      <History className="w-10 h-10 text-muted-foreground/20" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-black uppercase tracking-tight italic">Nothing to show yet</p>
                      <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.2em]">Your earnings history will appear here</p>
                    </div>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </AppShell>
  )
}
