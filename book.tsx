import { useBookingStore } from '@/stores/booking-store'
import { StepServiceType } from '@/components/booking/step-service-type'
import { StepAddress } from '@/components/booking/step-address'
import { StepLocation } from '@/components/booking/step-location'
import { StepTime } from '@/components/booking/step-time'
import { StepCarrier } from '@/components/booking/step-carrier'
import { StepPackages } from '@/components/booking/step-packages'
import { StepReview } from '@/components/booking/step-review'
import { StepCheckout } from '@/components/booking/step-checkout'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useMemo } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@convex/api'
import { AppShell } from '@/components/layout/app-shell'

export default function BookPage() {
  const { 
    step, 
    setStep, 
    pickupAddress, 
    isAddressValid,
    isManualAddress,
    carrier, 
    smallQty,
    mediumQty,
    largeQty,
    oversizedQty,
    isSealed, 
    serviceType,
    amazonLabelConfirmed,
    dropoffLocationId,
  } = useBookingStore()
  const navigate = useNavigate()
  const autoSaveAddress = useMutation(api.addresses.autoSaveAddress)
  
  const STEPS = useMemo(() => {
    const steps = [
      { id: 1, title: 'Service', component: StepServiceType },
      { id: 2, title: 'Address', component: StepAddress },
    ]

    if (serviceType === 'amazon_return') {
      steps.push({ id: 3, title: 'Location', component: StepLocation })
      steps.push({ id: 4, title: 'Time', component: StepTime })
      steps.push({ id: 5, title: 'Packages', component: StepPackages })
      steps.push({ id: 6, title: 'Review', component: StepReview })
      steps.push({ id: 7, title: 'Checkout', component: StepCheckout })
    } else {
      steps.push({ id: 3, title: 'Time', component: StepTime })
      steps.push({ id: 4, title: 'Carrier', component: StepCarrier })
      steps.push({ id: 5, title: 'Location', component: StepLocation })
      steps.push({ id: 6, title: 'Packages', component: StepPackages })
      steps.push({ id: 7, title: 'Review', component: StepReview })
      steps.push({ id: 8, title: 'Checkout', component: StepCheckout })
    }
    
    return steps.map((s, i) => ({ ...s, id: i + 1 }))
  }, [serviceType])

  const CurrentStepComponent = STEPS.find((s) => s.id === step)?.component || StepServiceType
  const progress = (step / STEPS.length) * 100

  const handleNext = () => {
    const currentStepTitle = STEPS.find(s => s.id === step)?.title

    if (currentStepTitle === 'Service') {
      if (!serviceType) {
        toast.error("Please select a service type")
        return
      }
      if (serviceType === 'amazon_return' && !amazonLabelConfirmed) {
        toast.error("Please confirm your Amazon return label is attached")
        return
      }
    }

    if (currentStepTitle === 'Address') {
      if (!isAddressValid || !pickupAddress) {
        toast.error("Please enter a valid pickup address")
        return
      }

      // For manual addresses, require coordinates
      if (isManualAddress && (!pickupAddress.latitude || !pickupAddress.longitude)) {
        toast.error("Please verify your address before continuing")
        return
      }
    }

    // Auto-save address when proceeding from Address step
    if (currentStepTitle === 'Address' && pickupAddress?.latitude && pickupAddress?.longitude) {
      autoSaveAddress({
        street1: pickupAddress.street1,
        street2: pickupAddress.street2,
        city: pickupAddress.city,
        state: pickupAddress.state,
        zipCode: pickupAddress.zipCode,
        country: pickupAddress.country || 'US',
        latitude: pickupAddress.latitude,
        longitude: pickupAddress.longitude,
        placeId: pickupAddress.placeId,
      }).catch(() => {
        // Silent fail - don't interrupt user flow
      })
    }

    if (currentStepTitle === 'Location' && !dropoffLocationId) {
      toast.error("Please select a drop-off location")
      return
    }

    if (currentStepTitle === 'Carrier' && !carrier) {
      toast.error("Please select a carrier")
      return
    }

    if (currentStepTitle === 'Packages') {
      const totalPackages = smallQty + mediumQty + largeQty + oversizedQty
      if (totalPackages === 0) {
        toast.error("Please select at least one package")
        return
      }
      if (!isSealed) {
        toast.error("Please confirm that packages are sealed and labeled")
        return
      }
    }

    if (step < STEPS.length) {
      setStep(step + 1)
      window.scrollTo(0, 0)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
      window.scrollTo(0, 0)
    } else {
      navigate(-1)
    }
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-8 pb-40 md:pb-32">
        <div className="mb-8 space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-sm font-medium text-primary uppercase tracking-widest">Step {step} of {STEPS.length}</p>
              <h1 className="text-3xl font-bold font-outfit">{STEPS.find(s => s.id === step)?.title}</h1>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-xs text-muted-foreground">Booking Progress</p>
              <p className="text-sm font-bold font-outfit">{Math.round(progress)}%</p>
            </div>
          </div>
          <Progress value={progress} className="h-2 bg-slate-800" />
        </div>

        <div className="min-h-[400px]">
          <CurrentStepComponent />
        </div>

        {/* Navigation Buttons */}
        <div className="fixed bottom-20 md:bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t border-border z-40">
          <div className="max-w-2xl mx-auto flex gap-4">
            <Button
              variant="outline"
              size="lg"
              className="flex-1 h-14 rounded-xl border-2 font-bold"
              onClick={handleBack}
            >
              <ChevronLeft className="mr-2 w-5 h-5" />
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>
            
            {STEPS.find(s => s.id === step)?.title !== 'Checkout' && (
              <Button
                size="lg"
                className="flex-[2] h-14 rounded-xl font-bold text-lg shadow-lg shadow-primary/20"
                onClick={handleNext}
              >
                {STEPS.find(s => s.id === step)?.title === 'Review' ? (
                  <>
                    Proceed to Checkout
                    <ChevronRight className="ml-2 w-5 h-5" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="ml-2 w-5 h-5" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

