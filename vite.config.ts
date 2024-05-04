import { sentrySvelteKit } from "@sentry/sveltekit";
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    plugins: [sentrySvelteKit({
        sourceMapsUploadOptions: {
            org: "robi-codes",
            project: "sma"
        }
    }), sveltekit()],
    optimizeDeps: {
        exclude: ["phosphor-svelte"],
    },
    test: {
        include: ['src/**/*.{test,spec}.{js,ts}']
    }
});