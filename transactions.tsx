import { AdminAppShell } from '@/components/layout/admin-app-shell'
import { useAdmin } from '@/contexts/admin-context'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Search, 
  Download, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCcw,
  Filter,
  MoreHorizontal
} from "lucide-react"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/api"
import { Skeleton } from "@/components/ui/skeleton"
import { Id } from "@convex/dataModel"

interface Transaction {
  id: string
  date: string
  type: 'Payment' | 'Payout' | 'Refund' | 'Commission'
  customer: string
  courier: string | null
  amount: number
  status: 'Completed' | 'Pending' | 'Failed' | 'Processing'
  jobId?: string
}

export default function AdminTransactions() {
  const { isAdminLoggedIn } = useAdmin()
  const [search, setSearch] = useState('')
  const transactionsData = useQuery(api.transactions.listTransactions, isAdminLoggedIn ? {} : "skip")
  const issueRefund = useMutation(api.transactions.issueRefund)

  const handleRefund = async (jobId: string) => {
    try {
      await issueRefund({ jobId: jobId as Id<"jobs"> })
      toast.success(`Refund initiated`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to issue refund")
    }
  }

  const mapType = (type: string): Transaction['type'] => {
    switch (type) {
      case 'payment': return 'Payment';
      case 'payout': return 'Payout';
      case 'refund': return 'Refund';
      case 'commission': return 'Commission';
      default: return 'Payment';
    }
  }

  const mapStatus = (status: string): Transaction['status'] => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'pending': return 'Pending';
      case 'failed': return 'Failed';
      case 'processing': return 'Processing';
      default: return 'Pending';
    }
  }

  const mappedTransactions: Transaction[] = transactionsData?.map(t => ({
    id: t._id,
    date: new Date(t.createdAt).toLocaleString(),
    type: mapType(t.type),
    customer: t.customerId?.substring(0, 8) || 'System',
    courier: t.courierId?.substring(0, 8) || null,
    amount: t.amount,
    status: mapStatus(t.status),
    jobId: t.jobId
  })) || []

  const filteredTransactions = mappedTransactions.filter(t => 
    t.id.toLowerCase().includes(search.toLowerCase()) || 
    t.customer.toLowerCase().includes(search.toLowerCase()) ||
    (t.courier && t.courier.toLowerCase().includes(search.toLowerCase()))
  )

  const totalRevenue = mappedTransactions
    .filter(t => t.type === 'Commission' && t.status === 'Completed')
    .reduce((acc, curr) => acc + curr.amount, 0)

  return (
    <AdminAppShell>
      <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
              <p className="text-muted-foreground">Financial logs and platform revenue tracking.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 border border-primary/20 px-4 py-2 rounded-xl flex flex-col items-end">
                <span className="text-[10px] uppercase font-bold text-primary tracking-wider">Total Revenue (Fee Share)</span>
                <span className="text-xl font-bold text-primary">${totalRevenue.toFixed(2)}</span>
              </div>
              <Button variant="outline" size="icon" className="h-10 w-10">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by ID, customer, or courier..." 
                className="pl-10 bg-card"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <Button variant="outline" className="flex-1 md:flex-none">
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
              <Button className="flex-1 md:flex-none bg-primary text-primary-foreground hover:bg-primary/90">
                Export Report
              </Button>
            </div>
          </div>

          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Courier</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactionsData === undefined ? (
                  [1, 2, 3, 4, 5].map(i => (
                    <TableRow key={i}>
                      <TableCell colSpan={8}><Skeleton className="h-12 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredTransactions.length > 0 ? filteredTransactions.map((tx) => (
                  <TableRow key={tx.id} className="group hover:bg-muted/50 transition-colors">
                    <TableCell className="font-mono text-xs font-medium">{tx.id.substring(0, 8)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{tx.date}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {tx.type === 'Payment' && <ArrowDownLeft className="h-3 w-3 text-emerald-500" />}
                        {tx.type === 'Payout' && <ArrowUpRight className="h-3 w-3 text-blue-500" />}
                        {tx.type === 'Refund' && <RefreshCcw className="h-3 w-3 text-orange-500" />}
                        {tx.type === 'Commission' && <DollarSign className="h-3 w-3 text-primary" />}
                        <span className="text-sm font-medium">{tx.type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{tx.customer}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {tx.courier || <span className="text-[10px] italic">N/A</span>}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${tx.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "px-2 py-0 rounded-full text-[10px] uppercase font-bold",
                        tx.status === 'Completed' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                        tx.status === 'Pending' || tx.status === 'Processing' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                        "bg-destructive/10 text-destructive border-destructive/20"
                      )}>
                        {tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          {tx.type === 'Payment' && tx.status === 'Completed' && tx.jobId && (
                            <DropdownMenuItem className="text-destructive" onClick={() => handleRefund(tx.jobId!)}>
                              Issue Refund
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      No transactions found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </AdminAppShell>
  )
}

function DollarSign(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}
