import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/apple-touch-icon.png',
      ],
      manifest: {
        name: 'Uwezo Fund',
        short_name: 'Uwezo Fund',
        description:
          'Uwezo Fund quick links — Wezesha Majuu, loans, website, and phone OTP chat.',
        theme_color: '#b72a9f',
        background_color: '#f7f3ea',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  server: {
    host: true,
    port: 4173,
    proxy: {
      '/api/businesses': { target: 'https://majuu.uwezo.go.ke', changeOrigin: true, secure: true },
      '/api/agencies': { target: 'https://majuu.uwezo.go.ke', changeOrigin: true, secure: true },
      '/msea-api': {
        target: 'https://msea.ecitizen.go.ke',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/msea-api/, '/api'),
      },
      '/zimbra-account': {
        target: 'https://mail.govmail.ke',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/zimbra-account/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('referer');
          });
        },
      },
      '/zimbra-admin': {
        target: 'https://mail.govmail.ke:9071',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/zimbra-admin/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('referer');
          });
        },
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    proxy: {
      '/api/businesses': { target: 'https://majuu.uwezo.go.ke', changeOrigin: true, secure: true },
      '/api/agencies': { target: 'https://majuu.uwezo.go.ke', changeOrigin: true, secure: true },
      '/msea-api': {
        target: 'https://msea.ecitizen.go.ke',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/msea-api/, '/api'),
      },
      '/zimbra-account': {
        target: 'https://mail.govmail.ke',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/zimbra-account/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('referer');
          });
        },
      },
      '/zimbra-admin': {
        target: 'https://mail.govmail.ke:9071',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/zimbra-admin/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('referer');
          });
        },
      },
    },
  },
});
