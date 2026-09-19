import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves this project from /AppTricot/, so every absolute
// asset/route reference in the app must be prefixed with this base.
const BASE_PATH = '/AppTricot/'

// Keep in sync with APP_NAME in src/config/appInfo.ts.
const APP_NAME = 'Mon carnet de tricot'

export default defineConfig({
  base: BASE_PATH,
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        id: BASE_PATH,
        name: APP_NAME,
        short_name: 'Carnet tricot',
        description:
          'Suivi personnel de projets de tricot et crochet : compteurs, patrons, laine et statistiques.',
        lang: 'fr',
        start_url: BASE_PATH,
        scope: BASE_PATH,
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#fdf6ef',
        theme_color: '#b5654a',
        icons: [
          {
            src: `${BASE_PATH}icons/icon-192.png`,
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: `${BASE_PATH}icons/icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: `${BASE_PATH}icons/icon-maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // Without this, a freshly installed SW only controls the *next*
        // navigation: the tab that triggered the install stays uncontrolled
        // until it's fully closed and reopened, so it still hits the
        // network for everything — which is exactly what fails offline on
        // iOS right after the very first (online) launch.
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
})
