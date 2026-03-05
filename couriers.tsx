import { AdminAppShell } from '@/components/layout/admin-app-shell'
import { CourierRow } from "@/components/admin/courier-row"
import { 
  Table, 
  TableBody, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Search, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { toast } from "sonner"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/api"
import { Skeleton } from "@/components/ui/skeleton"
import { Id } from "@convex/dataModel"
import { useAdmin } from '@/contexts/admin-context'

export default function AdminCouriers() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)
  const { isAdminLoggedIn } = useAdmin()
  
  const applications = useQuery(api.couriers.listApplications, isAdminLoggedIn ? { 
    status: statusFilter as "pending_review" | "approved" | "denied" | "suspended" | undefined 
  } : "skip")
  const pendingCount = useQuery(api.couriers.countPendingApplications, isAdminLoggedIn ? {} : "skip")
  const updateStatus = useMutation(api.couriers.updateApplicationStatus)

  const handleApprove = async (id: string) => {
    try {
      await updateStatus({ 
        applicationId: id as Id<"courierApplications">, 
        status: "approved" 
      })
      toast.success("Courier application approved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve application")
    }
  }

  const handleReject = async (id: string) => {
    try {
      await updateStatus({ 
        applicationId: id as Id<"courierApplications">, 
        status: "denied" 
      })
      toast.error("Courier application denied")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to deny application")
    }
  }

  const mappedCouriers = applications?.map(app => ({
    id: app._id,
    name: app.fullName,
    email: app.email,
    dateApplied: app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : 'N/A',
    vehicle: `${app.vehicleMake} ${app.vehicleModel} (${app.vehiclePlate})`,
    status: app.status,
    payoutSetupStatus: app.payoutSetupStatus,
    backgroundCheckStatus: app.backgroundCheckStatus,
    licenseCheckStatus: app.licenseCheckStatus,
    avatar: undefined 
  })) || []

  const filteredCouriers = mappedCouriers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.email.toLowerCase().includes(search.toLowerCase())
  )

  const renderCourierTable = (status?: string) => {
    if (applications === undefined) {
      return (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      )
    }

    const data = status && status !== 'all' 
      ? filteredCouriers.filter(c => c.status === status) 
      : filteredCouriers
    
    if (data.length === 0) {
      return (
        <div className="py-20 text-center border-2 border-dashed border-border rounded-xl bg-card/50">
          <p className="text-muted-foreground">No couriers found for this category.</p>
        </div>
      )
    }

    return (
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[300px]">Courier</TableHead>
              <TableHead>Applied Date</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Verification</TableHead>
              <TableHead>Payout Status</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((courier) => (
              <CourierRow 
                key={courier.id} 
                courier={courier as any} 
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <AdminAppShell>
      <div className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Couriers</h1>
              <p className="text-muted-foreground">Manage and review courier applications and performance.</p>
            </div>
            {pendingCount !== undefined && pendingCount > 0 && (
              <Badge variant="destructive" className="animate-pulse">
                {pendingCount} New Application{pendingCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name or email..." 
                className="pl-10 bg-card"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button variant="outline" className="w-full md:w-auto">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
          </div>

          <Tabs defaultValue="all" className="space-y-6" onValueChange={(v) => setStatusFilter(v === 'all' ? undefined : v)}>
            <TabsList className="bg-card border border-border p-1">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending_review" className="relative">
                Pending
                {pendingCount !== undefined && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                    {pendingCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="denied">Denied</TabsTrigger>
              <TabsTrigger value="suspended">Suspended</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="mt-0">
              {renderCourierTable('all')}
            </TabsContent>
            <TabsContent value="pending_review" className="mt-0">
              {renderCourierTable('pending_review')}
            </TabsContent>
            <TabsContent value="approved" className="mt-0">
              {renderCourierTable('approved')}
            </TabsContent>
            <TabsContent value="denied" className="mt-0">
              {renderCourierTable('denied')}
            </TabsContent>
            <TabsContent value="suspended" className="mt-0">
              {renderCourierTable('suspended')}
            </TabsContent>
          </Tabs>
      </div>
    </AdminAppShell>
  )
}
