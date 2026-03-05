import { TableCell, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  XCircle, 
  MoreHorizontal, 
  Eye, 
  UserMinus, 
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  ShieldEllipsis,
  FileCheck,
  FileWarning,
  FileX,
  CheckCircle2,
  Clock
} from "lucide-react"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useNavigate } from "react-router"
import { cn } from "@/lib/utils"

export interface Courier {
  id: string
  name: string
  email: string
  dateApplied: string
  vehicle: string
  status: 'pending_review' | 'approved' | 'denied' | 'suspended'
  payoutSetupStatus?: 'not_started' | 'pending' | 'complete'
  backgroundCheckStatus?: 'not_started' | 'in_progress' | 'cleared' | 'flagged'
  licenseCheckStatus?: 'not_started' | 'verified' | 'expired' | 'mismatch'
  avatar?: string
}

interface CourierRowProps {
  courier: Courier
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
}

export function CourierRow({ courier, onApprove, onReject }: CourierRowProps) {
  const navigate = useNavigate()

  const statusColors = {
    pending_review: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    approved: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    denied: "bg-destructive/10 text-destructive border-destructive/20",
    suspended: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  }

  const renderBackgroundStatus = () => {
    switch (courier.backgroundCheckStatus) {
      case 'cleared':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
              </TooltipTrigger>
              <TooltipContent>Background Check: Cleared</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      case 'flagged':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <ShieldAlert className="h-4 w-4 text-destructive" />
              </TooltipTrigger>
              <TooltipContent>Background Check: Flagged</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      case 'in_progress':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <ShieldEllipsis className="h-4 w-4 text-yellow-500" />
              </TooltipTrigger>
              <TooltipContent>Background Check: In Progress</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      default:
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <ShieldEllipsis className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>Background Check: Not Started</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
    }
  }

  const renderLicenseStatus = () => {
    switch (courier.licenseCheckStatus) {
      case 'verified':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <FileCheck className="h-4 w-4 text-emerald-500" />
              </TooltipTrigger>
              <TooltipContent>License Check: Verified</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      case 'expired':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <FileWarning className="h-4 w-4 text-orange-500" />
              </TooltipTrigger>
              <TooltipContent>License Check: Expired</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      case 'mismatch':
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <FileX className="h-4 w-4 text-destructive" />
              </TooltipTrigger>
              <TooltipContent>License Check: Mismatch</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      default:
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <FileX className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>License Check: Not Started</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
    }
  }

  const renderPayoutStatus = () => {
    switch (courier.payoutSetupStatus) {
      case 'complete':
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1 px-2 py-0.5 rounded-full font-medium text-[10px] uppercase tracking-wider">
            <CheckCircle2 className="h-3 w-3" /> Payout Ready
          </Badge>
        )
      case 'pending':
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 gap-1 px-2 py-0.5 rounded-full font-medium text-[10px] uppercase tracking-wider">
            <Clock className="h-3 w-3" /> Payout Pending
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="bg-slate-500/10 text-slate-500 border-slate-500/20 gap-1 px-2 py-0.5 rounded-full font-medium text-[10px] uppercase tracking-wider">
            No Payout
          </Badge>
        )
    }
  }

  return (
    <TableRow className="group hover:bg-muted/50 transition-colors">
      <TableCell className="py-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border border-border">
            <AvatarImage src={courier.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${courier.name}`} />
            <AvatarFallback>{courier.name[0]}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-semibold text-sm">{courier.name}</span>
            <span className="text-xs text-muted-foreground">{courier.email}</span>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-sm">{courier.dateApplied}</TableCell>
      <TableCell className="text-sm font-medium">{courier.vehicle}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {renderBackgroundStatus()}
          {renderLicenseStatus()}
        </div>
      </TableCell>
      <TableCell>
        {renderPayoutStatus()}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn("px-2.5 py-0.5 rounded-full font-medium text-[10px] uppercase tracking-wider", statusColors[courier.status])}>
          {courier.status.replace('_', ' ')}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          {courier.status === 'pending_review' && (
            <>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                onClick={() => onApprove?.(courier.id)}
              >
                <UserCheck className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                onClick={() => onReject?.(courier.id)}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate(`/admin/couriers/${courier.id}`)}>
                <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                View Profile
              </DropdownMenuItem>
              {courier.status === 'approved' && (
                <DropdownMenuItem className="text-destructive">
                  <UserMinus className="mr-2 h-4 w-4" />
                  Suspend Courier
                </DropdownMenuItem>
              )}
              {courier.status === 'suspended' && (
                <DropdownMenuItem className="text-emerald-500">
                  <UserCheck className="mr-2 h-4 w-4" />
                  Reactivate Courier
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  )
}
