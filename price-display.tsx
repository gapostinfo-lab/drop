import { cn } from '@/lib/utils'

interface PriceDisplayProps {
  baseFee: number
  additionalPackagesFee: number
  packageCount: number
  className?: string
}

export function PriceDisplay({ 
  baseFee, 
  additionalPackagesFee, 
  packageCount,
  className 
}: PriceDisplayProps) {
  const additionalCount = Math.max(0, packageCount - 1)
  const additionalTotal = additionalCount * additionalPackagesFee
  const total = baseFee + additionalTotal

  return (
    <div className={cn("space-y-2 p-4 rounded-xl bg-muted/30 border border-border", className)}>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Base Pickup Fee</span>
        <span>${baseFee.toFixed(2)}</span>
      </div>
      {additionalCount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Extra Packages ({additionalCount}x)</span>
          <span>${additionalTotal.toFixed(2)}</span>
        </div>
      )}
      <div className="pt-2 mt-2 border-t border-border flex justify-between font-bold text-lg">
        <span>Total Price</span>
        <span className="text-primary">${total.toFixed(2)}</span>
      </div>
    </div>
  )
}
