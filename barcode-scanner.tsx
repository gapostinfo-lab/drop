import { useEffect, useRef, useState } from "react"
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode"
import { X, Keyboard, Loader2, AlertCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface BarcodeScannerProps {
  isOpen: boolean
  onClose: () => void
  onScan: (barcode: string) => void
  title?: string
}

export function BarcodeScanner({
  isOpen,
  onClose,
  onScan,
  title = "Scan Barcode",
}: BarcodeScannerProps) {
  const [isManualEntry, setIsManualEntry] = useState(false)
  const [manualBarcode, setManualBarcode] = useState("")
  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [isSuccess, setIsSuccess] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const scannerId = "barcode-scanner-viewport"

  useEffect(() => {
    if (!isOpen || isManualEntry) {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error).finally(() => {
          scannerRef.current = null
        })
      }
      return
    }

    const startScanner = async () => {
      setIsInitializing(true)
      setError(null)
      
      try {
        const scanner = new Html5Qrcode(scannerId)
        scannerRef.current = scanner

        const config = {
          fps: 15,
          qrbox: { width: 280, height: 180 },
          aspectRatio: 1.0,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.CODABAR,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.AZTEC,
            Html5QrcodeSupportedFormats.PDF_417,
          ],
        }

        await scanner.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            handleSuccess(decodedText)
          },
          () => {
            // Silence common scanning errors (no barcode found in frame)
          }
        )
        setIsInitializing(false)
      } catch (err) {
        console.error("Failed to start scanner:", err)
        const errorMessage = err instanceof Error ? err.message : "Unknown error"
        if (errorMessage.includes("NotAllowedError") || errorMessage.includes("Permission")) {
          setError("Camera permission denied. Please allow camera access.")
        } else if (errorMessage.includes("NotFoundError") || errorMessage.includes("no camera")) {
          setError("No camera found on this device.")
        } else {
          setError(`Camera error: ${errorMessage}`)
        }
        setIsInitializing(false)
      }
    }

    // Small delay to ensure the DOM element is ready
    const timer = setTimeout(startScanner, 300)
    return () => {
      clearTimeout(timer)
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error)
      }
    }
  }, [isOpen, isManualEntry, retryCount])

  const handleSuccess = (barcode: string) => {
    setIsSuccess(true)
    toast.success("Barcode scanned!")
    
    // Play a subtle vibration if supported
    if ("vibrate" in navigator) {
      navigator.vibrate(100)
    }

    setTimeout(() => {
      onScan(barcode)
      setIsSuccess(false)
    }, 500)
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (manualBarcode.trim()) {
      onScan(manualBarcode.trim())
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md h-[90vh] sm:h-auto flex flex-col p-0 overflow-hidden bg-background border-border">
        <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
          <DialogTitle className="text-foreground font-black uppercase tracking-tight">
            {title}
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </Button>
        </DialogHeader>

        <div className="flex-1 relative flex flex-col items-center justify-center bg-black">
          {isManualEntry ? (
            <form onSubmit={handleManualSubmit} className="w-full p-8 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="barcode" className="text-muted-foreground uppercase text-xs font-bold tracking-widest">
                  Enter Barcode Manually
                </Label>
                <Input
                  id="barcode"
                  autoFocus
                  placeholder="e.g. 1Z999AA10123456784"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  className="bg-muted border-border text-foreground h-14 text-lg font-mono focus:ring-primary"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-14 bg-primary text-primary-foreground font-black text-lg uppercase tracking-tight"
                disabled={!manualBarcode.trim()}
              >
                Submit Barcode
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsManualEntry(false)}
                className="w-full text-muted-foreground hover:text-foreground"
              >
                Back to Camera
              </Button>
            </form>
          ) : (
            <>
              {/* Viewport */}
              <div id={scannerId} className="w-full h-full" />

              {/* Viewfinder Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className={cn(
                  "relative w-[280px] h-[180px] border-2 transition-all duration-300",
                  isSuccess ? "border-green-500 bg-green-500/20" : "border-primary/50"
                )}>
                  {/* Corners */}
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-primary" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-primary" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-primary" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-primary" />
                  
                  {/* Scan Line */}
                  {!isSuccess && (
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.5)] animate-scan-line" />
                  )}
                </div>
              </div>

              {/* Status & Controls */}
              <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-6 px-6 pointer-events-none">
                <div className="flex flex-col items-center gap-2">
                  {isInitializing ? (
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-border">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-xs font-bold text-foreground uppercase tracking-widest">Initializing Camera...</span>
                    </div>
                  ) : error ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2 bg-destructive/20 backdrop-blur-md px-4 py-2 rounded-full border border-destructive/50">
                        <AlertCircle className="w-4 h-4 text-destructive" />
                        <span className="text-xs font-bold text-destructive uppercase tracking-widest">{error}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setError(null)
                          setIsInitializing(true)
                          setRetryCount(c => c + 1)
                        }}
                        className="mt-2 pointer-events-auto bg-black/60 backdrop-blur-md border-border text-foreground hover:bg-muted"
                      >
                        Try Again
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-border animate-pulse">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-xs font-bold text-foreground uppercase tracking-widest">Scanning...</span>
                    </div>
                  )}
                </div>

                <div className="w-full flex gap-3 pointer-events-auto">
                  <Button
                    onClick={() => setIsManualEntry(true)}
                    className="flex-1 h-14 bg-muted/80 backdrop-blur-md border border-border text-foreground font-bold rounded-2xl"
                  >
                    <Keyboard className="w-5 h-5 mr-2" />
                    MANUAL
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="flex-1 h-14 bg-muted/80 backdrop-blur-md border border-border text-foreground font-bold rounded-2xl"
                  >
                    CANCEL
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>

      <style dangerouslySetInnerHTML={{ __html: `
        #barcode-scanner-viewport video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
        #barcode-scanner-viewport {
          border: none !important;
        }
        @keyframes scan-line {
          0% { transform: translateY(0); }
          100% { transform: translateY(180px); }
        }
        .animate-scan-line {
          animation: scan-line 2s linear infinite;
        }
      `}} />
    </Dialog>
  )
}
