import { AdminAppShell } from '@/components/layout/admin-app-shell'
import { JobRow, Job } from "@/components/admin/job-row"
import { JobDetailDialog } from '@/components/admin/job-detail-dialog'
import { 
  Table, 
  TableBody, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Search, Filter, Map as MapIcon, List, Loader2, UserCheck, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { toast } from "sonner"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/api"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Id } from "@convex/dataModel"
import { useAdmin } from '@/contexts/admin-context'

export default function AdminJobs() {
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [selectedDetailJobId, setSelectedDetailJobId] = useState<string | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)
  const { isAdminLoggedIn } = useAdmin()

  const jobsData = useQuery(api.jobs.listAllJobs, isAdminLoggedIn ? {} : "skip")
  const cancelJobMutation = useMutation(api.jobs.adminCancelJob)
  
  // Get approved couriers for assignment
  const approvedCouriers = useQuery(api.couriers.listApplications, isAdminLoggedIn ? { status: "approved" } : "skip")
  const assignCourierMutation = useMutation(api.jobs.assignCourier)


  const handleCancel = async (jobId: string) => {
    console.log("[AdminJobs] Cancelling job:", jobId)
    try {
      await cancelJobMutation({ jobId: jobId as Id<"jobs"> })
      toast.success("Job cancelled successfully")
    } catch (error) {
      console.error("[AdminJobs] Cancel job error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to cancel job")
    }
  }

  const handleAssign = (jobId: string) => {
    setSelectedJobId(jobId)
    setAssignDialogOpen(true)
  }

  const handleViewDetails = (jobId: string) => {
    setSelectedDetailJobId(jobId)
    setDetailDialogOpen(true)
  }

  const handleAssignCourier = async (courierId: string) => {
    if (!selectedJobId) return
    
    setIsAssigning(true)
    try {
      await assignCourierMutation({
        jobId: selectedJobId as Id<"jobs">,
        courierId: courierId as Id<"users">,
      })
      toast.success("Courier assigned successfully!")
      setAssignDialogOpen(false)
      setSelectedJobId(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign courier")
    } finally {
      setIsAssigning(false)
    }
  }

  const mapStatus = (status: string): Job['status'] => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'requested': return 'Requested';
      case 'matched': return 'Matched';
      case 'en_route':
      case 'arrived':
      case 'picked_up':
      case 'dropped_off': return 'In Progress';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return 'Draft'; // Unknown statuses default to Draft, not Requested
    }
  }

  const mappedJobs: Job[] = jobsData?.map(j => ({
    id: j._id,
    customer: j.customerId.substring(0, 8), // Ideally we'd join with profile
    courier: j.courierId?.substring(0, 8) || null,
    status: mapStatus(j.status),
    created: new Date(j.createdAt).toLocaleString(),
    amount: j.totalPrice,
    platformCommission: j.platformCommission,
    courierPayout: j.courierPayout,
    pickup: j.pickupAddress,
    delivery: "Carrier", // In this app, delivery is always to a carrier
    items: j.packageCount,
    isManualAddress: j.isManualAddress
  })) || []

  const filteredJobs = mappedJobs.filter(j => 
    j.id.toLowerCase().includes(search.toLowerCase()) || 
    j.customer.toLowerCase().includes(search.toLowerCase()) ||
    (j.courier && j.courier.toLowerCase().includes(search.toLowerCase()))
  )

  const renderJobTable = (status?: string) => {
    if (jobsData === undefined) {
      return (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      )
    }

    const data = status && status !== 'All' 
      ? filteredJobs.filter(j => j.status === status) 
      : filteredJobs
    
    if (data.length === 0) {
      return (
        <div className="py-20 text-center border-2 border-dashed border-border rounded-xl bg-card/50">
          <p className="text-muted-foreground">No jobs found for this category.</p>
        </div>
      )
    }

    return (
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Courier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((job) => (
              <JobRow 
                key={job.id} 
                job={job} 
                onAssign={handleAssign}
                onCancel={handleCancel}
                onViewDetails={handleViewDetails}
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Jobs</h1>
              <p className="text-muted-foreground">Monitor and manage all delivery requests.</p>
            </div>
            <div className="flex items-center gap-2 bg-card border border-border p-1 rounded-lg">
              <Button 
                variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-8"
                onClick={() => setViewMode('list')}
              >
                <List className="mr-2 h-4 w-4" /> List
              </Button>
              <Button 
                variant={viewMode === 'map' ? 'secondary' : 'ghost'} 
                size="sm" 
                className="h-8"
                onClick={() => setViewMode('map')}
              >
                <MapIcon className="mr-2 h-4 w-4" /> Map
              </Button>
            </div>
          </div>

          {viewMode === 'list' ? (
            <>
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
                    Export CSV
                  </Button>
                </div>
              </div>

              <Tabs defaultValue="All" className="space-y-6">
                <TabsList className="bg-card border border-border p-1 flex-wrap h-auto">
                  <TabsTrigger value="All">All</TabsTrigger>
                  <TabsTrigger value="Draft">Draft</TabsTrigger>
                  <TabsTrigger value="Requested">Requested</TabsTrigger>
                  <TabsTrigger value="Matched">Matched</TabsTrigger>
                  <TabsTrigger value="In Progress">In Progress</TabsTrigger>
                  <TabsTrigger value="Completed">Completed</TabsTrigger>
                  <TabsTrigger value="Cancelled">Cancelled</TabsTrigger>
                </TabsList>
                
                <TabsContent value="All" className="mt-0">{renderJobTable('All')}</TabsContent>
                <TabsContent value="Draft" className="mt-0">{renderJobTable('Draft')}</TabsContent>
                <TabsContent value="Requested" className="mt-0">{renderJobTable('Requested')}</TabsContent>
                <TabsContent value="Matched" className="mt-0">{renderJobTable('Matched')}</TabsContent>
                <TabsContent value="In Progress" className="mt-0">{renderJobTable('In Progress')}</TabsContent>
                <TabsContent value="Completed" className="mt-0">{renderJobTable('Completed')}</TabsContent>
                <TabsContent value="Cancelled" className="mt-0">{renderJobTable('Cancelled')}</TabsContent>
              </Tabs>
            </>
          ) : (
            <div className="h-[600px] w-full bg-card border border-border rounded-2xl flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <MapIcon className="w-8 h-8" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold">Interactive Map View</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">This feature is currently in development. Soon you'll be able to track all active couriers and jobs in real-time.</p>
              </div>
              <Button variant="outline" onClick={() => setViewMode('list')}>Back to List View</Button>
            </div>
          )}
        </div>

        {/* Courier Assignment Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                Assign Courier
              </DialogTitle>
              <DialogDescription>
                Select a courier to assign to job #{selectedJobId?.slice(0, 8)}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {approvedCouriers === undefined ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : approvedCouriers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Truck className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No approved couriers available</p>
                </div>
              ) : (
                approvedCouriers.map((courier) => (
                  <button
                    key={courier._id}
                    onClick={() => handleAssignCourier(courier.userId)}
                    disabled={isAssigning}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage 
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${courier.fullName}`} 
                        alt={courier.fullName} 
                      />
                      <AvatarFallback>{courier.fullName?.charAt(0) || 'C'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{courier.fullName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {courier.vehicleYear} {courier.vehicleMake} {courier.vehicleModel} • {courier.vehicleColor}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge 
                        variant={courier.isOnline ? "default" : "secondary"}
                        className={courier.isOnline ? "bg-emerald-500" : ""}
                      >
                        {courier.isOnline ? "Online" : "Offline"}
                      </Badge>
                    </div>
                  </button>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        <JobDetailDialog
          jobId={selectedDetailJobId}
          isOpen={detailDialogOpen}
          onClose={() => {
            setDetailDialogOpen(false)
            setSelectedDetailJobId(null)
          }}
        />
      </AdminAppShell>
  )
}
