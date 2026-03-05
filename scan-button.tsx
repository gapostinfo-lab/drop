import { useState } from 'react'
import { Camera, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ScanButtonProps {
  onScanComplete: () => void
  label?: string
  className?: string
}

export function ScanButton({ onScanComplete, label = 'Scan Barcode', className }: ScanButtonProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleScan = () => {
    setIsScanning(true)
    // Simulate scan process
    setTimeout(() => {
      setIsScanning(false)
      setIsSuccess(true)
      setTimeout(() => {
        onScanComplete()
        setIsSuccess(false)
      }, 1500)
    }, 2000)
  }

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="relative group">
        <Button
          onClick={handleScan}
          disabled={isScanning || isSuccess}
          variant="outline"
          className={cn(
            "w-32 h-32 rounded-3xl border-2 flex flex-col items-center justify-center gap-2 transition-all duration-300",
            isScanning ? "border-primary bg-primary/10 shadow-[0_0_20px_rgba(var(--primary),0.3)]" : "border-muted-foreground/30 hover:border-primary hover:bg-primary/5",
            isSuccess ? "border-green-500 bg-green-500/10" : ""
          )}
        >
          {isScanning ? (
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-2xl">
              <Camera className="w-10 h-10 text-primary animate-pulse" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/40 to-transparent h-1 w-full animate-scan" />
            </div>
          ) : isSuccess ? (
            <CheckCircle2 className="w-12 h-12 text-green-500 animate-in zoom-in" />
          ) : (
            <Camera className="w-12 h-12 text-muted-foreground group-hover:text-primary transition-colors" />
          )}
        </Button>
      </div>
      <span className={cn(
        "text-sm font-medium tracking-wide uppercase",
        isScanning ? "text-primary animate-pulse" : isSuccess ? "text-green-500" : "text-muted-foreground"
      )}>
        {isScanning ? 'Scanning...' : isSuccess ? 'Success!' : label}
      </span>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        .animate-scan {
          animation: scan 1.5s linear infinite;
        }
      `}</style>
    </div>
  )
}
