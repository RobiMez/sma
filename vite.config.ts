import { sentrySvelteKit } from '@sentry/sveltekit';
import { sveltekit } from '@sveltejs/kit/vite';
import raw from 'vite-raw-plugin';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    fs: {
      allow: [
        // allow the package json and the changelog
        './package.json',
        './CHANGELOG.md'
      ]
    }
  },
  plugins: [
    raw({
      fileRegex: /\.md$/
    }),
    sentrySvelteKit({
      sourceMapsUploadOptions: {
        org: 'robi-codes',
        project: 'sma'
      }
    }),
    sveltekit()
  ],
  optimizeDeps: {
    exclude: ['phosphor-svelte']
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}']
  }
});
