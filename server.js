// Production entrypoint for the self-hosted (VPS) deploy.
//
// adapter-node normally ships its own build/index.js server, but we need one
// process that serves both HTTP (the SvelteKit handler) and WebSockets (the
// inbox live-update hub). So we wrap build/handler.js in our own http server
// and attach a WebSocketServer on the /ws path.
//
// Run with:  node server.js   (PORT defaults to 3000)

import { createServer } from 'node:http';
import { handler } from './build/handler.js';
import { WebSocketServer } from 'ws';
import { subscribe, unsubscribe } from './src/lib/server/wsRegistry.js';

const port = Number(process.env.PORT) || 3000;

const server = createServer(handler);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    socket.destroy();
    return;
  }

  // Only /ws is ours; anything else on the upgrade path gets refused.
  if (url.pathname !== '/ws') {
    socket.destroy();
    return;
  }

  const rid = url.searchParams.get('rid') || '';
  wss.handleUpgrade(req, socket, head, (ws) => {
    subscribe(rid, ws);
    ws.on('close', () => unsubscribe(rid, ws));
    ws.on('error', () => unsubscribe(rid, ws));
  });
});

server.listen(port, () => {
  console.log(`SMA listening on :${port} (http + ws)`);
});
