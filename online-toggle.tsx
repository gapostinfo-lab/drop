import { Power, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface OnlineToggleProps {
  isOnline: boolean
  onToggle: () => void
  isLoading?: boolean
  disabled?: boolean
  className?: string
}

export function OnlineToggle({ isOnline, onToggle, isLoading, disabled, className }: OnlineToggleProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-6 rounded-3xl transition-all duration-500",
      isOnline 
        ? "bg-primary/10 border-2 border-primary/30 shadow-[0_0_30px_rgba(var(--primary),0.1)]" 
        : "bg-muted border-2 border-transparent",
      (isLoading || disabled) && "opacity-70",
      className
    )}>
      <div className="flex flex-col items-center gap-4">
        <div className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500",
          isOnline ? "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.4)]" : "bg-muted-foreground/20 text-muted-foreground"
        )}>
          {isLoading ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <Power className={cn("w-8 h-8", isOnline && "animate-pulse")} />
          )}
        </div>
        
        <div className="flex flex-col items-center gap-1">
          <Label className={cn(
            "text-xl font-bold tracking-tight",
            isOnline ? "text-primary" : "text-muted-foreground"
          )}>
            {isLoading ? "UPDATING..." : isOnline ? "YOU'RE ONLINE" : "YOU'RE OFFLINE"}
          </Label>
          <span className="text-xs text-muted-foreground/60 font-medium">
            {isLoading ? "Please wait..." : isOnline ? "Ready to accept pickups" : "Go online to start earning"}
          </span>
        </div>

        <div className="mt-2 scale-150">
          <Switch 
            checked={isOnline} 
            onCheckedChange={onToggle}
            disabled={isLoading || disabled}
            className="data-[state=checked]:bg-primary"
          />
        </div>
      </div>
    </div>
  )
}
