import { useQuery, useMutation } from 'convex/react'
import { api } from '@convex/api'
import { AdminAppShell } from '@/components/layout/admin-app-shell'
import { cn } from '@/lib/utils'
import { 
  Card, CardContent, CardHeader, CardTitle 
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  DollarSign, Clock, CheckCircle, 
  Loader2, Search, Calendar, Filter,
  MoreHorizontal, Download, Copy, AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { useAdmin } from '@/contexts/admin-context'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminPayoutsPage() {
  const { isAdminLoggedIn } = useAdmin()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPayouts, setSelectedPayouts] = useState<string[]>([])
  const [isMarkPaidOpen, setIsMarkPaidOpen] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer')
  const [paymentRef, setPaymentRef] = useState('')
  const [notes, setNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [singlePayoutId, setSinglePayoutId] = useState<string | null>(null)

  const payouts = useQuery(api.payouts.listPayouts, isAdminLoggedIn ? { 
    status: (statusFilter === 'all' ? undefined : statusFilter) as any 
  } : "skip")
  const markPaid = useMutation(api.payouts.markPayoutPaid)
  const batchMarkPaid = useMutation(api.payouts.batchMarkPayoutsPaid)

  const filteredPayouts = useMemo(() => {
    if (!payouts) return []
    return payouts.filter(p => 
      p.courierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.courierEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.jobId.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [payouts, searchQuery])

  const stats = useMemo(() => {
    if (!payouts) return null
    
    const pending = payouts.filter(p => p.status === 'pending')
    const processing = payouts.filter(p => p.status === 'processing')
    const paidThisMonth = payouts.filter(p => {
      if (p.status !== 'paid' || !p.paidAt) return false
      const date = new Date(p.paidAt)
      const now = new Date()
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    })
    const totalPaid = payouts.filter(p => p.status === 'paid')

    return {
      pending: { count: pending.length, amount: pending.reduce((sum, p) => sum + p.amount, 0) },
      processing: { count: processing.length, amount: processing.reduce((sum, p) => sum + p.amount, 0) },
      paidMonth: { count: paidThisMonth.length, amount: paidThisMonth.reduce((sum, p) => sum + p.amount, 0) },
      totalPaid: { count: totalPaid.length, amount: totalPaid.reduce((sum, p) => sum + p.amount, 0) }
    }
  }, [payouts])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedPayouts(filteredPayouts.filter(p => p.status !== 'paid').map(p => p._id))
    } else {
      setSelectedPayouts([])
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedPayouts(prev => [...prev, id])
    } else {
      setSelectedPayouts(prev => prev.filter(p => p !== id))
    }
  }

  const openMarkPaidDialog = (id?: string) => {
    if (id) {
      setSinglePayoutId(id)
      const payout = payouts?.find(p => p._id === id)
      if (payout?.courierPayoutMethod) {
        setPaymentMethod(payout.courierPayoutMethod)
      } else {
        setPaymentMethod('bank_transfer')
      }
    } else {
      setSinglePayoutId(null)
      setPaymentMethod('bank_transfer')
    }
    setIsMarkPaidOpen(true)
  }

  const handleConfirmPaid = async () => {
    setIsProcessing(true)
    try {
      if (singlePayoutId) {
        await markPaid({
          payoutId: singlePayoutId as any,
          paymentMethod,
          paymentReference: paymentRef,
          notes
        })
        toast.success("Payout marked as paid")
      } else {
        await batchMarkPaid({
          payoutIds: selectedPayouts as any,
          paymentMethod,
          paymentReference: paymentRef
        })
        toast.success(`${selectedPayouts.length} payouts marked as paid`)
        setSelectedPayouts([])
      }
      setIsMarkPaidOpen(false)
      setPaymentRef('')
      setNotes('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update payout")
    } finally {
      setIsProcessing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Paid</Badge>
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Pending</Badge>
      case 'processing':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Processing</Badge>
      case 'failed':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Failed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <AdminAppShell>
      <div className="space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Courier Payouts</h1>
              <p className="text-muted-foreground">Manage and track payments to your delivery partners.</p>
            </div>
            <div className="flex items-center gap-3">
              {selectedPayouts.length > 0 && (
                <Button 
                  onClick={() => openMarkPaidDialog()}
                  className="bg-primary text-primary-foreground animate-in fade-in slide-in-from-right-4"
                >
                  Mark {selectedPayouts.length} as Paid
                </Button>
              )}
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Pending</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                {stats ? (
                  <>
                    <div className="text-2xl font-bold">${stats.pending.amount.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">{stats.pending.count} payouts awaiting processing</p>
                  </>
                ) : (
                  <Skeleton className="h-8 w-24" />
                )}
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Processing</CardTitle>
                <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
              </CardHeader>
              <CardContent>
                {stats ? (
                  <>
                    <div className="text-2xl font-bold">${stats.processing.amount.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">{stats.processing.count} payouts being handled</p>
                  </>
                ) : (
                  <Skeleton className="h-8 w-24" />
                )}
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Paid This Month</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                {stats ? (
                  <>
                    <div className="text-2xl font-bold">${stats.paidMonth.amount.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">{stats.paidMonth.count} payouts completed</p>
                  </>
                ) : (
                  <Skeleton className="h-8 w-24" />
                )}
              </CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid All Time</CardTitle>
                <DollarSign className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                {stats ? (
                  <>
                    <div className="text-2xl font-bold">${stats.totalPaid.amount.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">{stats.totalPaid.count} total settlements</p>
                  </>
                ) : (
                  <Skeleton className="h-8 w-24" />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by courier or job ID..." 
                className="pl-10 bg-card"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px] bg-card">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="bg-card">
                <Calendar className="mr-2 h-4 w-4" />
                Date Range
              </Button>
            </div>
          </div>

          {/* Payout Table */}
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox 
                      checked={filteredPayouts.length > 0 && selectedPayouts.length === filteredPayouts.filter(p => p.status !== 'paid').length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Courier</TableHead>
                  <TableHead>Pay Via</TableHead>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Paid Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts === undefined ? (
                  [1, 2, 3, 4, 5].map(i => (
                    <TableRow key={i}>
                      <TableCell colSpan={9}><Skeleton className="h-12 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredPayouts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                      No payouts found matching your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayouts.map((payout) => (
                    <TableRow key={payout._id} className="group hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <Checkbox 
                          disabled={payout.status === 'paid'}
                          checked={selectedPayouts.includes(payout._id)}
                          onCheckedChange={(checked) => handleSelectOne(payout._id, !!checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{payout.courierName}</span>
                          <span className="text-xs text-muted-foreground">{payout.courierEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {!payout.courierPayoutSetupComplete || !payout.courierPayoutMethod ? (
                          <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-muted-foreground/20">
                            <AlertCircle className="mr-1 h-3 w-3" />
                            Not Set Up
                          </Badge>
                        ) : (
                          <div 
                            className="flex flex-col gap-1 group/details cursor-pointer w-fit" 
                            onClick={() => {
                              if (payout.courierPayoutDetails) {
                                navigator.clipboard.writeText(payout.courierPayoutDetails)
                                toast.success("Payout details copied")
                              }
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <Badge className={cn(
                                "font-medium",
                                payout.courierPayoutMethod === 'zelle' && "bg-purple-500/10 text-purple-500 border-purple-500/20",
                                payout.courierPayoutMethod === 'cashapp' && "bg-green-500/10 text-green-500 border-green-500/20",
                                payout.courierPayoutMethod === 'bank_transfer' && "bg-blue-500/10 text-blue-500 border-blue-500/20"
                              )}>
                                {payout.courierPayoutMethod === 'zelle' && "Zelle"}
                                {payout.courierPayoutMethod === 'cashapp' && "Cash App"}
                                {payout.courierPayoutMethod === 'bank_transfer' && "Bank"}
                              </Badge>
                              <Copy className="h-3 w-3 opacity-0 group-hover/details:opacity-100 transition-opacity text-muted-foreground" />
                            </div>
                            {payout.courierPayoutDetails && (
                              <span className="text-xs text-muted-foreground font-mono">
                                {payout.courierPayoutDetails}
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{payout.jobId.substring(0, 8)}</code>
                      </TableCell>
                      <TableCell className="font-semibold">
                        ${payout.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(payout.status)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(payout.createdAt), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {payout.paidAt ? format(new Date(payout.paidAt), 'MMM d, yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {payout.status !== 'paid' ? (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openMarkPaidDialog(payout._id)}
                            className="text-primary hover:text-primary hover:bg-primary/10"
                          >
                            Mark Paid
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mark as Paid Dialog */}
          <Dialog open={isMarkPaidOpen} onOpenChange={setIsMarkPaidOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Mark as Paid</DialogTitle>
                <DialogDescription>
                  {singlePayoutId 
                    ? "Confirm that this payout has been settled with the courier."
                    : `Confirm settlement for ${selectedPayouts.length} selected payouts.`
                  }
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="method">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger id="method">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="zelle">Zelle</SelectItem>
                      <SelectItem value="cashapp">Cash App</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="venmo">Venmo</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ref">Payment Reference (Optional)</Label>
                  <Input 
                    id="ref" 
                    placeholder="Transaction ID, check #, etc." 
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                  />
                </div>
                {singlePayoutId && (
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Input 
                      id="notes" 
                      placeholder="Internal notes..." 
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsMarkPaidOpen(false)}>Cancel</Button>
                <Button onClick={handleConfirmPaid} disabled={isProcessing}>
                  {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm Payment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </AdminAppShell>
  )
}
