import { env } from '$env/dynamic/public';

// Base URL for the SMA backend (HTTP API + WebSocket).
//
// Empty string = same-origin, which is what the box (which serves both the
// app and the API) and local dev want, so nothing changes there. The Vercel
// frontend sets PUBLIC_API_BASE=https://s.sma.et so its fetches and websocket
// hit the box — the single backend + database — instead of Vercel's own
// bundled route handlers (which would talk to a now-divergent database).
export const API_BASE = (env.PUBLIC_API_BASE ?? '').replace(/\/$/, '');

// Prefix an /api/... path with the backend base. Safe on server and client.
export const apiUrl = (path: string): string => `${API_BASE}${path}`;

// WebSocket URL for a path like `/ws?rid=...`. Browser-only (falls back to
// window.location when no base is configured).
export const wsUrl = (path: string): string => {
  if (API_BASE) return `${API_BASE.replace(/^http/, 'ws')}${path}`;
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${location.host}${path}`;
};
