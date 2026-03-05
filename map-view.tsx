import { MapPin, Navigation } from 'lucide-react'

export function MapView() {
  return (
    <div className="relative w-full h-[300px] md:h-[400px] rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
      {/* Mock Map Background */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="w-full h-full" style={{ 
          backgroundImage: 'radial-gradient(circle at 50% 50%, #baff29 1px, transparent 1px)', 
          backgroundSize: '40px 40px' 
        }} />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-4 text-center px-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-bounce">
          <Navigation className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-bold font-outfit text-slate-100">Live Tracking</h3>
          <p className="text-muted-foreground max-w-xs mx-auto text-sm mt-1">
            Real-time courier location will be available once the courier is en route.
          </p>
        </div>
        <div className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800/80 backdrop-blur border border-slate-700 text-xs font-semibold text-slate-300">
          <MapPin className="w-3 h-3 text-primary" />
          NYC Service Area
        </div>
      </div>

      {/* Mock courier marker */}
      <div className="absolute top-1/4 right-1/3 p-2 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 animate-pulse">
        <Navigation className="w-4 h-4" />
      </div>
    </div>
  )
}
