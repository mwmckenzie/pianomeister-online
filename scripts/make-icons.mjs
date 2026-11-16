// Writes the app icons (public/icons/): icon.svg plus 180/192/512 px PNGs, drawn from one
// shape list with Node built-ins only. Design: three white keys (C D E) with two black keys,
// and note strips in the pitch-class palette falling toward them; D is sounding.
// Run with `node scripts/make-icons.mjs`; the outputs are committed.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { crc32, deflateSync } from 'node:zlib'

const out = fileURLToPath(new URL('../public/icons/', import.meta.url))
const BACKGROUND = '#05070F'
const C = '#FF0000'
const D = '#FFE500'
const E = '#00C2FF'

// 512 × 512 design space: [x, y, width, height, cornerRadius, color]
const KEY_TOP = 330
const KEY_W = 104
const KEY_GAP = 8
const keyX = (i) => 92 + i * (KEY_W + KEY_GAP)
const shapes = [
  // Note strips (above the keys, centred on their lanes).
  [keyX(0) + 22, 70, KEY_W - 44, 150, 14, C],
  [keyX(1) + 22, 150, KEY_W - 44, 172, 14, D],
  [keyX(2) + 22, 40, KEY_W - 44, 120, 14, E],
  // White keys; D is lit in its pitch color.
  [keyX(0), KEY_TOP, KEY_W, 142, 12, '#F4F6FB'],
  [keyX(1), KEY_TOP, KEY_W, 142, 12, D],
  [keyX(2), KEY_TOP, KEY_W, 142, 12, '#F4F6FB'],
  // Black keys between C–D and D–E.
  [keyX(1) - 34, KEY_TOP, 60, 86, 8, '#1A1D26'],
  [keyX(2) - 34, KEY_TOP, 60, 86, 8, '#1A1D26'],
]

function svg() {
  const rect = ([x, y, w, h, r, fill]) =>
    `  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">',
    rect([0, 0, 512, 512, 96, BACKGROUND]),
    ...shapes.map(rect),
    '</svg>',
    '',
  ].join('\n')
}

const hex = (color) => [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16))

function inRoundedRect(px, py, [x, y, w, h, r]) {
  if (px < x || px > x + w || py < y || py > y + h) return false
  const dx = Math.max(x + r - px, 0, px - (x + w - r))
  const dy = Math.max(y + r - py, 0, py - (y + h - r))
  return dx * dx + dy * dy <= r * r
}

/** RGBA pixels with 4×4 supersampling. PNGs are full-bleed: home screens apply their own mask. */
function render(size) {
  const pixels = Buffer.alloc(size * size * 4)
  const scale = 512 / size
  const bg = hex(BACKGROUND)
  const SS = 4
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let [r, g, b] = [0, 0, 0]
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) * scale
          const y = (py + (sy + 0.5) / SS) * scale
          let color = bg
          for (const shape of shapes) if (inRoundedRect(x, y, shape)) color = hex(shape[5])
          r += color[0]
          g += color[1]
          b += color[2]
        }
      }
      const i = (py * size + px) * 4
      pixels[i] = Math.round(r / (SS * SS))
      pixels[i + 1] = Math.round(g / (SS * SS))
      pixels[i + 2] = Math.round(b / (SS * SS))
      pixels[i + 3] = 255
    }
  }
  return pixels
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function png(size) {
  const pixels = render(size)
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.writeUInt8(8, 8) // bit depth
  header.writeUInt8(6, 9) // RGBA
  // Each scanline starts with filter type 0 (none).
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'icon.svg'), svg())
for (const size of [180, 192, 512]) writeFileSync(join(out, `icon-${size}.png`), png(size))
console.log('Wrote public/icons/icon.svg and icon-{180,192,512}.png')
