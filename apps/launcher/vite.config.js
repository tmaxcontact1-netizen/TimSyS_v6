import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(configDirectory, '../..');

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    fs: {
      allow: [repositoryRoot]
    },
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/platform/**',
        '**/apps/memecoined/**',
        '**/apps/principaled/**',
        '**/.git/**',
      ]
    },
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/health': { target: 'http://localhost:3000', changeOrigin: true },
      '/students': { target: 'http://localhost:3000', changeOrigin: true },
      '/staff': { target: 'http://localhost:3000', changeOrigin: true },
      '/rooms': { target: 'http://localhost:3000', changeOrigin: true },
      '/inventory': { target: 'http://localhost:3000', changeOrigin: true },
      '/analytics': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  resolve: {
    // Principal'Ed is compiled from a sibling package. Force both applications to
    // share the launcher's React runtime; two React copies break hooks at runtime.
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(configDirectory, './src'),
      react: path.resolve(configDirectory, 'node_modules/react'),
      'react-dom': path.resolve(configDirectory, 'node_modules/react-dom'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
