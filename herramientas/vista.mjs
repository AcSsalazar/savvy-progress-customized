// Genera docs/cerveza.gif y docs/boxeador.gif a partir de plugin/hooks/estilos.ts,
// la misma fuente que dibuja el panel. Sin dependencias: PNG/GIF escritos aquí.
// Uso, desde la raíz del repositorio (Node 23.6 o más reciente, que ejecuta .ts):
//   node herramientas/vista.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { boxerFrame, beerFrame, BW, BH, CW, CH, BEERS, SHORTS, BANDS, EXERCISE_ORDER, CONTAINER_OF } from '../plugin/hooks/estilos.ts'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'docs')
const BG = [241, 239, 233]
const SCALE = 3, CELL_W = 44, CELL_H = 38

const rgb = col => {
  if (col.startsWith('#')) { const n = parseInt(col.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255] }
  const [r, g, b, a] = col.match(/[\d.]+/g).map(Number)
  return [r, g, b].map((v, i) => Math.round(v * a + BG[i] * (1 - a)))
}

function lzw(px, min) {
  const clear = 1 << min, eoi = clear + 1
  let size = min + 1, next = eoi + 1, dict = new Map(), cur = 0, bits = 0
  const bytes = []
  const emit = code => { cur |= code << bits; bits += size; while (bits >= 8) { bytes.push(cur & 255); cur >>>= 8; bits -= 8 } }
  emit(clear)
  let prefix = px[0]
  for (let i = 1; i < px.length; i++) {
    const k = px[i], key = prefix * 4096 + k
    if (dict.has(key)) { prefix = dict.get(key); continue }
    emit(prefix)
    if (next < 4096) { dict.set(key, next++); if (next > 1 << size && size < 12) size++ }
    else { emit(clear); dict = new Map(); next = eoi + 1; size = min + 1 }
    prefix = k
  }
  emit(prefix); emit(eoi)
  if (bits > 0) bytes.push(cur & 255)
  return bytes
}

function gif(W, H, frames, palette, delay) {
  let bits = 1; while (1 << bits < palette.length) bits++
  const out = [], w16 = n => out.push(n & 255, (n >> 8) & 255), str = s => { for (const ch of s) out.push(ch.charCodeAt(0)) }
  str('GIF89a'); w16(W); w16(H); out.push(0x80 | ((bits - 1) << 4) | (bits - 1), 0, 0)
  for (let i = 0; i < 1 << bits; i++) out.push(...(palette[i] || [0, 0, 0]))
  out.push(0x21, 0xff, 0x0b); str('NETSCAPE2.0'); out.push(3, 1, 0, 0, 0)
  const min = Math.max(2, bits)
  for (const f of frames) {
    out.push(0x21, 0xf9, 4, 0x04); w16(delay); out.push(0, 0)
    out.push(0x2c); w16(0); w16(0); w16(W); w16(H); out.push(0, min)
    const data = lzw(f, min)
    for (let i = 0; i < data.length; i += 255) { const ch = data.slice(i, i + 255); out.push(ch.length, ...ch) }
    out.push(0)
  }
  out.push(0x3b)
  return Buffer.from(out)
}

// Una hoja de celdas (cada una con su tamaño) por cuadro, escalada sin suavizado.
function sheet(cols, rows, cells) {
  const W = cols * CELL_W + 4, H = rows * CELL_H + 4
  const px = Array.from({ length: W * H }, () => [255, 255, 255])
  for (const { col, row, colors, w, h } of cells) {
    const ox = 4 + col * CELL_W, oy = 4 + row * CELL_H
    for (let y = 0; y < 34; y++) for (let x = 0; x < 40; x++) px[(oy + y) * W + ox + x] = BG
    const dx = Math.floor((40 - w) / 2), dy = Math.floor((34 - h) / 2)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = colors[y * w + x]; if (c) px[(oy + dy + y) * W + ox + dx + x] = rgb(c) }
  }
  return { W, H, px }
}

function writeGif(file, cols, rows, frameCells, delay) {
  const palette = [], index = new Map(), frames = []
  let SW = 0, SH = 0
  for (const cells of frameCells) {
    const { W, H, px } = sheet(cols, rows, cells)
    SW = W * SCALE; SH = H * SCALE
    const f = new Array(SW * SH)
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const [r, g, b] = px[Math.floor(y / SCALE) * W + Math.floor(x / SCALE)]
      const k = (r << 16) | (g << 8) | b
      if (!index.has(k)) { index.set(k, palette.length); palette.push([r, g, b]) }
      f[y * SW + x] = index.get(k)
    }
    frames.push(f)
  }
  if (palette.length > 256) throw new Error(`demasiados colores: ${palette.length}`)
  fs.writeFileSync(file, gif(SW, SH, frames, palette, delay))
  console.log(`${path.relative(ROOT, file)}: ${SW}×${SH}, ${frames.length} cuadros, ${palette.length} colores`)
}

fs.mkdirSync(OUT, { recursive: true })

// Cerveza: un recipiente por tipo de agente, una cerveza por modelo, y el estado "falló".
const LEVELS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1]
const beers = [
  ['explore', 'haiku'], ['plan', 'sonnet'], ['general', 'opus'], ['otro', 'fable'], ['general', 'otro', 'fail'],
]
writeGif(path.join(OUT, 'cerveza.gif'), 5, 1, Array.from({ length: 24 }, (_, t) => {
  const i = Math.floor(t / 2) % LEVELS.length
  return beers.map(([type, model, fail], col) => ({
    col, row: 0, w: CW, h: CH,
    colors: beerFrame(CONTAINER_OF[type], BEERS[model], LEVELS[i], t % 3, fail ? 'fail' : i >= 10 ? 'done' : 'run'),
  }))
}), 25)

// Boxeador: los siete ejercicios, con pantaloneta por modelo y banda por tipo.
const models = ['haiku', 'sonnet', 'opus', 'fable', 'otro', 'haiku', 'opus']
const types = ['explore', 'plan', 'general', 'explore', 'otro', 'plan', 'general']
writeGif(path.join(OUT, 'boxeador.gif'), 4, 2, Array.from({ length: 12 }, (_, t) =>
  EXERCISE_ORDER.map((ex, i) => ({
    col: i % 4, row: Math.floor(i / 4), w: BW, h: BH,
    colors: boxerFrame(ex, (t % 6) / 6, { shorts: SHORTS[models[i]], band: BANDS[types[i]] }, false),
  }))), 17)
