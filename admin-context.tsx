import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@convex/api'

const ADMIN_SESSION_KEY = 'adminSessionToken'

interface AdminContextType {
  isAdminLoggedIn: boolean
  isLoading: boolean
  adminEmail: string | null
  sessionToken: string | null
  login: (email: string, sessionToken: string) => void
  logout: () => Promise<void>
  validateSession: () => Promise<boolean>
}

const AdminContext = createContext<AdminContextType | null>(null)

export function AdminProvider({ children }: { children: ReactNode }) {
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Get session token from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem(ADMIN_SESSION_KEY)
    if (token) {
      setSessionToken(token)
    }
    setIsLoading(false)
  }, [])
  
  // Validate session with Convex
  const currentAdmin = useQuery(
    api.adminSessions.getCurrentAdmin,
    sessionToken ? { token: sessionToken } : "skip"
  )
  
  // Logout mutation
  const deleteSessionMutation = useMutation(api.adminSessions.deleteSession)
  
  // Derived state
  const isAdminLoggedIn = !!currentAdmin && !!sessionToken
  const adminEmail = currentAdmin?.email ?? null
  
  const login = useCallback((email: string, token: string) => {
    localStorage.setItem(ADMIN_SESSION_KEY, token)
    localStorage.setItem('adminEmail', email) // Keep for backwards compatibility
    setSessionToken(token)
    console.log('[AdminContext] Logged in:', email)
  }, [])
  
  const logout = useCallback(async () => {
    if (sessionToken) {
      try {
        await deleteSessionMutation({ token: sessionToken })
      } catch (e) {
        console.error('[AdminContext] Logout error:', e)
      }
    }
    localStorage.removeItem(ADMIN_SESSION_KEY)
    localStorage.removeItem('adminEmail')
    localStorage.removeItem('adminLoggedIn')
    setSessionToken(null)
    console.log('[AdminContext] Logged out')
  }, [sessionToken, deleteSessionMutation])
  
  const validateSession = useCallback(async (): Promise<boolean> => {
    if (!sessionToken) return false
    return !!currentAdmin
  }, [sessionToken, currentAdmin])
  
  // Clear invalid session
  useEffect(() => {
    if (sessionToken && currentAdmin === null && !isLoading) {
      // Session is invalid, clear it
      console.log('[AdminContext] Invalid session, clearing')
      localStorage.removeItem(ADMIN_SESSION_KEY)
      localStorage.removeItem('adminEmail')
      setSessionToken(null)
    }
  }, [sessionToken, currentAdmin, isLoading])

  return (
    <AdminContext.Provider value={{ 
      isAdminLoggedIn, 
      isLoading: isLoading || (sessionToken !== null && currentAdmin === undefined),
      adminEmail, 
      sessionToken,
      login, 
      logout,
      validateSession,
    }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const context = useContext(AdminContext)
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider')
  }
  return context
}
