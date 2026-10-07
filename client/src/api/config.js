// Same-origin `/api` in production (Render). Vite proxies this to the Express server in local dev.
export const API_BASE = import.meta.env.VITE_API_URL || "/api";
