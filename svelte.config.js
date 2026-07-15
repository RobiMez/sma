import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://kit.svelte.dev/docs/integrations#preprocessors
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  kit: {
    // Self-hosted on a single VPS. adapter-node emits build/handler.js, which
    // our custom server.js wraps so the same process also hosts the WebSocket
    // hub (see server.js and src/lib/server/wsRegistry.js).
    adapter: adapter()
  }
};

export default config;
