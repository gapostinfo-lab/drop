import { Link } from 'react-router'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, ChevronRight, Package, Calendar, Clock, Filter, Loader2, Star } from 'lucide-react'
import { useQuery } from "convex/react"
import { api } from "@convex/api"
import { useState } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { RatingDialog } from '@/components/customer/rating-dialog'
import { Id } from '@convex/dataModel'

export default function HistoryPage() {
  const myJobs = useQuery(api.jobs.getMyJobs)
  const [searchQuery, setSearchQuery] = useState('')
  const [ratingJobId, setRatingJobId] = useState<Id<"jobs"> | null>(null)

  if (myJobs === undefined) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppShell>
    )
  }

  const completedJobs = myJobs.filter(j => ['completed', 'cancelled'].includes(j.status))
  
  const filteredJobs = completedJobs.filter(job => 
    job.carrier.toLowerCase().includes(searchQuery.toLowerCase()) ||
    job.pickupAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `ORD-${job._id.slice(-4).toUpperCase()}`.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold font-outfit">Order History</h1>
          <div className="flex gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search orders..." 
                className="pl-9 bg-slate-900 border-slate-800" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" className="border-slate-800 bg-slate-900">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {filteredJobs.length > 0 ? (
            filteredJobs.map((job) => (
              <Link key={job._id} to={`/customer/order/${job._id}`}>
                <Card className="p-4 bg-slate-900/40 border-slate-800 hover:border-primary/30 hover:bg-slate-900/60 transition-all group">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                        <Package className="w-6 h-6 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">ORD-{job._id.slice(-4).toUpperCase()}</span>
                          <Badge variant="outline" className={
                            job.status === 'completed' 
                              ? "bg-green-500/10 text-green-500 border-green-500/20 capitalize" 
                              : "bg-destructive/10 text-destructive border-destructive/20 capitalize"
                          }>
                            {job.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(job.createdAt).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="font-medium text-slate-300">
                            {job.packageCount} {job.packageCount === 1 ? 'pkg' : 'pkgs'} • {job.carrier}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
                      {job.status === 'completed' && !job.rating && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-primary border-primary/50 hover:bg-primary/10"
                          onClick={(e) => {
                            e.preventDefault()
                            setRatingJobId(job._id)
                          }}
                        >
                          <Star className="w-4 h-4 mr-1" />
                          Rate
                        </Button>
                      )}
                      {job.rating && (
                        <div className="flex items-center gap-1 bg-primary/10 px-2 py-1 rounded-lg border border-primary/20">
                          <Star className="w-3 h-3 fill-primary text-primary" />
                          <span className="text-sm font-bold text-primary">{job.rating}.0</span>
                        </div>
                      )}
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="font-bold text-lg text-primary">${job.totalPrice.toFixed(2)}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </Card>
              </Link>
            ))
          ) : (
            <Card className="p-12 border-dashed border-slate-800 bg-transparent text-center">
              <p className="text-muted-foreground">No orders found.</p>
            </Card>
          )}
        </div>
        
        {filteredJobs.length > 10 && (
          <div className="pt-8 flex justify-center">
            <Button variant="ghost" className="text-muted-foreground hover:text-primary">
              Load more orders
            </Button>
          </div>
        )}
      </div>

      {ratingJobId && (
        <RatingDialog
          jobId={ratingJobId}
          isOpen={!!ratingJobId}
          onClose={() => setRatingJobId(null)}
        />
      )}
    </AppShell>
  )
}
