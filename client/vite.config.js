import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The API listens on :4000 (see server/.env.example). Proxying /api keeps requests same-origin in
// development, which mirrors the Amplify rewrite used in production and lets the session cookie work.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
});
