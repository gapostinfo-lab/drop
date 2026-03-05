import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router'
import { useMutation, useAction, useQuery } from "convex/react"
import { api } from "@convex/api"
import { toast } from 'sonner'
import { Loader2, CheckCircle2, AlertCircle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'verifying' | 'creating' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<Record<string, any>>({})

  // Get draft ID from URL or localStorage
  const draftIdFromUrl = searchParams.get('draft')
  const draftIdFromStorage = typeof window !== 'undefined' ? localStorage.getItem('droppit_draft_id') : null
  const draftId = draftIdFromUrl || draftIdFromStorage

  // Actions and mutations
  const verifyPayment = useAction(api.paymentsActions.verifyPayment)
  const createJobFromDraft = useMutation(api.bookingDrafts.createJobFromDraft)

  // Get draft to check if job already exists
  const draft = useQuery(
    api.bookingDrafts.getDraft,
    draftId ? { draftId: draftId as any } : "skip"
  )

  const processPayment = useCallback(async () => {
    if (!draftId) {
      setStatus('error')
      setError('No booking found. Please start a new booking.')
      return
    }

    setDebugInfo(prev => ({ ...prev, draftId, timestamp: new Date().toISOString() }))

    try {
      // Step 1: Check if job already created (idempotency)
      if (draft?.jobId) {
        console.log('[PaymentSuccess] Job already exists:', draft.jobId)
        setJobId(draft.jobId as string)
        setStatus('success')
        localStorage.removeItem('droppit_draft_id')
        toast.success('Payment already confirmed!')
        setTimeout(() => navigate(`/customer/tracking/${draft.jobId}`), 2000)
        return
      }

      // Step 2: Verify payment
      setStatus('verifying')
      console.log('[PaymentSuccess] Verifying payment for draft:', draftId)
      
      const verifyResult = await verifyPayment({ draftId: draftId as any })
      setDebugInfo(prev => ({ ...prev, verifyResult }))
      
      if (!verifyResult.success) {
        throw new Error(verifyResult.error || 'Payment verification failed')
      }

      // If job was already created during verification
      if (verifyResult.jobId) {
        setJobId(verifyResult.jobId)
        setStatus('success')
        localStorage.removeItem('droppit_draft_id')
        toast.success('Payment confirmed!')
        setTimeout(() => navigate(`/customer/tracking/${verifyResult.jobId}`), 2000)
        return
      }

      // Step 3: Create job from draft
      setStatus('creating')
      console.log('[PaymentSuccess] Creating job from draft:', draftId)
      
      const jobResult = await createJobFromDraft({ draftId: draftId as any })
      setDebugInfo(prev => ({ ...prev, jobResult }))
      
      console.log('[PaymentSuccess] Job created:', jobResult.jobId)
      setJobId(jobResult.jobId as string)
      setStatus('success')
      
      // Clear stored data
      localStorage.removeItem('droppit_draft_id')
      
      if (jobResult.alreadyCreated) {
        toast.success('Your booking was already confirmed!')
      } else {
        toast.success('Payment confirmed! Booking created.')
      }
      
      // Auto-redirect
      setTimeout(() => navigate(`/customer/tracking/${jobResult.jobId}`), 2000)

    } catch (err) {
      console.error('[PaymentSuccess] Error:', err)
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to complete booking')
      setDebugInfo(prev => ({ ...prev, error: err instanceof Error ? err.message : 'Unknown error' }))
    }
  }, [draftId, draft, verifyPayment, createJobFromDraft, navigate])

  // Run on mount and when draft loads
  useEffect(() => {
    // Wait for draft query to load if we have a draftId
    if (draftId && draft === undefined) {
      return // Still loading
    }
    
    if (status === 'loading') {
      processPayment()
    }
  }, [draftId, draft, status, processPayment])

  const handleRetry = () => {
    setStatus('loading')
    setError(null)
    processPayment()
  }

  // Loading/Verifying/Creating states
  if (status === 'loading' || status === 'verifying' || status === 'creating') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 bg-slate-900/60 border-slate-700 text-center">
          <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin mb-6" />
          <h1 className="text-2xl font-bold font-outfit mb-2">
            {status === 'loading' && 'Loading...'}
            {status === 'verifying' && 'Verifying Payment...'}
            {status === 'creating' && 'Creating Your Booking...'}
          </h1>
          <p className="text-muted-foreground">
            {status === 'verifying' && 'Please wait while we confirm your payment'}
            {status === 'creating' && 'Almost done! Setting up your pickup...'}
          </p>
        </Card>
      </div>
    )
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 bg-slate-900/60 border-slate-700 text-center">
          <div className="w-20 h-20 mx-auto bg-destructive/20 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold font-outfit text-destructive mb-2">
            Something Went Wrong
          </h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          
          <div className="space-y-3">
            {draftId && (
              <Button onClick={handleRetry} className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            )}
            <Button 
              variant="outline"
              onClick={() => navigate('/customer/book')}
              className="w-full"
            >
              Start New Booking
            </Button>
            <Button 
              variant="ghost"
              onClick={() => navigate('/customer/dashboard')}
              className="w-full"
            >
              <Home className="w-4 h-4 mr-2" />
              Go to Dashboard
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground mt-6">
            If you were charged but your booking wasn't created, please contact{' '}
            <a href="mailto:support@droppit.app" className="text-primary hover:underline">
              support@droppit.app
            </a>
          </p>

          {/* Debug info (only in dev) */}
          {import.meta.env.DEV && Object.keys(debugInfo).length > 0 && (
            <details className="mt-4 text-left">
              <summary className="text-xs text-muted-foreground cursor-pointer">Debug Info</summary>
              <pre className="text-xs bg-slate-800 p-2 rounded mt-2 overflow-auto">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          )}
        </Card>
      </div>
    )
  }

  // Success state
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 bg-slate-900/60 border-slate-700 text-center">
        <div className="w-20 h-20 mx-auto bg-primary/20 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold font-outfit text-primary mb-2">
          Payment Successful!
        </h1>
        <p className="text-muted-foreground mb-6">
          Your booking has been confirmed. A courier will be assigned shortly.
        </p>
        <div className="space-y-3">
          <Button 
            onClick={() => jobId && navigate(`/customer/tracking/${jobId}`)}
            className="w-full"
          >
            Track Your Pickup
          </Button>
          <p className="text-sm text-muted-foreground">
            Redirecting automatically...
          </p>
        </div>
      </Card>
    </div>
  )
}
