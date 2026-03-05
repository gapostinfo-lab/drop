import { useRef, useState, useCallback, useEffect } from "react"
import { Camera, RotateCcw, Check, X, Loader2, ImagePlus, AlertCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useMutation } from "convex/react"
import { api } from "@convex/api"
import { Id } from "@convex/dataModel"

interface PhotoCaptureProps {
  isOpen: boolean
  onClose: () => void
  onCapture: (storageId: Id<"_storage">) => void
  title?: string
  description?: string
}

export function PhotoCapture({
  isOpen,
  onClose,
  onCapture,
  title = "Take Photo",
  description = "Position the package in frame",
}: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const generateUploadUrl = useMutation(api.storage.generateUploadUrl)

  // Start camera when dialog opens
  useEffect(() => {
    if (!isOpen) {
      stopCamera()
      setCapturedImage(null)
      setError(null)
      return
    }

    if (capturedImage) return // Don't restart camera if we have a captured image

    startCamera()
  }, [isOpen, capturedImage])

  const startCamera = async () => {
    setIsInitializing(true)
    setError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setIsInitializing(false)
    } catch (err) {
      console.error("Failed to start camera:", err)
      setError("Could not access camera. Please check permissions or use gallery.")
      setIsInitializing(false)
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")

    if (!ctx) return

    // Set canvas size to video dimensions
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw the video frame to canvas
    ctx.drawImage(video, 0, 0)

    // Get the image data URL
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.85)
    setCapturedImage(imageDataUrl)

    // Stop the camera
    stopCamera()

    // Vibrate feedback
    if ("vibrate" in navigator) {
      navigator.vibrate(50)
    }
  }, [])

  const retakePhoto = () => {
    setCapturedImage(null)
    startCamera()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Read file as data URL for preview
    const reader = new FileReader()
    reader.onload = (event) => {
      setCapturedImage(event.target?.result as string)
      stopCamera()
    }
    reader.readAsDataURL(file)
  }

  const uploadPhoto = async () => {
    if (!capturedImage) return

    setIsUploading(true)

    try {
      // Convert data URL to blob
      const response = await fetch(capturedImage)
      const blob = await response.blob()

      // Get upload URL from Convex
      const uploadUrl = await generateUploadUrl()

      // Upload the file
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      })

      const { storageId } = await uploadResponse.json()

      toast.success("Photo uploaded!")

      // Vibrate feedback
      if ("vibrate" in navigator) {
        navigator.vibrate(100)
      }

      onCapture(storageId)
    } catch (err) {
      console.error("Failed to upload photo:", err)
      toast.error("Failed to upload photo. Please try again.")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md h-[90vh] sm:h-auto flex flex-col p-0 overflow-hidden bg-black border-none">
        <DialogHeader className="p-4 border-b border-white/10 flex flex-row items-center justify-between bg-black/80 backdrop-blur-md">
          <div>
            <DialogTitle className="text-white font-black uppercase tracking-tight">
              {title}
            </DialogTitle>
            <p className="text-xs text-white/60 mt-0.5">{description}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </Button>
        </DialogHeader>

        <div className="flex-1 relative flex flex-col items-center justify-center bg-black">
          {/* Hidden canvas for capturing */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Hidden file input for gallery */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />

          {capturedImage ? (
            // Preview captured image
            <div className="w-full h-full relative">
              <img
                src={capturedImage}
                alt="Captured"
                className="w-full h-full object-contain"
              />

              {/* Overlay controls */}
              <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-4 px-6">
                {isUploading ? (
                  <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-[#39FF14]/30">
                    <Loader2 className="w-5 h-5 animate-spin text-[#39FF14]" />
                    <span className="text-sm font-bold text-white uppercase tracking-widest">
                      Uploading...
                    </span>
                  </div>
                ) : (
                  <div className="w-full flex gap-3">
                    <Button
                      onClick={retakePhoto}
                      className="flex-1 h-14 bg-white/10 backdrop-blur-md border border-white/20 text-white font-bold rounded-2xl hover:bg-white/20"
                    >
                      <RotateCcw className="w-5 h-5 mr-2" />
                      RETAKE
                    </Button>
                    <Button
                      onClick={uploadPhoto}
                      className="flex-[2] h-14 bg-[#39FF14] hover:bg-[#39FF14]/90 text-black font-black rounded-2xl shadow-lg shadow-[#39FF14]/30"
                    >
                      <Check className="w-5 h-5 mr-2" />
                      USE PHOTO
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Camera view
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={cn(
                  "w-full h-full object-cover",
                  isInitializing && "opacity-0"
                )}
              />

              {/* Viewfinder overlay */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Corner guides */}
                <div className="absolute top-1/4 left-1/4 w-12 h-12 border-t-2 border-l-2 border-[#39FF14]" />
                <div className="absolute top-1/4 right-1/4 w-12 h-12 border-t-2 border-r-2 border-[#39FF14]" />
                <div className="absolute bottom-1/4 left-1/4 w-12 h-12 border-b-2 border-l-2 border-[#39FF14]" />
                <div className="absolute bottom-1/4 right-1/4 w-12 h-12 border-b-2 border-r-2 border-[#39FF14]" />
              </div>

              {/* Status & Controls */}
              <div className="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-6 px-6">
                {isInitializing ? (
                  <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                    <Loader2 className="w-4 h-4 animate-spin text-[#39FF14]" />
                    <span className="text-xs font-bold text-white uppercase tracking-widest">
                      Starting Camera...
                    </span>
                  </div>
                ) : error ? (
                  <div className="flex items-center gap-2 bg-red-500/20 backdrop-blur-md px-4 py-2 rounded-full border border-red-500/50">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <span className="text-xs font-bold text-red-500 uppercase tracking-widest">
                      {error}
                    </span>
                  </div>
                ) : null}

                <div className="w-full flex items-center justify-center gap-4">
                  {/* Gallery button */}
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="h-14 w-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20"
                    disabled={isInitializing}
                  >
                    <ImagePlus className="w-6 h-6" />
                  </Button>

                  {/* Capture button */}
                  <Button
                    onClick={capturePhoto}
                    disabled={isInitializing || !!error}
                    className="h-20 w-20 rounded-full bg-[#39FF14] hover:bg-[#39FF14]/90 text-black shadow-lg shadow-[#39FF14]/30 disabled:opacity-50"
                  >
                    <Camera className="w-8 h-8" />
                  </Button>

                  {/* Cancel button */}
                  <Button
                    onClick={onClose}
                    className="h-14 w-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20"
                  >
                    <X className="w-6 h-6" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
