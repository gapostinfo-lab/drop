import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/api"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  MessageSquare, 
  Send, 
  RefreshCw, 
  ChevronLeft,
  Clock,
  CheckCircle2,
  Filter,
  ExternalLink,
  User,
  Package,
  MapPin,
  Phone,
  AlertTriangle,
  CheckCircle,
  Tag
} from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { cn } from "@/lib/utils"
import { Id } from "@convex/dataModel"
import { Link } from "react-router"

const TICKET_TYPE_LABELS: Record<string, string> = {
  app_bug: "App Bug",
  cannot_find_courier: "Can't Find Courier",
  courier_not_arrived: "Courier Not Arrived",
  wrong_package: "Wrong Package",
  not_delivered: "Not Delivered",
  payment_issue: "Payment Issue",
  cancel_pickup: "Cancel Pickup",
  change_address: "Change Address",
  driver_behavior: "Driver Behavior",
  general_question: "General Question",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-500/20 text-blue-400",
  in_progress: "bg-yellow-500/20 text-yellow-400",
  resolved: "bg-green-500/20 text-green-400",
  closed: "bg-slate-500/20 text-slate-400",
};

export default function AdminSupportPage() {
  const isMobile = useIsMobile()
  const [selectedTicketId, setSelectedTicketId] = useState<Id<"supportTickets"> | null>(null)
  const [messageText, setMessageText] = useState("")
  const [showMobileChat, setShowMobileChat] = useState(false)
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [priorityFilter, setPriorityFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [roleFilter, setRoleFilter] = useState<string>("all")

  const scrollRef = useRef<HTMLDivElement>(null)

  // Queries
  const stats = useQuery(api.support.getTicketStats)
  const tickets = useQuery(api.support.listTicketsAdmin, {
    status: statusFilter === "all" ? undefined : statusFilter,
    priority: priorityFilter === "all" ? undefined : priorityFilter,
    ticketType: typeFilter === "all" ? undefined : typeFilter,
    createdByRole: roleFilter === "all" ? undefined : roleFilter,
  })
  
  const selectedTicket = useQuery(
    api.support.getTicket, 
    selectedTicketId ? { ticketId: selectedTicketId } : "skip"
  )
  const messages = useQuery(
    api.support.listMessages, 
    selectedTicketId ? { ticketId: selectedTicketId } : "skip"
  )

  // Mutations
  const sendMessage = useMutation(api.support.sendMessage)
  const markRead = useMutation(api.support.markRead)
  const updateStatus = useMutation(api.support.updateTicketStatus)
  const updatePriority = useMutation(api.support.updateTicketPriority)

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Mark as read when viewing a ticket
  useEffect(() => {
    if (selectedTicketId) {
      markRead({ ticketId: selectedTicketId, viewerType: "admin" }).catch(console.error)
    }
  }, [selectedTicketId, messages?.length, markRead])

  const handleSelectTicket = (id: Id<"supportTickets">) => {
    setSelectedTicketId(id)
    if (isMobile) {
      setShowMobileChat(true)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTicketId || !messageText.trim()) return

    try {
      await sendMessage({
        ticketId: selectedTicketId,
        body: messageText.trim()
      })
      setMessageText("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message")
    }
  }

  const handleUpdateStatus = async (status: string) => {
    if (!selectedTicketId) return
    try {
      await updateStatus({ 
        ticketId: selectedTicketId, 
        status: status as any 
      })
      toast.success(`Status updated to ${status.replace("_", " ")}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status")
    }
  }

  const handleUpdatePriority = async (priority: string) => {
    if (!selectedTicketId) return
    try {
      await updatePriority({ 
        ticketId: selectedTicketId, 
        priority: priority as any 
      })
      toast.success(`Priority updated to ${priority}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update priority")
    }
  }

  const StatsBar = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b bg-muted/30">
      <Card className="bg-background/50">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Tickets</p>
            <p className="text-2xl font-bold">{stats?.total ?? "..."}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
            <MessageSquare className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
      <Card className="bg-background/50">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Open</p>
            <p className="text-2xl font-bold">{stats?.open ?? "..."}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <Clock className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
      <Card className="bg-background/50">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">In Progress</p>
            <p className="text-2xl font-bold">{stats?.inProgress ?? "..."}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
            <RefreshCw className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
      <Card className="bg-background/50">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">High Priority</p>
            <p className="text-2xl font-bold text-red-500">{stats?.highPriority ?? "..."}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </div>
  )

  const FilterBar = (
    <div className="p-4 border-b flex flex-wrap gap-3 items-center bg-card">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filters:</span>
      </div>
      
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="in_progress">In Progress</SelectItem>
          <SelectItem value="resolved">Resolved</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
        </SelectContent>
      </Select>

      <Select value={priorityFilter} onValueChange={setPriorityFilter}>
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priorities</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>

      <Select value={typeFilter} onValueChange={setTypeFilter}>
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {Object.entries(TICKET_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={roleFilter} onValueChange={setRoleFilter}>
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="All Users" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Users</SelectItem>
          <SelectItem value="customer">Customers</SelectItem>
          <SelectItem value="courier">Couriers</SelectItem>
        </SelectContent>
      </Select>

      <Button 
        variant="ghost" 
        size="sm" 
        className="h-9"
        onClick={() => {
          setStatusFilter("all")
          setPriorityFilter("all")
          setTypeFilter("all")
          setRoleFilter("all")
        }}
      >
        Reset
      </Button>
    </div>
  )

  const TicketList = (
    <div className="flex flex-col h-full border-r">
      <div className="p-4 border-b flex items-center justify-between bg-card">
        <h2 className="text-xl font-bold">Support Inbox</h2>
        <Badge variant="outline">{tickets?.length || 0}</Badge>
      </div>
      <ScrollArea className="flex-1">
        {tickets === undefined ? (
          <div className="p-8 text-center text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p>Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>No tickets found</p>
          </div>
        ) : (
          <div className="divide-y">
            {tickets.map((ticket) => (
              <button
                key={ticket._id}
                onClick={() => handleSelectTicket(ticket._id)}
                className={cn(
                  "w-full p-4 text-left transition-colors hover:bg-muted/50 flex flex-col gap-2",
                  selectedTicketId === ticket._id && "bg-muted"
                )}
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">
                      {ticket.customerName}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {ticket.customerEmail}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(ticket.updatedAt, { addSuffix: true })}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium truncate flex-1 mr-2">
                    {ticket.subject}
                  </span>
                  {(ticket as any).adminUnread > 0 && (
                    <Badge variant="default" className="h-5 min-w-5 px-1 flex items-center justify-center rounded-full text-[10px]">
                      {(ticket as any).adminUnread}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[10px] px-1.5 py-0 border",
                      ticket.createdByRole === "courier" 
                        ? "border-blue-500/50 text-blue-500 bg-blue-500/10"
                        : "border-green-500/50 text-green-500 bg-green-500/10"
                    )}
                  >
                    {ticket.createdByRole === "courier" ? "Courier" : "Customer"}
                  </Badge>
                  <Badge 
                    variant="outline"
                    className={cn("text-[10px] px-1.5 py-0 border", STATUS_COLORS[ticket.status])}
                  >
                    {ticket.status.replace("_", " ")}
                  </Badge>
                  {ticket.priority && (
                    <Badge 
                      variant="outline"
                      className={cn("text-[10px] px-1.5 py-0 border", PRIORITY_COLORS[ticket.priority])}
                    >
                      {ticket.priority}
                    </Badge>
                  )}
                  {ticket.ticketType && (
                    <Badge 
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 bg-secondary/50"
                    >
                      {TICKET_TYPE_LABELS[ticket.ticketType] || ticket.ticketType}
                    </Badge>
                  )}
                  {ticket.jobId && (
                    <Badge 
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-500 border-blue-500/20"
                    >
                      Job Attached
                    </Badge>
                  )}
                </div>

                {ticket.lastMessage && (
                  <p className="text-[11px] text-muted-foreground truncate line-clamp-1">
                    {ticket.lastMessage}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )

  const ChatView = (
    <div className="flex flex-col h-full">
      {!selectedTicketId ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <MessageSquare className="h-8 w-8 opacity-20" />
          </div>
          <h3 className="text-lg font-medium text-foreground">No Ticket Selected</h3>
          <p className="text-center max-w-[250px]">
            Select a ticket from the list to view the conversation and respond.
          </p>
        </div>
      ) : !selectedTicket ? (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Chat Header */}
          <div className="p-4 border-b flex flex-col gap-4 bg-card shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                {isMobile && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setShowMobileChat(false)}
                    className="-ml-2"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                )}
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {selectedTicket.customerName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="overflow-hidden">
                  <h3 className="font-semibold truncate leading-tight">
                    {selectedTicket.subject}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{selectedTicket.customerName}</span>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "text-[10px] h-4 px-1 py-0",
                        selectedTicket.createdByRole === "courier" 
                          ? "border-blue-500/50 text-blue-500 bg-blue-500/10"
                          : "border-green-500/50 text-green-500 bg-green-500/10"
                      )}
                    >
                      {selectedTicket.createdByRole === "courier" ? "Courier" : "Customer"}
                    </Badge>
                    <span>•</span>
                    <span className="truncate">{selectedTicket.customerEmail}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select value={selectedTicket.status} onValueChange={handleUpdateStatus}>
                  <SelectTrigger className={cn("h-8 w-[130px] text-xs", STATUS_COLORS[selectedTicket.status])}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={selectedTicket.priority ?? "medium"} onValueChange={handleUpdatePriority}>
                  <SelectTrigger className={cn("h-8 w-[110px] text-xs", selectedTicket.priority ? PRIORITY_COLORS[selectedTicket.priority] : "")}>
                    <SelectValue placeholder="Set priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-xs">
              {selectedTicket.ticketType && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Tag className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground">{TICKET_TYPE_LABELS[selectedTicket.ticketType] || selectedTicket.ticketType}</span>
                </div>
              )}
              {selectedTicket.jobId && (
                <Link 
                  to={`/admin/jobs?id=${selectedTicket.jobId}`}
                  className="flex items-center gap-1.5 text-blue-500 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Job ID: {selectedTicket.jobId.substring(0, 8)}...</span>
                </Link>
              )}
            </div>

            {selectedTicket.jobSnapshot && (
              <div className="p-3 rounded-lg bg-muted/50 border text-xs space-y-2">
                <div className="flex items-center justify-between font-semibold border-b pb-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" />
                    <span>Job Snapshot</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] h-4">
                    {selectedTicket.jobSnapshot.status}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="h-3 w-3 mt-0.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Pickup:</span>
                    <span className="font-medium truncate">{selectedTicket.jobSnapshot.pickupAddress}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <MapPin className="h-3 w-3 mt-0.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Dropoff:</span>
                    <span className="font-medium truncate">{selectedTicket.jobSnapshot.dropoffLocationName}</span>
                  </div>
                  {selectedTicket.jobSnapshot.courierName && (
                    <div className="flex items-start gap-1.5">
                      <User className="h-3 w-3 mt-0.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Courier:</span>
                      <span className="font-medium">{selectedTicket.jobSnapshot.courierName}</span>
                    </div>
                  )}
                  {selectedTicket.jobSnapshot.courierPhone && (
                    <div className="flex items-start gap-1.5">
                      <Phone className="h-3 w-3 mt-0.5 text-muted-foreground" />
                      <span className="text-muted-foreground">Phone:</span>
                      <span className="font-medium">{selectedTicket.jobSnapshot.courierPhone}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Messages Area */}
          <ScrollArea className="flex-1 p-4" viewportRef={scrollRef}>
            <div className="space-y-4">
              <div className="flex justify-center my-4">
                <div className="bg-muted text-[10px] px-2 py-1 rounded-full text-muted-foreground uppercase tracking-wider font-semibold">
                  Ticket Created {formatDistanceToNow(selectedTicket.createdAt, { addSuffix: true })}
                </div>
              </div>
              
              {messages?.map((msg) => {
                const isAdmin = msg.senderType === "admin"
                return (
                  <div
                    key={msg._id}
                    className={cn(
                      "flex",
                      isAdmin ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                        isAdmin 
                          ? "bg-primary text-primary-foreground rounded-tr-none" 
                          : "bg-muted text-foreground rounded-tl-none"
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                      <div 
                        className={cn(
                          "text-[10px] mt-1 flex items-center gap-1 opacity-70",
                          isAdmin ? "justify-end" : "justify-start"
                        )}
                      >
                        {formatDistanceToNow(msg.createdAt, { addSuffix: true })}
                        {isAdmin && (
                          msg.readByCustomerAt ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              
              {selectedTicket.status === "closed" && (
                <div className="flex flex-col items-center justify-center p-6 bg-muted/30 rounded-lg border border-dashed gap-2">
                  <div className="flex items-center gap-2 text-muted-foreground font-medium">
                    <CheckCircle className="h-4 w-4" />
                    Ticket is closed
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    The customer cannot send more messages.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => handleUpdateStatus("open")}>
                    Reopen Ticket
                  </Button>
                </div>
              )}
              
              {selectedTicket.status === "resolved" && (
                <div className="flex flex-col items-center justify-center p-6 bg-green-500/5 rounded-lg border border-green-500/20 border-dashed gap-2">
                  <div className="flex items-center gap-2 text-green-600 font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    Ticket is resolved
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleUpdateStatus("open")}>
                    Reopen Ticket
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Message Input */}
          {(selectedTicket.status === "open" || selectedTicket.status === "in_progress") && (
            <div className="p-4 border-t bg-card">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  placeholder="Type your response..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" size="icon" disabled={!messageText.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  )

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-background">
      {StatsBar}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Layout */}
        {!isMobile && (
          <>
            <div className="w-80 lg:w-96 shrink-0 bg-card flex flex-col border-r">
              {FilterBar}
              {TicketList}
            </div>
            <div className="flex-1 bg-background">
              {ChatView}
            </div>
          </>
        )}

        {/* Mobile Layout */}
        {isMobile && (
          <div className="w-full relative h-full flex flex-col">
            {!showMobileChat ? (
              <div className="h-full bg-card flex flex-col">
                {FilterBar}
                {TicketList}
              </div>
            ) : (
              <div className="absolute inset-0 z-10 bg-background">
                {ChatView}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
