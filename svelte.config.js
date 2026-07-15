import adapterNode from '@sveltejs/adapter-node';
import adapterVercel from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Same repo, two deploy targets:
// - The self-hosted box runs a custom Node server (server.js) for WebSockets,
//   so it builds with adapter-node → build/handler.js.
// - Vercel sets VERCEL=1 during its builds; there we use adapter-vercel so the
//   output is Vercel-native (adapter-node's build/ dir is not deployable there,
//   which is what broke Vercel: "No Output Directory named public").
const adapter = process.env.VERCEL ? adapterVercel() : adapterNode();

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://kit.svelte.dev/docs/integrations#preprocessors
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  kit: {
    adapter
  }
};

export default config;
