import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Upload, 
  User, 
  Car, 
  FileText, 
  ShieldCheck, 
  Loader2,
  Calendar,
  MapPin,
  FileCheck,
  AlertCircle,
  X,
  Camera
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useMutation, useQuery } from "convex/react"
import { api } from "@convex/api"
import { Id } from "@convex/dataModel"

const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
];

export default function CourierOnboardingPage() {
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState<string | null>(null)
  const navigate = useNavigate()
  const hasCreatedInitialDraft = useRef(false)

  const existingApplication = useQuery(api.couriers.getMyApplication)
  const profile = useQuery(api.profiles.getMyProfile)
  const saveDraft = useMutation(api.couriers.saveDraft)
  const submitApplication = useMutation(api.couriers.submitApplication)
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl)

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    dateOfBirth: '',
    homeAddress: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: '',
    vehicleColor: '',
    vehiclePlate: '',
    agreedToContractor: false,
    agreedToLicenseInsurance: false,
    agreedToBackgroundCheck: false,
    applicantNotes: '',
    licenseNumber: '',
    licenseState: '',
    licenseExpiresAt: '',
  })

  const [storageIds, setStorageIds] = useState<{
    profilePhotoId?: Id<"_storage">
    licenseFrontId?: Id<"_storage">
    licenseBackId?: Id<"_storage">
    insuranceId?: Id<"_storage">
  }>({})

  // Pre-fill form from profile or existing application
  useEffect(() => {
    const initializeDraft = async () => {
      setInitError(null)
      // If we have an existing application, use it
      if (existingApplication) {
        if (existingApplication.status === 'pending_review' || existingApplication.status === 'approved') {
          navigate('/courier/status')
          return
        }

        setFormData({
          fullName: existingApplication.fullName || '',
          phone: existingApplication.phone || '',
          email: existingApplication.email || '',
          dateOfBirth: existingApplication.dateOfBirth || '',
          homeAddress: existingApplication.homeAddress || '',
          vehicleMake: existingApplication.vehicleMake || '',
          vehicleModel: existingApplication.vehicleModel || '',
          vehicleYear: existingApplication.vehicleYear || '',
          vehicleColor: existingApplication.vehicleColor || '',
          vehiclePlate: existingApplication.vehiclePlate || '',
          agreedToContractor: existingApplication.agreedToContractor || false,
          agreedToLicenseInsurance: existingApplication.agreedToLicenseInsurance || false,
          agreedToBackgroundCheck: existingApplication.agreedToBackgroundCheck || false,
          applicantNotes: existingApplication.applicantNotes || '',
          licenseNumber: existingApplication.licenseNumber || '',
          licenseState: existingApplication.licenseState || '',
          licenseExpiresAt: existingApplication.licenseExpiresAt || '',
        })

        setStorageIds({
          profilePhotoId: existingApplication.profilePhotoId,
          licenseFrontId: existingApplication.licenseFrontId,
          licenseBackId: existingApplication.licenseBackId,
          insuranceId: existingApplication.insuranceId,
        })
        return
      }
      
      // No existing application - create draft from profile
      if (existingApplication === null && profile && !hasCreatedInitialDraft.current) {
        hasCreatedInitialDraft.current = true
        
        const initialData = {
          fullName: profile.name || '',
          email: profile.email || '',
          phone: profile.phone || '',
        }
        
        setFormData(prev => ({
          ...prev,
          ...initialData,
        }))
        
        // Try to create draft
        setIsInitializing(true)
        try {
          await saveDraft(initialData)
        } catch (error: any) {
          setInitError(error?.message || String(error))
        } finally {
          setIsInitializing(false)
        }
      }
    }
    
    initializeDraft()
  }, [existingApplication, profile, navigate, saveDraft])

  const uploadFile = async (file: File, field: string) => {
    setIsUploading(field)
    try {
      const url = await generateUploadUrl()
      const result = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      })
      const { storageId } = await result.json()
      setStorageIds(prev => ({ ...prev, [`${field}Id`]: storageId }))
      toast.success("File uploaded successfully")
      return storageId
    } catch (error) {
      toast.error("Failed to upload file")
    } finally {
      setIsUploading(null)
    }
  }

  const handleFileChange = (field: string) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await uploadFile(file, field)
    }
  }

  const totalSteps = 6
  const progress = (step / totalSteps) * 100

  const validateStep = () => {
    switch (step) {
      case 1:
        if (!formData.fullName || !formData.phone || !formData.email || !formData.dateOfBirth || !formData.homeAddress) {
          toast.error("Please fill in all required fields")
          return false
        }
        return true
      case 2:
        if (!storageIds.profilePhotoId) {
          toast.error("Please upload a profile photo")
          return false
        }
        return true
      case 3:
        if (!formData.licenseNumber || !formData.licenseState || !formData.licenseExpiresAt) {
          toast.error("Please fill in all license details")
          return false
        }
        if (!storageIds.licenseFrontId || !storageIds.licenseBackId) {
          toast.error("Please upload both sides of your license")
          return false
        }
        // Check if license is not expired
        const expiryDate = new Date(formData.licenseExpiresAt)
        if (expiryDate < new Date()) {
          toast.error("Your license appears to be expired")
          return false
        }
        return true
      case 4:
        if (!formData.vehicleMake || !formData.vehicleModel || !formData.vehicleYear || !formData.vehicleColor || !formData.vehiclePlate) {
          toast.error("Please fill in all vehicle information")
          return false
        }
        return true
      case 5:
        return true // Insurance is optional
      case 6:
        if (!formData.agreedToContractor || !formData.agreedToLicenseInsurance || !formData.agreedToBackgroundCheck) {
          toast.error("Please accept all agreements")
          return false
        }
        return true
      default:
        return true
    }
  }

  const handleNext = async () => {
    if (!validateStep()) return

    // Auto-save draft with retry
    const saveWithRetry = async (retries = 2): Promise<boolean> => {
      try {
        await saveDraft({
          ...formData,
          ...storageIds,
        })
        return true
      } catch (error: any) {
        if (retries > 0) {
          // Wait a moment and retry
          await new Promise(r => setTimeout(r, 500))
          return saveWithRetry(retries - 1)
        }
        
        // Show specific error message
        const message = error?.message || String(error)
        if (message.includes('sign in') || message.includes('Session')) {
          toast.error('Your session has expired. Please sign in again.', {
            action: {
              label: 'Sign In',
              onClick: () => navigate('/auth'),
            },
          })
        } else if (message.includes('Cannot modify')) {
          toast.error('This application has already been submitted.')
          navigate('/courier/status')
        } else {
          toast.error(`Failed to save: ${message}`, {
            action: {
              label: 'Retry',
              onClick: () => handleNext(),
            },
          })
        }
        return false
      }
    }

    const saved = await saveWithRetry()
    if (saved && step < totalSteps) {
      setStep(s => s + 1)
      window.scrollTo(0, 0)
    }
  }

  const handlePrev = () => {
    setStep(s => Math.max(s - 1, 1))
    window.scrollTo(0, 0)
  }

  const handleSubmit = async () => {
    if (!validateStep()) return

    setIsSubmitting(true)
    try {
      await submitApplication({
        fullName: formData.fullName,
        phone: formData.phone,
        email: formData.email,
        dateOfBirth: formData.dateOfBirth,
        homeAddress: formData.homeAddress,
        profilePhotoId: storageIds.profilePhotoId!,
        licenseFrontId: storageIds.licenseFrontId!,
        licenseBackId: storageIds.licenseBackId!,
        insuranceId: storageIds.insuranceId,
        vehicleMake: formData.vehicleMake,
        vehicleModel: formData.vehicleModel,
        vehicleYear: formData.vehicleYear,
        vehicleColor: formData.vehicleColor,
        vehiclePlate: formData.vehiclePlate,
        agreedToContractor: formData.agreedToContractor,
        agreedToLicenseInsurance: formData.agreedToLicenseInsurance,
        agreedToBackgroundCheck: formData.agreedToBackgroundCheck,
        applicantNotes: formData.applicantNotes,
        licenseNumber: formData.licenseNumber,
        licenseState: formData.licenseState,
        licenseExpiresAt: formData.licenseExpiresAt,
      })

      toast.success("Application submitted successfully!")
      navigate('/courier/status')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit application")
    } finally {
      setIsSubmitting(false)
    }
  }

  const years = Array.from({ length: 26 }, (_, i) => (2025 - i).toString())

  if (existingApplication === undefined || profile === undefined || isInitializing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {isInitializing ? 'Setting up your application...' : 'Loading...'}
        </p>
      </div>
    )
  }

  if (initError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-bold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">{initError}</p>
        <Button onClick={() => window.location.reload()}>Try Again</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background p-6">
      <div className="max-w-2xl w-full mx-auto space-y-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-black tracking-tighter text-primary">COURIER ONBOARDING</h1>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest bg-muted px-3 py-1 rounded-full">
                Step {step} of {totalSteps}
              </span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-destructive/10 hover:text-destructive">
                    <X className="w-5 h-5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Exit Application?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your progress will be saved as a draft. You can return and continue your application anytime by signing in as a courier.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Continue Application</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => navigate('/')}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Exit to Home
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          <Progress value={progress} className="h-3 bg-muted" />
        </div>

        <Card className="border-2 border-primary/5 shadow-2xl overflow-hidden bg-card/50 backdrop-blur-sm">
          <CardHeader className="border-b border-primary/5 bg-muted/20 pb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {step === 1 && <User className="w-6 h-6" />}
                {step === 2 && <User className="w-6 h-6" />}
                {step === 3 && <FileText className="w-6 h-6" />}
                {step === 4 && <Car className="w-6 h-6" />}
                {step === 5 && <ShieldCheck className="w-6 h-6" />}
                {step === 6 && <FileCheck className="w-6 h-6" />}
              </div>
              <div>
                <CardTitle className="text-2xl font-black tracking-tight">
                  {step === 1 && "Personal Information"}
                  {step === 2 && "Profile Photo"}
                  {step === 3 && "Driver's License"}
                  {step === 4 && "Vehicle Information"}
                  {step === 5 && "Insurance"}
                  {step === 6 && "Finalize Application"}
                </CardTitle>
                <CardDescription className="text-base">
                  {step === 1 && "Tell us who you are and where you're located."}
                  {step === 2 && "A clear photo for your courier profile."}
                  {step === 3 && "Verify your identity and eligibility to drive."}
                  {step === 4 && "Tell us about the vehicle you'll be using."}
                  {step === 5 && "Optional but recommended for faster approval."}
                  {step === 6 && "Review agreements and submit your application."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-8 space-y-6">
            {step === 1 && (
              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="fullName" className="text-sm font-bold uppercase tracking-wider">Full Legal Name</Label>
                  <Input 
                    id="fullName" 
                    placeholder="John Quinton Doe" 
                    className="h-12 text-lg" 
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="phone" className="text-sm font-bold uppercase tracking-wider">Phone Number</Label>
                    <Input 
                      id="phone" 
                      placeholder="+1 (555) 000-0000" 
                      className="h-12 text-lg" 
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email" className="text-sm font-bold uppercase tracking-wider">Email Address</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="john@example.com" 
                      className="h-12 text-lg" 
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="dob" className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Date of Birth
                  </Label>
                  <Input 
                    id="dob" 
                    type="date" 
                    className="h-12 text-lg" 
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address" className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Home Address
                  </Label>
                  <Input 
                    id="address" 
                    placeholder="123 Delivery Lane, City, ST 12345" 
                    className="h-12 text-lg" 
                    value={formData.homeAddress}
                    onChange={(e) => setFormData({ ...formData, homeAddress: e.target.value })}
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col items-center justify-center py-12 space-y-6">
                <div className="relative">
                  <Label 
                    htmlFor="profile-photo" 
                    className={cn(
                      "w-48 h-48 rounded-full bg-muted border-4 border-dashed border-primary/20 flex flex-col items-center justify-center gap-3 hover:border-primary transition-all cursor-pointer group overflow-hidden shadow-inner",
                      storageIds.profilePhotoId && "border-solid border-primary"
                    )}
                  >
                    {isUploading === 'profilePhoto' ? (
                      <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    ) : storageIds.profilePhotoId ? (
                      <StorageImage storageId={storageIds.profilePhotoId} className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <Upload className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors" />
                        <span className="text-sm font-bold text-muted-foreground group-hover:text-primary">Take Selfie</span>
                      </>
                    )}
                    <input id="profile-photo" type="file" className="hidden" accept="image/*" capture="user" onChange={handleFileChange('profilePhoto')} />
                  </Label>
                  {storageIds.profilePhotoId && (
                    <div className="absolute -bottom-2 -right-2 bg-primary text-white p-2 rounded-full shadow-lg">
                      <Check className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  Please upload a clear, front-facing photo of yourself. This will be shown to customers when you deliver.
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-8">
                {/* License Details */}
                <div className="grid gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="licenseNumber" className="text-sm font-bold uppercase tracking-wider">
                      License Number
                    </Label>
                    <Input 
                      id="licenseNumber" 
                      placeholder="DL12345678" 
                      className="h-12 text-lg font-mono"
                      value={formData.licenseNumber}
                      onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value.toUpperCase() })}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6">
                    <div className="grid gap-2">
                      <Label htmlFor="licenseState" className="text-sm font-bold uppercase tracking-wider">
                        State Issued
                      </Label>
                      <Select 
                        value={formData.licenseState} 
                        onValueChange={(val) => setFormData({ ...formData, licenseState: val })}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Select State" />
                        </SelectTrigger>
                        <SelectContent>
                          {US_STATES.map(state => (
                            <SelectItem key={state.code} value={state.code}>{state.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="licenseExpires" className="text-sm font-bold uppercase tracking-wider">
                        Expiration Date
                      </Label>
                      <Input 
                        id="licenseExpires" 
                        type="date"
                        className="h-12"
                        value={formData.licenseExpiresAt}
                        onChange={(e) => setFormData({ ...formData, licenseExpiresAt: e.target.value })}
                        min={new Date().toISOString().split('T')[0]} // Can't be expired
                      />
                    </div>
                  </div>
                </div>
                
                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-primary/10" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground font-bold">Upload Photos</span>
                  </div>
                </div>

                <div className="grid gap-4">
                  <Label className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                    <Camera className="w-4 h-4" /> License Front
                  </Label>
                  <Label 
                    htmlFor="license-front" 
                    className={cn(
                      "h-48 rounded-2xl bg-muted border-4 border-dashed border-primary/20 flex flex-col items-center justify-center gap-3 hover:border-primary transition-all cursor-pointer group overflow-hidden shadow-inner",
                      storageIds.licenseFrontId && "border-solid border-primary"
                    )}
                  >
                    {isUploading === 'licenseFront' ? (
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    ) : storageIds.licenseFrontId ? (
                      <StorageImage storageId={storageIds.licenseFrontId} className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary" />
                        <span className="text-sm font-bold text-muted-foreground group-hover:text-primary">Upload Front</span>
                      </>
                    )}
                    <input id="license-front" type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileChange('licenseFront')} />
                  </Label>
                </div>
                <div className="grid gap-4">
                  <Label className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                    <Camera className="w-4 h-4" /> License Back
                  </Label>
                  <Label 
                    htmlFor="license-back" 
                    className={cn(
                      "h-48 rounded-2xl bg-muted border-4 border-dashed border-primary/20 flex flex-col items-center justify-center gap-3 hover:border-primary transition-all cursor-pointer group overflow-hidden shadow-inner",
                      storageIds.licenseBackId && "border-solid border-primary"
                    )}
                  >
                    {isUploading === 'licenseBack' ? (
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    ) : storageIds.licenseBackId ? (
                      <StorageImage storageId={storageIds.licenseBackId} className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary" />
                        <span className="text-sm font-bold text-muted-foreground group-hover:text-primary">Upload Back</span>
                      </>
                    )}
                    <input id="license-back" type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileChange('licenseBack')} />
                  </Label>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="grid gap-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="make" className="text-sm font-bold uppercase tracking-wider">Make</Label>
                    <Input 
                      id="make" 
                      placeholder="Toyota" 
                      className="h-12" 
                      value={formData.vehicleMake}
                      onChange={(e) => setFormData({ ...formData, vehicleMake: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="model" className="text-sm font-bold uppercase tracking-wider">Model</Label>
                    <Input 
                      id="model" 
                      placeholder="Camry" 
                      className="h-12" 
                      value={formData.vehicleModel}
                      onChange={(e) => setFormData({ ...formData, vehicleModel: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="year" className="text-sm font-bold uppercase tracking-wider">Year</Label>
                    <Select 
                      value={formData.vehicleYear} 
                      onValueChange={(val) => setFormData({ ...formData, vehicleYear: val })}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map(y => (
                          <SelectItem key={y} value={y}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="color" className="text-sm font-bold uppercase tracking-wider">Color</Label>
                    <Input 
                      id="color" 
                      placeholder="Silver" 
                      className="h-12" 
                      value={formData.vehicleColor}
                      onChange={(e) => setFormData({ ...formData, vehicleColor: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="plate" className="text-sm font-bold uppercase tracking-wider">License Plate</Label>
                  <Input 
                    id="plate" 
                    placeholder="ABC-1234" 
                    className="h-12" 
                    value={formData.vehiclePlate}
                    onChange={(e) => setFormData({ ...formData, vehiclePlate: e.target.value })}
                  />
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="flex flex-col items-center justify-center py-8 space-y-6">
                <div className="w-full flex justify-center">
                  <Badge variant="secondary" className="px-4 py-1.5 text-sm font-bold bg-primary/10 text-primary border-primary/20">
                    Recommended for faster approval
                  </Badge>
                </div>
                <Label 
                  htmlFor="insurance" 
                  className={cn(
                    "w-full h-48 rounded-2xl bg-muted border-4 border-dashed border-primary/20 flex flex-col items-center justify-center gap-3 hover:border-primary transition-all cursor-pointer group overflow-hidden shadow-inner",
                    storageIds.insuranceId && "border-solid border-primary"
                  )}
                >
                  {isUploading === 'insurance' ? (
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  ) : storageIds.insuranceId ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 rounded-full bg-primary/10 text-primary">
                        <FileText className="w-10 h-10" />
                      </div>
                      <span className="text-sm font-bold">Insurance Document Uploaded</span>
                      <Button variant="outline" size="sm" asChild>
                        <span>Replace File</span>
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-muted-foreground group-hover:text-primary" />
                      <span className="text-sm font-bold text-muted-foreground group-hover:text-primary">Upload Proof of Insurance</span>
                    </>
                  )}
                  <input id="insurance" type="file" className="hidden" accept=".pdf,image/*" onChange={handleFileChange('insurance')} />
                </Label>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  Providing your insurance information helps us verify your vehicle status more quickly.
                </p>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-5 rounded-2xl bg-muted/30 border-2 border-primary/5 hover:border-primary/20 transition-colors">
                    <Checkbox 
                      id="contractor" 
                      className="mt-1 size-5" 
                      checked={formData.agreedToContractor}
                      onCheckedChange={(checked) => setFormData({ ...formData, agreedToContractor: !!checked })}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="contractor" className="font-black text-base cursor-pointer">Independent Contractor (1099)</Label>
                      <p className="text-sm text-muted-foreground">
                        I acknowledge that I will be an independent contractor and not an employee of the platform.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-5 rounded-2xl bg-muted/30 border-2 border-primary/5 hover:border-primary/20 transition-colors">
                    <Checkbox 
                      id="license" 
                      className="mt-1 size-5" 
                      checked={formData.agreedToLicenseInsurance}
                      onCheckedChange={(checked) => setFormData({ ...formData, agreedToLicenseInsurance: !!checked })}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="license" className="font-black text-base cursor-pointer">Valid License & Insurance</Label>
                      <p className="text-sm text-muted-foreground">
                        I confirm I maintain a valid driver's license and the required vehicle insurance.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-5 rounded-2xl bg-muted/30 border-2 border-primary/5 hover:border-primary/20 transition-colors">
                    <Checkbox 
                      id="background" 
                      className="mt-1 size-5" 
                      checked={formData.agreedToBackgroundCheck}
                      onCheckedChange={(checked) => setFormData({ ...formData, agreedToBackgroundCheck: !!checked })}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="background" className="font-black text-base cursor-pointer">Background Screening</Label>
                      <p className="text-sm text-muted-foreground">
                        I consent to background screening and identity verification as part of this application.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 pt-4">
                  <Label htmlFor="notes" className="text-sm font-bold uppercase tracking-wider">Anything the admin should know? (Optional)</Label>
                  <Textarea 
                    id="notes" 
                    placeholder="Previous delivery experience, specific availability, etc." 
                    className="min-h-[120px] text-base"
                    value={formData.applicantNotes}
                    onChange={(e) => setFormData({ ...formData, applicantNotes: e.target.value })}
                  />
                </div>
              </div>
            )}
          </CardContent>

          <div className="p-8 border-t border-primary/5 bg-muted/10 flex gap-4">
            {step > 1 && (
              <Button 
                variant="outline" 
                onClick={handlePrev} 
                className="flex-1 h-14 font-black text-lg border-2"
                disabled={isSubmitting || !!isUploading}
              >
                <ChevronLeft className="w-5 h-5 mr-2" /> BACK
              </Button>
            )}
            {step < totalSteps ? (
              <Button 
                onClick={handleNext} 
                className="flex-[2] h-14 font-black text-lg shadow-lg shadow-primary/20"
                disabled={isSubmitting || !!isUploading}
              >
                CONTINUE <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting || !!isUploading}
                className="flex-[2] h-14 font-black text-lg shadow-xl shadow-primary/30 animate-in zoom-in-95 duration-300"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> SUBMITTING...</>
                ) : (
                  'SUBMIT APPLICATION'
                )}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

function StorageImage({ storageId, className }: { storageId: Id<"_storage">, className?: string }) {
  const url = useQuery(api.storage.getFileUrl, { storageId })
  
  if (!url) {
    return (
      <div className={cn("flex items-center justify-center bg-muted", className)}>
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return <img src={url} className={className} alt="Uploaded document" />
}
