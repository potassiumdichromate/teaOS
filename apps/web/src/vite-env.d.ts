/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Origin of the deployed apps/api backend, e.g. "https://teaos-api.onrender.com".
   * Unset in local dev — vite.config.ts's dev-server proxy handles the
   * relative "/api" and "/ws" paths instead. Required whenever the frontend
   * and backend are NOT served from the same origin (Vercel + Render, in
   * particular) — see docs/DEPLOYMENT.md.
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
