import { useEffect, useRef, useCallback } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@convex/api'
import { useAuth } from './use-auth'

const ONESIGNAL_APP_ID = '6eb78a08-1526-4668-b12e-7840bd745b37'

// Declare OneSignal on window
declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: any) => void>
    OneSignal?: any
  }
}

export function useOneSignal() {
  const { isAuthenticated, userId } = useAuth()
  const saveOneSignalId = useMutation(api.notifications.saveOneSignalId)
  const removeOneSignalId = useMutation(api.notifications.removeOneSignalId)
  
  const initializedRef = useRef(false)
  const scriptLoadedRef = useRef(false)

  // Load OneSignal SDK script
  const loadScript = useCallback(() => {
    if (scriptLoadedRef.current) return
    if (typeof window === 'undefined') return
    
    // Check if script already exists
    if (document.querySelector('script[src*="onesignal"]')) {
      scriptLoadedRef.current = true
      return
    }

    const script = document.createElement('script')
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
    script.defer = true
    script.onload = () => {
      scriptLoadedRef.current = true
    }
    document.head.appendChild(script)
  }, [])

  // Initialize OneSignal
  const initOneSignal = useCallback(async () => {
    if (initializedRef.current) return
    if (typeof window === 'undefined') return

    // Ensure script is loaded
    loadScript()

    // Wait for OneSignal to be available
    window.OneSignalDeferred = window.OneSignalDeferred || []
    
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      if (initializedRef.current) return
      initializedRef.current = true

      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: '/OneSignalSDKWorker.js',
          serviceWorkerUpdaterPath: '/OneSignalSDKUpdaterWorker.js',
          notifyButton: {
            enable: false, // We'll use our own UI
          },
          welcomeNotification: {
            title: 'Welcome to Droppit! 📦',
            message: "You'll receive updates about your deliveries here.",
          },
        })

        console.log('[OneSignal] Initialized successfully')

        // Listen for subscription changes
        OneSignal.User.PushSubscription.addEventListener('change', async (event: any) => {
          console.log('[OneSignal] Subscription changed:', event)
          
          const subscriptionId = OneSignal.User.PushSubscription.id
          
          if (subscriptionId && isAuthenticated) {
            try {
              await saveOneSignalId({ oneSignalId: subscriptionId })
              console.log('[OneSignal] Saved subscription ID to Convex')
            } catch (error) {
              console.error('[OneSignal] Failed to save subscription ID:', error)
            }
          }
        })

        // If already subscribed and authenticated, save the ID
        const subscriptionId = OneSignal.User.PushSubscription.id
        if (subscriptionId && isAuthenticated) {
          try {
            await saveOneSignalId({ oneSignalId: subscriptionId })
            console.log('[OneSignal] Saved existing subscription ID to Convex')
          } catch (error) {
            console.error('[OneSignal] Failed to save existing subscription ID:', error)
          }
        }
      } catch (error) {
        console.error('[OneSignal] Initialization failed:', error)
        initializedRef.current = false
      }
    })
  }, [isAuthenticated, saveOneSignalId, loadScript])

  // Request push permission
  const requestPermission = useCallback(async () => {
    if (typeof window === 'undefined' || !window.OneSignal) {
      console.log('[OneSignal] SDK not loaded yet')
      return false
    }

    try {
      const permission = await window.OneSignal.Notifications.requestPermission()
      console.log('[OneSignal] Permission result:', permission)
      
      // After permission granted, get and save subscription ID
      if (permission) {
        const subscriptionId = window.OneSignal.User.PushSubscription.id
        if (subscriptionId && isAuthenticated) {
          await saveOneSignalId({ oneSignalId: subscriptionId })
        }
      }
      
      return permission
    } catch (error) {
      console.error('[OneSignal] Permission request failed:', error)
      return false
    }
  }, [isAuthenticated, saveOneSignalId])

  // Check if notifications are enabled
  const isSubscribed = useCallback(async () => {
    if (typeof window === 'undefined' || !window.OneSignal) {
      return false
    }
    
    try {
      const optedIn = await window.OneSignal.User.PushSubscription.optedIn
      return optedIn
    } catch {
      return false
    }
  }, [])

  // Unsubscribe from push
  const unsubscribe = useCallback(async () => {
    if (typeof window === 'undefined' || !window.OneSignal) {
      return
    }

    try {
      await window.OneSignal.User.PushSubscription.optOut()
      await removeOneSignalId()
      console.log('[OneSignal] Unsubscribed successfully')
    } catch (error) {
      console.error('[OneSignal] Unsubscribe failed:', error)
    }
  }, [removeOneSignalId])

  // Initialize on mount
  useEffect(() => {
    initOneSignal()
  }, [initOneSignal])

  // Save subscription ID when user authenticates
  useEffect(() => {
    if (!isAuthenticated || !userId) return
    if (typeof window === 'undefined' || !window.OneSignal) return

    const saveExistingSubscription = async () => {
      try {
        const subscriptionId = window.OneSignal?.User?.PushSubscription?.id
        if (subscriptionId) {
          await saveOneSignalId({ oneSignalId: subscriptionId })
          console.log('[OneSignal] Saved subscription ID after auth')
        }
      } catch (error) {
        console.error('[OneSignal] Failed to save subscription after auth:', error)
      }
    }

    // Small delay to ensure OneSignal is ready
    const timer = setTimeout(saveExistingSubscription, 1000)
    return () => clearTimeout(timer)
  }, [isAuthenticated, userId, saveOneSignalId])

  return {
    requestPermission,
    isSubscribed,
    unsubscribe,
  }
}
