import { useQuery } from 'convex/react'
import { api } from '@convex/api'
import { AdminAppShell } from '@/components/layout/admin-app-shell'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdmin } from '@/contexts/admin-context'
import { Shield, Clock, User, Settings, RefreshCw, UserX, UserCheck, Ban } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const actionIcons: Record<string, React.ReactNode> = {
  'courier_approved': <UserCheck className="w-4 h-4 text-green-500" />,
  'courier_rejected': <UserX className="w-4 h-4 text-red-500" />,
  'courier_suspended': <Ban className="w-4 h-4 text-orange-500" />,
  'setting_updated': <Settings className="w-4 h-4 text-blue-500" />,
  'refund_issued': <RefreshCw className="w-4 h-4 text-purple-500" />,
  'job_cancelled': <Ban className="w-4 h-4 text-red-500" />,
}

const actionLabels: Record<string, string> = {
  'courier_approved': 'Approved Courier',
  'courier_rejected': 'Rejected Courier',
  'courier_suspended': 'Suspended Courier',
  'setting_updated': 'Updated Setting',
  'refund_issued': 'Issued Refund',
  'job_cancelled': 'Cancelled Job',
}

export default function AdminLogsPage() {
  const { isAdminLoggedIn } = useAdmin()
  const logs = useQuery(api.adminLogs.listAdminLogs, isAdminLoggedIn ? { limit: 100 } : "skip")

  return (
    <AdminAppShell>
      <div className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Admin Activity Log</h1>
              <p className="text-sm text-muted-foreground">
                All administrative actions are recorded here
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                {logs === undefined ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex gap-4 p-4 rounded-lg border border-border">
                        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-1/3" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No admin actions recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {logs.map((log) => (
                      <div
                        key={log._id}
                        className="flex gap-4 p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                          {actionIcons[log.action] || <User className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {actionLabels[log.action] || log.action}
                            </Badge>
                            {log.targetType && (
                              <span className="text-xs text-muted-foreground">
                                on {log.targetType}
                              </span>
                            )}
                          </div>
                          {log.details && (
                            <p className="text-sm text-muted-foreground mt-1 truncate">
                              {typeof log.details === 'object' 
                                ? JSON.stringify(log.details).slice(0, 100) + '...'
                                : String(log.details)
                              }
                            </p>
                          )}
                          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(log.timestamp, { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </AdminAppShell>
  )
}
