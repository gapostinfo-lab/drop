import { useQuery, useMutation } from 'convex/react'
import { api } from '@convex/api'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useAdmin } from '@/contexts/admin-context'
import { formatDistanceToNow } from 'date-fns'
import { useNavigate } from 'react-router'

interface NotificationBellProps {
  type: 'customer' | 'courier' | 'admin'
  isAdmin?: boolean
}

export function NotificationBell({ type, isAdmin = false }: NotificationBellProps) {
  const navigate = useNavigate()
  const { isAdminLoggedIn } = useAdmin()
  
  // Use dedicated unread count queries for real-time updates
  const customerUnreadCount = useQuery(
    api.customerNotifications.countUnread,
    type === 'customer' ? {} : 'skip'
  )
  const courierUnreadCount = useQuery(
    api.couriers.countUnreadNotifications,
    type === 'courier' ? {} : 'skip'
  )
  const adminUnreadCount = useQuery(
    api.couriers.countUnreadAdminNotifications,
    (type === 'admin' && isAdmin && isAdminLoggedIn) ? {} : 'skip'
  )

  // Get the appropriate unread count
  const unreadCount = type === 'customer' 
    ? customerUnreadCount 
    : type === 'courier' 
    ? courierUnreadCount 
    : adminUnreadCount

  // Notifications for popover preview
  const customerNotifications = useQuery(
    api.customerNotifications.getMyNotifications,
    type === 'customer' ? { limit: 5 } : 'skip'
  )
  const courierNotifications = useQuery(
    api.couriers.getMyNotifications,
    type === 'courier' ? { limit: 5 } : 'skip'
  )
  const adminNotifications = useQuery(
    api.couriers.getAdminNotifications,
    (type === 'admin' && isAdmin && isAdminLoggedIn) ? { limit: 5 } : 'skip'
  )

  const notifications = (type === 'customer' 
    ? customerNotifications 
    : type === 'courier' 
    ? courierNotifications 
    : adminNotifications) as any[] | undefined

  const markCustomerRead = useMutation(api.customerNotifications.markNotificationRead)
  const markCourierRead = useMutation(api.couriers.markNotificationRead)
  const markAdminRead = useMutation(api.couriers.markAdminNotificationRead)

  const handleMarkRead = async (notificationId: any) => {
    if (type === 'customer') await markCustomerRead({ notificationId })
    else if (type === 'courier') await markCourierRead({ notificationId })
    else if (type === 'admin' && isAdmin) await markAdminRead({ notificationId })
  }

  const handleViewAll = () => {
    if (type === 'customer') navigate('/customer/notifications')
    else if (type === 'courier') navigate('/courier/notifications')
  }

  if (type === 'admin' && !isAdmin) {
    return null
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {(unreadCount ?? 0) > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
              variant="destructive"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b border-border">
          <h4 className="font-semibold">Notifications</h4>
        </div>
        <ScrollArea className="h-[250px]">
          {notifications?.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications?.map((notif: any) => (
                <div 
                  key={notif._id}
                  className={`p-3 hover:bg-muted/50 cursor-pointer ${!notif.isRead ? 'bg-primary/5' : ''}`}
                  onClick={() => handleMarkRead(notif._id)}
                >
                  <div className="flex items-start gap-2">
                    {!notif.isRead && (
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{notif.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{notif.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        {type !== 'admin' && (
          <div className="p-2 border-t border-border">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-xs font-bold uppercase"
              onClick={handleViewAll}
            >
              View all notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
