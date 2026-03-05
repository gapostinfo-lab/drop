import { useState, useEffect, useCallback, useRef } from 'react'

export interface GeoLocationState {
  latitude: number | null
  longitude: number | null
  heading: number | null
  speed: number | null
  accuracy: number | null
  timestamp: number | null
  error: string | null
  permissionState: 'prompt' | 'granted' | 'denied' | 'unavailable' | 'loading'
  isWatching: boolean
}

interface UseGeoLocationOptions {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
  updateInterval?: number // How often to update location (ms)
  retryInterval?: number // How often to retry if denied (ms)
  enabled?: boolean // Whether to start watching
}

const defaultOptions: UseGeoLocationOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
  updateInterval: 5000,
  retryInterval: 3000,
  enabled: true,
}

export function useGeoLocation(options: UseGeoLocationOptions = {}) {
  const opts = { ...defaultOptions, ...options }
  
  const [state, setState] = useState<GeoLocationState>({
    latitude: null,
    longitude: null,
    heading: null,
    speed: null,
    accuracy: null,
    timestamp: null,
    error: null,
    permissionState: 'loading',
    isWatching: false,
  })

  const watchIdRef = useRef<number | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  // Check if geolocation is available
  const isSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator

  // Update location state
  const handleSuccess = useCallback((position: GeolocationPosition) => {
    if (!mountedRef.current) return
    
    setState(prev => ({
      ...prev,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      heading: position.coords.heading,
      speed: position.coords.speed,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp,
      error: null,
      permissionState: 'granted',
      isWatching: true,
    }))
  }, [])

  // Handle errors
  const handleError = useCallback((error: GeolocationPositionError) => {
    if (!mountedRef.current) return
    
    let errorMessage: string
    let permissionState: GeoLocationState['permissionState'] = 'denied'
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location permission denied. Please enable GPS in your browser settings.'
        permissionState = 'denied'
        break
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location unavailable. Please check your GPS settings.'
        permissionState = 'unavailable'
        break
      case error.TIMEOUT:
        errorMessage = 'Location request timed out. Please try again.'
        permissionState = 'unavailable'
        break
      default:
        errorMessage = 'Unable to get location.'
        permissionState = 'unavailable'
    }
    
    setState(prev => ({
      ...prev,
      error: errorMessage,
      permissionState,
      isWatching: false,
    }))
  }, [])

  // Start watching location
  const startWatching = useCallback(() => {
    if (!isSupported || !opts.enabled) return
    
    // Clear any existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }
    
    // Start watching
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: opts.enableHighAccuracy,
        timeout: opts.timeout,
        maximumAge: opts.maximumAge,
      }
    )
    
    setState(prev => ({ ...prev, isWatching: true }))
  }, [isSupported, opts.enabled, opts.enableHighAccuracy, opts.timeout, opts.maximumAge, handleSuccess, handleError])

  // Stop watching
  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    setState(prev => ({ ...prev, isWatching: false }))
  }, [])

  // Request permission and start watching
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      setState(prev => ({
        ...prev,
        error: 'Geolocation is not supported by your browser.',
        permissionState: 'unavailable',
      }))
      return
    }
    
    setState(prev => ({ ...prev, permissionState: 'loading', error: null }))
    
    // Try to get current position first
    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleSuccess(position)
        startWatching()
      },
      (error) => {
        handleError(error)
        // Schedule retry if denied
        if (error.code === error.PERMISSION_DENIED && opts.retryInterval) {
          retryTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              requestPermission()
            }
          }, opts.retryInterval)
        }
      },
      {
        enableHighAccuracy: opts.enableHighAccuracy,
        timeout: opts.timeout,
        maximumAge: 0,
      }
    )
  }, [isSupported, opts.enableHighAccuracy, opts.timeout, opts.retryInterval, handleSuccess, handleError, startWatching])

  // Check permission status on mount
  useEffect(() => {
    mountedRef.current = true
    
    if (!isSupported) {
      setState(prev => ({
        ...prev,
        error: 'Geolocation is not supported by your browser.',
        permissionState: 'unavailable',
      }))
      return
    }
    
    // Check current permission state if available
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
        if (!mountedRef.current) return
        
        if (result.state === 'granted') {
          setState(prev => ({ ...prev, permissionState: 'granted' }))
          startWatching()
        } else if (result.state === 'denied') {
          setState(prev => ({
            ...prev,
            permissionState: 'denied',
            error: 'Location permission denied. Please enable GPS in your browser settings.',
          }))
        } else {
          // Prompt state - request permission
          if (opts.enabled) {
            requestPermission()
          } else {
            setState(prev => ({ ...prev, permissionState: 'prompt' }))
          }
        }
        
        // Listen for permission changes
        result.addEventListener('change', () => {
          if (!mountedRef.current) return
          if (result.state === 'granted') {
            startWatching()
          } else if (result.state === 'denied') {
            stopWatching()
            setState(prev => ({
              ...prev,
              permissionState: 'denied',
              error: 'Location permission denied.',
            }))
          }
        })
      }).catch(() => {
        // Permissions API not supported, try directly
        if (opts.enabled) {
          requestPermission()
        }
      })
    } else {
      // Permissions API not supported, try directly
      if (opts.enabled) {
        requestPermission()
      }
    }
    
    return () => {
      mountedRef.current = false
      stopWatching()
    }
  }, [isSupported, opts.enabled, requestPermission, startWatching, stopWatching])
  
  // Refresh location manually
  const refresh = useCallback(() => {
    if (!isSupported) return
    
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy: opts.enableHighAccuracy,
        timeout: opts.timeout,
        maximumAge: 0,
      }
    )
  }, [isSupported, opts.enableHighAccuracy, opts.timeout, handleSuccess, handleError])

  return {
    ...state,
    isSupported,
    requestPermission,
    startWatching,
    stopWatching,
    refresh,
  }
}
