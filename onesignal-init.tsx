import { useOneSignal } from '@/hooks/use-onesignal'

/**
 * OneSignal initialization component.
 * This component doesn't render anything, it just initializes OneSignal.
 * Place it inside the ConvexAuthProvider.
 */
export function OneSignalInit() {
  // This hook handles all OneSignal initialization
  useOneSignal()
  
  return null
}
