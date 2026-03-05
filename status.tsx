import { useQuery } from 'convex/react'
import { api } from '@convex/api'
import { useNavigate } from 'react-router'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Clock, CheckCircle, XCircle, AlertTriangle, 
  FileText, Mail, ArrowRight, Loader2 
} from 'lucide-react'

export default function CourierStatusPage() {
  const navigate = useNavigate()
  const application = useQuery(api.couriers.getMyApplication)
  const notifications = useQuery(api.couriers.getMyNotifications, { limit: 5 })

  // Loading state
  if (application === undefined) {
    return (
      <AppShell>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppShell>
    )
  }

  // No application - redirect to onboarding
  if (!application) {
    navigate('/courier/onboarding')
    return null
  }

  // Render based on status
  const statusConfig = {
    draft: {
      icon: FileText,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      title: 'Application In Progress',
      description: 'You have a draft application. Complete and submit it to start delivering.',
      action: { label: 'Continue Application', path: '/courier/onboarding' },
    },
    pending_review: {
      icon: Clock,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      title: 'Pending Review',
      description: 'Your application is being reviewed by our team. This usually takes 1-2 business days.',
      action: null,
    },
    approved: {
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      title: 'Approved! 🎉',
      description: 'Congratulations! You can now go online and start accepting deliveries.',
      action: { label: 'Go to Dashboard', path: '/courier/dashboard' },
    },
    denied: {
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      title: 'Application Not Approved',
      description: 'Unfortunately, your application was not approved at this time. Please contact support for more information.',
      action: { label: 'Contact Support', path: 'mailto:support@droppit.com' },
    },
    suspended: {
      icon: AlertTriangle,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      title: 'Account Suspended',
      description: 'Your courier account has been suspended. Please contact support for more information.',
      action: { label: 'Contact Support', path: 'mailto:support@droppit.com' },
    },
  }

  const config = statusConfig[application.status as keyof typeof statusConfig] || statusConfig.pending_review
  const StatusIcon = config.icon

  return (
    <AppShell>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        {/* Status Card */}
        <Card className="border-2">
          <CardHeader className="text-center pb-2">
            <div className={`mx-auto w-20 h-20 rounded-full ${config.bgColor} flex items-center justify-center mb-4`}>
              <StatusIcon className={`w-10 h-10 ${config.color}`} />
            </div>
            <CardTitle className="text-2xl">{config.title}</CardTitle>
            <CardDescription className="text-base mt-2">
              {config.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            {config.action && (
              <Button 
                onClick={() => {
                  if (config.action.path.startsWith('mailto:')) {
                    window.location.href = config.action.path
                  } else {
                    navigate(config.action.path)
                  }
                }}
                className="mt-4"
              >
                {config.action.label}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Application Details */}
        {application.status !== 'draft' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Application Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Name</p>
                  <p className="font-medium">{application.fullName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Submitted</p>
                  <p className="font-medium">
                    {application.submittedAt 
                      ? new Date(application.submittedAt).toLocaleDateString()
                      : 'Not submitted'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vehicle</p>
                  <p className="font-medium">
                    {application.vehicleYear} {application.vehicleMake} {application.vehicleModel}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={
                    application.status === 'approved' ? 'default' :
                    application.status === 'pending_review' ? 'secondary' :
                    'destructive'
                  }>
                    {application.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Notifications */}
        {notifications && notifications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Updates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {notifications.map((notif: any) => (
                <div 
                  key={notif._id} 
                  className={`p-3 rounded-lg border ${notif.isRead ? 'bg-background' : 'bg-primary/5 border-primary/20'}`}
                >
                  <p className="font-medium text-sm">{notif.title}</p>
                  <p className="text-sm text-muted-foreground">{notif.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(notif._creationTime).toLocaleString()}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Contact Support */}
        <Card className="bg-muted/50">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">Need help?</p>
                <p className="text-xs text-muted-foreground">Contact our support team</p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="mailto:support@droppit.com">Contact</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
