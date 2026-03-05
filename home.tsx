import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Package, Truck, Shield, Clock, ArrowRight, Star, MapPin } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-6 border-b border-border/50 backdrop-blur-md sticky top-0 z-50 bg-background/80">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center rotate-3">
            <Package className="text-primary-foreground w-6 h-6" />
          </div>
          <span className="font-bold text-2xl tracking-tighter">Droppit</span>
        </div>
        <div className="flex gap-4">
          <Link to="/auth">
            <Button variant="ghost" className="font-semibold">Sign In</Button>
          </Link>
          <Link to="/auth">
            <Button className="font-bold rounded-full px-6">Get Started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 py-20 md:py-32 overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-primary/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-primary/10 blur-[100px] rounded-full" />
        
        <div className="max-w-5xl mx-auto text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary font-semibold text-sm animate-bounce">
            <Truck className="w-4 h-4" />
            <span>Now delivering in your city</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight">
            Package pickup <br />
            <span className="text-primary">on your schedule</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Don't wait in line. We'll pick up your pre-labeled packages and drop them off at UPS, FedEx, USPS, or DHL.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link to="/auth">
              <Button size="lg" className="h-16 px-10 text-xl font-bold rounded-2xl w-full sm:w-auto shadow-xl shadow-primary/20">
                Book a Pickup <ArrowRight className="ml-2 w-6 h-6" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="h-16 px-10 text-xl font-bold rounded-2xl w-full sm:w-auto border-2">
                Become a Courier
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: Clock,
              title: "ASAP or Scheduled",
              desc: "Get a courier within 15 minutes or schedule for later."
            },
            {
              icon: Shield,
              title: "Secure & Tracked",
              desc: "Real-time tracking and photo proof for every delivery."
            },
            {
              icon: MapPin,
              title: "Any Carrier",
              desc: "We drop off at UPS, FedEx, USPS, or local stores."
            }
          ].map((feature, i) => (
            <div key={i} className="p-8 rounded-3xl bg-card border border-border/50 space-y-4 hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                <feature.icon className="text-primary w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4">How it Works</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Getting your packages dropped off has never been easier. Just 3 simple steps.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Book a Pickup",
                desc: "Enter your address, select your carrier (UPS, FedEx, USPS, or DHL), and choose ASAP or schedule for later.",
                icon: Package,
              },
              {
                step: "2", 
                title: "We Pick Up",
                desc: "A verified courier arrives at your door, scans your pre-labeled packages, and heads to the drop-off location.",
                icon: Truck,
              },
              {
                step: "3",
                title: "Track & Confirm",
                desc: "Get real-time updates and photo proof when your packages are dropped off. That's it!",
                icon: Shield,
              },
            ].map((item, i) => (
              <div key={i} className="relative">
                {/* Connector line for desktop */}
                {i < 2 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
                )}
                
                <div className="flex flex-col items-center text-center space-y-4">
                  {/* Step number with icon */}
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                      <item.icon className="w-10 h-10 text-primary" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                      {item.step}
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          
          {/* CTA */}
          <div className="text-center mt-12">
            <Link to="/auth">
              <Button size="lg" className="h-14 px-8 text-lg font-bold rounded-xl">
                Book Your First Pickup <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <h2 className="text-4xl font-bold">Trusted by thousands</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
            {[
              {
                name: "Sarah Jenkins",
                role: "Small Business Owner",
                text: "Droppit saves me 3 hours a week. I just leave my packages by the door and they're gone in minutes."
              },
              {
                name: "Michael Chen",
                role: "Busy Parent",
                text: "Returning items is actually easy now. No more dragging kids to the UPS store."
              }
            ].map((t, i) => (
              <div key={i} className="p-6 rounded-2xl bg-muted/50 space-y-4">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-primary text-primary" />)}
                </div>
                <p className="italic text-lg">"{t.text}"</p>
                <div>
                  <p className="font-bold">{t.name}</p>
                  <p className="text-sm text-muted-foreground">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 border-t border-border mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Package className="text-primary-foreground w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">Droppit</span>
          </div>
          <p className="text-muted-foreground text-sm">© 2024 Droppit Technologies. All rights reserved.</p>
          <div className="flex gap-6 text-sm font-semibold">
            <Link to="/terms" className="hover:text-primary transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            <a href="mailto:support@droppit.app" className="hover:text-primary transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
