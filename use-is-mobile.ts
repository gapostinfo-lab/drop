import { useState, useEffect } from 'react'

const MOBILE_BREAKPOINT = 768

function getIsMobile(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth < MOBILE_BREAKPOINT
}

export function useIsMobile() {
  // Initialize with actual value to prevent flash
  const [isMobile, setIsMobile] = useState(getIsMobile)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    
    // Check immediately
    checkMobile()
    
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}
