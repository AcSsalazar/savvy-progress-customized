// Estilos propios de savvy-progress-customized: cerveza y boxeador en pixel art.
// Todo se genera aquí como texto SVG: sin recursos externos, sin red, sin llamadas al motor.
// Cada parte tiene profundidad (z); el render sombrea por bordes y contornea la silueta.

// Un solo tema para todo el panel: cerveza (por defecto), boxeador o el cangrejo original.
export type Estilo = 'cerveza' | 'boxeador' | 'cangrejo'
export const ESTILOS: readonly Estilo[] = ['cerveza', 'boxeador', 'cangrejo']
export const estiloOf = (v: unknown): Estilo => (ESTILOS as readonly unknown[]).includes(v) ? (v as Estilo) : 'cerveza'

type Pt = [number, number]
type Part = { id: string; z: number; base: string; shade?: string; light?: string; line?: string; flat?: boolean; noOutline?: boolean; sep?: boolean }
type Canvas = { W: number; H: number; p: (Part | null)[] }
type Pal = { base: string; shade: string; light: string; line?: string }

const OUT = '#22150e'
const TAU = Math.PI * 2

const canvas = (W: number, H: number): Canvas => ({ W, H, p: new Array<Part | null>(W * H).fill(null) })

function put(c: Canvas, x: number, y: number, part: Part): void {
  if (x < 0 || y < 0 || x >= c.W || y >= c.H) return
  const i = y * c.W + x
  const cur = c.p[i]
  if (!cur || cur.z <= part.z) c.p[i] = part
}

function brush(c: Canvas, x: number, y: number, w: number, part: Part): void {
  if (w <= 1.01) return put(c, Math.floor(x), Math.floor(y), part)
  if (w <= 2.01) {
    const x0 = Math.round(x - 1), y0 = Math.round(y - 1)
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) put(c, x0 + dx, y0 + dy, part)
    return
  }
  const r = w / 2
  for (let py = Math.floor(y - r - 1); py <= Math.ceil(y + r); py++)
    for (let px = Math.floor(x - r - 1); px <= Math.ceil(x + r); px++)
      if ((px + 0.5 - x) ** 2 + (py + 0.5 - y) ** 2 <= r * r + 0.15) put(c, px, py, part)
}

function line(c: Canvas, a: Pt, b: Pt, w: number, part: Part): void {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    brush(c, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, w, part)
  }
}

function poly(c: Canvas, pts: Pt[], part: Part): void {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1])
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      const px = x + 0.5, py = y + 0.5
      let inside = false
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i] ?? [0, 0], [xj, yj] = pts[j] ?? [0, 0]
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
      }
      if (inside) put(c, x, y, part)
    }
}

// Sprite de caracteres → píxeles planos, rotado k cuartos de vuelta y centrado en (cx, cy).
function stamp(c: Canvas, rows: readonly string[], map: Record<string, string>, cx: number, cy: number, z: number, k = 0): void {
  const h = rows.length, w = (rows[0] ?? '').length
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ch = (rows[y] ?? '')[x] ?? '.'
      const col = map[ch]
      if (!col) continue
      let dx = x - (w - 1) / 2, dy = y - (h - 1) / 2
      for (let i = 0; i < ((k % 4) + 4) % 4; i++) [dx, dy] = [dy, -dx]
      put(c, Math.round(cx + dx - 0.01), Math.round(cy + dy - 0.01), { id: 'spr' + ch, z, base: col, flat: true })
    }
}

// Colores finales: sombra abajo/derecha, luz arriba/izquierda, línea interior donde
// una parte cercana pisa a una lejana, contorno alrededor de la silueta.
function render(c: Canvas): (string | null)[] {
  const { W, H, p } = c
  const at = (x: number, y: number): Part | null => (x < 0 || y < 0 || x >= W || y >= H ? null : p[y * W + x] ?? null)
  const out = new Array<string | null>(W * H).fill(null)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const q = at(x, y)
      const around = [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)]
      if (!q) {
        if (around.some(n => n && !n.noOutline)) out[y * W + x] = OUT
        continue
      }
      if (q.flat) { out[y * W + x] = q.base; continue }
      const edge = (n: Part | null) => !n || (n.id !== q.id && n.z < q.z)
      const sep = q.sep && around.some(n => n && n.id !== q.id && n.z < q.z && !n.noOutline)
      out[y * W + x] = sep ? q.line ?? q.shade ?? q.base
        : edge(at(x + 1, y)) || edge(at(x, y + 1)) ? q.shade ?? q.base
        : edge(at(x - 1, y)) || edge(at(x, y - 1)) ? q.light ?? q.base
        : q.base
    }
  return out
}

// Un <path> por color, con tramos horizontales: mucho más corto que un <rect> por tramo.
function toPaths(colors: (string | null)[], W: number, H: number): string {
  const runs = new Map<string, string>()
  for (let y = 0; y < H; y++) {
    let x = 0
    while (x < W) {
      const col = colors[y * W + x]
      if (!col) { x++; continue }
      let e = x + 1
      while (e < W && colors[y * W + e] === col) e++
      runs.set(col, (runs.get(col) ?? '') + `M${x} ${y}h${e - x}v1h-${e - x}z`)
      x = e
    }
  }
  return [...runs].map(([col, d]) => `<path fill="${col}" d="${d}"/>`).join('')
}

const rot = ([x, y]: Pt, a: number): Pt => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]
const add = (a: Pt, b: Pt, k = 1): Pt => [a[0] + b[0] * k, a[1] + b[1] * k]
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
const unit = (a: Pt, b: Pt): Pt => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / d, (b[1] - a[1]) / d] }
const flat = (id: string, z: number, base: string, extra: Partial<Part> = {}): Part => ({ id, z, base, flat: true, noOutline: true, ...extra })
const solid = (id: string, z: number, base: string, shade: string, light: string, extra: Partial<Part> = {}): Part => ({ id, z, base, shade, light, ...extra })

function mix(hex: string, t: number, to = 255): string {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.round(v + (to - v) * t).toString(16).padStart(2, '0')
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`
}

// ---------------------------------------------------------------- boxeador

type Pose = {
  hip: Pt; nk: Pt; headK?: number; flut?: boolean
  shN: Pt; elN: Pt; haN: Pt; shF: Pt; elF: Pt; haF: Pt
  knN: Pt; anN: Pt; toN: Pt; knF: Pt; anF: Pt; toF: Pt
}
type Look = { shorts: readonly [string, string, string]; band: readonly [string, string]; gloves?: boolean }

const SKIN: Pal = { base: '#e2a47a', shade: '#bf7c53', light: '#f3c39d', line: '#a8653f' }
const SKIN_FAR: Pal = { base: '#c4855a', shade: '#a2663e', light: '#d39a72' }
const SHOE: Pal = { base: '#34343e', shade: '#212128', light: '#50505e' }
const GLOVE: Pal = { base: '#d23a30', shade: '#9e2620', light: '#f06a5c', line: '#7c1a16' }
const GLOVE_FAR: Pal = { base: '#a8302a', shade: '#7c1f1a', light: '#c4433a' }
const WAIST: Pal = { base: '#f1f0ea', shade: '#c9c7bd', light: '#ffffff' }
const HEAD = ['..HHHH..', '.HHhHHH.', 'BBBBBBBb', 'HHSSSeSS', 'HsSSSESn', 'HsSSSSSS', '.sSSSmS.', '..sSSS..']

function boxer(c: Canvas, pose: Pose, look: Look): void {
  const P = (id: string, z: number, pal: Pal, extra: Partial<Part> = {}): Part => ({ id, z, ...pal, ...extra })
  const armF = P('armF', 1, SKIN_FAR), legF = P('legF', 2, SKIN_FAR), shoeF = P('shoeF', 2.1, SHOE)
  const shortsF = P('shortsF', 2.5, { base: look.shorts[1], shade: mix(look.shorts[1], 0.22, 0), light: look.shorts[0] })
  const torso = P('torso', 3, SKIN), legN = P('legN', 4, SKIN, { sep: true }), shoeN = P('shoeN', 4.1, SHOE)
  const shorts = P('shorts', 5, { base: look.shorts[0], shade: look.shorts[1], light: look.shorts[2] }, { sep: true })
  const waist = P('waist', 5.5, WAIST), neck = P('neck', 5.8, SKIN), armN = P('armN', 7, SKIN, { sep: true })
  const gloveN = P('gloveN', 8, GLOVE, { sep: true }), gloveF = P('gloveF', 1.5, GLOVE_FAR)

  const { hip, nk } = pose
  const u = unit(hip, nk), v: Pt = [-u[1], u[0]]
  const L = Math.hypot(nk[0] - hip[0], nk[1] - hip[1])
  const T = (t: number, s: number) => add(add(hip, u, L * t), v, s)
  poly(c, [T(0, -1.7), T(0, 1.7), T(0.3, 1.9), T(0.62, 2.7), T(0.85, 2.6), T(1, 1.6), T(1, -2.2), T(0.7, -2.3), T(0.35, -1.8)], torso)

  const leg = (kn: Pt, an: Pt, to: Pt, part: Part, shoe: Part, sh: Part) => {
    line(c, hip, kn, 3, part); line(c, kn, an, 2.2, part); line(c, an, to, 2.2, shoe)
    line(c, hip, lerp(hip, kn, 0.55), 4.2, sh)
  }
  leg(pose.knF, pose.anF, pose.toF, legF, shoeF, shortsF)
  leg(pose.knN, pose.anN, pose.toN, legN, shoeN, shorts)
  brush(c, hip[0], hip[1], 4.6, shorts)
  line(c, T(0.16, -2), T(0.16, 2.1), 1, waist)

  const head = add(nk, u, 4.3)
  line(c, nk, add(nk, u, 1.6), 2.2, neck)
  const k = pose.headK ?? 0
  stamp(c, HEAD, { H: '#2b1b12', h: '#4a3022', B: look.band[0], b: look.band[1], S: '#e8ad84', s: '#c27e55', E: '#151515', e: '#2b1b12', m: '#9a4a3a', n: '#e8ad84' }, head[0], head[1], 6, k)
  const tail = add(add(head, rot([-4.6, -1.6], (k * Math.PI) / 2)), [0, pose.flut ? 1 : 0])
  put(c, Math.round(tail[0]), Math.round(tail[1]), flat('tail', 5.9, look.band[0]))
  put(c, Math.round(tail[0] - Math.cos((k * Math.PI) / 2)), Math.round(tail[1] + (pose.flut ? 0 : 1)), flat('tail', 5.9, look.band[1]))

  const arm = (sh: Pt, el: Pt, ha: Pt, part: Part, glove: Part) => {
    brush(c, sh[0], sh[1], 2.8, part)
    line(c, sh, el, 2.3, part); line(c, el, ha, 2, part)
    if (look.gloves) { brush(c, ha[0], ha[1], 3.8, glove); line(c, lerp(el, ha, 0.7), ha, 2.4, glove) }
    else brush(c, ha[0], ha[1], 2, part)
  }
  arm(pose.shF, pose.elF, pose.haF, armF, gloveF)
  arm(pose.shN, pose.elN, pose.haN, armN, gloveN)
}

function stand(dx = 0, dy = 0): Pose {
  const o = (x: number, y: number): Pt => [x + dx, y + dy]
  return {
    hip: o(15, 21), nk: o(16.2, 12.6),
    shN: o(16.6, 14.3), elN: o(18.6, 18.2), haN: o(20.4, 14.4),
    shF: o(15.6, 14.3), elF: o(14.8, 18.4), haF: o(18.4, 13.6),
    knN: o(16.3, 25.8), anN: o(16, 30.4), toN: o(18.6, 30.6),
    knF: o(14.2, 25.8), anF: o(13.8, 30.4), toF: o(16.4, 30.6),
  }
}

export const BW = 40, BH = 34
const headK = (u: Pt) => ((Math.round(-Math.atan2(u[0], -u[1]) / (Math.PI / 2)) % 4) + 4) % 4
const flutAt = (f: number) => f % 0.34 < 0.17

const EXERCISES: Record<string, (c: Canvas, f: number, look: Look) => void> = {
  cuerda(c, f, look) {
    const j = Math.max(0, Math.sin(TAU * f)) * 2.6
    const bend = (1 - Math.min(1, j / 1.2)) * 0.8
    const p = stand(1, -j)
    p.hip = add(p.hip, [0, bend]); p.knN = add(p.knN, [bend, 0]); p.knF = add(p.knF, [bend, 0])
    const w: Pt = [Math.cos(TAU * f) * 0.6, Math.sin(TAU * f) * 0.6]
    p.elN = [18.6, 18.6 - j]; p.haN = add([20.6, 20.8 - j], w)
    p.elF = [15.6, 18.8 - j]; p.haF = add([14, 20.8 - j], w)
    boxer(c, { ...p, flut: flutAt(f) }, look)
    const cx = 17.2, cy = 17 - j * 0.3, a = TAU * f
    const E = (t: number): Pt => [cx + 10 * Math.cos(t), cy + 15.2 * Math.sin(t)]
    const rope = flat('rope', Math.cos(a) > 0 ? 9 : 0.5, '#3b3b44')
    const seg = (p0: Pt, p1: Pt) => { const n = Math.ceil(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * 2) + 1; for (let i = 0; i <= n; i++) { const q = lerp(p0, p1, i / n); put(c, Math.floor(q[0]), Math.floor(q[1]), rope) } }
    let prev = E(a - 1)
    seg(p.haF, prev)
    for (let i = 1; i <= 24; i++) { const q = E(a - 1 + (2 * i) / 24); seg(prev, q); prev = q }
    seg(prev, p.haN)
    for (const h of [p.haF, p.haN]) put(c, Math.floor(h[0]), Math.floor(h[1]), flat('handle', 9.5, '#d23a30'))
  },
  pera(c, f, look) {
    const p = stand(2, 0)
    const ctr: Pt = [25.2, 9.4], a = TAU * f
    p.haN = add(ctr, [1.4 * Math.cos(a), 1.4 * Math.sin(a)]); p.elN = [22, 13 + 0.5 * Math.sin(a)]
    p.haF = add(ctr, [-0.8 + 1.4 * Math.cos(a + Math.PI), 0.6 + 1.4 * Math.sin(a + Math.PI)]); p.elF = [20.6, 13.8]
    boxer(c, { ...p, flut: flutAt(f) }, { ...look, gloves: true })
    line(c, [23, 1], [38, 1], 2, solid('board', 3, '#7a5434', '#5a3c24', '#9a7048'))
    const sway = 1.3 * Math.sin(2 * TAU * f)
    line(c, [31, 2.5], [31 + sway * 0.4, 4], 1, solid('swivel', 3.2, '#8a8a92', '#66666e', '#a8a8b0'))
    brush(c, 31 + sway, 6.6, 4.6, solid('bag', 3.1, '#b2402f', '#842d21', '#d4604c'))
  },
  saco(c, f, look) {
    const p = stand(0, 0)
    const e = f < 0.25 ? Math.sin(((f / 0.25) * Math.PI) / 2) : f < 0.42 ? 1 : f < 0.7 ? 1 - (f - 0.42) / 0.28 : 0
    p.haN = lerp([20.4, 14.4], [27.4, 15], e); p.elN = lerp([18.6, 18.2], [23.8, 15.4], e)
    boxer(c, { ...p, flut: flutAt(f) }, { ...look, gloves: true })
    const ang = f >= 0.25 ? -0.12 * Math.sin(Math.PI * Math.min(1, (f - 0.25) / 0.75)) : 0
    const piv: Pt = [32.5, 0], R = (q: Pt) => add(piv, rot(q, ang))
    line(c, R([0, 0]), R([0, 4]), 1, solid('chain', 2.7, '#8e8e96', '#6a6a72', '#b0b0b8'))
    poly(c, ([[-2, 4], [2, 4], [3, 5], [3, 23], [2, 24], [-2, 24], [-3, 23], [-3, 5]] as Pt[]).map(R), solid('bag', 2.8, '#6e4b36', '#4f3324', '#8d644b'))
    for (const y of [7, 21]) line(c, R([-3, y]), R([3, y]), 1, solid('strap', 2.9, '#3e281b', '#2c1c12', '#55392a'))
    if (f >= 0.25 && f < 0.42) for (const s of [[28.6, 12.6], [29.4, 16.6], [27.4, 11.4]] as Pt[]) put(c, Math.floor(s[0]), Math.floor(s[1]), flat('spark', 10, '#fff2a8'))
  },
  flexiones(c, f, look) {
    const d = (1 - Math.cos(TAU * f)) / 2
    const nk = lerp([28, 19.4], [28, 24.4], d), an: Pt = [6.6, 30.2]
    const shN = add(nk, [-0.6, 1.4]), haN: Pt = [29, 31], shF = add(shN, [-1, 0])
    boxer(c, {
      hip: lerp(an, nk, 0.46), nk, headK: 0, flut: flutAt(f),
      knN: lerp(an, nk, 0.22), anN: an, toN: [4.6, 31.2],
      knF: add(lerp(an, nk, 0.22), [-0.4, 0]), anF: [5.6, 30.4], toF: [3.6, 31.2],
      shN, haN, elN: lerp(lerp(shN, haN, 0.5), [25, 25.4], d),
      shF, haF: [27.4, 31], elF: lerp(lerp(shF, [27.4, 31], 0.5), [23.6, 25.6], d),
    }, look)
  },
  abdominales(c, f, look) {
    const d = (1 - Math.cos(TAU * f)) / 2
    const hip: Pt = [18.4, 29.2], nk = lerp([9.8, 29.2], [14.6, 20.8], d)
    const u = unit(hip, nk), v: Pt = [-u[1], u[0]]
    const shN = lerp(hip, nk, 0.9)
    boxer(c, {
      hip, nk, headK: headK(u), flut: flutAt(f),
      knN: [22.8, 24.6], anN: [25.8, 29.8], toN: [28.2, 30.6],
      knF: [21.8, 24.9], anF: [24.8, 29.8], toF: [27.2, 30.6],
      shN, elN: add(add(nk, u, 2.4), v, -2.8), haN: add(add(nk, u, 4), v, 1.2),
      shF: shN, elF: add(add(nk, u, 2), v, -2.2), haF: add(add(nk, u, 3.6), v, 1.4),
    }, look)
  },
  correr(c, f, look) {
    const a = TAU * f
    const hip: Pt = [16, 20.8 - 0.8 * Math.abs(Math.sin(a))]
    const nk = add(hip, rot([0, -8.5], 0.2))
    const th = 0.75 * Math.sin(a)
    const leg = (t: number, b: number): [Pt, Pt, Pt] => {
      const kn = add(hip, [Math.sin(t) * 4.8, Math.cos(t) * 4.8])
      const an = add(kn, [Math.sin(t - b) * 4.4, Math.cos(t - b) * 4.4])
      return [kn, an, add(an, [2.3, 0.3])]
    }
    const [knN, anN, toN] = leg(th, 0.35 + 1.2 * Math.max(0, Math.cos(a)))
    const [knF, anF, toF] = leg(-th, 0.35 + 1.2 * Math.max(0, -Math.cos(a)))
    const arm = (sh: Pt, al: number): [Pt, Pt] => {
      const dir: Pt = [Math.sin(al), Math.cos(al)], el = add(sh, dir, 3.6)
      return [el, add(el, rot(dir, -1.45), 3)]
    }
    const shN = lerp(hip, nk, 0.86), shF = add(shN, [-1, 0])
    const [elN, haN] = arm(shN, -0.9 * Math.sin(a)), [elF, haF] = arm(shF, 0.9 * Math.sin(a))
    boxer(c, { hip, nk, knN, anN, toN, knF, anF, toF, shN, elN, haN, shF, elF, haF, flut: flutAt(f) }, look)
    for (const [x, y, w] of [[2, 11, 5], [1, 15, 6], [3, 19, 4]] as const) for (let i = 0; i < w; i++) put(c, x + i, y, flat('wind', 0.2, 'rgba(150,150,150,.55)'))
  },
  pesas(c, f, look) {
    const d = (1 - Math.cos(TAU * f)) / 2
    const hip = lerp([15, 21], [11.6, 26.2], d), nk = lerp([16.2, 12.6], [17, 18.8], d)
    const knN = lerp([16.3, 25.8], [18.4, 26.4], d)
    const shN = lerp(hip, nk, 0.88), bar = add(nk, [-2.8, 2.4])
    const haN = add(nk, [0.6, 2.6]), elN = add(lerp(shN, haN, 0.5), [0.6, 2.6])
    boxer(c, {
      hip, nk, knN, anN: [16, 30.4], toN: [18.6, 30.6], knF: add(knN, [-1.4, 0]), anF: [14.4, 30.4], toF: [17, 30.6],
      shN, elN, haN, shF: add(shN, [-1, 0]), elF: add(elN, [-1, 0]), haF: add(haN, [-0.6, 0]), flut: flutAt(f),
    }, look)
    brush(c, bar[0], bar[1], 6.6, solid('plate', 9, '#30323a', '#1c1e23', '#5a5e68'))
    brush(c, bar[0], bar[1], 2, flat('hub', 9.5, '#9a9da6', { noOutline: false }))
  },
}
export const EXERCISE_ORDER = ['cuerda', 'pera', 'saco', 'flexiones', 'abdominales', 'correr', 'pesas'] as const

export function boxerFrame(kind: string, f: number, look: Look, sweat: boolean): (string | null)[] {
  const c = canvas(BW, BH)
  if (kind === 'correr') {
    for (let k = 0; k < 8; k++) {
      const x0 = Math.round((((k * 7 - f * 14) % 42) + 42) % 42) - 2
      for (let i = 0; i < 3; i++) put(c, x0 + i, 32, flat('road', 0.1, 'rgba(0,0,0,.22)'))
    }
  } else for (let x = 0; x < BW; x++) put(c, x, 32, flat('ground', 0.1, 'rgba(0,0,0,.16)'))
  EXERCISES[kind]?.(c, f, look)
  if (sweat) put(c, 21, 6 + Math.floor(f * 6), flat('sweat', 10, '#7cc7f0'))
  return render(c)
}

// ---------------------------------------------------------------- cerveza

export const CW = 32, CH = 30
type Row = [y: number, a: number, b: number]
const rng = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
const CONTAINERS: Record<string, { rows: Row[]; wall: number; handle?: 'mug' | 'big'; dimples?: boolean }> = {
  vaso: { rows: rng(12, 26).map((y): Row => [y, 9, 20]), wall: 1 },
  pinta: { rows: rng(5, 26).map((y): Row => { const e = Math.round((26 - y) / 8); const b = y >= 7 && y <= 9 ? 1 : 0; return [y, 10 - e - b, 19 + e + b] }), wall: 1 },
  jarra: { rows: rng(8, 26).map((y): Row => [y, 8, 20]), wall: 1, handle: 'mug' },
  tradicional: { rows: rng(8, 26).map((y): Row => [y, 8, 20]), wall: 2, handle: 'big', dimples: true },
}

type BeerPal = readonly [string, string, string, boolean?]

export function beerFrame(kind: string, pal: BeerPal, level: number, tick: number, state: 'run' | 'done' | 'fail'): (string | null)[] {
  const c = canvas(CW, CH)
  const C = CONTAINERS[kind] ?? CONTAINERS.jarra!
  const rows = C.rows, first = rows[0]!, last = rows[rows.length - 1]!
  const top = first[0], bottom = last[0]
  const failed = state === 'fail'
  const glass = failed ? solid('glass', 5, '#b4b4b4', '#8e8e8e', '#d2d2d2') : solid('glass', 5, '#cfe2ea', '#97b5c4', '#f2f9fc')
  const base = failed ? solid('base', 5, '#a6a6a6', '#828282', '#c4c4c4') : solid('base', 5, '#bcd3dd', '#8eadbc', '#e3f0f5')
  rows.forEach(([y, a, b], i) => {
    for (let x = a; x <= b; x++) put(c, x, y, flat('air', 1, 'rgba(214,232,240,.22)', { noOutline: false }))
    for (let w = 1; w <= C.wall; w++) { put(c, a - w, y, glass); put(c, b + w, y, glass) }
    const prev = rows[i - 1]
    if (prev) {
      const [, pa, pb] = prev
      for (let x = Math.min(a, pa) - 1; x <= Math.max(a, pa) - 1; x++) put(c, x, y, glass)
      for (let x = Math.min(b, pb) + 1; x <= Math.max(b, pb) + 1; x++) put(c, x, y, glass)
    }
  })
  const [, a0, b0] = last
  for (let y = bottom + 1; y <= bottom + 2; y++) for (let x = a0 - C.wall; x <= b0 + C.wall; x++) put(c, x, y, base)
  if (C.handle === 'mug') { line(c, [21, 11], [26, 11], 2, glass); line(c, [26.4, 11], [26.4, 22], 2, glass); line(c, [21, 22], [26, 22], 2, glass) }
  if (C.handle === 'big') { line(c, [22, 10.6], [27.4, 10.6], 2.4, glass); line(c, [28, 11], [28, 22.4], 2.6, glass); line(c, [22, 22.6], [27.4, 22.6], 2.4, glass) }

  if (failed) {
    for (const [x, y] of [[13, 13], [14, 14], [14, 15], [13, 16], [14, 17], [15, 18]] as const) put(c, x, y, flat('crack', 7, '#5a5a5a'))
    for (let x = a0 - 3; x <= a0 + 3; x++) put(c, x, bottom + 3, flat('puddle', 0.5, 'rgba(120,120,120,.35)'))
    return render(c)
  }

  const lv = Math.max(0, Math.min(1, level))
  const filled = Math.round(lv * (rows.length - 3))
  const liqTop = bottom - filled + 1
  for (const [y, a, b] of rows) {
    if (y < liqTop) continue
    const depth = (y - liqTop) / Math.max(1, bottom - liqTop)
    const col = depth > 0.62 ? pal[1] : depth < 0.12 ? mix(pal[0], 0.18) : pal[0]
    for (let x = a; x <= b; x++) put(c, x, y, flat('beer', 2, x === a + 1 ? mix(col, 0.25) : x === b ? mix(col, 0.25, 0) : col))
  }
  if (filled > 2) for (const [k, dx] of [[0, 2], [1, 5], [2, 8], [3, 10]] as const) put(c, a0 + dx, bottom - ((tick * 2 + k * 3) % Math.max(1, filled - 1)), flat('bub', 3, mix(pal[0], 0.55)))
  if (pal[3] && filled > 2) ([[a0 + 3, bottom - 2], [a0 + 7, bottom - 5], [a0 + 5, bottom - 8], [a0 + 10, bottom - 3]] as Pt[]).forEach(([x, y], i) => {
    if ((tick + i) % 2 === 0 && y >= liqTop) put(c, x, y, flat('spark', 3.1, '#fffbe0'))
  })

  const over = state === 'done' || lv >= 1
  if (filled > 0 || over) {
    const fTop = over ? top - 3 : liqTop - 3
    const rowAt = (y: number): Row => rows.find(r => r[0] === y) ?? [y, first[1], first[2]]
    const foam = flat('foam', 4, pal[2], { noOutline: false })
    const end = over ? top : liqTop
    for (let y = fTop; y < end; y++) { const [, a, b] = rowAt(Math.max(y, top)); for (let x = a; x <= b; x++) put(c, x, y, y === end - 1 ? { ...foam, base: mix(pal[2], 0.1, 0) } : foam) }
    const [, ta, tb] = rowAt(top)
    for (let x = ta; x <= tb; x++) if ((x * 7 + 3) % 5 < 3) put(c, x, fTop - 1, foam)
    for (let x = ta + 1; x <= tb; x += 3) put(c, x, fTop + 1, flat('fb', 4.1, '#ffffff', { noOutline: false }))
    if (over) {
      const drop = tick % 6
      for (const [x, len] of [[ta - C.wall - 1, 3 + drop], [tb + C.wall + 1, 2 + ((drop + 3) % 6)]] as const) for (let i = 0; i < len; i++) put(c, x, top - 1 + i, foam)
    }
  }
  for (let y = top + 2; y <= bottom - 3; y++) if (y % 7 !== 0) put(c, first[1] + 1 + (kind === 'pinta' ? 1 : 0), y, flat('shine', 6, 'rgba(255,255,255,.45)'))
  if (C.dimples) for (let y = top + 2; y <= bottom - 3; y += 4) for (let x = a0 + 2; x <= b0 - 2; x += 4) { put(c, x, y, flat('dim', 6, 'rgba(255,255,255,.55)')); put(c, x + 1, y + 1, flat('dim2', 6, 'rgba(0,40,60,.18)')) }
  return render(c)
}

// ---------------------------------------------------------------- qué dibujar para un agente

const MODELS = ['haiku', 'sonnet', 'opus', 'fable'] as const
type ModelKey = (typeof MODELS)[number] | 'otro'
const modelKey = (id: string): ModelKey => MODELS.find(m => id.toLowerCase().includes(m)) ?? 'otro'
type TypeKey = 'explore' | 'plan' | 'general' | 'otro'
const typeKey = (t: string): TypeKey => {
  const bare = t.replace(/^[^:]*:/, '').toLowerCase()
  return bare === 'explore' ? 'explore' : bare === 'plan' ? 'plan' : bare === 'general-purpose' || bare === 'claude' ? 'general' : 'otro'
}

export const BEERS: Record<ModelKey, BeerPal> = {
  otro: ['#efcf7e', '#d6b05a', '#fffdf2'], haiku: ['#f6c94a', '#dca52a', '#fffef8'], sonnet: ['#c4602a', '#963f1a', '#f6e6c8'],
  opus: ['#3a2418', '#1f120b', '#e0c49a'], fable: ['#f8d866', '#e4b53a', '#ffffff', true],
}
export const SHORTS: Record<ModelKey, readonly [string, string, string]> = {
  otro: ['#9097a1', '#6f7680', '#b5bcc5'], haiku: ['#3fae64', '#2b8049', '#6fd08f'], sonnet: ['#3a7be0', '#2a5bb0', '#6fa2f2'],
  opus: ['#8a55d6', '#6a3fae', '#ad82ee'], fable: ['#e0b030', '#b58a1f', '#f6d36a'],
}
export const BANDS: Record<TypeKey, readonly [string, string]> = {
  explore: ['#2aa598', '#1c7b71'], plan: ['#e09a2e', '#b0761d'], general: ['#8b62d8', '#6a47ad'], otro: ['#c23a30', '#922a22'],
}
export const CONTAINER_OF: Record<TypeKey, string> = { explore: 'vaso', plan: 'pinta', general: 'jarra', otro: 'tradicional' }

// level (0..1) fija el nivel de la cerveza; sin él sale de las peticiones al modelo.
export type SpriteInput = { type: string; model: string; status: string; steps: number; ctx: number; order: number; level?: number }

// Nivel de la cerveza: rápido al principio y frenando (3 peticiones ≈ media jarra, 10 ≈ 9/10);
// al terminar, llena y desbordando, aunque la tarea haya sido corta.
export const beerLevel = (steps: number, done: boolean): number => (done ? 1 : 1 - Math.exp(-Math.max(0, steps) / 4.5))
// Caja donde va la figura: se centra a lo ancho y se apoya en el borde inferior.
export type Place = { x: number; y: number; w: number; h: number; scale: number; rtl: boolean; animate: boolean }

// Cada cuadro se muestra 1/N del ciclo de 1 s. El retraso negativo ata la fase al reloj:
// la fila se redibuja cada segundo y la animación sigue donde iba.
export const SPRITE_CSS = `<style>.sf{opacity:0}
@keyframes sf6{0%{opacity:1}16.667%,100%{opacity:0}}@keyframes sf3{0%{opacity:1}33.333%,100%{opacity:0}}
@media (prefers-reduced-motion: reduce){.sf{animation:none!important;opacity:0}.sf.f0{opacity:1}}</style>`

const PERIOD = 1000

function frames(list: (string | null)[][], w: number, h: number, at: number, animate: boolean, key: string): string {
  const n = list.length
  if (!animate || n === 1) {
    const k = n === 1 ? 0 : Math.floor(((at % PERIOD) / PERIOD) * n) % n
    return toPaths(list[k] ?? [], w, h)
  }
  return list.map((colors, k) => {
    const delay = Math.round(((k / n - 1) * PERIOD) - (at % PERIOD))
    return `<g class="sf${k === 0 ? ' f0' : ''}" style="animation:${key} ${PERIOD}ms steps(1,end) infinite;animation-delay:${delay}ms">${toPaths(colors, w, h)}</g>`
  }).join('')
}

// La figura de un agente como grupo SVG listo para insertar, o null para el cangrejo original.
export function sprite(inp: SpriteInput, estilo: Estilo, at: number, place: Place): string | null {
  const kind = estilo
  if (kind === 'cangrejo') return null
  const m = modelKey(inp.model), t = typeKey(inp.type)
  const live = inp.status === 'running'
  const { x, y, scale, rtl } = place
  let body: string, w: number, h: number
  if (kind === 'cerveza') {
    w = CW; h = CH
    const state = inp.status === 'failed' ? 'fail' : inp.status === 'done' ? 'done' : 'run'
    const level = state === 'done' ? 1 : inp.level ?? beerLevel(inp.steps, false)
    const list = state === 'fail' ? [beerFrame(CONTAINER_OF[t], BEERS[m], 0, 0, 'fail')]
      : [0, 1, 2].map(tick => beerFrame(CONTAINER_OF[t], BEERS[m], level, tick, state))
    body = frames(list, w, h, at, place.animate && state !== 'fail', 'sf3')
  } else {
    w = BW; h = BH
    // El ejercicio rota por orden de llegada: cuerda, pera, saco, flexiones, abdominales, correr, pesas.
    const ex = EXERCISE_ORDER[inp.order % EXERCISE_ORDER.length] ?? 'cuerda'
    const look: Look = { shorts: SHORTS[m], band: BANDS[t] }
    const sweat = live && inp.ctx > 70
    const list = live ? Array.from({ length: 6 }, (_, k) => boxerFrame(ex, k / 6, look, sweat)) : [boxerFrame(ex, 0, look, false)]
    body = frames(list, w, h, at, place.animate && live, 'sf6')
  }
  const ox = x + Math.round((place.w - w * scale) / 2), oy = y + Math.round(place.h - h * scale)
  const tx = rtl ? ox + w * scale : ox
  return `<g data-estilo="${kind}" transform="translate(${tx} ${oy}) scale(${rtl ? -scale : scale} ${scale})" opacity="${inp.status === 'failed' && kind === 'boxeador' ? 0.45 : 1}" shape-rendering="crispEdges">${body}</g>`
}
