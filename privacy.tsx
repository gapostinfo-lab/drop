import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Package, ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-6 border-b border-border/50">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center rotate-3">
            <Package className="text-primary-foreground w-6 h-6" />
          </div>
          <span className="font-bold text-2xl tracking-tighter">Droppit</span>
        </Link>
        <Link to="/">
          <Button variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
          <p className="text-lg">Last updated: January 2025</p>
          
          <h2 className="text-2xl font-semibold text-foreground mt-8">1. Information We Collect</h2>
          <p>We collect information you provide directly: name, email, phone number, and addresses for pickup services. We also collect location data when you use our app to facilitate pickups.</p>
          
          <h2 className="text-2xl font-semibold text-foreground mt-8">2. How We Use Your Information</h2>
          <p>Your information is used to: process pickups and deliveries, communicate about your orders, improve our services, and send important updates about your account.</p>
          
          <h2 className="text-2xl font-semibold text-foreground mt-8">3. Information Sharing</h2>
          <p>We share your pickup address and contact info with assigned couriers to complete deliveries. We do not sell your personal information to third parties.</p>
          
          <h2 className="text-2xl font-semibold text-foreground mt-8">4. Data Security</h2>
          <p>We use industry-standard security measures to protect your data. Payment information is processed securely and we do not store your full card details.</p>
          
          <h2 className="text-2xl font-semibold text-foreground mt-8">5. Your Rights</h2>
          <p>You can request access to, correction of, or deletion of your personal data by contacting us at <a href="mailto:support@droppit.app" className="text-primary hover:underline">support@droppit.app</a></p>
          
          <h2 className="text-2xl font-semibold text-foreground mt-8">6. Cookies</h2>
          <p>We use essential cookies to maintain your session and preferences. No third-party tracking cookies are used.</p>
          
          <h2 className="text-2xl font-semibold text-foreground mt-8">7. Contact</h2>
          <p>For privacy questions, contact us at <a href="mailto:support@droppit.app" className="text-primary hover:underline">support@droppit.app</a></p>
        </div>
      </main>
    </div>
  )
}
