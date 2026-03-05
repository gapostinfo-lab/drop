import { useEffect, useRef, useCallback, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '@convex/api'

interface LocationState {
  latitude: number
  longitude: number
  accuracy: number | null
  heading: number | null
  speed: number | null
  timestamp: number
}

interface UseCourierLocationOptions {
  isOnline: boolean
  updateIntervalMs?: number // Default 10000 (10 seconds)
  minDistanceMeters?: number // Default 50 meters
}

export function useCourierLocation(options: UseCourierLocationOptions) {
  const { isOnline, updateIntervalMs = 10000, minDistanceMeters = 50 } = options
  
  const [location, setLocation] = useState<LocationState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  
  const updateLocationMutation = useMutation(api.locations.updateCourierLocation)
  const clearLocationMutation = useMutation(api.locations.clearCourierLocation)
  
  const lastSentLocation = useRef<{ lat: number; lng: number } | null>(null)
  const lastSentTime = useRef<number>(0)
  const watchIdRef = useRef<number | null>(null)

  // Calculate distance between two points in meters
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180
    const φ2 = lat2 * Math.PI / 180
    const Δφ = (lat2 - lat1) * Math.PI / 180
    const Δλ = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }, [])

  // Send location to server
  const sendLocation = useCallback(async (position: GeolocationPosition) => {
    const { latitude, longitude, accuracy, heading, speed } = position.coords
    const now = Date.now()

    // Update local state
    setLocation({
      latitude,
      longitude,
      accuracy,
      heading,
      speed,
      timestamp: now,
    })

    // Check if we should send to server
    const timeSinceLastSend = now - lastSentTime.current
    const distanceMoved = lastSentLocation.current
      ? calculateDistance(lastSentLocation.current.lat, lastSentLocation.current.lng, latitude, longitude)
      : Infinity

    // Send if: first time, enough time passed, or moved enough distance
    if (!lastSentLocation.current || timeSinceLastSend >= updateIntervalMs || distanceMoved >= minDistanceMeters) {
      try {
        await updateLocationMutation({
          latitude,
          longitude,
          heading: heading ?? undefined,
          speed: speed ?? undefined,
          accuracy: accuracy ?? undefined,
        })
        lastSentLocation.current = { lat: latitude, lng: longitude }
        lastSentTime.current = now
        setError(null)
      } catch (err) {
        console.error('[useCourierLocation] Failed to send location:', err)
        setError(err instanceof Error ? err.message : 'Failed to update location')
      }
    }
  }, [updateLocationMutation, updateIntervalMs, minDistanceMeters, calculateDistance])

  // Handle geolocation error
  const handleError = useCallback((err: GeolocationPositionError) => {
    console.error('[useCourierLocation] Geolocation error:', err)
    switch (err.code) {
      case err.PERMISSION_DENIED:
        setError('Location permission denied. Please enable location access.')
        break
      case err.POSITION_UNAVAILABLE:
        setError('Location unavailable. Please check your GPS.')
        break
      case err.TIMEOUT:
        setError('Location request timed out. Retrying...')
        break
      default:
        setError('Failed to get location.')
    }
  }, [])

  // Start tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }

    setIsTracking(true)
    setError(null)

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      sendLocation,
      handleError,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    )

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      sendLocation,
      handleError,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    )
  }, [sendLocation, handleError])

  // Stop tracking
  const stopTracking = useCallback(async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    
    setIsTracking(false)
    lastSentLocation.current = null
    lastSentTime.current = 0

    // Clear location from server
    try {
      await clearLocationMutation()
    } catch (err) {
      console.error('[useCourierLocation] Failed to clear location:', err)
    }
  }, [clearLocationMutation])

  // Effect to start/stop tracking based on online status
  useEffect(() => {
    if (isOnline) {
      startTracking()
    } else {
      stopTracking()
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [isOnline, startTracking, stopTracking])

  // Request permission (for UI purposes)
  const requestPermission = useCallback(async () => {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' })
      return result.state
    } catch {
      return 'prompt' // Fallback for browsers that don't support permissions API
    }
  }, [])

  return {
    location,
    error,
    isTracking,
    requestPermission,
  }
}
