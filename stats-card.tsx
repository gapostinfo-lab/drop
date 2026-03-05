import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react"

interface StatsCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  className?: string
}

export function StatsCard({ label, value, icon: Icon, trend, className }: StatsCardProps) {
  return (
    <Card className={cn("overflow-hidden group transition-all duration-300 hover:border-primary/50", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
            <Icon className="w-5 h-5" />
          </div>
          {trend && (
            <div className={cn(
              "flex items-center gap-0.5 text-xs font-medium px-2 py-1 rounded-full",
              trend.isPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-destructive/10 text-destructive"
            )}>
              {trend.isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {trend.value}%
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
