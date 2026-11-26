import { defineConfig } from 'vitest/config.js';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'LeverLab — Calisthenics Biomechanics & Shoulder Torque',
        short_name: 'LeverLab',
        description:
          'Offline-capable Planche & Front Lever static shoulder torque calculator, Auto-Bridge progression ladder, and straight-arm tendon volume tracker.',
        theme_color: '#101317',
        background_color: '#101317',
        display: 'standalone',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
