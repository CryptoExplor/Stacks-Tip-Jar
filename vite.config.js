// vite.config.js (FIXED - with Buffer polyfill)
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    nodePolyfills({
      // Include buffer polyfill for @stacks/transactions
      include: ['buffer'],
      globals: {
        Buffer: true,
      },
    }),
  ],
  
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  
  server: {
    port: 8000,
    open: true,
    host: true
  },
  
  preview: {
    port: 8000,
    host: true
  },
  
  optimizeDeps: {
    include: ['@stacks/transactions']
  }
});
