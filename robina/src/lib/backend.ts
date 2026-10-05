const configuredApiUrl = String(import.meta.env.VITE_API_URL || "").trim();

function isLocalDevHost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1";
}

// In production/mobile browsers, treat backend as available even when VITE_API_URL
// is absent so relative /api calls still work for same-origin deployments.
export const HAS_BACKEND = Boolean(configuredApiUrl) || !isLocalDevHost();

// Keep empty string fallback for relative /api routes when hosted on same domain.
export const API_BASE_URL = configuredApiUrl || "";
