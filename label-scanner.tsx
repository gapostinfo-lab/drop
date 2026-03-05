import { useEffect, useRef, useState, useCallback } from "react"
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from "@zxing/library"
import { X, Camera, Keyboard, ImagePlus, Loader2, AlertCircle, Check, RotateCcw } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type ScanMode = "camera" | "manual" | "photo"

interface LabelScannerProps {
  isOpen: boolean
  onClose: () => void
  onScan: (value: string, type: "barcode" | "qr" | "manual" | "ocr") => void
  title?: string
}

export function LabelScanner({
  isOpen,
  onClose,
  onScan,
  title = "Scan Package Label",
}: LabelScannerProps) {
  const [mode, setMode] = useState<ScanMode>("camera")
  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detectedValue, setDetectedValue] = useState<string | null>(null)
  const [manualValue, setManualValue] = useState("")
  const [manualError, setManualError] = useState<string | null>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const lastScanRef = useRef<{ value: string; time: number } | null>(null)

  // Cleanup function to stop camera
  const stopCamera = useCallback(() => {
    if (readerRef.current) {
      readerRef.current.reset()
      readerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }, [])

  // Handle close - ensure camera is stopped
  const handleClose = useCallback(() => {
    stopCamera()
    setDetectedValue(null)
    setManualValue("")
    setManualError(null)
    setError(null)
    setMode("camera")
    onClose()
  }, [stopCamera, onClose])

  // Start camera scanning
  useEffect(() => {
    if (!isOpen || mode !== "camera" || detectedValue) {
      return
    }

    let mounted = true
    setIsInitializing(true)
    setError(null)

    const startScanning = async () => {
      try {
        // Configure hints for better detection
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.QR_CODE,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_93,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.ITF,
          BarcodeFormat.CODABAR,
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.AZTEC,
          BarcodeFormat.PDF_417,
        ])
        hints.set(DecodeHintType.TRY_HARDER, true)

        const reader = new BrowserMultiFormatReader(hints)
        readerRef.current = reader

        // Get video devices
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter(d => d.kind === "videoinput")
        
        // Prefer back camera
        let deviceId: string | undefined
        const backCamera = videoDevices.find(d => 
          d.label.toLowerCase().includes("back") || 
          d.label.toLowerCase().includes("rear") ||
          d.label.toLowerCase().includes("environment")
        )
        if (backCamera) {
          deviceId = backCamera.deviceId
        } else if (videoDevices.length > 0) {
          // On mobile, last device is usually back camera
          deviceId = videoDevices[videoDevices.length - 1].deviceId
        }

        if (!videoRef.current) {
          throw new Error("Video element not ready")
        }

        // Start decoding
        await reader.decodeFromVideoDevice(
          deviceId ?? null,
          videoRef.current,
          (result) => {
            if (!mounted) return
            
            if (result) {
              const value = result.getText()
              const now = Date.now()
              
              // Debounce: ignore if same value within 2 seconds
              if (lastScanRef.current && 
                  lastScanRef.current.value === value && 
                  now - lastScanRef.current.time < 2000) {
                return
              }
              
              lastScanRef.current = { value, time: now }
              
              setDetectedValue(value)
              
              // Vibrate on success
              if ("vibrate" in navigator) {
                navigator.vibrate(100)
              }
            }
            // Ignore decode errors (no barcode in frame)
          }
        )

        // Store stream reference for cleanup
        if (videoRef.current?.srcObject) {
          streamRef.current = videoRef.current.srcObject as MediaStream
        }

        if (mounted) {
          setIsInitializing(false)
        }
      } catch (err) {
        console.error("[LabelScanner] Error:", err)
        if (!mounted) return
        
        const message = err instanceof Error ? err.message : String(err)
        if (message.includes("NotAllowedError") || message.includes("Permission")) {
          setError("Camera permission denied. Please allow camera access in your browser settings.")
        } else if (message.includes("NotFoundError") || message.includes("no video")) {
          setError("No camera found on this device.")
        } else if (message.includes("NotReadableError")) {
          setError("Camera is in use by another app. Please close other apps using the camera.")
        } else {
          setError(`Camera error: ${message}`)
        }
        setIsInitializing(false)
      }
    }

    // Small delay to ensure DOM is ready
    const timer = setTimeout(startScanning, 100)

    return () => {
      mounted = false
      clearTimeout(timer)
      stopCamera()
    }
  }, [isOpen, mode, detectedValue, stopCamera])

  // Handle confirm detected value
  const handleConfirm = () => {
    if (!detectedValue) return
    
    // Determine if QR or barcode based on content
    const isQR = detectedValue.startsWith("http") || detectedValue.length > 50
    onScan(detectedValue, isQR ? "qr" : "barcode")
    handleClose()
  }

  // Handle rescan
  const handleRescan = () => {
    setDetectedValue(null)
    lastScanRef.current = null
  }

  // Handle manual submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setManualError(null)
    
    const trimmed = manualValue.trim().toUpperCase()
    
    if (!trimmed) {
      setManualError("Please enter a tracking number")
      return
    }
    if (trimmed.length < 6) {
      setManualError("Tracking number must be at least 6 characters")
      return
    }
    if (trimmed.length > 64) {
      setManualError("Tracking number is too long")
      return
    }
    
    onScan(trimmed, "manual")
    handleClose()
  }

  // Mask value for display (show last 6 chars)
  const maskValue = (value: string) => {
    if (value.length <= 6) return value
    return "****" + value.slice(-6)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md h-[90vh] sm:h-auto flex flex-col p-0 overflow-hidden bg-background border-border">
        <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between shrink-0">
          <DialogTitle className="text-foreground font-black uppercase tracking-tight">
            {title}
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </Button>
        </DialogHeader>

        {/* Mode tabs */}
        <div className="flex border-b border-border shrink-0">
          <button
            onClick={() => { stopCamera(); setMode("camera"); setDetectedValue(null); }}
            className={cn(
              "flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors",
              mode === "camera" 
                ? "text-primary border-b-2 border-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Camera className="w-4 h-4" />
            Scan
          </button>
          <button
            onClick={() => { stopCamera(); setMode("manual"); }}
            className={cn(
              "flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors",
              mode === "manual" 
                ? "text-primary border-b-2 border-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Keyboard className="w-4 h-4" />
            Manual
          </button>
          <button
            onClick={() => { stopCamera(); setMode("photo"); }}
            className={cn(
              "flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors",
              mode === "photo" 
                ? "text-primary border-b-2 border-primary" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ImagePlus className="w-4 h-4" />
            Photo
          </button>
        </div>

        <div className="flex-1 relative flex flex-col">
          {/* Camera mode */}
          {mode === "camera" && (
            <div className="flex-1 relative bg-black flex items-center justify-center">
              {/* Video element */}
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />

              {/* Detected value overlay */}
              {detectedValue && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
                  <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                    <Check className="w-10 h-10 text-green-500" />
                  </div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">
                    Detected
                  </p>
                  <p className="text-xl font-mono font-bold text-white mb-6">
                    {maskValue(detectedValue)}
                  </p>
                  <div className="flex gap-3 w-full max-w-xs">
                    <Button
                      variant="outline"
                      onClick={handleRescan}
                      className="flex-1 h-12 font-bold"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Rescan
                    </Button>
                    <Button
                      onClick={handleConfirm}
                      className="flex-1 h-12 bg-green-500 hover:bg-green-600 text-white font-bold"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Confirm
                    </Button>
                  </div>
                </div>
              )}

              {/* Viewfinder overlay (when scanning) */}
              {!detectedValue && !error && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative w-72 h-44 border-2 border-primary/50">
                    {/* Corners */}
                    <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary" />
                    <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary" />
                    <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary" />
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary" />
                    
                    {/* Scan line animation */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-primary/60 animate-scan-line" />
                  </div>
                </div>
              )}

              {/* Status indicator */}
              {!detectedValue && (
                <div className="absolute bottom-6 left-0 right-0 flex justify-center">
                  {isInitializing ? (
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-xs font-bold text-white uppercase tracking-widest">
                        Starting camera...
                      </span>
                    </div>
                  ) : error ? (
                    <div className="flex flex-col items-center gap-3 px-6">
                      <div className="flex items-center gap-2 bg-destructive/20 backdrop-blur-md px-4 py-2 rounded-full">
                        <AlertCircle className="w-4 h-4 text-destructive" />
                        <span className="text-xs font-bold text-destructive">
                          {error}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setError(null); setIsInitializing(true); }}
                        className="text-white border-white/30"
                      >
                        Try Again
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full animate-pulse">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-xs font-bold text-white uppercase tracking-widest">
                        Point at barcode
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Manual entry mode */}
          {mode === "manual" && (
            <form onSubmit={handleManualSubmit} className="flex-1 flex flex-col p-6">
              <div className="flex-1 flex flex-col justify-center space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="tracking" className="text-muted-foreground uppercase text-xs font-bold tracking-widest">
                    Enter Tracking Number
                  </Label>
                  <Input
                    id="tracking"
                    autoFocus
                    placeholder="e.g. 1Z999AA10123456784"
                    value={manualValue}
                    onChange={(e) => { setManualValue(e.target.value); setManualError(null); }}
                    className={cn(
                      "h-14 text-lg font-mono uppercase",
                      manualError && "border-destructive focus-visible:ring-destructive"
                    )}
                  />
                  {manualError && (
                    <p className="text-sm text-destructive font-medium">{manualError}</p>
                  )}
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full h-14 bg-primary text-primary-foreground font-black text-lg uppercase"
                  disabled={!manualValue.trim()}
                >
                  Save Tracking Number
                </Button>
              </div>
            </form>
          )}

          {/* Photo OCR mode (placeholder) */}
          {mode === "photo" && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <ImagePlus className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-2">Photo OCR</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                Take a photo of the shipping label and we'll extract the tracking number automatically.
              </p>
              <p className="text-xs text-muted-foreground italic">
                Coming soon. Please use manual entry for now.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setMode("manual")}
              >
                <Keyboard className="w-4 h-4 mr-2" />
                Use Manual Entry
              </Button>
            </div>
          )}
        </div>

        {/* Cancel button at bottom */}
        <div className="p-4 border-t border-border shrink-0">
          <Button
            variant="outline"
            onClick={handleClose}
            className="w-full h-12 font-bold"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scan-line {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(170px); opacity: 0.5; }
        }
        .animate-scan-line {
          animation: scan-line 2s ease-in-out infinite;
        }
      `}} />
    </Dialog>
  )
}
