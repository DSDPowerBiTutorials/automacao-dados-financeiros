/**
 * Auth utility functions for managing browser state and cache
 */

/**
 * Clear all browser storage related to authentication
 * Call this on logout or when detecting invalid session states
 */
export function clearAuthStorage() {
    if (typeof window === 'undefined') return;

    try {
        // Clear all localStorage keys related to Supabase
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));

        // Clear sessionStorage
        sessionStorage.clear();

        console.log('Auth storage cleared successfully');
    } catch (error) {
        console.error('Error clearing auth storage:', error);
    }
}

/**
 * Force reload the page without cache
 */
export function hardReload() {
    if (typeof window === 'undefined') return;

    try {
        window.location.reload();
    } catch (error) {
        console.error('Error reloading page:', error);
    }
}

/**
 * Check if the current session is stale (older than 24 hours)
 */
export function isSessionStale(): boolean {
    if (typeof window === 'undefined') return false;

    try {
        // Check for Supabase session timestamp
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-') && key.includes('auth-token')) {
                const item = localStorage.getItem(key);
                if (item) {
                    const data = JSON.parse(item);
                    const expiresAt = data?.expires_at;
                    if (expiresAt) {
                        const expiryDate = new Date(expiresAt * 1000);
                        const now = new Date();
                        return expiryDate < now;
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error checking session staleness:', error);
        return true; // If we can't check, assume it's stale
    }

    return false;
}

/**
 * Clear stale sessions on app initialization
 */
export function clearStaleSession() {
    if (isSessionStale()) {
        console.log('Detected stale session, clearing...');
        clearAuthStorage();
        return true;
    }
    return false;
}
