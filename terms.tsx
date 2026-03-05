import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Package, ArrowLeft } from 'lucide-react'

export default function TermsPage() {
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
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        
        <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
          <p className="text-lg">Last updated: January 2025</p>
          
          <h2 className="text-2xl font-semibold text-foreground mt-8">1. Acceptance of Terms</h2>
          <p>By accessing and using Droppit's services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
          
          <h2 className="text-2xl font-semibold text-foreground mt-8">2. Description of Service</h2>
          <p>Droppit provides a platform connecting customers who need packages picked up and delivered to shipping carriers (UPS, FedEx, USPS, DHL, etc.) with independent courier contractors.</p>
          
          <h2 className="text-2xl font-semibold text-foreground mt-8">3. User Responsibilities</h2>
          <p>Users are responsible for ensuring packages are properly labeled and ready for pickup. Droppit is not responsible for lost, damaged, or delayed packages once they are handed off to the carrier.</p>
          
          <h2 className="text-2xl font-semibold text-foreground mt-8">4. Payment Terms</h2>
          <p>All payments are processed securely through our payment provider. Prices are displayed before checkout and include all applicable fees.</p>
          
          <h2 className="text-2xl font-semibold text-foreground mt-8">5. Courier Contractors</h2>
          <p>Couriers using Droppit are independent contractors, not employees. They are responsible for their own taxes, insurance, and vehicle maintenance.</p>
          
          <h2 className="text-2xl font-semibold text-foreground mt-8">6. Limitation of Liability</h2>
          <p>Droppit's liability is limited to the amount paid for the service. We are not liable for indirect, incidental, or consequential damages.</p>
          
          <h2 className="text-2xl font-semibold text-foreground mt-8">7. Contact</h2>
          <p>For questions about these terms, contact us at <a href="mailto:support@droppit.app" className="text-primary hover:underline">support@droppit.app</a></p>
        </div>
      </main>
    </div>
  )
}
