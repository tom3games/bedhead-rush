// 寝癖なおし3分前 / BEDHEAD RUSH
// 3D の洗面所の鏡に映った自分の頭。跳ねた毛束（折れ曲がる棒の連なり）を、くし・ドライヤー・霧吹き・ワックスで直す。
// 時間は固定60Hz（performance.now で数える）。ロジックは頭のローカル座標で完結し、描画とは独立（bot で一気に回せる）
import * as THREE from './vendor/three.module.js'
if (!CanvasRenderingContext2D.prototype.roundRect) CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); this.moveTo(x + r, y); this.arcTo(x + w, y, x + w, y + h, r); this.arcTo(x + w, y + h, x, y + h, r); this.arcTo(x, y + h, x, y, r); this.arcTo(x, y, x + w, y, r); this.closePath() }

const D = window.BH_DATA, Snd = window.Snd
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)]
const DT = 1 / 60, V3 = THREE.Vector3
const clamp = (v, a, b) => v < a ? a : v > b ? b : v
const lerp = (a, b, k) => a + (b - a) * k
const isTouch = matchMedia('(pointer:coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0)
const store = { get(k, d) { try { const v = localStorage.getItem('bh.' + k); return v == null ? d : v } catch (e) { return d } }, set(k, v) { try { localStorage.setItem('bh.' + k, v) } catch (e) {} } }
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
if (isTouch) document.body.classList.remove('pc'); else document.body.classList.add('pc')

// ---------- 状態
const S = {
  lang: store.get('lang', (navigator.language || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en'),
  muted: store.get('mute', '0') === '1',
  view: 'title', t: 0, simT: 0, seed: 1, rng: Math.random, bot: null, botState: null, dbgPause: false, sim: false, tut: false,
  tool: 0, plugged: true, jar: 1, strands: [], ev: null, cat: null, stats: null, result: null, face: 'sleep', faceTmp: null, hurry: false, said: {},
}
const inp = { down: false, B: new V3(), V: new V3(0, 0, -1), moveAcc: 0, pressT: 0, tapCat: false, plug: false, leave: false, sx: -1, sy: -1, over: false }
const T = k => D.TXT[S.lang][k] ?? k
const EYE = new V3(0, 0.25, 1).normalize().multiplyScalar(8) // ロジック用の仮想の目（頭のローカル座標）

// ---------- 描画の土台
const canvas = $('#gl'), fxc = $('#fx'), fx = fxc.getContext('2d')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.5 : 2))
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xdfeee9)
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120)
const hemi = new THREE.HemisphereLight(0xfff4e0, 0x8a96a8, 1.7); scene.add(hemi)
const sun = new THREE.DirectionalLight(0xfff0d0, 1.6); sun.position.set(5, 7, 6); scene.add(sun)
const rim = new THREE.DirectionalLight(0xbfe4ff, 0.6); rim.position.set(-6, 3, -4); scene.add(rim)

function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]) }
  return t
}
const lam = (color, o = {}) => new THREE.MeshLambertMaterial({ color, ...o })
const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m }

// ---------- 洗面所（鏡の中の背景）
const room = new THREE.Group(); scene.add(room)
{
  const tile = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#d6efe8'; x.fillRect(0, 0, w, h); x.strokeStyle = '#b4d6cd'; x.lineWidth = 6; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h); x.stroke(); x.beginPath(); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke() } x.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) x.fillRect(i * 64 + 8, j * 64 + 8, 18, 6) }, [10, 6])
  mesh(new THREE.PlaneGeometry(40, 24), lam(0xffffff, { map: tile }), 0, 2, -4.2, room)
  // 窓（朝日）
  const win = canvasTex(256, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#fff7d6'); g.addColorStop(1, '#ffd98a'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.beginPath(); x.arc(180, 70, 34, 0, 7); x.fill(); x.fillStyle = '#e9d3a0'; x.fillRect(122, 0, 12, h); x.fillRect(0, 122, w, 12) })
  mesh(new THREE.BoxGeometry(3.6, 3.2, 0.2), lam(0xf4efe4), 4.6, 3.1, -4.1, room)
  mesh(new THREE.PlaneGeometry(3.1, 2.7), new THREE.MeshBasicMaterial({ map: win }), 4.6, 3.1, -3.98, room)
  // ドア
  mesh(new THREE.BoxGeometry(3.2, 7, 0.2), lam(0xc98f5a), -5.2, 0.6, -4.1, room)
  mesh(new THREE.BoxGeometry(2.6, 2.4, 0.06), lam(0xb57c4a), -5.2, 2.2, -3.98, room)
  mesh(new THREE.BoxGeometry(2.6, 2.4, 0.06), lam(0xb57c4a), -5.2, -0.8, -3.98, room)
  mesh(new THREE.SphereGeometry(0.16, 10, 8), lam(0xe8c35a), -4.1, 0.6, -3.9, room)
  // タオル掛け
  mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), lam(0xcfcfcf), 3.4, 0.6, -4.0, room).rotation.z = Math.PI / 2
  const towel = mesh(new THREE.BoxGeometry(1.8, 2.2, 0.12), lam(0xff9a8a), 3.4, -0.5, -3.95, room)
  mesh(new THREE.BoxGeometry(1.8, 0.18, 0.14), lam(0xffffff), 3.4, -1.1, -3.9, room); towel.rotation.z = 0.04
  // 棚とボトル
  mesh(new THREE.BoxGeometry(3.4, 0.14, 0.7), lam(0xffffff), -2.6, 3.0, -3.8, room)
  ;[[0x7fd4f5, -3.7], [0xffcf33, -3.0], [0xff8fb1, -2.3], [0x58d68d, -1.6]].forEach(([c, x], i) => { mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.6 + (i % 2) * 0.3, 10), lam(c), x, 3.35 + (i % 2) * 0.15, -3.7, room) })
  // 天井の照明
  mesh(new THREE.BoxGeometry(4, 0.3, 0.5), new THREE.MeshBasicMaterial({ color: 0xfffbe8 }), 0, 6.6, -3.7, room)
}
// 洗面台（手前）
const counter = new THREE.Group(); scene.add(counter)
const props = []
{
  const top = mesh(new THREE.BoxGeometry(12, 0.5, 2.6), lam(0xf6f2ea), 0, -2.35, 1.1, counter)
  mesh(new THREE.BoxGeometry(12, 3, 2.4), lam(0x9ac7d6), 0, -4.1, 1.1, counter)
  mesh(new THREE.CylinderGeometry(1.3, 1.1, 0.12, 24), lam(0xdfe8ec), 0, -2.08, 1.3, counter)
  const fau = mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.7, 10), lam(0xc8ced6), 0, -1.8, 0.3, counter)
  mesh(new THREE.BoxGeometry(0.16, 0.12, 0.7), lam(0xc8ced6), 0, -1.48, 0.6, counter)
  // コップと歯ブラシ
  mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.6, 12), lam(0x7fb8ff, { transparent: true, opacity: 0.85 }), -2.4, -1.8, 1.2, counter)
  const tb = mesh(new THREE.BoxGeometry(0.08, 1, 0.08), lam(0x58d68d), -2.3, -1.3, 1.2, counter); tb.rotation.z = -0.25
  // 道具（選んでいる道具は手に持っているので台から消える）
  const comb = new THREE.Group(); mesh(new THREE.BoxGeometry(1.0, 0.18, 0.12), lam(0xff8fb1), 0, 0, 0, comb); for (let i = 0; i < 8; i++) mesh(new THREE.BoxGeometry(0.04, 0.22, 0.08), lam(0x2a2233), -0.42 + i * 0.12, -0.18, 0, comb)
  comb.position.set(1.7, -2.0, 1.9); comb.rotation.x = -1.2; counter.add(comb)
  const dry = new THREE.Group(); mesh(new THREE.SphereGeometry(0.36, 14, 10), lam(0x3f7cff), 0, 0, 0, dry); mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.7, 12), lam(0x9fb4d8), -0.45, 0, 0, dry).rotation.z = Math.PI / 2; mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 10), lam(0x3f7cff), 0.1, -0.4, 0, dry).rotation.z = 0.3
  dry.position.set(3.6, -1.75, 1.0); dry.rotation.y = 0.5; counter.add(dry)
  const spray = new THREE.Group(); mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.9, 12), lam(0x7fd4f5), 0, 0, 0, spray); mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), lam(0xffffff), 0, 0.6, 0, spray); mesh(new THREE.BoxGeometry(0.3, 0.1, 0.12), lam(0xffffff), 0.15, 0.72, 0, spray)
  spray.position.set(-3.6, -1.65, 1.0); counter.add(spray)
  const wax = new THREE.Group(); mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.32, 14), lam(0xffcf33), 0, 0, 0, wax); mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 14), lam(0x2a2233), 0, 0.2, 0, wax)
  wax.position.set(2.6, -1.95, 1.6); counter.add(wax)
  props.push(comb, dry, spray, wax)
}

// ---------- 自分（頭・顔・パジャマ）
const head = new THREE.Group(); scene.add(head)
const SKIN = 0xf6c9a0
const skinM = lam(SKIN), darkM = lam(0x2a1c16), whiteM = lam(0xffffff)
const HS = new V3(0.94, 1.04, 0.92) // 頭の楕円率
const face = mesh(new THREE.SphereGeometry(1, 28, 20), skinM, 0, 0, 0, head); face.scale.copy(HS)
const capGeo = new THREE.SphereGeometry(1.07, 28, 14, 0, Math.PI * 2, 0, 1.38)
const cap = mesh(capGeo, lam(0x3b2a20, { flatShading: true }), 0, 0, 0, head); cap.scale.copy(HS); cap.rotation.x = -0.3
for (const sx of [-1, 1]) {
  const ear = mesh(new THREE.SphereGeometry(0.2, 12, 8), skinM, sx * 0.9, -0.02, 0, head); ear.scale.set(0.5, 1, 0.8)
}
mesh(new THREE.SphereGeometry(0.13, 12, 8), skinM, 0, -0.1, 0.92, head).scale.set(1, 0.9, 1.1)
const blushM = new THREE.MeshBasicMaterial({ color: 0xff8f8f, transparent: true, opacity: 0.45, depthWrite: false })
for (const sx of [-1, 1]) { const b = mesh(new THREE.CircleGeometry(0.12, 14), blushM, sx * 0.52, -0.22, 0.79, head); b.rotation.y = sx * 0.55 }
const eyes = [], pupils = [], lids = [], brows = []
for (const sx of [-1, 1]) {
  const e = mesh(new THREE.SphereGeometry(0.16, 14, 10), whiteM, sx * 0.32, 0.1, 0.8, head); e.scale.z = 0.6; eyes.push(e)
  const p = mesh(new THREE.SphereGeometry(0.075, 10, 8), darkM, sx * 0.32, 0.1, 0.885, head); pupils.push(p)
  const l = mesh(new THREE.BoxGeometry(0.26, 0.028, 0.03), darkM, sx * 0.32, 0.08, 0.9, head); lids.push(l)
  const b = mesh(new THREE.BoxGeometry(0.26, 0.055, 0.05), darkM, sx * 0.32, 0.37, 0.87, head); brows.push(b)
}
const mouth = new THREE.Group(); mouth.position.set(0, -0.42, 0.85); head.add(mouth)
const mSmile = mesh(new THREE.TorusGeometry(0.13, 0.03, 6, 14, Math.PI), darkM, 0, 0.06, 0, mouth); mSmile.rotation.z = Math.PI
const mOpen = mesh(new THREE.SphereGeometry(0.15, 14, 10), lam(0x7a2430), 0, 0, -0.02, mouth); mOpen.scale.set(1, 0.8, 0.35)
const mLine = mesh(new THREE.BoxGeometry(0.2, 0.03, 0.03), darkM, 0, 0, 0, mouth)
const sweat = mesh(new THREE.SphereGeometry(0.08, 10, 8), lam(0x9fd8ff, { transparent: true, opacity: 0.9 }), 0.72, 0.48, 0.58, head); sweat.scale.y = 1.5
const tears = [-1, 1].map(sx => mesh(new THREE.SphereGeometry(0.05, 8, 6), lam(0x6ec3ff), sx * 0.34, -0.06, 0.86, head))
// 首とパジャマ
const pj = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#e8f0ff'; x.fillRect(0, 0, w, h); x.fillStyle = '#7b9cff'; for (let i = 0; i < 4; i++) x.fillRect(i * 32 + 4, 0, 12, h) }, [6, 2])
const neck = mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.8, 14), skinM, 0, -1.15, -0.05)
const body = mesh(new THREE.SphereGeometry(1, 24, 14), lam(0xffffff, { map: pj }), 0, -2.25, -0.15); body.scale.set(1.8, 0.95, 0.95)
const collar = mesh(new THREE.TorusGeometry(0.46, 0.1, 8, 18), lam(0xffffff), 0, -1.45, -0.05); collar.rotation.x = Math.PI / 2 - 0.25

// ---------- 毛束（折れ曲がる棒の連なり）。描画は InstancedMesh 2つ（棒と関節）
const MAXS = 24, NSEG = 5
const segGeo = new THREE.CylinderGeometry(0.7, 1, 1, 6, 1); segGeo.translate(0, 0.5, 0)
const jointGeo = new THREE.SphereGeometry(1, 7, 5)
const hairM = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true })
const segIM = new THREE.InstancedMesh(segGeo, hairM, MAXS * NSEG), jointIM = new THREE.InstancedMesh(jointGeo, hairM, MAXS * NSEG)
segIM.frustumCulled = jointIM.frustumCulled = false
head.add(segIM, jointIM)
const C_BASE = new THREE.Color(0x3b2a20), C_WET = new THREE.Color(0x150d09), C_HOT = new THREE.Color(0xd8471c), C_WAX = new THREE.Color(0x9c7650), C_FRIZZ = new THREE.Color(0x7a5236)

// 頭皮の上の点（楕円に合わせる）
const capPoint = (u, r = 1.03) => new V3(u.x * HS.x * r, u.y * HS.y * r, u.z * HS.z * r)
const UP = new V3(0, 1, 0)
function tangentOf(u, v) { return v.clone().sub(u.clone().multiplyScalar(u.dot(v))) }
function makeStrand(u, rng, o = {}) {
  u = u.clone().normalize()
  const segL = o.segL || 0.27, n = NSEG
  let f0 = tangentOf(u, new V3(u.x * 0.6, -0.4, -1)); if (f0.length() < 0.2) f0 = tangentOf(u, new V3(0, -1, 0)); f0.normalize() // とかすと後ろへ流れる
  const ax = u.clone().cross(f0).normalize()
  const flat = []; for (let i = 0; i < n; i++) flat.push(f0.clone().applyAxisAngle(ax, (i + 0.6) * segL / 1.05))
  // 跳ねた形: 外向きに倒した軸から、ジグザグに折れる
  const tt = tangentOf(u, new V3(rng() * 2 - 1, 0.9 + (u.z > 0.4 ? 0.8 : 0), rng() * 2 - 1)); if (tt.length() < 0.05) tt.set(1, 0, 0); tt.normalize()
  const tilt = o.ahoge ? 0.15 : 0.25 + rng() * 0.55
  const base = u.clone().multiplyScalar(Math.cos(tilt)).add(tt.clone().multiplyScalar(Math.sin(tilt))).normalize()
  const kAx = base.clone().cross(new V3(rng() - 0.5, rng() - 0.5, rng() - 0.5)).normalize()
  const amp = 0.65 + rng() * 0.5, sg = rng() < 0.5 ? 1 : -1
  const kinks = o.ahoge ? [0, 0.05, 0.1, 1.1, 1.0] : [0.1, 0.9, -1.5, 1.4, -1.1]
  const messy = []; let cum = 0; for (let i = 0; i < n; i++) { cum += kinks[i] * amp * sg; messy.push(base.clone().applyAxisAngle(kAx, cum)) }
  const pts = []; for (let i = 0; i <= n; i++) pts.push(new V3())
  return { id: S.strands.length, u, n, segL, r0: o.ahoge ? 0.045 : 0.12 + rng() * 0.03, flat, messy, m: o.m ?? 1, mv: o.m ?? 1, vel: 0, wet: 0, set: 0, heat: 0, wax: 0, frizz: 0, ahoge: !!o.ahoge, pts, sway: 0, hot: false, popT: 0 }
}
const ANCHORS = (() => {
  const a = [[0.12, 0]]
  for (const b of [-140, -95, -48, 0, 48, 95, 140]) a.push([0.48, b])
  for (const b of [-120, -75, -30, 30, 75, 120]) a.push([0.9, b])
  for (const b of [-95, 95]) a.push([1.3, b])
  return a.map(([p, b]) => { const r = b * Math.PI / 180; return new V3(Math.sin(p) * Math.sin(r), Math.cos(p), Math.sin(p) * Math.cos(r)) })
})()
const _d = new V3(), _a = new V3(), _b = new V3()
function poseStrand(s) {
  const k = clamp(s.mv, 0, 1.3)
  const p0 = s.pts[0].copy(capPoint(s.u, 0.99))
  for (let i = 0; i < s.n; i++) {
    _d.copy(s.flat[i]).multiplyScalar(1 - Math.min(k, 1)).addScaledVector(s.messy[i], k)
    if (s.frizz > 0.05) { const ph = S.simT * 9 + s.id * 2.3 + i * 1.7; _d.x += Math.sin(ph) * 0.35 * s.frizz; _d.z += Math.cos(ph * 1.3) * 0.35 * s.frizz; _d.y += 0.2 * s.frizz }
    if (s.sway > 0.01) { const ph = S.simT * 40 + s.id; _d.x += Math.sin(ph) * 0.25 * s.sway * (i + 1) / s.n; _d.y += Math.cos(ph * 0.7) * 0.15 * s.sway }
    if (_d.lengthSq() < 1e-6) _d.copy(s.u)
    _d.normalize()
    s.pts[i + 1].copy(s.pts[i]).addScaledVector(_d, s.segL * (1 + 0.15 * s.frizz))
  }
}
// 見えている点か（頭の陰に隠れていないか）
function visible(P) {
  _a.copy(P).sub(EYE); const L = _a.length(); _a.divideScalar(L)
  const b = EYE.dot(_a), c = EYE.lengthSq() - 0.97 * 0.97, disc = b * b - c
  if (disc < 0) return true
  const t1 = -b - Math.sqrt(disc); return !(t1 > 0 && t1 < L - 0.05)
}
// 道具の当たり（視線に垂直な面での距離）
function strandWeight(s, B, V, R) {
  if (S.cat && (S.cat.st === 'on' || S.cat.st === 'sleep') && s.u.y > 0.72) return 0
  let best = 0
  for (let i = 1; i <= s.n; i++) {
    _b.copy(s.pts[i]).sub(B); const pr = _b.dot(V); _b.addScaledVector(V, -pr); const d = _b.length()
    if (d < R) { const w = 1 - d / R; if (w > best && visible(s.pts[i])) best = w }
  }
  return best
}
const lockOf = s => Math.min(1, s.wax)

// ---------- 猫
const cat = new THREE.Group(); scene.add(cat); cat.visible = false
const catParts = {}
{
  const fur = canvasTex(64, 64, (x, w, h) => { x.fillStyle = '#f2a04a'; x.fillRect(0, 0, w, h); x.fillStyle = '#c96f22'; for (let i = 0; i < 4; i++) x.fillRect(0, i * 16 + 4, w, 6) })
  const furM = lam(0xffffff, { map: fur }), whiteC = lam(0xfff4e6)
  const bodyC = mesh(new THREE.SphereGeometry(0.5, 14, 10), furM, 0, 0.45, 0, cat); bodyC.scale.set(1.35, 0.85, 0.85)
  const hd = new THREE.Group(); hd.position.set(0.62, 0.8, 0); cat.add(hd)
  mesh(new THREE.SphereGeometry(0.36, 14, 10), furM, 0, 0, 0, hd)
  mesh(new THREE.SphereGeometry(0.17, 10, 8), whiteC, 0.2, -0.1, 0, hd).scale.set(0.8, 0.7, 1.3)
  for (const sz of [-1, 1]) { const e = mesh(new THREE.ConeGeometry(0.12, 0.26, 4), furM, -0.02, 0.32, sz * 0.18, hd); e.rotation.x = sz * 0.3 }
  catParts.eyes = [-1, 1].map(sz => mesh(new THREE.SphereGeometry(0.055, 8, 6), lam(0x1a1a1a), 0.3, 0.06, sz * 0.13, hd))
  catParts.head = hd
  const tail = mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.9, 8), furM, -0.75, 0.75, 0, cat); tail.rotation.z = 0.7; catParts.tail = tail
  for (const [x, z] of [[0.35, 0.2], [0.35, -0.2], [-0.35, 0.2], [-0.35, -0.2]]) mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.35, 8), whiteC, x, 0.12, z, cat)
  catParts.body = bodyC
}

// ---------- ゲームの開始と1ステップ
function newStrands(rng) {
  S.strands = []
  for (const u of ANCHORS) S.strands.push(makeStrand(u, rng, { m: 0.75 + rng() * 0.25 }))
  for (const s of S.strands) { s.mv = s.m; poseStrand(s) }
}
function startGame(seed) {
  S.seed = seed ?? Math.floor(Math.random() * 1e9); const rng = mulberry(S.seed); S.rng = rng
  S.view = 'play'; S.t = 0; S.simT = 0; S.tool = 0; S.plugged = true; S.jar = 1; S.hurry = false; S.result = null; S.said = {}
  S.botState = { t: 0, task: null, wait: 0, osc: 1, B: new V3(0, 1, 0.8), tapCD: 0, cordSeen: null, catSeen: null, leaveRoll: null, rng: mulberry(S.seed * 7 + 3) }
  newStrands(rng)
  const ah = [10 + rng() * 9, 24 + rng() * 9, 37 + rng() * 7]; if (rng() < 0.4) ah.pop()
  const catT = 15 + rng() * 14
  let cordT = 9 + rng() * 33; for (let k = 0; k < 20 && Math.abs(cordT - catT) < 9; k++) cordT = 9 + rng() * 33
  S.ev = { ahoge: ah, catT, cordT, cordDone: false, catDone: false, lastBoing: -9, deadMsg: -9 }
  S.cat = { st: 'off', t: 0, hits: 0, need: 3, messT: 0 }
  S.stats = { boings: 0, booms: 0, sprays: 0, catMins: 0, ahoge: 0, leaveT: null }
  Object.assign(inp, { down: false, moveAcc: 0, pressT: 0, tapCat: false, plug: false, leave: false })
  S.faceTmp = null; setFace('sleepy'); S.faceTmp = { name: 'yawn', t: 1.1 }
  if (!S.sim) {
    show('vPlay'); clearBubbles(); updTools(); $('#bPlug').hidden = true; $('#plugBadge').hidden = true; $('#banner').hidden = true; $('#clock').classList.remove('hurry')
    Snd.setTrack('play'); Snd.sfx('yawn'); resize()
    S.tut = store.get('tut', '0') !== '1' && !S.bot
    if (S.tut) showTut(0)
    cat.visible = false; last = performance.now(); acc = 0
  }
}
function step() {
  S.simT += DT
  if (S.view === 'play') stepPlay()
  else stepIdle()
}
function stepIdle() {
  for (const s of S.strands) { springStrand(s); poseStrand(s) }
  faceTick()
}
function springStrand(s) {
  s.vel += (s.m - s.mv) * 260 * DT - s.vel * 11 * DT
  s.mv = clamp(s.mv + s.vel * DT, -0.2, 1.35)
}
function stepPlay() {
  if (S.tut) { stepIdle(); return }
  S.t += DT
  const ev = S.ev, st = S.stats
  if (S.bot) botTick()
  if (inp.leave) { inp.leave = false; finish(false); return }
  if (inp.plug) { inp.plug = false; plugIn() }
  if (inp.tapCat) { inp.tapCat = false; catTap() }
  // 道具
  if (inp.down) { applyTool(); inp.pressT++ } else { inp.pressT = 0; inp.moveAcc = 0 }
  // 妨害
  while (ev.ahoge.length && S.t >= ev.ahoge[0]) { ev.ahoge.shift(); spawnAhoge() }
  if (!ev.cordDone && S.t >= ev.cordT) { ev.cordDone = true; unplug() }
  if (!ev.catDone && S.t >= ev.catT) { ev.catDone = true; S.cat.st = 'walk'; S.cat.t = 0; say(T('meow'), catScreenPt(), 'y'); sfx('meow') }
  stepCat()
  // 毛束
  const base = 0.03 + 0.055 * (S.t / D.PLAY_SEC)
  for (const s of S.strands) {
    if (!s.hot) s.heat = Math.max(0, s.heat - 0.5 * DT)
    s.hot = false; s.sway = Math.max(0, s.sway - 3 * DT)
    s.wet = Math.max(0, s.wet - 0.012 * DT)
    if (s.m < 0.55 && S.t - ev.lastBoing > 0.3) {
      const rate = base * (1 - 0.92 * s.set) * (1 - 0.9 * lockOf(s)) * (s.wet > 0.35 ? 0.35 : 1) * (s.ahoge ? 1.4 : 1)
      if (S.rng() < rate * DT) {
        s.m = Math.min(1, s.m + 0.55 + 0.25 * S.rng()); s.set *= 0.4; s.vel += 9; ev.lastBoing = S.t; st.boings++
        if (!S.sim) { say(T('boing'), tipScreen(s), 'y'); sfx('boing'); faceReact('shock', 0.45) }
      }
    }
    springStrand(s); poseStrand(s)
  }
  // 時間
  const left = D.PLAY_SEC - S.t
  if (!S.hurry && left <= 12) { S.hurry = true; if (!S.sim) { Snd.setTrack('hurry'); $('#clock').classList.add('hurry'); sfx('hurry'); say(T('hurry')[0], faceScreen(), 'talk') } }
  if (S.hurry && !S.said.h2 && left <= 6) { S.said.h2 = 1; if (!S.sim) say(T('hurry')[1], faceScreen(), 'talk') }
  faceTick()
  if (left <= 0) finish(true)
}

function applyTool() {
  const B = inp.B, V = inp.V, list = S.strands
  if (S.tool === 0) { // くし
    const mv = Math.min(inp.moveAcc, 0.5); inp.moveAcc = 0
    if (mv < 0.002) return
    let any = false
    for (const s of list) {
      const w = strandWeight(s, B, V, 0.44); if (!w) continue
      const eff = (0.12 + 0.74 * Math.min(1, s.wet)) * (1 - 0.75 * lockOf(s)) * (1 - 0.5 * s.set * (s.m > 0.4 ? 1 : 0)) * (s.ahoge ? 0.7 : 1)
      const d = 0.7 * mv * w * eff
      s.m = Math.max(0, s.m - d); if (s.wet > 0.1) s.frizz = Math.max(0, s.frizz - d * 1.6 * Math.min(1, s.wet)); s.vel -= d * 14; any = true
    }
    if (any) sfx('comb')
  } else if (S.tool === 1) { // ドライヤー
    if (!S.plugged) { if (S.t - S.ev.deadMsg > 1.4) { S.ev.deadMsg = S.t; if (!S.sim) { say(T('dryerDead'), faceScreen(), 'talk'); sfx('oops') } } return }
    for (const s of list) {
      const w = strandWeight(s, B, V, 0.6); if (!w) continue
      s.hot = true; s.sway = Math.min(1, s.sway + w * 0.3)
      if (s.wet > 0.02) {
        s.wet = Math.max(0, s.wet - 0.9 * DT * w)
        if (s.m < 0.35) s.set = Math.min(1, s.set + 1.2 * DT * w * Math.min(1, s.wet * 4 + 0.3))
        else s.set = Math.min(1, s.set + 0.6 * DT * w) // 跳ねたまま乾かすと、跳ねたまま決まる
        s.heat = Math.min(1, s.heat + 0.12 * DT * w)
      } else {
        s.heat += 0.62 * DT * w; s.m = Math.max(0, s.m - 0.05 * DT * w)
        if (s.heat >= 1) explode(s)
      }
    }
  } else if (S.tool === 2) { // 霧吹き
    if (inp.pressT % 14 !== 0) return
    S.stats.sprays++; sfx('spray'); if (!S.sim) mist(inp.sx, inp.sy)
    for (const s of list) { const w = strandWeight(s, B, V, 0.55); if (w) s.wet = Math.min(1.3, s.wet + 0.6 * w) }
  } else if (S.tool === 3) { // ワックス
    if (S.jar <= 0) { if (S.t - S.ev.deadMsg > 1.4) { S.ev.deadMsg = S.t; if (!S.sim) say(T('waxEmpty'), faceScreen(), 'talk') } return }
    let any = false
    for (const s of list) { const w = strandWeight(s, B, V, 0.4); if (!w) continue; const add = 1.2 * DT * w; s.wax += add; S.jar = Math.max(0, S.jar - add * 0.05); any = true }
    if (any && inp.pressT % 16 === 0) sfx('wax')
  }
}
function explode(s) {
  s.m = 1; s.vel += 14; s.frizz = 1; s.set = 0; s.heat = 0; S.stats.booms++
  for (const o of S.strands) if (o !== s && o.u.distanceTo(s.u) < 0.7) { o.m = Math.min(1, o.m + 0.45); o.set *= 0.5; o.vel += 6 }
  if (!S.sim) { say(T('boom'), tipScreen(s), 'r'); sfx('boom'); setTimeout(() => sfx('scream'), 120); faceReact('shock', 0.9); smoke(tipScreen(s)) }
}
function spawnAhoge() {
  if (S.strands.length >= MAXS) return
  const r = S.rng, p = 0.08 + r() * 0.3, b = (r() * 2 - 1) * 1.6
  const u = new V3(Math.sin(p) * Math.sin(b), Math.cos(p), Math.sin(p) * Math.cos(b))
  const s = makeStrand(u, r, { ahoge: true, segL: 0.3, m: 1 }); s.mv = 0; s.vel = 12; S.strands.push(s); S.stats.ahoge++
  if (!S.sim) { poseStrand(s); say(T('ahoge'), tipScreen(s), 'y'); sfx('ahoge') }
}
function unplug() { S.plugged = false; if (!S.sim) { sfx('unplug'); say(T('unplug'), faceScreen(), 'r'); $('#bPlug').hidden = false; $('#plugBadge').hidden = false; updTools() } }
function plugIn() { if (S.plugged) return; S.plugged = true; if (!S.sim) { sfx('plug'); $('#bPlug').hidden = true; $('#plugBadge').hidden = true; updTools() } }

// 猫: 台を歩く → 頭に飛び乗る → 3回タップでどく。放っておくと寝る（5回）
const CAT_WALK = 2.0, CAT_JUMP = 0.55, CAT_LEAVE = 0.7
function stepCat() {
  const c = S.cat; if (c.st === 'off') return
  c.t += DT
  if (c.st === 'walk' && c.t >= CAT_WALK) { c.st = 'jump'; c.t = 0 }
  else if (c.st === 'jump' && c.t >= CAT_JUMP) { c.st = 'on'; c.t = 0; c.hits = 0; c.need = 3; if (!S.sim) { $('#banner').textContent = T('catTap'); $('#banner').hidden = false; faceReact('up', 1.2) } }
  else if (c.st === 'on') {
    c.messT += DT; S.stats.catMins += DT
    if (c.messT > 0.9) { c.messT = 0; const crown = S.strands.filter(s => s.u.y > 0.6).sort((a, b) => a.m - b.m).slice(0, 2); for (const s of crown) { s.m = Math.min(1, s.m + 0.3); s.set *= 0.6; s.vel += 5 } }
    if (c.t > 7) { c.st = 'sleep'; c.t = 0; c.hits = 0; c.need = 5; if (!S.sim) { say(T('zzz'), catScreenPt(), 'b'); sfx('purr') } }
  } else if (c.st === 'sleep') { S.stats.catMins += DT }
  else if (c.st === 'leave' && c.t >= CAT_LEAVE) { c.st = 'off'; if (!S.sim) cat.visible = false }
}
function catTap() {
  const c = S.cat; if (c.st !== 'on' && c.st !== 'sleep') return
  c.hits++; c.squish = 1
  if (c.hits >= c.need) { c.st = 'leave'; c.t = 0; if (!S.sim) { say(T('hiss'), catScreenPt(), 'r'); sfx('hiss'); $('#banner').hidden = true } }
  else if (!S.sim) sfx('meow')
}
const catOnHead = () => S.cat && (S.cat.st === 'on' || S.cat.st === 'sleep')

// ---------- bot（台本）: good / normal / sloppy / idle。採点の分布を測るため
const BOTP = {
  good: { speed: 5.2, switch: 0.18, reactCord: 0.4, reactCat: 0.45, tapGap: 0.16 },
  normal: { speed: 3.4, switch: 0.45, reactCord: 2.2, reactCat: 1.8, tapGap: 0.3 },
  sloppy: { speed: 4.0, switch: 0.3, reactCord: 5, reactCat: 4, tapGap: 0.5 },
}
function botTick() {
  const kind = S.bot, P = BOTP[kind], b = S.botState
  if (!P) { inp.down = false; return }
  const R = b.rng
  // 妨害への対処
  if (!S.plugged) { if (b.cordSeen == null) b.cordSeen = S.t; if (S.t - b.cordSeen > P.reactCord) { inp.plug = true; b.cordSeen = null } } else b.cordSeen = null
  if (catOnHead()) {
    if (b.catSeen == null) b.catSeen = S.t
    if (S.t - b.catSeen > P.reactCat) { b.tapCD -= DT; if (b.tapCD <= 0) { inp.tapCat = true; b.tapCD = P.tapGap } inp.down = false; return }
  } else b.catSeen = null
  // 出発
  const maxM = Math.max(...S.strands.map(s => s.m)), avgWet = S.strands.reduce((a, s) => a + s.wet, 0) / S.strands.length
  if (kind === 'good' && (S.t > 48.8 || (S.t > 43 && maxM < 0.08 && avgWet < 0.2))) { inp.leave = true; return }
  if (kind === 'normal') { if (b.leaveRoll == null) b.leaveRoll = R() < 0.5; if (b.leaveRoll && S.t > 48.6) { inp.leave = true; return } }
  if (b.wait > 0) { b.wait -= DT; inp.down = false; return }
  let tk = b.task
  if (!tk || tk.done) {
    tk = b.task = chooseTask(kind, b, R)
    if (!tk) { inp.down = false; b.wait = 0.2; return }
    tk.t = 0
    if (tk.tool !== S.tool) { setTool(tk.tool); b.wait = P.switch; inp.down = false; return }
  }
  const s = tk.s, mid = s.pts[Math.min(3, s.n)]
  const V = _a.copy(mid).sub(EYE).normalize(), side = _b.copy(V).cross(UP).normalize()
  const amp = tk.tool === 0 ? (kind === 'sloppy' ? 0.55 : 0.32) : tk.tool === 3 ? (kind === 'good' ? 0.1 : 0.4) : 0.04
  const goal = mid.clone().addScaledVector(side, amp * b.osc)
  const dv = goal.clone().sub(b.B), dist = dv.length(), stepL = P.speed * DT
  if (dist <= stepL) { b.B.copy(goal); b.osc *= -1 } else b.B.addScaledVector(dv, stepL / dist)
  const moved = Math.min(dist, stepL)
  inp.B.copy(b.B); inp.V.copy(b.B).sub(EYE).normalize()
  const near = b.B.distanceTo(mid) < amp + 0.25
  inp.down = near; if (near) inp.moveAcc += moved
  tk.t += DT
  if (tk.t > tk.max || (near && tk.until && tk.until())) tk.done = true
}
function chooseTask(kind, b, R) {
  const L = S.strands.filter(s => !(catOnHead() && s.u.y > 0.72))
  if (!L.length) return null
  if (kind === 'good') {
    if (b.next) { const n = b.next; b.next = null; if (n.s.m < 0.2 && n.s.wet > 0.05) return n }
    if (S.t > 39 && S.jar > 0.05) { const w = L.filter(s => !s.botWax && s.m < 0.15 && s.wax < 0.4 && s.wet < 0.3); if (w.length) { const s = w[0]; s.botWax = true; return { tool: 3, s, max: 0.45, until: () => s.wax > 0.65 } } }
    const messy = L.filter(s => s.m > 0.2).sort((a, c) => c.m - a.m)
    if (messy.length) { const s = messy[0]; if (s.wet < 0.35) return { tool: 2, s, max: 0.08 }; b.next = { tool: 1, s, max: 1.6, until: () => s.wet < 0.04 || S.strands.some(o => o.heat > 0.7) }; return { tool: 0, s, max: 1.6, until: () => s.m < 0.06 } }
    const wet = L.filter(s => s.wet > 0.1 && s.m < 0.25 && s.set < 0.85).sort((a, c) => c.wet - a.wet)
    if (wet.length) { const s = wet[0]; return { tool: 1, s, max: 2.2, until: () => s.wet < 0.04 || S.strands.some(o => o.heat > 0.7) } }
    if (S.t > 36 && S.jar > 0.1) { const w = L.filter(s => s.set > 0.5 && s.wax < 0.5 && s.m < 0.2); if (w.length) { const s = w[0]; return { tool: 3, s, max: 0.6, until: () => s.wax > 0.7 } } }
    const half = L.filter(s => s.m > 0.08).sort((a, c) => c.m - a.m)
    if (half.length) { const s = half[0]; return { tool: 0, s, max: 0.8, until: () => s.m < 0.04 } }
    return null
  }
  if (kind === 'normal') {
    if (b.next) { const n = b.next; b.next = null; return n }
    let s = L.filter(s => s.m > 0.25).sort((a, c) => c.m - a.m)[0]
    if (s && R() < 0.3) s = L[Math.floor(R() * L.length)]
    if (s) {
      if (s.wet < 0.2 && R() < 0.6) return { tool: 2, s, max: 0.08 }
      if (R() < 0.45) { const dur = 0.5 + R() * 1.7, look = R() < 0.6; b.next = { tool: 1, s, max: dur, until: look ? () => s.heat > 0.8 : null } }
      return { tool: 0, s, max: 1.2, until: () => s.m < 0.18 }
    }
    const w = L.filter(s => s.wet > 0.15)[0]; if (w) return { tool: 1, s: w, max: 0.6 + R() * 1.6 }
    return null
  }
  // sloppy: 適当な場所に適当な道具
  const s = L[Math.floor(R() * L.length)], r = R()
  const tool = r < 0.5 ? 0 : r < 0.8 ? 1 : r < 0.9 ? 2 : 3
  return { tool, s, max: 0.4 + R() * 1.4 }
}

// ---------- 顔の表情
const FACES = {
  sleep: { o: 0, br: 0, by: 0, m: 'line', px: 0, py: 0 }, sleepy: { o: 0.3, br: 0.05, by: -0.02, m: 'line' },
  yawn: { o: 0.05, br: -0.1, by: 0.03, m: 'open', ms: 1.3 }, focus: { o: 0.85, br: -0.28, by: -0.02, m: 'line' },
  shock: { o: 1.25, br: 0.35, by: 0.07, m: 'open', ms: 1.1, ps: 0.6 }, panic: { o: 1.05, br: 0.4, by: 0.04, m: 'open', ms: 0.6, sweat: 1 },
  up: { o: 1, br: 0.25, by: 0.05, m: 'open', ms: 0.5, py: 0.06 }, smug: { o: 0.5, br: -0.1, by: 0.05, m: 'smile', ms: 1.2 },
  happy: { o: 0.9, br: 0.15, by: 0.03, m: 'smile' }, awk: { o: 0.85, br: 0.3, by: 0, m: 'line', tilt: 0.25, sweat: 1 },
  cry: { o: 0.25, br: 0.45, by: 0.02, m: 'frown', tears: 1 }, dead: { o: 1.2, br: 0.5, by: 0.08, m: 'open', ms: 1.4, ps: 0.4, sweat: 1, tears: 1 },
}
function setFace(n) { S.face = n }
function faceReact(n, t) { S.faceTmp = { name: n, t } }
function faceTick() {
  if (S.faceTmp) { S.faceTmp.t -= DT; if (S.faceTmp.t <= 0) S.faceTmp = null }
  if (S.view === 'play' && !S.faceTmp) S.face = catOnHead() ? 'up' : S.hurry ? 'panic' : 'focus'
}
function applyFace(t) {
  const f = FACES[S.faceTmp ? S.faceTmp.name : S.face] || FACES.focus
  const blink = (S.face !== 'sleep' && (t % 3.7) < 0.12) ? 0.1 : 1
  const o = f.o * blink
  eyes.forEach((e, i) => { e.scale.y = Math.max(0.06, o); pupils[i].visible = o > 0.2; pupils[i].scale.setScalar(f.ps || 1); pupils[i].scale.y *= Math.min(1, o); pupils[i].position.y = 0.1 + (f.py || 0); lids[i].visible = o < 0.2 })
  brows.forEach((b, i) => { const sx = i ? 1 : -1; b.rotation.z = -sx * f.br; b.position.y = 0.37 + f.by })
  mSmile.visible = f.m === 'smile' || f.m === 'frown'; mSmile.rotation.z = f.m === 'frown' ? 0 : Math.PI; mSmile.position.y = f.m === 'frown' ? -0.06 : 0.06
  mOpen.visible = f.m === 'open'; const ms = f.ms || 1; mOpen.scale.set(ms * (0.9 + Math.sin(t * 20) * 0.04 * ms), 0.8 * ms, 0.35)
  mLine.visible = f.m === 'line'; mLine.rotation.z = f.tilt || 0
  mouth.scale.setScalar(f.m === 'smile' ? (f.ms || 1) : 1)
  sweat.visible = !!f.sweat; sweat.position.y = 0.48 - ((t * 0.6) % 0.4)
  tears.forEach((d, i) => { d.visible = !!f.tears; d.position.y = -0.06 - ((t * 0.9 + i * 0.3) % 0.5) })
}

// ---------- 画面座標の変換と吹き出し・演出
const _w = new V3()
function toScreen(local) { _w.copy(local); head.localToWorld(_w); _w.project(camera); return [(_w.x + 1) / 2 * innerWidth, (1 - _w.y) / 2 * innerHeight] }
const tipScreen = s => toScreen(s.pts[s.n])
const faceScreen = () => toScreen(new V3(0.9, 0.9, 0.6))
function catScreenPt() { _w.copy(cat.position); _w.y += 0.9; _w.project(camera); return [(_w.x + 1) / 2 * innerWidth, (1 - _w.y) / 2 * innerHeight] }
function say(text, pt, cls = '') {
  if (S.sim || !pt) return
  const d = document.createElement('div'); d.className = 'pop ' + cls; d.textContent = text
  d.style.left = clamp(pt[0], 70, innerWidth - 70) + 'px'; d.style.top = clamp(pt[1], 110, innerHeight - 60) + 'px'
  $('#bubbles').appendChild(d); setTimeout(() => d.remove(), cls === 'talk' ? 1600 : 950)
}
function clearBubbles() { $('#bubbles').innerHTML = ''; parts.length = 0 }
const sfx = n => { if (!S.sim) Snd.sfx(n) }
const parts = []
function mist(x, y) { if (x < 0) return; for (let i = 0; i < 18; i++) { const a = -2.2 + Math.random() * 1.4 - (x > innerWidth / 2 ? 0 : 0), sp = 80 + Math.random() * 160; parts.push({ k: 'mist', x: x + 20, y: y - 20, vx: Math.cos(a) * sp * (x > innerWidth / 2 ? 1 : -1) * -1, vy: Math.sin(a) * sp * 0.6, life: 0.5 + Math.random() * 0.3, t: 0 }) } }
function smoke(pt) { if (!pt) return; for (let i = 0; i < 10; i++) parts.push({ k: 'smoke', x: pt[0] + (Math.random() - 0.5) * 30, y: pt[1], vx: (Math.random() - 0.5) * 60, vy: -40 - Math.random() * 60, life: 0.9, t: 0, r: 8 + Math.random() * 10 }) }

// ---------- 道具アイコン（SVG）
const ICONS = {
  comb: '<rect x="6" y="18" width="52" height="13" rx="5" fill="#ff8fb1" stroke="#2a2233" stroke-width="3.5"/><path d="M12 31v17M19 31v17M26 31v17M33 31v17M40 31v17M47 31v17M53 31v14" stroke="#2a2233" stroke-width="3.5" stroke-linecap="round"/><path d="M12 23h18" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>',
  dryer: '<rect x="4" y="19" width="20" height="15" rx="3" fill="#b8c8e6" stroke="#2a2233" stroke-width="3.5"/><circle cx="36" cy="26" r="15" fill="#3f7cff" stroke="#2a2233" stroke-width="3.5"/><circle cx="36" cy="26" r="5.5" fill="#fff" stroke="#2a2233" stroke-width="2.5"/><path d="M37 40l5 18h-9l-3-16" fill="#3f7cff" stroke="#2a2233" stroke-width="3.5" stroke-linejoin="round"/><path d="M2 12l-0 0M8 10h-6M8 44h-6" stroke="#9fd8ff" stroke-width="3" stroke-linecap="round"/>',
  spray: '<rect x="18" y="26" width="24" height="32" rx="7" fill="#7fd4f5" stroke="#2a2233" stroke-width="3.5"/><path d="M23 26v-9h14v9" fill="#fff" stroke="#2a2233" stroke-width="3.5" stroke-linejoin="round"/><path d="M22 13h18l5 4" stroke="#2a2233" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 38h16" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/><circle cx="52" cy="10" r="2.6" fill="#7fd4f5"/><circle cx="57" cy="17" r="2.2" fill="#7fd4f5"/><circle cx="50" cy="19" r="2" fill="#7fd4f5"/>',
  wax: '<rect x="10" y="24" width="44" height="28" rx="7" fill="#ffcf33" stroke="#2a2233" stroke-width="3.5"/><rect x="8" y="14" width="48" height="12" rx="5" fill="#2a2233"/><path d="M18 36h28M18 43h18" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".8"/>',
}
const ICON_KEYS = ['comb', 'dryer', 'spray', 'wax']
const iconImg = {}
for (const k of ICON_KEYS) { const im = new Image(); im.src = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${ICONS[k]}</svg>`); iconImg[k] = im }
$$('[data-ico]').forEach(el => { el.innerHTML = ICONS[el.dataset.ico] })
function tutSvg(i) {
  const headS = '<circle cx="100" cy="66" r="30" fill="#f6c9a0" stroke="#2a2233" stroke-width="3"/><path d="M70 60q30-38 60 0" fill="#3b2a20"/>'
  const fing = '<g class="fing"><circle cx="100" cy="40" r="9" fill="#fff" stroke="#2a2233" stroke-width="3"/><circle cx="100" cy="40" r="15" fill="none" stroke="#2a2233" stroke-width="2" opacity=".35"/></g>'
  if (i === 0) return headS + '<path d="M88 40l-8-22M100 36l2-26M112 40l12-20" stroke="#3b2a20" stroke-width="6" stroke-linecap="round"/><g transform="translate(140 8) scale(.8)">' + ICONS.spray + '</g><circle cx="128" cy="22" r="3" fill="#7fd4f5"/><circle cx="120" cy="30" r="3" fill="#7fd4f5"/><circle cx="114" cy="20" r="2.4" fill="#7fd4f5"/>'
  if (i === 1) return headS + '<path d="M78 46q20-18 44 0" stroke="#150d09" stroke-width="7" fill="none" stroke-linecap="round"/>' + fing + '<g transform="translate(20 70) scale(.55)">' + ICONS.comb + '</g>'
  return headS + '<path d="M78 46q20-18 44 0" stroke="#3b2a20" stroke-width="7" fill="none" stroke-linecap="round"/><g transform="translate(140 30) scale(.8)">' + ICONS.dryer + '</g><path d="M136 46h-18M138 56h-14M136 36h-12" stroke="#9fd8ff" stroke-width="3" stroke-linecap="round"/><path d="M40 20l6 10-10 0z" fill="#ff5a4e"/><text x="18" y="50" font-size="14" font-weight="900" fill="#ff5a4e">!</text>'
}

// ---------- UI
const VIEWS = ['vTitle', 'vHow', 'vPlay', 'vPause', 'vResult']
function show(id) { for (const v of VIEWS) $('#' + v).hidden = v !== id; $('#bPause').hidden = id !== 'vPlay'; requestAnimationFrame(resize) }
function applyLang() {
  document.documentElement.lang = S.lang; document.title = T('docTitle')
  $$('[data-t]').forEach(el => { el.textContent = T(el.dataset.t) })
  $$('[data-tool-name]').forEach(el => { el.textContent = T('tools')[+el.dataset.toolName] })
  $('#bLang').textContent = S.lang === 'ja' ? 'EN' : 'JA'
  $('#ctrlLine').textContent = isTouch ? T('ctrlTouch') : T('ctrlPc')
  if (S.result && S.view === 'result') fillResult(true)
  if (S.tut) showTut(S.tutI)
}
function applyMute() {
  Snd.setMute(S.muted); const b = $('#bMute'); b.querySelector('.on').style.display = S.muted ? 'none' : ''; b.querySelector('.off').style.display = S.muted ? '' : 'none'
}
function setTool(i) { if (S.tool === i) return; S.tool = i; if (!S.sim) { updTools(); sfx('tool') } }
function updTools() {
  $$('.tool').forEach(b => { const i = +b.dataset.tool; b.classList.toggle('on', i === S.tool); b.classList.toggle('dead', (i === 1 && !S.plugged) || (i === 3 && S.jar <= 0)) })
  props.forEach((p, i) => { p.visible = !(S.view === 'play' && i === S.tool) })
}
function showTut(i) {
  S.tutI = i; const d = T('tut')[i]; $('#tut').hidden = false
  $('#tutStep').textContent = `${i + 1}/3`; $('#tutT').textContent = d.t; $('#tutP').textContent = isTouch ? d.touch : d.pc
  $('#tutSvg').innerHTML = tutSvg(i); $('#tutBtn').textContent = i < 2 ? T('tutNext') : T('tutGo')
}
$('#bTut').onclick = () => { sfx('tap'); if (S.tutI < 2) showTut(S.tutI + 1); else { $('#tut').hidden = true; S.tut = false; store.set('tut', '1'); setTool(2); last = performance.now(); acc = 0 } }

// HUD
function fmtClock(sec) { sec = Math.floor(sec); const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60; return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` }
const gameClock = () => D.CLOCK0 + Math.min(1, S.t / D.PLAY_SEC) * D.CLOCK_SPAN
let hudLast = ''
function hud() {
  if (S.view !== 'play' && S.view !== 'pause') return
  const left = Math.max(0, D.CLOCK_SPAN - Math.min(1, S.t / D.PLAY_SEC) * D.CLOCK_SPAN)
  const key = Math.floor(gameClock()) + '|' + Math.ceil(left - 1e-6)
  if (key !== hudLast) { hudLast = key; $('#clkTime').textContent = fmtClock(gameClock()); const l = Math.ceil(left - 1e-6); $('#clkLeft').textContent = `${Math.floor(l / 60)}:${String(l % 60).padStart(2, '0')}` }
  $('#clkBar').style.transform = `scaleX(${left / D.CLOCK_SPAN})`
  $('#waxBar').style.transform = `scaleX(${S.jar})`
}

// ---------- 結果
function computeResult(late) {
  const L = S.strands
  const mess = L.map(s => Math.min(1.2, clamp(s.m, 0, 1) + s.frizz * 0.5))
  const mean = mess.reduce((a, b) => a + b, 0) / mess.length
  const base = 100 * Math.pow(Math.max(0, 1 - mean), 0.9)
  const wetAvg = L.reduce((a, s) => a + Math.min(1, s.wet), 0) / L.length
  const wetPen = Math.max(0, wetAvg - 0.3) * 45
  const greasePen = L.reduce((a, s) => a + Math.max(0, s.wax - 1.2), 0) * 5
  const catOn = catOnHead()
  const leftSec = Math.max(0, D.PLAY_SEC - S.t)
  const score = clamp(Math.round(base - wetPen - greasePen - (late ? 8 : 0) - (catOn ? 12 : 0) + (late ? 0 : Math.min(4, leftSec * 0.25))), 0, 100)
  const rank = D.RANKS.find(r => score >= r.min)
  const frizzN = L.filter(s => s.frizz > 0.5).length, antN = L.filter(s => s.ahoge && s.m > 0.5).length
  let special = null
  if (catOn) special = 'cat'
  else if (['B', 'C', 'D'].includes(rank.id)) {
    if (frizzN >= 4) special = 'afro'; else if (greasePen >= 6) special = 'grease'; else if (wetAvg > 0.55) special = 'wet'; else if (antN >= 2) special = 'antenna'
  }
  const pick = D.REACT[rank.id][S.seed % D.REACT[rank.id].length]
  return { score, rank: rank.id, special, late, mean: +mean.toFixed(3), wetAvg: +wetAvg.toFixed(2), greasePen: +greasePen.toFixed(1), frizzN, antN, cat: catOn,
    boings: S.stats.boings, booms: S.stats.booms, depart: late ? D.CLOCK0 + D.CLOCK_SPAN : gameClock(), leftSec: +leftSec.toFixed(1), react: special ? D.REACT[special] : pick, t: +S.t.toFixed(2) }
}
const revealTimers = []
function finish(late) {
  if (S.view !== 'play') return
  S.result = computeResult(late); S.view = 'result'; inp.down = false
  if (S.sim) return
  Snd.dryer(false)
  const R = S.result
  setFace({ S: 'smug', A: 'happy', B: 'awk', C: 'cry', D: 'dead' }[R.rank]); S.faceTmp = null
  if (R.cat) S.face = 'up'
  for (const p of props) p.visible = true
  sfx(late ? 'horn' : 'door')
  if (late) say(T('late'), faceScreen(), 'talk')
  revealTimers.forEach(clearTimeout); revealTimers.length = 0
  // シャッター → 社員証の写真
  revealTimers.push(setTimeout(() => {
    applyFace(S.simT); for (const s of S.strands) { s.mv = s.m; s.vel = 0; poseStrand(s) } syncHair(); updCat(0)
    photo = capturePhoto(); $('#rPhoto').src = photo.toDataURL('image/jpeg', 0.9)
    $('#flash').classList.remove('on'); void $('#flash').offsetWidth; $('#flash').classList.add('on'); sfx('stamp')
    show('vResult'); fillResult(false); $('#bubbles').innerHTML = ''
  }, late ? 900 : 500))
}
let photo = null
function fillResult(instant) {
  const R = S.result, rk = D.RANKS.find(r => r.id === R.rank)
  $('#rTime').textContent = fmtClock(R.depart)
  const tag = $('#rTag'); tag.textContent = R.late ? T('lateTag') : T('earlyTag'); tag.className = 'tag ' + (R.late ? 'late' : 'ok')
  $('#rRank').textContent = R.rank; $('#rStamp').style.borderColor = $('#rStamp').style.color = shade(rk.color)
  $('#rTitle').textContent = (R.special ? D.TITLES_SPECIAL[R.special] : rk)[S.lang]
  $('#rReact').textContent = R.react[S.lang]
  $('#rFace').innerHTML = coworkerSvg(R.rank, R.special)
  $('#rStats').innerHTML = [`${T(R.late ? 'statLate' : 'statDep')} ${fmtClock(R.depart)}`, `${T('statBoing')} ${R.boings}${T('times')}`, `${T('statBoom')} ${R.booms}${T('times')}`].map(s => `<span>${s}</span>`).join('')
  const reveals = ['#rTitle', '#rReactBox', '#rStats', '#rBtns']
  if (instant) { $('#rScore').textContent = R.score; $('#rStamp').classList.add('slam'); reveals.forEach(q => $(q).classList.add('on')); return }
  $('#rScore').textContent = '0'; $('#rStamp').classList.remove('slam'); reveals.forEach(q => $(q).classList.remove('on'))
  Snd.setTrack(null)
  revealTimers.push(setTimeout(() => {
    sfx('roll'); const t0 = performance.now(), dur = 1300
    const tick = () => { const k = Math.min(1, (performance.now() - t0) / dur); $('#rScore').textContent = Math.round(R.score * (1 - Math.pow(1 - k, 3))); if (k < 1 && S.view === 'result') requestAnimationFrame(tick) }
    tick()
  }, 300))
  revealTimers.push(setTimeout(() => {
    $('#rScore').textContent = R.score; $('#rStamp').classList.add('slam'); sfx('stamp'); $('#rTitle').classList.add('on')
    const c = $('#rCard'); c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake')
  }, 1750))
  revealTimers.push(setTimeout(() => {
    ['#rReactBox', '#rStats', '#rBtns'].forEach(q => $(q).classList.add('on'))
    const good = ['S', 'A'].includes(R.rank) && !R.special
    sfx(good ? 'cheer' : 'laugh'); Snd.setTrack(good || R.rank === 'B' ? 'win' : 'sad')
  }, 2250))
}
function shade(hex) { const c = new THREE.Color(hex); c.multiplyScalar(0.62); return '#' + c.getHexString() }
// 同僚の顔（SVG）。反応ごとに表情を変える
function coworkerSvg(rank, special) {
  const e = { S: 'star', A: 'smile', B: 'side', C: 'laugh', D: 'shock' }[rank] || 'side'
  const ex = special === 'cat' || special === 'afro' ? 'shock' : e
  let eyes = '', mouth = ''
  if (ex === 'star') { eyes = '<path d="M20 26l2 4 4 .5-3 3 1 4-4-2-4 2 1-4-3-3 4-.5zM40 26l2 4 4 .5-3 3 1 4-4-2-4 2 1-4-3-3 4-.5z" fill="#ffcf33" stroke="#2a2233" stroke-width="1.5"/>'; mouth = '<path d="M22 42q8 9 16 0z" fill="#7a2430" stroke="#2a2233" stroke-width="2"/>' }
  else if (ex === 'smile') { eyes = '<path d="M18 31q4-4 8 0M34 31q4-4 8 0" stroke="#2a2233" stroke-width="2.5" fill="none" stroke-linecap="round"/>'; mouth = '<path d="M24 42q6 5 12 0" stroke="#2a2233" stroke-width="2.5" fill="none" stroke-linecap="round"/>' }
  else if (ex === 'side') { eyes = '<circle cx="24" cy="31" r="2.6" fill="#2a2233"/><circle cx="40" cy="31" r="2.6" fill="#2a2233"/>'; mouth = '<path d="M25 43h10" stroke="#2a2233" stroke-width="2.5" stroke-linecap="round"/><path d="M48 18q3 5 0 7q-3-2 0-7z" fill="#9fd8ff" stroke="#2a2233" stroke-width="1.2"/>' }
  else if (ex === 'laugh') { eyes = '<path d="M18 29l6 3-6 3M42 29l-6 3 6 3" stroke="#2a2233" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'; mouth = '<path d="M21 40q9 12 18 0z" fill="#7a2430" stroke="#2a2233" stroke-width="2"/>' }
  else { eyes = '<circle cx="23" cy="30" r="5" fill="#fff" stroke="#2a2233" stroke-width="2"/><circle cx="37" cy="30" r="5" fill="#fff" stroke="#2a2233" stroke-width="2"/><circle cx="23" cy="30" r="1.6" fill="#2a2233"/><circle cx="37" cy="30" r="1.6" fill="#2a2233"/>'; mouth = '<ellipse cx="30" cy="44" rx="4" ry="5" fill="#7a2430" stroke="#2a2233" stroke-width="2"/>' }
  return `<circle cx="30" cy="32" r="22" fill="#f1c7a2" stroke="#2a2233" stroke-width="2.5"/><path d="M8 28q2-20 22-20t22 20q-6-8-22-8t-22 8z" fill="#2a2233"/><rect x="15" y="25" width="13" height="10" rx="3" fill="none" stroke="#2a2233" stroke-width="1.6"/><rect x="32" y="25" width="13" height="10" rx="3" fill="none" stroke="#2a2233" stroke-width="1.6"/>${eyes}${mouth}<path d="M12 58q18-10 36 0" fill="#3f7cff" stroke="#2a2233" stroke-width="2.5"/>`
}
// 鏡の前の顔写真（4:5）を、今の描画キャンバスから切り出す
function capturePhoto() {
  const W = canvas.width, H = canvas.height, c = document.createElement('canvas'); c.width = 480; c.height = 600
  const cw = Math.min(W, H * 0.8), ch = cw * 1.25
  const fov = 34, need = 5.0, vh = need * H / ch, d = vh / (2 * Math.tan(fov * Math.PI / 360))
  const cp = camera.position.clone(), cq = camera.quaternion.clone(), cf = camera.fov
  camera.clearViewOffset(); camera.fov = fov; camera.aspect = W / H; camera.updateProjectionMatrix()
  const tgt = new V3(0, 0.45, 0); camera.position.copy(tgt).add(new V3(0, 0.12, 1).normalize().multiplyScalar(d)); camera.lookAt(tgt)
  counter.visible = false
  renderer.render(scene, camera)
  c.getContext('2d').drawImage(canvas, (W - cw) / 2, (H - ch) / 2, cw, ch, 0, 0, 480, 600)
  counter.visible = true; camera.position.copy(cp); camera.quaternion.copy(cq); camera.fov = cf; resize(); renderer.render(scene, camera)
  return c
}
async function makeCard() {
  const R = S.result, rk = D.RANKS.find(r => r.id === R.rank)
  if (!photo) photo = capturePhoto()
  try { await document.fonts.ready } catch (e) {}
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const x = c.getContext('2d')
  const g = x.createLinearGradient(0, 0, 0, 1350); g.addColorStop(0, '#fff6e6'); g.addColorStop(1, '#f6dcb8'); x.fillStyle = g; x.fillRect(0, 0, 1080, 1350)
  x.strokeStyle = 'rgba(42,34,51,.06)'; x.lineWidth = 4; for (let i = 0; i < 1080; i += 90) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 1350); x.stroke() } for (let j = 0; j < 1350; j += 90) { x.beginPath(); x.moveTo(0, j); x.lineTo(1080, j); x.stroke() }
  const disp = "'Dela Gothic One',sans-serif", body = "'M PLUS Rounded 1c',sans-serif"
  // 見出し
  x.fillStyle = '#2a2233'; rr(x, 0, 0, 1080, 130, 0); x.fill()
  x.font = `62px ${disp}`; x.textAlign = 'left'; x.fillStyle = '#fff'; x.fillText(S.lang === 'ja' ? '寝癖なおし' : 'BEDHEAD', 50, 88); const w1 = x.measureText(S.lang === 'ja' ? '寝癖なおし' : 'BEDHEAD').width
  x.fillStyle = '#ffcf33'; x.fillText(S.lang === 'ja' ? '3分前' : 'RUSH', 50 + w1 + 14, 88)
  x.textAlign = 'right'; x.font = `900 30px ${body}`; x.fillStyle = '#fff'; x.fillText(`${T('resultHead')} ${fmtClock(R.depart)}`, 1030, 62)
  x.fillStyle = R.late ? '#ff5a4e' : '#58d68d'; x.font = `900 28px ${body}`; x.fillText(R.late ? T('lateTag') : T('earlyTag'), 1030, 104)
  // 社員証
  x.save(); x.translate(300, 560); x.rotate(-0.04)
  x.fillStyle = 'rgba(0,0,0,.18)'; rr(x, -222, -332, 460, 690, 30); x.fill()
  x.fillStyle = '#fff'; x.strokeStyle = '#2a2233'; x.lineWidth = 6; rr(x, -230, -340, 460, 690, 30); x.fill(); x.stroke()
  x.fillStyle = '#f3e3c8'; rr(x, -40, -322, 80, 18, 9); x.fill(); x.stroke()
  x.fillStyle = '#3f7cff'; rr(x, -200, -290, 400, 46, 10); x.fill(); x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = `900 26px ${body}`; x.fillText(T('idCard'), 0, -257)
  x.drawImage(photo, -200, -230, 400, 500); x.strokeStyle = '#2a2233'; x.lineWidth = 5; x.strokeRect(-200, -230, 400, 500)
  x.fillStyle = '#2a2233'; x.font = `900 34px ${body}`; x.fillText(T('you'), 0, 318)
  x.restore()
  // ハンコ
  x.save(); x.translate(478, 770); x.rotate(0.22)
  const col = shade(rk.color); x.strokeStyle = col; x.fillStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 12; x.beginPath(); x.arc(0, 0, 105, 0, 7); x.fill(); x.stroke()
  x.lineWidth = 4; x.beginPath(); x.arc(0, 0, 86, 0, 7); x.stroke()
  x.fillStyle = col; x.font = `120px ${disp}`; x.textAlign = 'center'; x.fillText(R.rank, 0, 44); x.restore()
  // スコア
  x.textAlign = 'left'; x.fillStyle = '#4a3f55'; x.font = `900 38px ${body}`; x.fillText(T('scoreLab'), 600, 300)
  x.fillStyle = '#2a2233'; x.font = `190px ${disp}`; x.fillText(String(R.score), 590, 480); const sw = x.measureText(String(R.score)).width
  x.font = `900 46px ${body}`; x.fillText(T('pts'), 600 + sw, 478)
  // 称号
  const title = (R.special ? D.TITLES_SPECIAL[R.special] : rk)[S.lang]
  x.font = `58px ${disp}`; let fs = 58; while (x.measureText(title).width > 420 && fs > 30) { fs -= 2; x.font = `${fs}px ${disp}` }
  const tw = x.measureText(title).width + 48
  x.save(); x.translate(600, 560); x.rotate(-0.03); x.fillStyle = '#2a2233'; rr(x, 6, 6, tw, fs + 40, 16); x.fill(); x.fillStyle = '#ffcf33'; x.strokeStyle = '#2a2233'; x.lineWidth = 5; rr(x, 0, 0, tw, fs + 40, 16); x.fill(); x.stroke()
  x.fillStyle = '#2a2233'; x.fillText(title, 24, fs + 12); x.restore()
  // 統計
  x.fillStyle = '#4a3f55'; x.font = `900 30px ${body}`
  ;[`${T('statBoing')} ${R.boings}${T('times')}`, `${T('statBoom')} ${R.booms}${T('times')}`].forEach((s, i) => x.fillText(s, 604, 720 + i * 44))
  // 同僚の反応
  const fimg = await svgImg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60">${coworkerSvg(R.rank, R.special)}</svg>`)
  x.fillStyle = '#fff'; x.strokeStyle = '#2a2233'; x.lineWidth = 6; rr(x, 70, 960, 940, 250, 34); x.fill(); x.stroke()
  if (fimg) x.drawImage(fimg, 96, 990, 190, 190)
  x.fillStyle = '#4a3f55'; x.font = `900 28px ${body}`; x.textAlign = 'left'; x.fillText(T('coworker'), 310, 1020)
  const q = (S.lang === 'ja' ? '「' : '“') + R.react[S.lang] + (S.lang === 'ja' ? '」' : '”')
  x.fillStyle = '#2a2233'; let qs = 50; x.font = `900 ${qs}px ${body}`
  const lines = wrap(x, q, 660); while (lines.length > 2 && qs > 34) { qs -= 4; x.font = `900 ${qs}px ${body}`; lines.splice(0, lines.length, ...wrap(x, q, 660)) }
  lines.slice(0, 3).forEach((l, i) => x.fillText(l, 310, 1090 + i * (qs + 14)))
  x.textAlign = 'center'; x.fillStyle = '#7a6f85'; x.font = `800 28px ${body}`; x.fillText('tom3games.github.io/bedhead-rush', 540, 1300)
  return c
}
function wrap(x, s, w) { const out = []; let line = ''; for (const ch of s.split(S.lang === 'ja' ? '' : /(?<= )/)) { if (x.measureText(line + ch).width > w && line) { out.push(line); line = ch } else line += ch } if (line) out.push(line); return out }
function svgImg(src) { return new Promise(r => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = 'data:image/svg+xml,' + encodeURIComponent(src) }) }
function rr(x, X, Y, w, h, r) { x.beginPath(); x.roundRect(X, Y, w, h, r) }
async function saveImage() {
  const c = await makeCard(), blob = await new Promise(r => c.toBlob(r, 'image/png'))
  const R = S.result, rk = D.RANKS.find(r => r.id === R.rank), title = (R.special ? D.TITLES_SPECIAL[R.special] : rk)[S.lang]
  const file = new File([blob], 'bedhead-rush.png', { type: 'image/png' })
  const text = T('share').replace('{s}', R.score).replace('{t}', title) + ' https://tom3games.github.io/bedhead-rush/'
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text }); return blob } catch (e) { if (e && e.name === 'AbortError') return blob } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bedhead-rush.png'; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast(T('saved')); return blob
}
function toast(s) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = s; document.body.appendChild(d); setTimeout(() => d.remove(), 1600) }

// ---------- 画面遷移
function goTitle() {
  S.view = 'title'; S.result = null; S.tut = false; $('#tut').hidden = true; revealTimers.forEach(clearTimeout)
  newStrands(mulberry(20261030)); S.cat = { st: 'title', t: 0, hits: 0, need: 3 }; setFace('sleep'); S.faceTmp = null
  show('vTitle'); clearBubbles(); updTools(); Snd.setTrack('title'); Snd.dryer(false)
}
function pauseGame(on) {
  if (on && S.view === 'play') { S.view = 'pause'; inp.down = false; show('vPause'); Snd.dryer(false) }
  else if (!on && S.view === 'pause') { S.view = 'play'; show('vPlay'); last = performance.now(); acc = 0 }
}
const firstTap = () => { Snd.init() }
document.addEventListener('pointerdown', firstTap, { capture: true })
document.addEventListener('keydown', firstTap, { capture: true })
$('#bStart').onclick = () => { sfx('tap'); startGame() }
$('#bHow').onclick = () => { sfx('tap'); S.view = 'how'; show('vHow') }
$('#bHowBack').onclick = () => { sfx('tap'); S.view = 'title'; show('vTitle') }
$('#bHowGo').onclick = () => { sfx('tap'); startGame() }
$('#bAgain').onclick = () => { sfx('tap'); revealTimers.forEach(clearTimeout); startGame() }
$('#bTitle').onclick = () => { sfx('tap'); goTitle() }
$('#bSave').onclick = () => { sfx('tap'); saveImage() }
// Xでポスト: クリックの同期処理内で開く（ポップアップブロック回避）。URL は url パラメータで渡す
const PUB_URL = 'https://tom3games.github.io/bedhead-rush/'
function xText() { const R = S.result; if (!R) return ''; const rk = D.RANKS.find(r => r.id === R.rank), title = (R.special ? D.TITLES_SPECIAL[R.special] : rk)[S.lang]; return T('share').replace('{s}', R.score).replace('{t}', title) }
function xUrl() { return 'https://x.com/intent/post?text=' + encodeURIComponent(xText()) + '&url=' + encodeURIComponent(PUB_URL) }
$('#bX').onclick = () => { window.open(xUrl(), '_blank', 'noopener'); sfx('tap') }
$('#bPause').onclick = () => pauseGame(true)
$('#bResume').onclick = () => pauseGame(false)
$('#bQuit').onclick = () => goTitle()
$('#bMute').onclick = () => { S.muted = !S.muted; store.set('mute', S.muted ? '1' : '0'); applyMute() }
$('#bLang').onclick = () => { S.lang = S.lang === 'ja' ? 'en' : 'ja'; store.set('lang', S.lang); applyLang() }
$('#bLeave').onclick = () => { if (S.view === 'play' && !S.tut) { inp.leave = true } }
$('#bPlug').onclick = () => { inp.plug = true }
$$('.tool').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); setTool(+b.dataset.tool) }))
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(true) })
addEventListener('keydown', e => {
  if (S.view === 'play') {
    if (['1', '2', '3', '4'].includes(e.key)) setTool(+e.key - 1)
    else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') pauseGame(true)
  } else if (S.view === 'pause' && (e.key === 'Escape' || e.key === 'p' || e.key === 'P')) pauseGame(false)
  else if (S.view === 'title' && e.key === 'Enter') startGame()
})
// なぞり（マウスと指）→ 頭のローカル座標の点 B と視線 V
const ray = new THREE.Raycaster(), _inv = new THREE.Matrix4(), _o = new V3(), _dir = new V3()
function pointerToLocal(x, y) {
  const ndc = new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1)
  ray.setFromCamera(ndc, camera)
  _inv.copy(head.matrixWorld).invert()
  _o.copy(ray.ray.origin).applyMatrix4(_inv); _dir.copy(ray.ray.direction).transformDirection(_inv)
  const b = _o.dot(_dir), c = _o.lengthSq() - 1.15 * 1.15, disc = b * b - c
  const t = disc >= 0 ? -b - Math.sqrt(disc) : -b
  return [_o.clone().addScaledVector(_dir, t), _dir.clone()]
}
function catHit(x, y) {
  if (!catOnHead() || !cat.visible) return false
  const p = catScreenPt(), q = cat.position.clone(); q.x += 0.9; q.project(camera)
  const r = Math.max(36, Math.abs((q.x + 1) / 2 * innerWidth - p[0]) * 1.1)
  return Math.hypot(x - p[0], y - p[1] + r * 0.2) < r
}
let dragId = null
canvas.addEventListener('pointerdown', e => {
  if (S.view !== 'play' || S.tut || S.bot) return
  inp.sx = e.clientX; inp.sy = e.clientY; inp.over = true
  if (catHit(e.clientX, e.clientY)) { inp.tapCat = true; return }
  dragId = e.pointerId; try { canvas.setPointerCapture(e.pointerId) } catch (er) {}
  const [B, V] = pointerToLocal(e.clientX, e.clientY); inp.B.copy(B); inp.V.copy(V); inp.down = true; inp.pressT = 0
})
canvas.addEventListener('pointermove', e => {
  inp.sx = e.clientX; inp.sy = e.clientY; inp.over = true
  if (dragId !== e.pointerId || S.view !== 'play' || S.bot) return
  const [B, V] = pointerToLocal(e.clientX, e.clientY)
  const mv = B.clone().sub(inp.B); mv.addScaledVector(V, -mv.dot(V))
  inp.moveAcc += Math.min(0.45, mv.length()); inp.B.copy(B); inp.V.copy(V)
})
for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, e => { if (e.pointerId === dragId) { dragId = null; if (!S.bot) inp.down = false } if (e.pointerType !== 'mouse') inp.over = false })
canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') inp.over = false })

// ---------- 描画
function syncHair() {
  let k = 0; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new V3(), col = new THREE.Color()
  for (const s of S.strands) {
    col.copy(C_BASE).lerp(C_FRIZZ, Math.min(1, s.frizz)).lerp(C_WAX, clamp((s.wax - 0.3) / 1.5, 0, 0.8)).lerp(C_WET, clamp(s.wet, 0, 1) * 0.85).lerp(C_HOT, clamp((s.heat - 0.35) / 0.65, 0, 1))
    for (let i = 0; i < s.n; i++) {
      const a = s.pts[i], b = s.pts[i + 1]; _d.copy(b).sub(a); const L = _d.length(); _d.divideScalar(L || 1)
      const r = s.r0 * (1 - i * 0.17) * (1 + 0.35 * s.frizz)
      q.setFromUnitVectors(UP, _d); sc.set(r, L, r); m4.compose(a, q, sc); segIM.setMatrixAt(k, m4); segIM.setColorAt(k, col)
      const rj = r * 0.78; sc.set(rj, rj, rj); m4.compose(b, q, sc); jointIM.setMatrixAt(k, m4); jointIM.setColorAt(k, col)
      k++
    }
  }
  segIM.count = jointIM.count = k
  segIM.instanceMatrix.needsUpdate = jointIM.instanceMatrix.needsUpdate = true
  if (segIM.instanceColor) segIM.instanceColor.needsUpdate = true
  if (jointIM.instanceColor) jointIM.instanceColor.needsUpdate = true
}
function arc(a, b, k, h) { return a.clone().lerp(b, k).add(new V3(0, Math.sin(k * Math.PI) * h, 0)) }
const CAT_ON = new V3(0, 1.05, -0.1)
function updCat(t) {
  const c = S.cat; if (!c) return
  if (c.st === 'off') { cat.visible = false; return }
  cat.visible = true; c.squish = Math.max(0, (c.squish || 0) - 0.08)
  const onW = head.localToWorld(CAT_ON.clone())
  let sleep = false
  if (c.st === 'title') { cat.position.set(-3.6, -2.1, 1.6); cat.rotation.set(0, 0.6, 0); sleep = true }
  else if (c.st === 'walk') { const k = c.t / CAT_WALK; cat.position.set(lerp(-6, -2.2, k), -2.1, 1.3); cat.rotation.set(0, 0, 0); cat.position.y += Math.abs(Math.sin(k * 18)) * 0.08 }
  else if (c.st === 'jump') { cat.position.copy(arc(new V3(-2.2, -2.1, 1.3), onW, c.t / CAT_JUMP, 1.6)); cat.rotation.set(0, 0, 0.3) }
  else if (c.st === 'on' || c.st === 'sleep') { cat.position.copy(onW); cat.rotation.set(0, -1.15 + Math.sin(t * 2) * 0.12, 0); sleep = c.st === 'sleep'; if (!sleep) cat.position.y += Math.abs(Math.sin(t * 7)) * 0.06 }
  else if (c.st === 'leave') { cat.position.copy(arc(onW, new V3(6, -3, 1.2), c.t / CAT_LEAVE, 1.2)); cat.rotation.set(0, Math.PI, -0.4) }
  const sq = c.squish || 0
  cat.scale.set(0.8 * (1 + sq * 0.3), 0.8 * (sleep ? 0.75 : 1) * (1 - sq * 0.35), 0.8 * (1 + sq * 0.3))
  catParts.eyes.forEach(e => { e.scale.y = sleep ? 0.2 : 1 })
  catParts.tail.rotation.z = 0.7 + Math.sin(t * (sleep ? 1.5 : 5)) * 0.4
  catParts.head.rotation.z = sleep ? -0.35 : 0
}
function drawFx(dt) {
  const W = innerWidth, H = innerHeight
  if (fxc.width !== W || fxc.height !== H) { fxc.width = W; fxc.height = H }
  fx.clearRect(0, 0, W, H)
  // 熱い毛の湯気・テカリ・しずく
  if (S.view === 'play' || S.view === 'result') for (const s of S.strands) {
    if (s.heat > 0.45 && Math.random() < s.heat * 0.5 * dt * 60) { const p = tipScreen(s); parts.push({ k: 'steam', x: p[0], y: p[1], vx: (Math.random() - 0.5) * 20, vy: -50, life: 0.6, t: 0, r: 4 + s.heat * 6 }) }
    if (s.wax > 1.25 && Math.random() < 0.08) { const p = toScreen(s.pts[2 + Math.floor(Math.random() * 3)]); parts.push({ k: 'spark', x: p[0], y: p[1], vx: 0, vy: 0, life: 0.45, t: 0 }) }
    if (s.wet > 0.7 && Math.random() < 0.04) { const p = tipScreen(s); parts.push({ k: 'drip', x: p[0], y: p[1], vx: 0, vy: 30, life: 0.7, t: 0 }) }
  }
  // ドライヤーの風
  if (S.view === 'play' && inp.down && S.tool === 1 && S.plugged && inp.sx >= 0 && Math.random() < 0.9) {
    const cx = toScreen(new V3(0, 0.6, 0)); const ang = Math.atan2(cx[1] - inp.sy, cx[0] - inp.sx) + (Math.random() - 0.5) * 0.7
    parts.push({ k: 'wind', x: inp.sx, y: inp.sy, vx: Math.cos(ang) * 420, vy: Math.sin(ang) * 420, life: 0.28, t: 0 })
  }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.t += dt; if (p.t >= p.life) { parts.splice(i, 1); continue }
    p.x += p.vx * dt; p.y += p.vy * dt; const k = p.t / p.life
    if (p.k === 'mist') { fx.fillStyle = `rgba(150,215,255,${0.8 * (1 - k)})`; fx.beginPath(); fx.arc(p.x, p.y, 2.5 + k * 3, 0, 7); fx.fill() }
    else if (p.k === 'wind') { fx.strokeStyle = `rgba(255,255,255,${0.75 * (1 - k)})`; fx.lineWidth = 3; fx.beginPath(); fx.moveTo(p.x, p.y); fx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05); fx.stroke() }
    else if (p.k === 'steam' || p.k === 'smoke') { fx.fillStyle = p.k === 'smoke' ? `rgba(90,80,80,${0.55 * (1 - k)})` : `rgba(255,255,255,${0.6 * (1 - k)})`; fx.beginPath(); fx.arc(p.x, p.y, p.r * (1 + k), 0, 7); fx.fill() }
    else if (p.k === 'spark') { fx.fillStyle = `rgba(255,255,220,${1 - k})`; const r = 6 * (1 - Math.abs(k - 0.5) * 2); fx.beginPath(); fx.moveTo(p.x, p.y - r * 2); fx.lineTo(p.x + r * 0.5, p.y); fx.lineTo(p.x, p.y + r * 2); fx.lineTo(p.x - r * 0.5, p.y); fx.fill(); fx.fillRect(p.x - r * 2, p.y - 1, r * 4, 2) }
    else if (p.k === 'drip') { fx.fillStyle = `rgba(110,195,255,${1 - k})`; fx.beginPath(); fx.arc(p.x, p.y, 3.5, 0, 7); fx.fill() }
  }
  // 道具のカーソル
  if (S.view === 'play' && !S.tut && inp.over && inp.sx >= 0) {
    const im = iconImg[ICON_KEYS[S.tool]], sz = isTouch ? 46 : 54
    fx.save(); fx.translate(inp.sx, inp.sy)
    fx.strokeStyle = 'rgba(42,34,51,.55)'; fx.lineWidth = 2; fx.setLineDash([4, 4]); fx.beginPath(); fx.arc(0, 0, [26, 40, 36, 26][S.tool] * (isTouch ? 0.9 : 1), 0, 7); fx.stroke(); fx.setLineDash([])
    if (im.complete) { fx.rotate(inp.down ? Math.sin(performance.now() / 50) * 0.12 : 0); fx.drawImage(im, isTouch ? -sz / 2 : 6, isTouch ? -sz - 26 : -sz + 8, sz, sz) }
    fx.restore()
  }
}

// カメラ: 使える領域（HUD を除いた所）に頭がちょうど収まる距離
const CAM_DIR = new V3(0, 0.25, 1).normalize(), CAM_TGT = new V3(0, 0.3, 0)
function insets() {
  const W = innerWidth, H = innerHeight, r = { t: 0, b: 0, l: 0, r: 0 }
  const rect = q => { const el = $(q); return el && el.offsetParent ? el.getBoundingClientRect() : null }
  if (S.view === 'title') {
    const a = rect('.tTop'), b = rect('.tBtns'), land = W > H && (H <= 620 || W >= 900)
    if (land && a) r.l = Math.max(a.right, b ? b.right : 0) + 6
    else { if (a) r.t = a.bottom; if (b) r.b = H - b.top }
  } else if (S.view === 'play' || S.view === 'pause' || S.view === 'how') {
    const a = rect('#clock'), b = rect('.dock')
    if (b && b.height > b.width * 1.5) { r.r = W - b.left + 4; r.t = 8; r.b = 8 } // 横持ち: 道具は右の縦1列
    else { if (a) r.t = a.bottom + 4; if (b) r.b = H - b.top + 4 }
    if (S.view !== 'play') { r.t = 70; r.b = 90 }
  }
  return r
}
function resize() {
  const W = innerWidth, H = innerHeight
  renderer.setSize(W, H, false)
  const ins = insets(), uw = Math.max(120, W - ins.l - ins.r), uh = Math.max(120, H - ins.t - ins.b)
  const tan = Math.tan(camera.fov * Math.PI / 360), asp = W / H
  const needH = 4.7, needW = W / H < 0.8 ? 4.2 : 5.6
  let d = Math.max(needH * H / uh / (2 * tan), needW * W / uw / (2 * tan * asp)); d = clamp(d, 6, 40)
  camera.aspect = asp; camera.position.copy(CAM_TGT).addScaledVector(CAM_DIR, d); camera.lookAt(CAM_TGT); camera.updateProjectionMatrix()
  const ox = (ins.r - ins.l) / 2, oy = (ins.b - ins.t) / 2
  if (Math.abs(ox) > 1 || Math.abs(oy) > 1) camera.setViewOffset(W, H, ox, oy, W, H); else camera.clearViewOffset()
  camera.updateMatrixWorld()
}
addEventListener('resize', () => resize())
let acc = 0, last = performance.now(), frames = 0
function frame() {
  requestAnimationFrame(frame)
  const now = performance.now(); let d = (now - last) / 1000; last = now; if (d > 0.25) d = 0.25
  if (!S.dbgPause && S.view !== 'pause') { acc += d; let n = 0; while (acc >= DT && n < 8) { step(); acc -= DT; n++ } if (n === 8) acc = 0 }
  render(S.dbgPause ? 0 : d)
}
function render(d = 0) {
  Snd.tick()
  Snd.dryer(S.view === 'play' && !S.tut && inp.down && S.tool === 1 && S.plugged, S.strands.some(s => s.hot && s.heat > 0.5))
  const t = S.simT
  head.position.y = Math.sin(t * 1.6) * 0.03; head.rotation.z = Math.sin(t * 0.7) * 0.03; head.rotation.y = Math.sin(t * 0.5) * 0.05
  head.updateMatrixWorld()
  applyFace(t); syncHair(); updCat(t); hud()
  if (S.view === 'title' && Math.floor(t * 60) % 150 === 0 && t > 0.5) say('Zzz…', toScreen(new V3(0.9, 1.0, 0.5)), 'b')
  drawFx(d)
  renderer.render(scene, camera); frames++
}

// ---------- 検証用の窓口
window.bh = {
  S, D, inp, renderer, camera, scene, head, Snd,
  get strands() { return S.strands },
  start: seed => startGame(seed), title: goTitle, finish, makeCard, saveImage, xText, xUrl, PUB_URL, fillResult, capturePhoto, computeResult,
  setBot: b => { S.bot = b }, setTool, result: () => S.result,
  simulate(seed, bot, quiet = true) {
    const keepSim = S.sim; S.sim = quiet; const v0 = S.view
    startGame(seed); S.bot = bot; S.tut = false; let n = 0
    while (S.view === 'play' && n < 70 * 60) { step(); n++ }
    S.bot = null; S.sim = keepSim
    const r = { ...S.result, steps: n }
    if (quiet) { S.view = v0 === 'play' ? 'title' : v0 }
    return r
  },
  force: {
    cat() { S.ev.catDone = true; S.cat.st = 'walk'; S.cat.t = 0 }, catOn() { S.ev.catDone = true; S.cat.st = 'on'; S.cat.t = 0; S.cat.hits = 0; S.cat.need = 3; $('#banner').textContent = T('catTap'); $('#banner').hidden = false },
    cord() { S.ev.cordDone = true; unplug() }, ahoge() { spawnAhoge() }, boom(i) { explode(S.strands[i]) },
    mess(v) { for (const s of S.strands) { s.m = v; s.mv = v; poseStrand(s) } }, wet(v) { for (const s of S.strands) s.wet = v }, wax(v) { for (const s of S.strands) s.wax = v },
  },
  tapCat: () => catTap(), plug: () => plugIn(), catHit, toScreen, tipScreen, pointerToLocal,
  dbg: { pause(b = true) { S.dbgPause = b; if (!b) { last = performance.now(); acc = 0 } }, step(n = 1) { for (let i = 0; i < n; i++) step() }, render() { render(0) } },
  fps: () => new Promise(res => { const f0 = frames, t0 = performance.now(); setTimeout(() => res(Math.round((frames - f0) / ((performance.now() - t0) / 1000))), 2000) }),
}
applyLang(); applyMute(); goTitle(); resize()
requestAnimationFrame(frame)
window.__bhReady = true
