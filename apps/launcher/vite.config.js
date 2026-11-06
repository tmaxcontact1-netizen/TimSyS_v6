import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { copyFile, readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(configDirectory, '../..');

export default defineConfig({
  plugins: [react(), { name: 'assistant-entry', async closeBundle() {
    const assets=path.join(configDirectory,'dist/assets');
    const code=(await Promise.all((await readdir(assets)).filter(f=>f.endsWith('.js')).map(f=>readFile(path.join(assets,f),'utf8')))).join('\n');
    const css=(await Promise.all((await readdir(assets)).filter(f=>f.endsWith('.css')).map(f=>readFile(path.join(assets,f),'utf8')))).join('\n');
    for(const selector of ['flex','grid','p-6','px-6','min-h-screen','rounded-lg','gap-6'])assert.ok(new RegExp('\\.'+selector+'\\s*\\{').test(css),`Launcher build lost dashboard styling: ${selector}`);
    for(const marker of ['Documentary destinations','Connection evidence','dl-viewport'])assert.ok(code.includes(marker),`Launcher build lost Phase 2A UI: ${marker}`);
    assert.ok(!code.includes('Formal responsibilities, source evidence and the connections between them.'),'Launcher includes superseded Nervous Breakdown interface');
    await copyFile(path.join(configDirectory, 'dist/index.html'), path.join(configDirectory, 'dist/assistant.html')); } }],
  server: {
    port: 5173,
    fs: {
      allow: [repositoryRoot]
    },
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/platform/**',
        '**/apps/tradeed/**',
        '**/apps/principaled/**',
        '**/.git/**',
      ]
    },
    proxy: {
      '/ai-gateway': { target: 'http://localhost:3000', changeOrigin: true },
      '/execution': { target: 'http://localhost:3000', changeOrigin: true },
      '/nervous-breakdown': { target: 'http://localhost:3000', changeOrigin: true },
      '/documents': { target: 'http://localhost:3000', changeOrigin: true },
      '/document-intelligence': { target: 'http://localhost:3000', changeOrigin: true },
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
