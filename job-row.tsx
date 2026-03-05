import { TableCell, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  ChevronDown, 
  ChevronUp, 
  MoreHorizontal, 
  MapPin, 
  Truck, 
  Clock, 
  Package as PackageIcon,
  DollarSign,
  Camera
} from "lucide-react"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useState } from "react"

export interface Job {
  id: string
  customer: string
  courier: string | null
  status: 'Draft' | 'Requested' | 'Matched' | 'In Progress' | 'Completed' | 'Cancelled'
  created: string
  amount: number
  platformCommission: number
  courierPayout: number
  pickup: string
  delivery: string
  items: number
  isManualAddress?: boolean
}

interface JobRowProps {
  job: Job
  onAssign?: (id: string) => void
  onCancel?: (id: string) => void
  onViewDetails?: (id: string) => void
}

export function JobRow({ job, onAssign, onCancel, onViewDetails }: JobRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const statusColors = {
    Draft: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    Requested: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    Matched: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    "In Progress": "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    Completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    Cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  }

  return (
    <>
      <TableRow className={cn("group transition-colors", isExpanded ? "bg-muted/30" : "hover:bg-muted/50")}>
        <TableCell className="py-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </TableCell>
        <TableCell className="font-mono text-xs font-medium">#{job.id}</TableCell>
        <TableCell className="font-medium">{job.customer}</TableCell>
        <TableCell className="text-muted-foreground">
          {job.courier ? (
            <div className="flex items-center gap-1.5">
              <Truck className="h-3 w-3" />
              {job.courier}
            </div>
          ) : (
            <span className="text-xs italic">Unassigned</span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("px-2.5 py-0.5 rounded-full font-medium text-[10px] uppercase tracking-wider whitespace-nowrap", statusColors[job.status])}>
              {job.status}
            </Badge>
            {job.isManualAddress && (
              <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-500">
                Manual
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">{job.created}</TableCell>
        <TableCell className="text-right font-bold text-primary">${job.amount.toFixed(2)}</TableCell>
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setIsExpanded(!isExpanded)}>
                <PackageIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                {isExpanded ? "Hide Summary" : "View Summary"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewDetails?.(job.id)}>
                <Camera className="mr-2 h-4 w-4 text-primary" />
                View Full Details
              </DropdownMenuItem>
              {!job.courier && job.status === 'Requested' && (
                <DropdownMenuItem onClick={() => onAssign?.(job.id)}>
                  <Truck className="mr-2 h-4 w-4 text-emerald-500" />
                  Assign Courier
                </DropdownMenuItem>
              )}
              {job.status !== 'Cancelled' && job.status !== 'Completed' && (
                <DropdownMenuItem className="text-destructive" onClick={() => onCancel?.(job.id)}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel Job
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
      
      {isExpanded && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={8} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-3 w-3" /> Route Details
                </h4>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                      <div className="w-px h-full bg-border" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground font-semibold flex items-center gap-2">
                        Pickup
                        {job.isManualAddress && (
                          <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-500 py-0 h-4">
                            Manual
                          </Badge>
                        )}
                      </p>
                      <p className="text-sm">{job.pickup}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full border-2 border-primary" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground font-semibold">Delivery</p>
                      <p className="text-sm">{job.delivery}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <PackageIcon className="h-3 w-3" /> Package Info
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Number of Items</span>
                    <span className="font-medium">{job.items}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Weight Class</span>
                    <span className="font-medium">Medium (5-10kg)</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Priority</span>
                    <Badge variant="secondary" className="text-[10px]">Standard</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Clock className="h-3 w-3" /> Timeline
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Requested</span>
                    <span className="font-medium">{job.created}</span>
                  </div>
                  {job.status === 'Completed' && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Delivered</span>
                      <span className="font-medium">Today, 2:45 PM</span>
                    </div>
                  )}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <DollarSign className="h-3 w-3" /> Financial Breakdown
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Customer Paid</span>
                        <span className="font-medium">${job.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Platform Fee (25%)</span>
                        <span className="font-medium text-primary">${job.platformCommission.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-t border-border pt-2">
                        <span className="font-bold">Courier Payout</span>
                        <span className="font-bold text-emerald-500">${job.courierPayout.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

function XCircle(props: any) {
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
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  )
}
