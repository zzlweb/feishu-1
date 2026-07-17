import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3000';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const defaultCacheDir = path.join(
  os.tmpdir(),
  `feishu-doc-vite-${createHash('sha256').update(projectRoot).digest('hex').slice(0, 12)}`,
);

function resolveVendorChunk(id: string): string | undefined {
  const normalizedId = id.replace(/\\/g, '/');
  if (!normalizedId.includes('/node_modules/')) return undefined;
  if (
    normalizedId.includes('/node_modules/@tiptap/')
    || normalizedId.includes('/node_modules/prosemirror-')
  ) {
    return 'vendor-editor';
  }
  if (
    normalizedId.includes('/node_modules/tdesign-react/')
    || normalizedId.includes('/node_modules/tdesign-icons-react/')
  ) {
    return 'vendor-tdesign';
  }
  if (
    normalizedId.includes('/node_modules/katex/')
    || normalizedId.includes('/node_modules/lowlight/')
    || normalizedId.includes('/node_modules/highlight.js/')
  ) {
    return 'vendor-rich-text';
  }
  // React、Router 及其余小型依赖放入同一个基础包，避免 Router 的传递依赖
  // 被拆到另一个 vendor 后形成 vendor-core <-> vendor-react 循环。
  return 'vendor-core';
}

export default defineConfig({
  plugins: [react()],
  cacheDir: process.env.VITE_CACHE_DIR || defaultCacheDir,
  build: {
    rollupOptions: {
      output: {
        manualChunks: resolveVendorChunk,
      },
    },
  },
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      '/static': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5174,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      '/static': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
});
