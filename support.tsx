import { useState } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/api"
import { Link, useNavigate } from "react-router"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, 
  MessageSquare, 
  Clock, 
  ArrowLeft, 
  Bug, 
  Search, 
  PackageX, 
  AlertTriangle, 
  CreditCard, 
  XCircle, 
  MapPin, 
  UserX, 
  HelpCircle,
  Package
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const ISSUE_TYPES = [
  {
    id: "app_bug",
    label: "App Issue / Bug",
    icon: Bug,
    template: "I'm experiencing a problem with the Droppit app. Please help resolve this issue.\n\nDetails:",
    priority: "medium",
  },
  {
    id: "cannot_find_courier",
    label: "Can't Find My Courier",
    icon: Search,
    template: "I cannot locate the courier assigned to my pickup. Please help me contact them.",
    priority: "high",
  },
  {
    id: "courier_not_arrived",
    label: "Courier Hasn't Arrived",
    icon: Clock,
    template: "My courier has not arrived yet. Please check the job status and provide an update.",
    priority: "high",
  },
  {
    id: "wrong_package",
    label: "Wrong Package Picked Up",
    icon: PackageX,
    template: "The courier picked up the wrong package. Please help resolve this issue.",
    priority: "medium",
  },
  {
    id: "not_delivered",
    label: "Package Not Delivered",
    icon: AlertTriangle,
    template: "My package was not delivered to the drop-off location. Please investigate.",
    priority: "high",
  },
  {
    id: "payment_issue",
    label: "Payment / Billing Issue",
    icon: CreditCard,
    template: "I believe there is an issue with my payment or billing. Please review my account.",
    priority: "medium",
  },
  {
    id: "cancel_pickup",
    label: "Cancel Pickup",
    icon: XCircle,
    template: "I would like to cancel my pickup request. Please assist with the cancellation.",
    priority: "medium",
  },
  {
    id: "change_address",
    label: "Change Pickup Address",
    icon: MapPin,
    template: "I need to change my pickup address. Please help update my order.",
    priority: "medium",
  },
  {
    id: "driver_behavior",
    label: "Driver Behavior Issue",
    icon: UserX,
    template: "I would like to report an issue with my courier's behavior.",
    priority: "medium",
  },
  {
    id: "general_question",
    label: "General Question",
    icon: HelpCircle,
    template: "I have a question about Droppit.",
    priority: "low",
  },
];

export default function SupportPage() {
  const navigate = useNavigate()
  const tickets = useQuery(api.support.listMyTickets)
  const createTicket = useMutation(api.support.createTicket)
  const myJobs = useQuery(api.jobs.getMyJobs)
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedType, setSelectedType] = useState<typeof ISSUE_TYPES[0] | null>(null)
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [attachJob, setAttachJob] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Find active job
  const activeJob = myJobs?.find(j => 
    ["requested", "matched", "en_route", "arrived", "picked_up", "dropped_off"].includes(j.status)
  )

  const handleSelectType = (type: typeof ISSUE_TYPES[0]) => {
    setSelectedType(type)
    setSubject(type.label)
    setMessage(type.template)
    setStep(2)
  }

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedType || !subject.trim() || !message.trim()) {
      toast.error("Please fill in all required fields")
      return
    }

    setIsSubmitting(true)
    try {
      const { ticketId } = await createTicket({
        subject: subject.trim(),
        firstMessage: message.trim(),
        ticketType: selectedType.id,
        jobId: (attachJob && activeJob) ? activeJob._id : undefined,
      })
      toast.success("Your support ticket has been submitted. A support agent will respond shortly.")
      setIsDialogOpen(false)
      resetForm()
      navigate(`/customer/support/${ticketId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create ticket")
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setStep(1)
    setSelectedType(null)
    setSubject("")
    setMessage("")
    setAttachJob(true)
  }

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link to="/customer/dashboard">
              <Button variant="ghost" size="icon" className="-ml-2">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">Support Tickets</h1>
          </div>
          <p className="text-muted-foreground">
            Get help with your orders or account.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className={cn(
            "sm:max-w-[600px] transition-all duration-300",
            step === 1 ? "max-h-[90vh] overflow-y-auto" : ""
          )}>
            <DialogHeader>
              <DialogTitle>
                {step === 1 ? "What can we help you with?" : "Describe your issue"}
              </DialogTitle>
              <DialogDescription>
                {step === 1 
                  ? "Select the type of issue you're experiencing to get started." 
                  : "Provide more details so we can assist you better."}
              </DialogDescription>
            </DialogHeader>

            {step === 1 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 py-4">
                {ISSUE_TYPES.map((type) => {
                  const Icon = type.icon
                  return (
                    <button
                      key={type.id}
                      onClick={() => handleSelectType(type)}
                      className="flex flex-col gap-3 p-4 text-left border rounded-xl hover:bg-accent hover:border-primary transition-all group relative"
                    >
                      <div className="p-2 w-fit bg-muted rounded-lg group-hover:bg-primary/10 transition-colors">
                        <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <div>
                        <div className="font-medium text-sm sm:text-base leading-tight">{type.label}</div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground capitalize mt-1">{type.priority} Priority</div>
                      </div>
                      {type.priority === "high" && (
                        <div className="absolute top-3 right-3 h-2 w-2 bg-red-500 rounded-full" />
                      )}
                    </button>
                  )
                })}
              </div>
            ) : (
              <form onSubmit={handleCreateTicket} className="space-y-6 py-4">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-background rounded-md">
                      {selectedType && <selectedType.icon className="h-4 w-4 text-primary" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{selectedType?.label}</div>
                      <div className="text-xs text-muted-foreground">Selected Issue Type</div>
                    </div>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setStep(1)}
                    className="text-xs h-8"
                  >
                    Change
                  </Button>
                </div>

                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Enter a brief subject"
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe your issue in detail..."
                      required
                      rows={5}
                      className="resize-none"
                    />
                  </div>

                  {activeJob && (
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="attachJob" 
                          checked={attachJob} 
                          onCheckedChange={(checked) => setAttachJob(!!checked)}
                        />
                        <label
                          htmlFor="attachJob"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          Attach current order info
                        </label>
                      </div>
                      
                      {attachJob && (
                        <div className="p-3 border rounded-lg bg-muted/30 space-y-2">
                          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            <span>Active Order</span>
                            <Badge variant="outline" className="text-[10px] uppercase h-4">
                              {activeJob.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <div className="flex items-start gap-3">
                            <Package className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="text-sm">
                              <div className="font-medium truncate">{activeJob.pickupAddress}</div>
                              <div className="text-xs text-muted-foreground">
                                {activeJob.carrier} • {activeJob.packageCount} package(s)
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Submit Ticket"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {tickets === undefined ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24" />
            </Card>
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center space-y-4 border-dashed">
          <div className="p-4 bg-muted rounded-full">
            <MessageSquare className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <CardTitle>No tickets found</CardTitle>
            <CardDescription>
              You haven't created any support tickets yet.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
            Create your first ticket
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tickets.map((ticket) => (
            <Link key={ticket._id} to={`/customer/support/${ticket._id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer relative overflow-hidden">
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{ticket.subject}</CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(ticket.updatedAt, { addSuffix: true })}
                      </div>
                      <Badge variant={ticket.status === "open" ? "default" : "secondary"}>
                        {ticket.status}
                      </Badge>
                      {ticket.priority === "high" && (
                        <Badge variant="destructive" className="h-5">High Priority</Badge>
                      )}
                    </div>
                  </div>
                  {ticket.unreadCount > 0 && (
                    <Badge variant="destructive" className="rounded-full px-2">
                      {ticket.unreadCount} new
                    </Badge>
                  )}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
