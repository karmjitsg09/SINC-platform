/**
 * OAuth Authentication Configuration and Utilities for Sync Platform.
 *
 * Provides dynamic and environment-aware OAuth redirect resolution
 * for both local development (http://localhost:3000) and production domains.
 */

export function getOAuthRedirectUrl() {
  // 1. Check if an explicit redirect URL or production app URL is set in env
  const envRedirect =
    import.meta.env.VITE_AUTH_REDIRECT_URL ||
    import.meta.env.VITE_APP_URL ||
    import.meta.env.VITE_SITE_URL;

  if (envRedirect && typeof envRedirect === 'string' && envRedirect.trim() !== '') {
    return envRedirect.trim().replace(/\/+$/, '');
  }

  // 2. In browser environments, use window.location.origin dynamically.
  // This automatically handles localhost with any configured port (e.g. 3000)
  // as well as production custom domains and preview deployments without hardcoding.
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  // 3. Sensible development fallback
  return 'http://localhost:3000';
}
