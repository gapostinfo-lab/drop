import { useState } from 'react'
import { useBookingStore } from '@/stores/booking-store'
import { useAction, useConvexAuth } from "convex/react"
import { api } from "@convex/api"
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, CreditCard, ShieldCheck, AlertCircle, RefreshCw, MapPin, LogIn, Package } from 'lucide-react'
import { getPriceBreakdown, getPackageSummary, formatCents } from '@/lib/pricing'

// Error code to user-friendly message mapping
const ERROR_MESSAGES: Record<string, { title: string; message: string; icon: React.ReactNode; action?: string }> = {
  AUTH_REQUIRED: {
    title: "Sign In Required",
    message: "Your session has expired. Please sign in again to continue.",
    icon: <LogIn className="w-6 h-6" />,
    action: "sign_in"
  },
  VALIDATION_ERROR: {
    title: "Missing Information",
    message: "Please check your booking details and try again.",
    icon: <AlertCircle className="w-6 h-6" />,
  },
  HUB_NOT_SELECTED: {
    title: "Drop-off Location Required",
    message: "Please go back and select a drop-off location for your package.",
    icon: <MapPin className="w-6 h-6" />,
    action: "go_back"
  },
  HUB_NOT_FOUND: {
    title: "Location Not Available",
    message: "The selected drop-off location is no longer available. Please select a different location.",
    icon: <MapPin className="w-6 h-6" />,
    action: "go_back"
  },
  HUB_INACTIVE: {
    title: "Location Temporarily Closed",
    message: "This drop-off location is temporarily unavailable. Please select a different location.",
    icon: <MapPin className="w-6 h-6" />,
    action: "go_back"
  },
  PRICING_ERROR: {
    title: "Pricing Error",
    message: "We couldn't calculate the price for your order. Please try again.",
    icon: <Package className="w-6 h-6" />,
  },
  PAYMENT_ERROR: {
    title: "Payment Setup Error",
    message: "Payment system is temporarily unavailable. Please try again.",
    icon: <CreditCard className="w-6 h-6" />,
  },
  CHECKOUT_FAILED: {
    title: "Checkout Failed",
    message: "Unable to create payment session. Please try again.",
    icon: <CreditCard className="w-6 h-6" />,
  },
  DRAFT_ERROR: {
    title: "Booking Error", 
    message: "Unable to save your booking. Please try again.",
    icon: <AlertCircle className="w-6 h-6" />,
  },
  UNKNOWN: {
    title: "Something Went Wrong",
    message: "An unexpected error occurred. Please try again.",
    icon: <AlertCircle className="w-6 h-6" />,
  },
};

function parseError(error: Error): { code: string; message: string } {
  const message = error.message || "An unexpected error occurred";
  
  // Check for error code prefix (e.g., "AUTH_REQUIRED: message")
  const codeMatch = message.match(/^([A-Z_]+):\s*(.+)$/);
  if (codeMatch) {
    return { code: codeMatch[1], message: codeMatch[2] };
  }
  
  // Fallback detection
  if (message.toLowerCase().includes('sign in') || message.toLowerCase().includes('session')) {
    return { code: 'AUTH_REQUIRED', message };
  }
  if (message.toLowerCase().includes('drop-off') || message.toLowerCase().includes('location')) {
    return { code: 'HUB_NOT_SELECTED', message };
  }
  if (message.toLowerCase().includes('payment') || message.toLowerCase().includes('checkout')) {
    return { code: 'PAYMENT_ERROR', message };
  }
  
  return { code: 'UNKNOWN', message };
}

export function StepCheckout() {
  const [status, setStatus] = useState<'initial' | 'creating' | 'redirecting' | 'error'>('initial')
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const booking = useBookingStore()
  
  // Payment actions
  const createCheckoutSession = useAction(api.paymentsActions.createCheckoutSession)

  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth()

  // Calculate price
  const breakdown = getPriceBreakdown({
    smallQty: booking.smallQty,
    mediumQty: booking.mediumQty,
    largeQty: booking.largeQty,
    oversizedQty: booking.oversizedQty,
  })
  const packageSummary = getPackageSummary({
    smallQty: booking.smallQty,
    mediumQty: booking.mediumQty,
    largeQty: booking.largeQty,
    oversizedQty: booking.oversizedQty,
  })

  const handlePayNow = async () => {
    if (isProcessing) return
    setIsProcessing(true)
    setStatus('creating')
    setError(null)
    
    try {
      // Client-side validation first
      if (!booking.pickupAddress?.street1 || !booking.pickupAddress?.city) {
        throw new Error('VALIDATION_ERROR: Please enter a valid pickup address.')
      }
      
      if (breakdown.totalPackages < 1) {
        throw new Error('VALIDATION_ERROR: Please add at least one package.')
      }

      if (booking.serviceType === 'amazon_return' && !booking.dropoffLocationId) {
        throw new Error('HUB_NOT_SELECTED: Please select a drop-off location.')
      }

      // Build pickup address string
      const pickupAddressStr = [
        booking.pickupAddress.street1,
        booking.pickupAddress.street2,
        booking.pickupAddress.city,
        booking.pickupAddress.state,
        booking.pickupAddress.zipCode
      ].filter(Boolean).join(', ')

      // Call the single action that does everything server-side
      const result = await createCheckoutSession({
        siteUrl: window.location.origin,
        pickupAddress: pickupAddressStr,
        pickupNotes: booking.pickupNotes || undefined,
        pickupStreet1: booking.pickupAddress.street1,
        pickupStreet2: booking.pickupAddress.street2,
        pickupCity: booking.pickupAddress.city,
        pickupState: booking.pickupAddress.state,
        pickupZipCode: booking.pickupAddress.zipCode,
        pickupCountry: booking.pickupAddress.country || 'US',
        pickupLatitude: booking.pickupAddress.latitude,
        pickupLongitude: booking.pickupAddress.longitude,
        pickupPlaceId: booking.pickupAddress.placeId,
        isManualAddress: booking.isManualAddress,
        isAsap: booking.isAsap,
        scheduledDate: booking.isAsap ? undefined : booking.scheduledDate || undefined,
        scheduledTime: booking.isAsap ? undefined : booking.scheduledTime || undefined,
        carrier: booking.carrier || 'Other',
        smallQty: booking.smallQty,
        mediumQty: booking.mediumQty,
        largeQty: booking.largeQty,
        oversizedQty: booking.oversizedQty,
        serviceType: booking.serviceType || 'carrier_dropoff',
        dropoffLocationType: booking.dropoffLocationType || undefined,
        dropoffLocationId: booking.dropoffLocationId ? (booking.dropoffLocationId as any) : undefined,
        dropoffLocationName: booking.dropoffLocationName || undefined,
        dropoffLocationAddress: booking.dropoffLocationAddress || undefined,
        dropoffLatitude: booking.dropoffLatitude || undefined,
        dropoffLongitude: booking.dropoffLongitude || undefined,
        amazonLabelConfirmed: booking.amazonLabelConfirmed || undefined,
        expectedTrackingNumber: booking.expectedTrackingNumber || undefined,
      })

      // Handle result
      if (!result.success || !result.checkoutUrl) {
        const errorCode = result.error?.code || 'UNKNOWN'
        const errorMessage = result.error?.message || 'Failed to create checkout'
        throw new Error(`${errorCode}: ${errorMessage}`)
      }

      // Store draft ID for success page
      if (result.draftId) {
        localStorage.setItem('droppit_draft_id', result.draftId)
      }

      // Reset booking store
      booking.resetBooking()

      // Log for debugging
      console.log('[Droppit Checkout] Redirecting to:', result.checkoutUrl)

      // Set status and redirect (ALWAYS use location.href, NO popups)
      setStatus('redirecting')
      window.location.href = result.checkoutUrl

    } catch (err: any) {
      console.error('Checkout error:', err)
      setIsProcessing(false)
      setStatus('error')
      
      // Extract error message - ConvexError puts message in err.data or err.message
      let errorMessage = 'An unexpected error occurred'
      
      if (err?.data) {
        // ConvexError format - data contains the message string
        errorMessage = typeof err.data === 'string' ? err.data : JSON.stringify(err.data)
      } else if (err?.message) {
        // Standard Error format
        errorMessage = err.message
      }
      
      // Log full error for debugging
      console.error('Checkout error details:', {
        message: err?.message,
        data: err?.data,
        name: err?.name,
      })
      
      const parsedError = parseError({ message: errorMessage } as Error)
      setError(parsedError)
      
      localStorage.removeItem('droppit_draft_id')
    }
  }

  const handleRetry = () => {
    // Reset state and try again
    setStatus('initial')
    setError(null)
    setIsProcessing(false)
  }

  const handleGoBack = () => {
    booking.setStep(booking.step - 1)
  }

  // Auth loading state
  if (isAuthLoading) {
    return (
      <div className="space-y-6 text-center py-12">
        <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
        <p className="text-muted-foreground">Checking your session...</p>
      </div>
    )
  }

  // Not authenticated - show sign in prompt
  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <Card className="p-6 bg-amber-500/10 border-amber-500/30">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500">
              <LogIn className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-outfit">Sign In Required</h2>
              <p className="text-muted-foreground mt-2">
                Please sign in to complete your booking. Your order details will be saved.
              </p>
            </div>
            <Button 
              onClick={() => window.location.href = '/auth?redirect=/customer/book'} 
              size="lg"
              className="w-full sm:w-auto"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In to Continue
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // Error state
  if (status === 'error' && error) {
    const errorConfig = ERROR_MESSAGES[error.code] || ERROR_MESSAGES.UNKNOWN

    return (
      <div className="space-y-6">
        <Card className="p-6 bg-destructive/10 border-destructive/30">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center text-destructive">
              {errorConfig.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold font-outfit text-destructive">
                {errorConfig.title}
              </h2>
              <p className="text-muted-foreground mt-2">{error.message}</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              {errorConfig.action === 'go_back' && (
                <Button onClick={handleGoBack} variant="default" className="flex-1">
                  <MapPin className="w-4 h-4 mr-2" />
                  Select Location
                </Button>
              )}
              {errorConfig.action === 'sign_in' && (
                <Button onClick={() => window.location.href = '/auth'} variant="default" className="flex-1">
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </Button>
              )}
              
              <Button onClick={handleRetry} variant="outline" className="flex-1">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          </div>
        </Card>
        
        <p className="text-xs text-center text-muted-foreground">
          Error: {error.code}
        </p>
      </div>
    )
  }

  // Redirecting state
  if (status === 'redirecting') {
    return (
      <div className="space-y-6 text-center py-12">
        <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
        <div>
          <h2 className="text-xl font-bold font-outfit">Opening Secure Checkout...</h2>
          <p className="text-muted-foreground mt-2">
            You'll be redirected to complete payment securely.
          </p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={handleRetry}
          >
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  // Default checkout view
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold font-outfit text-primary">Checkout</h2>
        <p className="text-muted-foreground">Review your order and complete payment</p>
      </div>

      {/* Order Summary */}
      <Card className="p-6 bg-slate-900/60 border-slate-700">
        <h3 className="font-semibold text-lg mb-4 font-outfit">Order Summary</h3>
        
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Service</span>
            <span>{booking.serviceType === 'amazon_return' ? 'Amazon Return' : 'Carrier Drop-Off'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Carrier</span>
            <span>{booking.carrier || 'Not selected'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Packages</span>
            <span>{packageSummary}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pickup</span>
            <span className="text-right max-w-[200px] truncate">
              {booking.pickupAddress?.city}, {booking.pickupAddress?.state}
            </span>
          </div>
          {booking.dropoffLocationName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Drop-off</span>
              <span className="text-right max-w-[200px] truncate">
                {booking.dropoffLocationName}
              </span>
            </div>
          )}
          
          <div className="border-t border-slate-700 my-4" />
          
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pickup Fee</span>
            <span>{formatCents(breakdown.pickupFeeCents)}</span>
          </div>
          {breakdown.totalPackages > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Packages ({breakdown.totalPackages})</span>
              <span>{formatCents(breakdown.packagesCents)}</span>
            </div>
          )}
          
          <div className="border-t border-slate-700 my-4" />
          
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span className="text-primary">{formatCents(breakdown.totalCents)}</span>
          </div>
        </div>
      </Card>

      {/* Payment Section */}
      <Card className="p-6 bg-slate-900/60 border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-lg font-outfit">Secure Payment</h3>
        </div>
        
        <p className="text-sm text-muted-foreground mb-6">
          You'll be redirected to complete payment securely. Your booking will be confirmed after payment.
        </p>
        
        <Button 
          onClick={handlePayNow}
          disabled={status === 'creating' || isProcessing}
          size="lg"
          className="w-full h-14 text-lg font-bold rounded-xl shadow-lg shadow-primary/20"
        >
          {status === 'creating' || isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Preparing Checkout...
            </>
          ) : (
            <>
              Pay Now - {formatCents(breakdown.totalCents)}
            </>
          )}
        </Button>
      </Card>

      {/* Security Note */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="w-4 h-4" />
        <span>Secure payment powered by Whop. Your card details are never stored.</span>
      </div>

      {/* Debug Panel - only in dev or when ?debug=true */}
      {(import.meta.env.DEV || new URLSearchParams(window.location.search).get('debug') === 'true') && (
        <details className="mt-6 text-left">
          <summary className="text-xs text-muted-foreground cursor-pointer">🔧 Debug Info</summary>
          <div className="mt-2 p-3 bg-slate-800 rounded text-xs font-mono space-y-1">
            <div><span className="text-muted-foreground">Hostname:</span> {window.location.hostname}</div>
            <div><span className="text-muted-foreground">Origin:</span> {window.location.origin}</div>
            <div><span className="text-muted-foreground">Convex URL:</span> {import.meta.env.VITE_CONVEX_URL || 'not set'}</div>
            <div><span className="text-muted-foreground">Auth Status:</span> {isAuthenticated ? '✅ Authenticated' : '❌ Not authenticated'}</div>
            <div><span className="text-muted-foreground">Total Price:</span> {formatCents(breakdown.totalCents)}</div>
            <div><span className="text-muted-foreground">Packages:</span> {breakdown.totalPackages}</div>
            <div><span className="text-muted-foreground">Service Type:</span> {booking.serviceType || 'not set'}</div>
            <div><span className="text-muted-foreground">Dropoff Location:</span> {booking.dropoffLocationId || 'not set'}</div>
            <div><span className="text-muted-foreground">Carrier:</span> {booking.carrier || 'not set'}</div>
          </div>
        </details>
      )}
    </div>
  )
}
