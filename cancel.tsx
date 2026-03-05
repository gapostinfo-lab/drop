import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import { useMutation } from "convex/react"
import { api } from "@convex/api"
import { XCircle, RefreshCw, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function PaymentCancelPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [isRetrying, setIsRetrying] = useState(false)

  // Get draft ID from URL or localStorage
  const draftId = searchParams.get('draft') || localStorage.getItem('droppit_draft_id')
  
  const cancelDraft = useMutation(api.bookingDrafts.cancelDraft)

  useEffect(() => {
    // Mark draft as cancelled (optional - they can retry)
    if (draftId) {
      // Don't await - just fire and forget
      cancelDraft({ draftId: draftId as any }).catch(() => {
        // Ignore errors - draft might already be cancelled or expired
      })
    }
  }, [draftId])

  const handleTryAgain = () => {
    setIsRetrying(true)
    // Clear the old draft and start fresh
    localStorage.removeItem('droppit_draft_id')
    navigate('/customer/book')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 bg-slate-900/60 border-slate-700 text-center">
        <div className="w-20 h-20 mx-auto bg-muted rounded-full flex items-center justify-center mb-6">
          <XCircle className="w-10 h-10 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold font-outfit mb-2">
          Payment Cancelled
        </h1>
        <p className="text-muted-foreground mb-6">
          Your payment was cancelled. No charges were made to your card.
        </p>
        <div className="space-y-3">
          <Button 
            onClick={handleTryAgain}
            disabled={isRetrying}
            className="w-full"
          >
            {isRetrying ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </>
            )}
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate('/customer/dashboard')}
            className="w-full"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground mt-6">
          Need help? Contact{' '}
          <a href="mailto:support@droppit.app" className="text-primary hover:underline">
            support@droppit.app
          </a>
        </p>
      </Card>
    </div>
  )
}
