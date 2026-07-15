// Process-global registry of WebSocket subscribers, keyed by room id (rid).
//
// It lives on globalThis on purpose: the bundled SvelteKit handler (which runs
// the API routes) and the outer server.js / Vite dev plugin (which own the
// WebSocketServer) are separate module graphs, so a plain module-level Map
// would give each side its OWN instance and notifications would never cross.
// globalThis is the one thing they share within the single Node process.
//
// This is intentionally single-process — same assumption as the in-memory rate
// limiter and the cached mongoose connection. A multi-instance deploy would
// need a broker (Redis pub/sub) here instead.

/** @typedef {import('ws').WebSocket} WS */

/** @returns {{ subs: Map<string, Set<WS>> }} */
function registry() {
  const g = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (globalThis));
  if (!g.__smaWS) g.__smaWS = { subs: new Map() };
  return /** @type {{ subs: Map<string, Set<WS>> }} */ (g.__smaWS);
}

/** @param {string} rid @param {WS} ws */
export function subscribe(rid, ws) {
  if (!rid) return;
  const { subs } = registry();
  let set = subs.get(rid);
  if (!set) subs.set(rid, (set = new Set()));
  set.add(ws);
}

/** @param {string} rid @param {WS} ws */
export function unsubscribe(rid, ws) {
  const { subs } = registry();
  const set = subs.get(rid);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) subs.delete(rid);
}

// Tell every client watching `rid` that its inbox changed. The payload is just
// a signal — clients re-fetch through the normal (authenticated, E2E) path, so
// the socket never carries message content.
/** @param {string} rid @param {number} [at] @returns {number} */
export function notifyRoom(rid, at) {
  const set = registry().subs.get(rid);
  if (!set || set.size === 0) return 0;
  const payload = JSON.stringify({ type: 'message', rid, at: at ?? Date.now() });
  let delivered = 0;
  for (const ws of set) {
    try {
      ws.send(payload);
      delivered++;
    } catch {
      // Dead socket — the 'close' handler will unsubscribe it.
    }
  }
  return delivered;
}
