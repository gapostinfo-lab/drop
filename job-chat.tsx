import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@convex/api"
import { Id } from "@convex/dataModel"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown, ChevronUp, Send } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface JobChatProps {
  jobId: Id<"jobs">
  viewerRole: "customer" | "courier"
  otherPartyName: string
  isExpanded?: boolean
  onToggle?: () => void
}

export function JobChat({
  jobId,
  viewerRole,
  otherPartyName,
  isExpanded: controlledExpanded,
  onToggle,
}: JobChatProps) {
  const [internalExpanded, setInternalExpanded] = useState(false)
  const isExpanded = controlledExpanded ?? internalExpanded
  const [messageText, setMessageText] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  const messages = useQuery(api.jobMessages.listJobMessages, { jobId })
  const unreadCount = useQuery(api.jobMessages.getUnreadCount, { jobId })
  const sendMessage = useMutation(api.jobMessages.sendJobMessage)
  const markRead = useMutation(api.jobMessages.markJobRead)

  const handleToggle = () => {
    if (onToggle) {
      onToggle()
    } else {
      setInternalExpanded(!internalExpanded)
    }
  }

  useEffect(() => {
    if (isExpanded) {
      markRead({ jobId, viewerRole }).catch(console.error)
    }
  }, [isExpanded, jobId, viewerRole, markRead, messages?.length])

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages, isExpanded])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!messageText.trim()) return

    try {
      await sendMessage({ jobId, body: messageText.trim() })
      setMessageText("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message")
    }
  }

  return (
    <Card className="w-full overflow-hidden border-t-0 sm:border-t rounded-t-none sm:rounded-t-xl">
      <Collapsible open={isExpanded} onOpenChange={handleToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-3 px-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">
                  Chat with {otherPartyName}
                </CardTitle>
                {unreadCount ? (
                  <Badge variant="destructive" className="h-5 w-5 flex items-center justify-center p-0 rounded-full text-[10px]">
                    {unreadCount}
                  </Badge>
                ) : null}
              </div>
              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-0 border-t">
            <ScrollArea className="h-[300px] p-4" ref={scrollRef}>
              <div className="flex flex-col gap-3">
                {messages?.map((msg) => {
                  const isMe = msg.senderRole === viewerRole
                  return (
                    <div
                      key={msg._id}
                      className={cn(
                        "flex flex-col max-w-[80%]",
                        isMe ? "self-end items-end" : "self-start items-start"
                      )}
                    >
                      <div
                        className={cn(
                          "px-3 py-2 rounded-2xl text-sm",
                          isMe
                            ? "bg-primary text-primary-foreground rounded-tr-none"
                            : "bg-muted text-muted-foreground rounded-tl-none"
                        )}
                      >
                        {msg.body}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-1 px-1">
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )
                })}
                {messages?.length === 0 && (
                  <div className="text-center text-muted-foreground text-xs py-8">
                    No messages yet. Say hello!
                  </div>
                )}
              </div>
            </ScrollArea>
            <form
              onSubmit={handleSendMessage}
              className="p-3 border-t flex items-center gap-2"
            >
              <Input
                placeholder="Type a message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="flex-1"
                autoComplete="off"
              />
              <Button type="submit" size="icon" disabled={!messageText.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
