import { useState, useEffect, useRef } from "react"
import { useParams, Link } from "react-router"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft, Send, Clock, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Id } from "@convex/dataModel"

export default function CourierSupportTicketPage() {
  const { ticketId } = useParams<{ ticketId: string }>()
  const id = ticketId as Id<"supportTickets">
  
  const ticket = useQuery(api.support.getTicket, { ticketId: id })
  const messages = useQuery(api.support.listMessages, { ticketId: id })
  const sendMessage = useMutation(api.support.sendMessage)
  const markRead = useMutation(api.support.markRead)
  
  const [newMessage, setNewMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Mark as read when viewing
  useEffect(() => {
    if (id) {
      markRead({ ticketId: id, viewerType: "courier" }).catch(console.error)
    }
  }, [id, markRead, messages]) // Re-run when new messages arrive

  // Scroll to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || isSending) return

    setIsSending(true)
    try {
      await sendMessage({
        ticketId: id,
        body: newMessage.trim(),
      })
      setNewMessage("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message")
    } finally {
      setIsSending(false)
    }
  }

  if (ticket === undefined || messages === undefined) {
    return (
      <div className="container max-w-4xl py-8 space-y-4">
        <div className="h-10 w-32 bg-muted animate-pulse rounded" />
        <Card className="h-[600px] animate-pulse" />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="container max-w-4xl py-8 text-center space-y-4">
        <h1 className="text-2xl font-bold">Ticket not found</h1>
        <p className="text-muted-foreground">The support ticket you're looking for doesn't exist.</p>
        <Link to="/courier/support">
          <Button variant="outline">Back to Tickets</Button>
        </Link>
      </div>
    )
  }

  const isClosed = ticket.status === "closed"

  return (
    <div className="container max-w-4xl py-8 h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/courier/support">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{ticket.subject}</h1>
            <Badge variant={isClosed ? "secondary" : "default"}>
              {ticket.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Created {format(ticket.createdAt, "PPP p")}
          </p>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((msg) => {
              const isCourier = msg.senderType === "courier"
              return (
                <div
                  key={msg._id}
                  className={cn(
                    "flex flex-col max-w-[80%] space-y-1",
                    isCourier ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div
                    className={cn(
                      "px-4 py-2 rounded-2xl text-sm",
                      isCourier
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "bg-muted text-muted-foreground rounded-tl-none"
                    )}
                  >
                    {msg.body}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground px-1">
                    <Clock className="h-3 w-3" />
                    {format(msg.createdAt, "p")}
                  </div>
                </div>
              )
            })}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {isClosed && (
          <div className="p-4 bg-muted/50 border-t flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            This ticket is closed. If you need further assistance, please create a new ticket.
          </div>
        )}

        <div className="p-4 border-t bg-background">
          <form onSubmit={handleSend} className="flex gap-2">
            <Input
              placeholder={isClosed ? "Ticket is closed" : "Type your message..."}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={isClosed || isSending}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={isClosed || isSending || !newMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
