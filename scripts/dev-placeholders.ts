/**
 * Generate flat test patterns so photo layout, srcset and CLS can be verified
 * without network access. These are NOT photographs and must never ship: the
 * manifest they write is throwaway and public/vehicles is gitignored.
 *
 *   npm run placeholders          write patterns for the first 6 vehicles
 *   npm run placeholders -- 20    write patterns for the first 20
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import { CATALOG } from '../src/data/catalog';
import type { ImageManifest } from '../src/data/images';

function png(w: number, h: number, rgb: (x: number, y: number) => [number, number, number]): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 3));
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = rgb(x, y);
      raw[o++] = r; raw[o++] = g; raw[o++] = b;
    }
  }
  const chunk = (tag: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(tag, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const count = Number(process.argv[2]) || 6;
mkdirSync('public/vehicles', { recursive: true });
const manifest: ImageManifest = {};

CATALOG.slice(0, count).forEach((v, i) => {
  const palette: [number, number, number][] = [[40, 90, 140], [140, 70, 40], [60, 120, 70]];
  const base = palette[i % palette.length]!;
  const pattern = (w: number, h: number) => (x: number, y: number): [number, number, number] => {
    const k = 1 - (Math.floor((y * 6) / h) * 0.09);
    const stripe = Math.floor(x / (w / 26)) % 2 === 0 ? 18 : 0;
    const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * k) + stripe));
    return [f(base[0]), f(base[1]), f(base[2])];
  };
  writeFileSync(`public/vehicles/${v.id}-0.png`, png(640, 400, pattern(640, 400)));
  writeFileSync(`public/vehicles/${v.id}-0@2x.png`, png(1280, 800, pattern(1280, 800)));
  manifest[v.id] = [{
    file: `${v.id}-0.png`, file2x: `${v.id}-0@2x.png`,
    width: 640, height: 400,
    licence: 'cc-by-sa', author: 'Layout test pattern',
    sourceUrl: 'https://commons.wikimedia.org/',
    alt: 'Layout verification placeholder, not a photograph',
  }];
});

writeFileSync('src/data/generated/images.json', JSON.stringify(manifest));
console.log(`${count} test patterns written. Run "npm run images:reset" before committing.`);
