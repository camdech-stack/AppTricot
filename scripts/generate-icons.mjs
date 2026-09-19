// Generates provisional PWA icons (a cream knit-stitch zigzag on a terracotta
// background) as raw PNGs, with no image-library dependency. Replace these
// with a designed icon set later; keep this script only as a fallback.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const BG = [181, 101, 74, 255]; // terracotta
const FG = [253, 246, 239, 255]; // cream

function crc32(buf) {
  const table = crc32.table ?? (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function createCanvas(size, bg) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) pixels.set(bg, i * 4);
  return pixels;
}

function setPixel(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  pixels.set(color, (y * size + x) * 4);
}

function fillCircle(pixels, size, cx, cy, r, color) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPixel(pixels, size, x, y, color);
    }
  }
}

function strokeLine(pixels, size, x0, y0, x1, y1, width, color) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist * 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    fillCircle(pixels, size, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, width / 2, color);
  }
}

function drawZigzag(pixels, size, { amplitude, spanFraction, strokeWidth, centerY }) {
  const marginX = (size * (1 - spanFraction)) / 2;
  const points = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const x = marginX + (size - 2 * marginX) * (i / 6);
    const y = centerY + (i % 2 === 0 ? -amplitude / 2 : amplitude / 2);
    return [x, y];
  });
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    strokeLine(pixels, size, x0, y0, x1, y1, strokeWidth, FG);
  }
}

function renderIcon(size, { maskableSafe = false } = {}) {
  const pixels = createCanvas(size, BG);
  const spanFraction = maskableSafe ? 0.55 : 0.72;
  const amplitude = size * (maskableSafe ? 0.16 : 0.22);
  const strokeWidth = size * (maskableSafe ? 0.075 : 0.09);
  drawZigzag(pixels, size, { amplitude, spanFraction, strokeWidth, centerY: size / 2 });
  return encodePng(size, size, pixels);
}

writeFileSync(path.join(outDir, 'icon-192.png'), renderIcon(192));
writeFileSync(path.join(outDir, 'icon-512.png'), renderIcon(512));
writeFileSync(path.join(outDir, 'icon-maskable-512.png'), renderIcon(512, { maskableSafe: true }));
writeFileSync(path.join(outDir, 'apple-touch-icon-180.png'), renderIcon(180));

console.log('Provisional icons written to public/icons/');
