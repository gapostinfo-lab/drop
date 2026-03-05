/**
 * Enhanced auth storage for PWA persistence
 * Uses localStorage with portal-specific keys to prevent cross-portal issues
 */

// Storage keys by portal
export const AUTH_STORAGE_KEYS = {
  // Convex Auth tokens (used by @convex-dev/auth)
  CONVEX_TOKEN: 'convex-auth-token',
  CONVEX_REFRESH_TOKEN: 'convex-auth-refresh-token',
  
  // Portal-specific session markers (for cross-portal detection)
  CUSTOMER_SESSION: 'droppit_customer_session',
  COURIER_SESSION: 'droppit_courier_session',
  ADMIN_SESSION: 'adminSessionToken', // Already exists
  
  // Auth ready state
  AUTH_READY: 'droppit_auth_ready',
  LAST_PORTAL: 'droppit_last_portal',
} as const;

export type Portal = 'customer' | 'courier' | 'admin';

/**
 * Detect which portal the user is on based on URL
 */
export function detectPortal(): Portal {
  const path = window.location.pathname;
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/courier')) return 'courier';
  return 'customer';
}

/**
 * Get the session key for a portal
 */
export function getSessionKey(portal: Portal): string {
  switch (portal) {
    case 'admin': return AUTH_STORAGE_KEYS.ADMIN_SESSION;
    case 'courier': return AUTH_STORAGE_KEYS.COURIER_SESSION;
    case 'customer': return AUTH_STORAGE_KEYS.CUSTOMER_SESSION;
  }
}

/**
 * Check if user has stored auth tokens
 */
export function hasStoredTokens(): boolean {
  try {
    const token = localStorage.getItem(AUTH_STORAGE_KEYS.CONVEX_TOKEN);
    const refreshToken = localStorage.getItem(AUTH_STORAGE_KEYS.CONVEX_REFRESH_TOKEN);
    return !!(token || refreshToken);
  } catch {
    return false;
  }
}

/**
 * Check if user has a session for a specific portal
 */
export function hasPortalSession(portal: Portal): boolean {
  try {
    const sessionKey = getSessionKey(portal);
    return !!localStorage.getItem(sessionKey);
  } catch {
    return false;
  }
}

/**
 * Mark portal session as active (call after successful auth)
 */
export function markPortalSession(portal: Portal, userId: string): void {
  try {
    const sessionKey = getSessionKey(portal);
    localStorage.setItem(sessionKey, JSON.stringify({
      userId,
      timestamp: Date.now(),
    }));
    localStorage.setItem(AUTH_STORAGE_KEYS.LAST_PORTAL, portal);
    console.log(`[AUTH_STORAGE] Marked ${portal} session for user ${userId}`);
  } catch (e) {
    console.error('[AUTH_STORAGE] Failed to mark session:', e);
  }
}

/**
 * Clear portal session (call on logout)
 */
export function clearPortalSession(portal: Portal): void {
  try {
    const sessionKey = getSessionKey(portal);
    localStorage.removeItem(sessionKey);
    console.log(`[AUTH_STORAGE] Cleared ${portal} session`);
  } catch (e) {
    console.error('[AUTH_STORAGE] Failed to clear session:', e);
  }
}

/**
 * Clear all auth data (nuclear option - only on explicit full logout)
 */
export function clearAllAuthData(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEYS.CONVEX_TOKEN);
    localStorage.removeItem(AUTH_STORAGE_KEYS.CONVEX_REFRESH_TOKEN);
    localStorage.removeItem(AUTH_STORAGE_KEYS.CUSTOMER_SESSION);
    localStorage.removeItem(AUTH_STORAGE_KEYS.COURIER_SESSION);
    // Note: Don't clear admin session - it's separate
    localStorage.removeItem(AUTH_STORAGE_KEYS.LAST_PORTAL);
    console.log('[AUTH_STORAGE] Cleared all auth data');
  } catch (e) {
    console.error('[AUTH_STORAGE] Failed to clear all auth data:', e);
  }
}

/**
 * Get last active portal
 */
export function getLastPortal(): Portal | null {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEYS.LAST_PORTAL) as Portal | null;
  } catch {
    return null;
  }
}

/**
 * Check if running as PWA
 */
export function isPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

/**
 * Create storage adapter for ConvexAuthProvider
 * This wraps localStorage with logging for debugging
 */
export function createAuthStorage() {
  return {
    getItem: (key: string): string | null => {
      try {
        const value = localStorage.getItem(key);
        if (value && key.includes('auth')) {
          console.log(`[AUTH_STORAGE] GET ${key.substring(0, 25)}... = ${value ? 'exists' : 'null'}`);
        }
        return value;
      } catch (e) {
        console.error('[AUTH_STORAGE] GET failed:', key, e);
        return null;
      }
    },
    setItem: (key: string, value: string): void => {
      try {
        localStorage.setItem(key, value);
        if (key.includes('auth')) {
          console.log(`[AUTH_STORAGE] SET ${key.substring(0, 25)}...`);
        }
      } catch (e) {
        console.error('[AUTH_STORAGE] SET failed:', key, e);
      }
    },
    removeItem: (key: string): void => {
      try {
        localStorage.removeItem(key);
        if (key.includes('auth')) {
          console.log(`[AUTH_STORAGE] REMOVE ${key}`);
        }
      } catch (e) {
        console.error('[AUTH_STORAGE] REMOVE failed:', key, e);
      }
    },
  };
}
