import { useQuery, useMutation } from 'convex/react'
import { api } from '@convex/api'
import { Bell, Check, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AppShell } from '@/components/layout/app-shell'
import { formatDistanceToNow } from 'date-fns'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

export default function CustomerNotificationsPage() {
  const navigate = useNavigate()
  const notifications = useQuery(api.customerNotifications.getMyNotifications, { limit: 50 })
  const unreadCount = useQuery(api.customerNotifications.countUnread)
  const markRead = useMutation(api.customerNotifications.markNotificationRead)
  const markAllRead = useMutation(api.customerNotifications.markAllRead)

  const handleMarkAllRead = async () => {
    try {
      const result = await markAllRead({})
      if (result.marked > 0) {
        toast.success(`Marked ${result.marked} notifications as read`)
      }
    } catch (error) {
      toast.error('Failed to mark notifications as read')
    }
  }

  const handleNotificationClick = async (notificationId: any, jobId?: string) => {
    try {
      await markRead({ notificationId })
      if (jobId) {
        navigate(`/customer/order/${jobId}`)
      }
    } catch (error) {
      console.error('Failed to mark notification as read', error)
    }
  }

  return (
    <AppShell>
      <div className="min-h-screen bg-background">
        {/* Fixed Header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-black tracking-tight uppercase">Notifications</h1>
                {unreadCount !== undefined && unreadCount > 0 && (
                  <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
                )}
              </div>
            </div>
            {unreadCount !== undefined && unreadCount > 0 && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleMarkAllRead}
                className="text-xs font-bold uppercase"
              >
                <Check className="w-4 h-4 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Scrollable Notification List */}
        <div className="p-4">
          <div className="max-h-[65vh] overflow-y-auto space-y-2 scrollbar-thin">
            {notifications === undefined ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Bell className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-bold text-lg">No notifications</h3>
                <p className="text-sm text-muted-foreground">You're all caught up!</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <Card 
                  key={notif._id}
                  className={`cursor-pointer transition-colors hover:bg-muted/50 ${!notif.isRead ? 'bg-primary/5 border-primary/20' : ''}`}
                  onClick={() => handleNotificationClick(notif._id, notif.jobId)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      {/* Unread indicator */}
                      <div className="mt-1.5">
                        {!notif.isRead ? (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        ) : (
                          <div className="w-2 h-2" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm truncate ${!notif.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
