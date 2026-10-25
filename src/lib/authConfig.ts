/**
 * OAuth Authentication Configuration and Utilities for SINC Platform.
 *
 * Provides dynamic and environment-aware OAuth redirect resolution
 * for both local development (http://localhost:3000) and production domains.
 */

export function getOAuthRedirectUrl(): string {
  const envRedirect =
    process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL ||
    process.env.VITE_AUTH_REDIRECT_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VITE_APP_URL ||
    process.env.VITE_SITE_URL;

  if (envRedirect && typeof envRedirect === 'string' && envRedirect.trim() !== '') {
    return envRedirect.trim().replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return 'http://localhost:3000';
}
