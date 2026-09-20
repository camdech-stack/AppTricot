// Ravelry's license forbids caching their responses at all (see CLAUDE.md).
// Exported as data — rather than inlined in vite.config.ts — so a test can
// assert its shape without spinning up the whole Vite/workbox pipeline.
// NetworkOnly: workbox never reads or writes this URL to any cache, and
// never treats it as a navigation to fall back on.
export const RAVELRY_RUNTIME_CACHING_RULE = {
  urlPattern: /^https:\/\/api\.ravelry\.com\//,
  handler: 'NetworkOnly',
} as const
