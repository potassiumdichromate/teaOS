/**
 * Where the real apps/api backend lives, for both REST and WebSocket calls.
 *
 * Local dev: VITE_API_BASE_URL is unset, so both helpers below return the
 * relative paths ("/api", "/ws") that vite.config.ts's dev-server proxy
 * forwards to localhost:4000.
 *
 * Deployed (Vercel frontend + Render backend, different origins): set
 * VITE_API_BASE_URL to the backend's real origin, e.g.
 * "https://teaos-api.onrender.com" — see docs/DEPLOYMENT.md. Read once at
 * module load, not per-call: it's a build-time env var, not something that
 * changes at runtime.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export function apiUrl(path: string): string {
  return `${API_BASE}/api${path}`;
}

export function wsUrl(path: string): string {
  if (API_BASE) {
    return `${API_BASE.replace(/^http/, "ws")}${path}`;
  }
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}${path}`;
}
