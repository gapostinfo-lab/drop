import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "@convex/api"
import { Id } from "@convex/dataModel"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Star, User, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

interface RatingDialogProps {
  jobId: Id<"jobs">
  isOpen: boolean
  onClose: () => void
  courierName?: string
  courierPhotoUrl?: string | null
}

export function RatingDialog({
  jobId,
  isOpen,
  onClose,
  courierName: initialCourierName,
  courierPhotoUrl: initialCourierPhotoUrl,
}: RatingDialogProps) {
  const [rating, setRating] = useState<number>(0)
  const [hoveredRating, setHoveredRating] = useState<number>(0)
  const [feedback, setFeedback] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const job = useQuery(api.jobs.getJobById, isOpen ? { jobId } : "skip")
  const courierProfile = useQuery(
    api.profiles.getProfileByUserId,
    job?.courierId && isOpen ? { userId: job.courierId } : "skip"
  )
  const courierImageUrl = useQuery(
    api.storage.getFileUrl,
    courierProfile?.profileImageId && isOpen ? { storageId: courierProfile.profileImageId } : "skip"
  )

  const name = initialCourierName || courierProfile?.name
  const photoUrl = initialCourierPhotoUrl || courierImageUrl

  const rateJob = useMutation(api.jobs.rateJob)

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please select a rating")
      return
    }

    setIsSubmitting(true)
    try {
      await rateJob({
        jobId,
        rating,
        feedback: feedback.trim() || undefined,
      })
      setIsSuccess(true)
      toast.success("Thank you for your feedback!")
      setTimeout(() => {
        onClose()
        // Reset state after closing animation
        setTimeout(() => {
          setIsSuccess(false)
          setRating(0)
          setFeedback("")
        }, 300)
      }, 2000)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit rating")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-slate-950 border-slate-800 text-slate-100">
        <AnimatePresence mode="wait">
          {!isSuccess ? (
            <motion.div
              key="rating-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 py-4"
            >
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-center font-outfit">
                  Rate your delivery
                </DialogTitle>
                <DialogDescription className="text-center text-slate-400">
                  How was your experience with {name || "your courier"}?
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col items-center justify-center space-y-4">
                {/* Courier Avatar */}
                <div className="w-20 h-20 rounded-full bg-slate-900 border-2 border-primary/20 overflow-hidden flex items-center justify-center">
                  {photoUrl ? (
                    <img
                      src={photoUrl}
                      alt={name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-10 h-10 text-slate-500" />
                  )}
                </div>
                {name && (
                  <p className="font-bold text-lg font-outfit">{name}</p>
                )}

                {/* Star Rating */}
                <div className="flex items-center gap-2 py-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className="relative p-1 transition-transform active:scale-90 hover:scale-110"
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      onClick={() => setRating(star)}
                    >
                      <Star
                        className={cn(
                          "w-10 h-10 transition-all duration-200",
                          (hoveredRating || rating) >= star
                            ? "fill-primary text-primary drop-shadow-[0_0_8px_rgba(57,255,20,0.5)]"
                            : "fill-transparent text-slate-700"
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">
                  Additional feedback (optional)
                </label>
                <Textarea
                  placeholder="Tell us more about the delivery..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className="bg-slate-900 border-slate-800 focus:border-primary/50 min-h-[100px] resize-none"
                />
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="text-slate-400 hover:text-white hover:bg-slate-900"
                >
                  Skip
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={rating === 0 || isSubmitting}
                  className="bg-primary text-primary-foreground font-bold hover:bg-primary/90 flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Rating"
                  )}
                </Button>
              </DialogFooter>
            </motion.div>
          ) : (
            <motion.div
              key="success-message"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-12 space-y-4 text-center"
            >
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-2">
                <Star className="w-10 h-10 fill-primary text-primary animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold font-outfit text-primary">Thank You!</h2>
              <p className="text-slate-400">
                Your feedback helps us improve our service.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}
