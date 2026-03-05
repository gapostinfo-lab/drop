import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RatingStarsProps {
  rating: number
  max?: number
  size?: number
  className?: string
  onChange?: (rating: number) => void
}

export function RatingStars({ 
  rating, 
  max = 5, 
  size = 16, 
  className,
  onChange 
}: RatingStarsProps) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {Array.from({ length: max }).map((_, i) => (
        <button
          key={i}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(i + 1)}
          className={cn(
            "transition-colors",
            onChange ? "cursor-pointer hover:scale-110" : "cursor-default"
          )}
        >
          <Star 
            size={size}
            className={cn(
              i < rating 
                ? "fill-primary text-primary" 
                : "fill-muted text-muted-foreground"
            )}
          />
        </button>
      ))}
    </div>
  )
}
