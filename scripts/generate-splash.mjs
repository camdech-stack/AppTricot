// Renders the iOS launch screens (public/splash/*.png) and prints the matching
// <link rel="apple-touch-startup-image"> tags for index.html. Not part of the
// build: it needs `playwright` and a Chromium, and the PNGs are committed.
// Usage: node scripts/generate-splash.mjs   (PLAYWRIGHT_MODULE / CHROMIUM_PATH
// can point at a global install). Keep the mark in sync with src/components/Logo.tsx.
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'splash');
mkdirSync(outDir, { recursive: true });

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const fontPath = path.join(
  root,
  'node_modules/@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2',
);
const fontData = readFileSync(fontPath).toString('base64');

// [css width, css height, device pixel ratio] — portrait only (the app is portrait-first).
const DEVICES = [
  [440, 956, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3],
  [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3],
  [375, 667, 2], [768, 1024, 2], [810, 1080, 2], [820, 1180, 2], [834, 1112, 2],
  [834, 1194, 2], [1024, 1366, 2],
];

const mark = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="c"><circle cx="30" cy="31" r="22"/></clipPath></defs><circle cx="30" cy="31" r="22" fill="#C2416B"/><g clip-path="url(#c)" fill="none" stroke="#FCF8F3" stroke-width="2.6" stroke-linecap="round"><g transform="rotate(-28 30 31)"><path d="M2 14Q30 26 58 14"/><path d="M2 23Q30 35 58 23"/><path d="M2 32Q30 44 58 32"/><path d="M2 41Q30 53 58 41"/><path d="M2 50Q30 62 58 50"/></g></g><path d="M41 50C49 58 55 49 59 56" fill="none" stroke="#C2416B" stroke-width="4" stroke-linecap="round"/></svg>`;

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const links = [];
for (const [w, h, dpr] of DEVICES) {
  const markSize = Math.round(Math.min(w, h) * 0.3);
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  await page.setContent(`<style>
@font-face{font-family:Outfit;font-weight:100 900;src:url(data:font/woff2;base64,${fontData}) format('woff2')}
html,body{margin:0;height:100%;background:#FCF8F3}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(markSize * 0.08)}px}
svg{width:${markSize}px;height:${markSize}px}
span{font:700 ${Math.round(markSize * 0.4)}px Outfit,sans-serif;color:#2b1a20}
</style>${mark}<span>Tricot</span>`);
  await page.evaluate(() => document.fonts.ready);
  const name = `splash-${w * dpr}x${h * dpr}.png`;
  await page.screenshot({ path: path.join(outDir, name) });
  await page.close();
  links.push(
    `    <link rel="apple-touch-startup-image" href="/splash/${name}" media="(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)" />`,
  );
}
await browser.close();
console.log(links.join('\n'));
console.log(`\nSplash images written to ${pathToFileURL(outDir)}`);
