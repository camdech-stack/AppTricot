import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { RAVELRY_RUNTIME_CACHING_RULE } from './src/ravelry/serviceWorkerRule.ts'

// GitHub Pages serves this project from /AppTricot/, so every absolute
// asset/route reference in the app must be prefixed with this base.
const BASE_PATH = '/AppTricot/'

// Keep in sync with APP_NAME in src/config/appInfo.ts.
const APP_NAME = 'Tricot'

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
        short_name: APP_NAME,
        description:
          'Suivi personnel de projets de tricot et crochet : compteurs, patrons, laine et statistiques.',
        lang: 'fr',
        start_url: BASE_PATH,
        scope: BASE_PATH,
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#FCF8F3',
        theme_color: '#FCF8F3',
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
        // woff2: local Outfit/DM Sans font files, precached so typography
        // still renders correctly with no network (see CLAUDE.md). mjs: the
        // pdf.js worker, imported via `?url` so Vite copies it verbatim
        // instead of bundling it as a regular chunk (still `.mjs`, not the
        // `.js` already covered above). pfb/ttf: pdf.js's standard font
        // data (see scripts/copy-pdfjs-assets.mjs) — both needed for the
        // PDF viewer to work fully offline (step 4).
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,woff2,mjs,pfb,ttf}'],
        // The pdf.js worker alone is ~1.3MB, above workbox's 2MB default —
        // bumped so it (and the standard font files) still get precached
        // instead of silently skipped.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Without this, a freshly installed SW only controls the *next*
        // navigation: the tab that triggered the install stays uncontrolled
        // until it's fully closed and reopened, so it still hits the
        // network for everything — which is exactly what fails offline on
        // iOS right after the very first (online) launch.
        clientsClaim: true,
        skipWaiting: true,
        // Ravelry's license forbids caching their responses (see
        // src/ravelry/serviceWorkerRule.ts and CLAUDE.md): explicit
        // NetworkOnly, checked before the default navigation fallback would
        // ever apply.
        runtimeCaching: [RAVELRY_RUNTIME_CACHING_RULE],
      },
    }),
  ],
})
