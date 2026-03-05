import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type CourierStatus = 'Pending Review' | 'Approved' | 'Rejected' | 'Suspended'

export interface Job {
  id: string
  pickupAddress: string
  dropoffAddress: string
  distance: string
  packageCount: number
  carrierType: 'Standard' | 'Express' | 'Heavy'
  payout: number
  status: 'Available' | 'Active' | 'Completed'
  customerName?: string
  customerPhone?: string
  isManualAddress?: boolean
}

interface CourierState {
  status: CourierStatus
  isOnline: boolean
  activeJob: Job | null
  completedToday: number
  thisWeekEarnings: number
  rating: number
  
  // Actions
  setStatus: (status: CourierStatus) => void
  setOnline: (isOnline: boolean) => void
  setActiveJob: (job: Job | null) => void
  completeJob: () => void
}

export const useCourierStore = create<CourierState>()(
  persist(
    (set) => ({
      status: 'Pending Review',
      isOnline: false,
      activeJob: null,
      completedToday: 0,
      thisWeekEarnings: 0,
      rating: 4.8,

      setStatus: (status) => set({ status }),
      setOnline: (isOnline) => set({ isOnline }),
      setActiveJob: (job) => set({ activeJob: job }),
      completeJob: () => set((state) => ({
        activeJob: null,
        completedToday: state.completedToday + 1,
        thisWeekEarnings: state.thisWeekEarnings + (state.activeJob?.payout || 0),
      })),
    }),
    {
      name: 'courier-storage',
    }
  )
)
