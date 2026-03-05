import { cn } from '@/lib/utils'
import { Check, Clock, Package, Truck, MapPin, CheckCircle2 } from 'lucide-react'

export type OrderStep = 
  | 'requested' 
  | 'matched' 
  | 'en_route' 
  | 'arrived' 
  | 'picked_up' 
  | 'dropped_off' 
  | 'completed'

interface TimelineStep {
  id: OrderStep
  label: string
  description: string
  icon: any
}

const STEPS: TimelineStep[] = [
  { id: 'requested', label: 'Requested', description: 'Pickup request received', icon: Clock },
  { id: 'matched', label: 'Matched', description: 'Courier found', icon: CheckCircle2 },
  { id: 'en_route', label: 'Courier En Route', description: 'Courier is on the way', icon: Truck },
  { id: 'arrived', label: 'Arrived', description: 'Courier at pickup location', icon: MapPin },
  { id: 'picked_up', label: 'Picked Up', description: 'Package(s) in transit', icon: Package },
  { id: 'dropped_off', label: 'Dropped Off', description: 'Delivered to carrier', icon: Truck },
  { id: 'completed', label: 'Completed', description: 'Pickup complete', icon: CheckCircle2 },
]

interface OrderTimelineProps {
  currentStep: OrderStep
  completedSteps: OrderStep[]
  className?: string
}

export function OrderTimeline({ currentStep, completedSteps, className }: OrderTimelineProps) {
  const currentIndex = STEPS.findIndex(s => s.id === currentStep)

  return (
    <div className={cn("space-y-8", className)}>
      {STEPS.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id) || index < currentIndex
        const isActive = step.id === currentStep
        const Icon = step.icon

        return (
          <div key={step.id} className="relative flex gap-4">
            {/* Connector Line */}
            {index !== STEPS.length - 1 && (
              <div 
                className={cn(
                  "absolute left-[19px] top-10 w-[2px] h-[calc(100%+16px)]",
                  index < currentIndex ? "bg-primary" : "bg-slate-800"
                )} 
              />
            )}

            {/* Icon Circle */}
            <div 
              className={cn(
                "relative z-10 w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 transition-all duration-500",
                isCompleted ? "bg-primary border-primary text-primary-foreground" : 
                isActive ? "bg-slate-900 border-primary text-primary shadow-[0_0_15px_rgba(186,255,41,0.3)] animate-pulse" : 
                "bg-slate-900 border-slate-800 text-slate-600"
              )}
            >
              {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
            </div>

            {/* Content */}
            <div className="pt-1 pb-4">
              <h4 className={cn(
                "font-bold font-outfit transition-colors",
                isActive ? "text-primary text-lg" : isCompleted ? "text-slate-100" : "text-slate-500"
              )}>
                {step.label}
              </h4>
              <p className={cn(
                "text-sm transition-colors",
                isActive ? "text-slate-300" : "text-slate-500"
              )}>
                {step.description}
              </p>
              {isActive && (
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary uppercase tracking-wider">
                  Live Update
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
