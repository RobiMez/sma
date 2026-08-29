import { sentrySvelteKit } from '@sentry/sveltekit';
import { sveltekit } from '@sveltejs/kit/vite';
import raw from 'vite-raw-plugin';
import { WebSocketServer } from 'ws';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

import { defineConfig } from 'vitest/config';
import type { Plugin, ViteDevServer } from 'vite';
import { subscribe, unsubscribe } from './src/lib/server/wsRegistry.js';

// Mirrors server.js for `pnpm dev`: attaches a /ws WebSocketServer to Vite's
// HTTP server. It must only claim the /ws path and otherwise return, so Vite's
// own HMR websocket upgrade keeps working.
function wsDevPlugin(): Plugin {
  return {
    name: 'sma-ws-dev',
    configureServer(server: ViteDevServer) {
      const wss = new WebSocketServer({ noServer: true });
      server.httpServer?.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        let url: URL;
        try {
          url = new URL(req.url ?? '', 'http://localhost');
        } catch {
          return;
        }
        if (url.pathname !== '/ws') return; // leave HMR upgrades to Vite
        const rid = url.searchParams.get('rid') || '';
        wss.handleUpgrade(req, socket, head, (ws) => {
          subscribe(rid, ws);
          ws.on('close', () => unsubscribe(rid, ws));
          ws.on('error', () => unsubscribe(rid, ws));
        });
      });
    }
  };
}

export default defineConfig({
  server: {
    port: 5340,
    fs: {
      allow: [
        // allow the package json
        './package.json'
      ]
    }
  },
  plugins: [
    // Only the release build that can actually upload source maps loads this.
    // Without a token the plugin does nothing useful — it says as much — while
    // still dragging Babel into the module graph, which buries every `pnpm
    // build` and `pnpm test` under a screen of @babel circular-dependency
    // warnings. Error capture itself lives in the hooks and does not depend on
    // this plugin, so gating it costs nothing locally.
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentrySvelteKit({
            // The build plugin reports its own usage stats to Sentry by
            // default. Opt out — nothing else here sends telemetry.
            telemetry: false,
            sourceMapsUploadOptions: {
              org: 'robi-codes',
              project: 'sma',
              telemetry: false
            }
          })
        ]
      : []),
    raw({
      fileRegex: /\.md$/
    }),
    sveltekit(),
    wsDevPlugin()
  ],
  optimizeDeps: {
    exclude: ['phosphor-svelte']
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}']
  }
});
