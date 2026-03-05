import { useQuery } from "convex/react"
import { api } from "@convex/api"
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DollarSign, AlertCircle, RefreshCw, Loader2 } from 'lucide-react'
import { Link } from 'react-router'
import { AdminAppShell } from '@/components/layout/admin-app-shell'
import { useAdmin } from '@/contexts/admin-context'

export default function AdminPaymentsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const { isAdminLoggedIn } = useAdmin()
  
  const stats = useQuery(api.jobs.getPaymentStats, isAdminLoggedIn ? {} : "skip")
  const payments = useQuery(api.jobs.listPayments, isAdminLoggedIn ? {
    status: statusFilter === 'all' ? undefined : statusFilter as any,
    limit: 100,
  } : "skip")

  if (!stats || !payments) {
    return (
      <AdminAppShell>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminAppShell>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Paid</Badge>
      case 'failed':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Failed</Badge>
      case 'refunded':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Refunded</Badge>
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Pending</Badge>
    }
  }

  return (
    <AdminAppShell>
      <div className="space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold font-outfit">Payments</h1>
            <p className="text-muted-foreground">View payment history and revenue</p>
          </div>

          {/* Revenue Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-medium">Today</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-bold text-primary font-outfit">
                    {formatCurrency(stats.revenueToday)}
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-medium">This Week</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-outfit">
                  {formatCurrency(stats.revenueWeek)}
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-medium">This Month</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-outfit">
                  {formatCurrency(stats.revenueMonth)}
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-medium">All Time</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold font-outfit">
                  {formatCurrency(stats.totalRevenue)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Payment Status Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-green-500/5 border-green-500/20">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-2 rounded-full bg-green-500/10">
                  <DollarSign className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-400">{stats.totalPaid}</p>
                  <p className="text-sm text-green-400/70">Paid</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-red-500/5 border-red-500/20">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-2 rounded-full bg-red-500/10">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-400">{stats.totalFailed}</p>
                  <p className="text-sm text-red-400/70">Failed</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-yellow-500/5 border-yellow-500/20">
              <CardContent className="pt-6 flex items-center gap-4">
                <div className="p-2 rounded-full bg-yellow-500/10">
                  <RefreshCw className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-400">{stats.totalRefunded}</p>
                  <p className="text-sm text-yellow-400/70">Refunded</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payments Table */}
          <Card className="bg-card border-border overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="font-outfit text-xl">Payment History</CardTitle>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px] bg-background">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="pl-6">Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right pr-6">Job</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                          No payments found
                        </TableCell>
                      </TableRow>
                    ) : (
                      payments.map((payment) => (
                        <TableRow key={payment._id}>
                          <TableCell className="text-muted-foreground pl-6">
                            {formatDate(payment.paidAt || payment.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{payment.customerName}</p>
                              <p className="text-xs text-muted-foreground">{payment.customerEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium font-outfit">
                            {formatCurrency(payment.paymentAmount || payment.totalPrice)}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(payment.paymentStatus)}
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <Link 
                              to={`/admin/jobs`}
                              className="text-primary hover:underline text-sm font-medium"
                            >
                              View Job
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminAppShell>
  )
}
