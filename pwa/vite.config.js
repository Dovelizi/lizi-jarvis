import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    port: 5174,
    host: '127.0.0.1',
    proxy: {
      '/api':    { target: 'http://127.0.0.1:5173', changeOrigin: true },
      '/static': { target: 'http://127.0.0.1:5173', changeOrigin: true },
      '/stream': { target: 'ws://127.0.0.1:5173',   ws: true },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // 开发模式关闭 SW：避免调试期间缓存导致代码更新看不到。
      // 生产 build 仍会生成 SW（PWA 能力不受影响）。
      devOptions: { enabled: false },
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Claudio · Personal AI Radio',
        short_name: 'Claudio',
        description: 'lizi 的私人 DJ — 一份会打碟的 taste.md',
        theme_color: '#0A0E0A',
        background_color: '#0A0E0A',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          { urlPattern: /^\/api\//, handler: 'NetworkFirst', options: { cacheName: 'api' } },
        ],
      },
    }),
  ],
});
