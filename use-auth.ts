import { useConvexAuth, useQuery } from "convex/react"
import { api } from "@convex/api"
import { useAuthActions } from "@convex-dev/auth/react"
import { useCallback, useEffect } from "react"
import { markPortalSession, clearPortalSession, clearAllAuthData, detectPortal } from '@/lib/auth-storage'

export function useAuth() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth()
  const { signOut: convexSignOut } = useAuthActions()
  
  // Fetch profile only when authenticated
  const profile = useQuery(
    api.profiles.getMyProfile,
    isAuthenticated ? {} : "skip"
  )
  
  // For couriers, also get their application status
  const courierApplication = useQuery(
    api.couriers.getMyApplication,
    isAuthenticated && profile?.role === 'courier' ? {} : "skip"
  )

  // Loading states
  const isProfileLoading = isAuthenticated && profile === undefined
  const isCourierLoading = profile?.role === 'courier' && courierApplication === undefined
  const isLoading = authLoading || isProfileLoading || isCourierLoading

  // Mark portal session when authenticated
  useEffect(() => {
    if (isAuthenticated && profile?.userId) {
      const portal = detectPortal();
      if (portal !== 'admin') { // Admin uses separate auth
        markPortalSession(portal, profile.userId);
      }
    }
  }, [isAuthenticated, profile?.userId]);
  
  // Get the correct dashboard URL for the user's role
  const getDashboardUrl = useCallback(() => {
    if (!profile?.role) return '/auth'
    
    switch (profile.role) {
      case 'admin':
        return '/admin/dashboard'
      case 'courier':
        return courierApplication?.status === 'approved' 
          ? '/courier/dashboard' 
          : '/courier/status'
      case 'customer':
      default:
        return '/customer/dashboard'
    }
  }, [profile?.role, courierApplication?.status])

  // IMPORTANT: This signOut should ONLY be called when user explicitly clicks logout
  // Never call this automatically or on app close - it will clear session tokens
  const signOut = useCallback(async () => {
    console.log('[AUTH] User initiated sign out');
    const portal = detectPortal();
    
    try {
      // Sign out from Convex Auth
      await convexSignOut()
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      // Clear portal-specific session and auth data
      try {
        // Save admin session before clearing
        const adminSessionToken = localStorage.getItem('adminSessionToken')
        const adminEmail = localStorage.getItem('adminEmail')
        
        // Clear portal session
        if (portal !== 'admin') {
          clearPortalSession(portal);
          clearAllAuthData(); // Clear Convex tokens too
        }
        
        sessionStorage.clear()
        
        // Restore admin session if it existed
        if (adminSessionToken) {
          localStorage.setItem('adminSessionToken', adminSessionToken)
        }
        if (adminEmail) {
          localStorage.setItem('adminEmail', adminEmail)
        }
      } catch (e) {
        // Ignore storage errors
      }
      // Force hard redirect to clear all state
      window.location.href = '/auth'
    }
  }, [convexSignOut])
  
  return {
    // Auth state
    isAuthenticated,
    isLoading,
    
    // User info
    user: profile,
    role: profile?.role as 'customer' | 'courier' | 'admin' | undefined,
    userId: profile?.userId,
    userName: profile?.name,
    userEmail: profile?.email,
    
    // Courier specific
    courierStatus: courierApplication?.status,
    isApprovedCourier: courierApplication?.status === 'approved',
    isCourierOnline: courierApplication?.isOnline,
    
    // Actions
    signOut,
    getDashboardUrl,
  }
}
