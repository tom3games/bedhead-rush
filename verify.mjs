// 自分で壊す検証。node verify.mjs（全部 pass で 0 終了）。サーバーは空いているポートを自動で取る
import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { chromium, webkit } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = await new Promise(r => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)) }) })
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 500))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)) }
async function open(browser, opts = {}, tutDone = true) {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, acceptDownloads: true, ...opts })
  await ctx.addInitScript(k => { try { localStorage.clear(); if (k) localStorage.setItem('bh.tut', '1') } catch (e) {} }, tutDone)
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0); await p.waitForFunction(() => window.__bhReady, null, { timeout: 40000 })
  return p
}
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('main:not([hidden]) *')) {
    if (el.closest('[hidden]') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
const fit = q => q.evaluate(() => {
  const H = innerHeight, W = innerWidth, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  const vis = el => el.offsetParent && !el.closest('[hidden]')
  for (const el of document.querySelectorAll('main:not([hidden]) button, #corner button')) {
    if (!vis(el)) continue
    const r = el.getBoundingClientRect(); if (r.bottom > H + 1 || r.top < -1 || r.right > W + 1 || r.left < -1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom))
  }
  for (const el of document.querySelectorAll('main:not([hidden]) .howCard, main:not([hidden]) .rCard, main:not([hidden]) .tutCard, main:not([hidden]) .clock, main:not([hidden]) .logo')) { if (!vis(el)) continue; const r = el.getBoundingClientRect(); if (r.bottom > H + 1 || r.top < -1) over.push(el.className + ':' + Math.round(r.top) + '-' + Math.round(r.bottom)) }
  // カードの中身がカードからはみ出していない
  for (const card of document.querySelectorAll('main:not([hidden]) .rCard, main:not([hidden]) .howCard')) { if (card.scrollHeight > card.clientHeight + 2) over.push('cardScroll ' + card.className + ':' + card.scrollHeight + '>' + card.clientHeight) }
  const bs = [...document.querySelectorAll('main:not([hidden]) button, #corner button')].filter(vis).map(b => [b.id || b.className, b.getBoundingClientRect()])
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i][1], b = bs[j][1]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) over.push('overlap ' + bs[i][0] + '/' + bs[j][0]) }
  // 時計と右上のボタンが重ならない
  const ck = document.querySelector('#clock'), cn = document.querySelector('#corner')
  if (ck && vis(ck)) { const a = ck.getBoundingClientRect(), b = cn.getBoundingClientRect(); if (a.right > b.left - 2 && a.top < b.bottom) over.push('clock/corner') }
  // 時刻が折り返していない（1行）
  const tm = document.querySelector('#clkTime'); if (tm && vis(tm) && tm.getBoundingClientRect().height > parseFloat(getComputedStyle(tm).fontSize) * 1.5) over.push('clock wraps')
  // 結果の称号・同僚の吹き出しが1〜3行に収まる
  for (const q of ['#rTitle', '#rReact']) { const el = document.querySelector(q); if (el && vis(el)) { const lh = parseFloat(getComputedStyle(el).fontSize) * 1.5; if (el.getBoundingClientRect().height > lh * 3.2) over.push(q + ' too many lines') } }
  return { H, over: over.slice(0, 6) }
})
const glVariance = p => p.evaluate(() => {
  bh.dbg.render(); const src = document.querySelector('#gl'), c = document.createElement('canvas'); c.width = 200; c.height = 200
  const x = c.getContext('2d'); x.drawImage(src, 0, 0, 200, 200); const d = x.getImageData(0, 0, 200, 200).data
  let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 7) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ }
  return Math.round(s2 / n - (s / n) ** 2)
})
// 毛束 i の真ん中あたりをマウスで往復してなでる（実際のポインタ操作）
async function stroke(p, i, n = 12, amp = 26) {
  const [x, y] = await p.evaluate(i => { bh.dbg.render(); const s = bh.strands[i]; return bh.toScreen(s.pts[3]) }, i)
  await p.mouse.move(x, y); await p.mouse.down()
  for (let k = 0; k < n; k++) { await p.mouse.move(x + (k % 2 ? -amp : amp), y + (k % 2 ? 4 : -4), { steps: 3 }); await p.evaluate(() => bh.dbg.step(2)) }
  await p.mouse.up(); await p.evaluate(() => bh.dbg.step(1))
}
async function hold(p, i, frames) {
  const [x, y] = await p.evaluate(i => { bh.dbg.render(); return bh.toScreen(bh.strands[i].pts[3]) }, i)
  await p.mouse.move(x, y); await p.mouse.down(); await p.evaluate(f => bh.dbg.step(f), frames); await p.mouse.up(); await p.evaluate(() => bh.dbg.step(1))
}
// ---- Xでポスト の検査道具
// window.open をスタブして押す → 開いたURLを分解して確かめる
const xStub = async (pg, ns, pub, tag) => {
  await pg.evaluate(() => { window.__opened = []; if (!window.__origOpen) window.__origOpen = window.open; window.open = (...a) => { window.__opened.push(a); return null } })
  const vis = await pg.evaluate(() => { const b = document.querySelector('#bX'), r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, clip: b.scrollWidth > b.clientWidth + 1, bg: getComputedStyle(b).backgroundColor, label: b.textContent.trim(), svg: !!b.querySelector('svg path') } })
  await pg.click('#bX')
  const r = await pg.evaluate(ns => ({ opened: window.__opened, text: window[ns].xText(), url: window[ns].xUrl() }), ns)
  await pg.evaluate(() => { window.open = window.__origOpen })
  expect(r.opened.length === 1, r)
  const [u, target, feat] = r.opened[0], q = new URL(u)
  const text = q.searchParams.get('text'), url = q.searchParams.get('url')
  expect(u.startsWith('https://x.com/intent/post?') && target === '_blank' && /noopener/.test(feat || '') && u === r.url, r.opened[0])
  expect(text === r.text && text.includes(tag) && (text.match(/#/g) || []).length === 1 && url === pub && !/https?:\/\//.test(text), { text, url })
  expect(vis.inView && !vis.clip && vis.svg && vis.bg === 'rgb(0, 0, 0)' && vis.h >= 36, vis)
  return { label: vis.label, text }
}
// 本物のクリックで新しいタブ（popup）が開く。x.com へは出ずにダミーを返す
const xPopup = async (pg, pub) => {
  await pg.context().route(/^https:\/\/x\.com\//, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>x</title>ok' }))
  const [pop] = await Promise.all([pg.waitForEvent('popup', { timeout: 8000 }), pg.click('#bX')])
  await pop.waitForLoadState().catch(() => {})
  const u = new URL(pop.url()); await pop.close()
  expect(u.origin + u.pathname === 'https://x.com/intent/post' && u.searchParams.get('url') === pub && u.searchParams.get('text'), pop.url())
  return u.searchParams.get('text')
}
// 結果画面のボタンの文字が切れていない
const btnClip = pg => pg.evaluate(() => [...document.querySelectorAll('#vResult button')].filter(b => b.offsetParent && b.scrollWidth > b.clientWidth + 1).map(b => b.id + ':' + b.scrollWidth + '>' + b.clientWidth))
const PUB = 'https://tom3games.github.io/bedhead-rush/'
const SIZES = [[360, 640, 'small'], [390, 844, 'phone'], [844, 390, 'land'], [667, 375, 'land-se'], [768, 1024, 'tab'], [1440, 900, 'pc']]

const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const p = await open(browser, {}, false)
await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('ブラウザの拡大が起きない（viewport・ピンチ・Ctrl+ホイール・Ctrl+プラス）', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', r); return r
})
await t('OGP 一式があり og:image と og:url が公開先', async () => {
  const r = await p.evaluate(() => Object.fromEntries(['og:title', 'og:description', 'og:image', 'og:url', 'og:type'].map(k => [k, document.querySelector(`meta[property="${k}"]`)?.content]).concat([['tw', document.querySelector('meta[name="twitter:card"]')?.content]])))
  expect(Object.values(r).every(Boolean) && r['og:image'] === 'https://tom3games.com/play/bedhead-rush/og.png?v=1' && r['og:url'] === 'https://tom3games.com/play/bedhead-rush/' && r.tw === 'summary_large_image', r)
})
await t('タイトル: 3D の洗面所と寝癖頭が描けている（輝度の散らばり）・寝ている顔', async () => { await p.waitForTimeout(400); const v = await glVariance(p); const face = await p.evaluate(() => bh.S.face); expect(v > 150 && face === 'sleep', { v, face }); return { variance: v, face } })
await p.screenshot({ path: ROOT + '/shots/v-title.png' })
await t('タイトル → 遊び方 → もどる → 遊び方から開始（PC はマウスの説明）', async () => {
  await p.click('#bHow'); expect(await p.isVisible('#vHow'), 'how'); const txt = await p.textContent('#ctrlLine'); expect(/マウス/.test(txt), txt)
  await p.screenshot({ path: ROOT + '/shots/v-how.png' })
  await p.click('#bHowBack'); expect(await p.isVisible('#vTitle'), 'title')
  await p.click('#bHow'); await p.click('#bHowGo'); expect(await p.isVisible('#vPlay'), 'play')
  return txt
})
await t('初回はチュートリアル3枚。出ている間は時間が止まり、閉じると霧吹きを持って始まる。2回目は出ない', async () => {
  expect(await p.isVisible('#tut'), 'no tut'); const t0 = await p.evaluate(() => bh.S.t); await p.waitForTimeout(500); const t1 = await p.evaluate(() => bh.S.t)
  await p.screenshot({ path: ROOT + '/shots/v-tut.png' })
  const titles = []; for (let i = 0; i < 3; i++) { titles.push(await p.textContent('#tutT')); await p.click('#bTut') }
  await p.waitForTimeout(300); const r = await p.evaluate(() => ({ t: bh.S.t, tool: bh.S.tool, tut: bh.S.tut, ls: localStorage.getItem('bh.tut') }))
  await p.evaluate(() => { bh.title(); bh.start(2) }); const again = await p.isVisible('#tut')
  expect(t0 === t1 && r.t > 0 && r.tool === 2 && !r.tut && r.ls === '1' && !again, { t0, t1, ...r, again }); return titles
})
await t('道具の切り替え: 1〜4キーと下のボタン（選んだ道具は台から消える）', async () => {
  await p.evaluate(() => bh.dbg.pause(true))
  const r = []
  for (const k of ['1', '2', '3', '4']) { await p.keyboard.press(k); r.push(await p.evaluate(() => bh.S.tool)) }
  await p.click('.tool[data-tool="1"]'); r.push(await p.evaluate(() => bh.S.tool))
  const on = await p.evaluate(() => document.querySelector('.tool.on').dataset.tool)
  expect(r.join() === '0,1,2,3,1' && on === '1', { r, on }); return r
})
// --- 遊びの仕組み（実際のマウス操作）
await t('くし: 乾いた毛はなかなか寝ない、霧吹きで濡らすとよく寝る（同じなで方で比較）', async () => {
  const one = async (wet) => {
    await p.evaluate(w => { bh.start(11); bh.dbg.pause(true); bh.S.ev.ahoge = []; bh.S.ev.catT = 999; bh.S.ev.cordT = 999; bh.force.mess(1); if (w) bh.force.wet(1); bh.setTool(0); bh.dbg.step(2) }, wet)
    await stroke(p, 4, 14); return p.evaluate(() => +bh.strands[4].m.toFixed(3))
  }
  const dry = await one(false), wet = await one(true)
  expect(wet < 0.3 && dry > 0.55 && dry - wet > 0.35, { dry, wet }); return { dry, wet }
})
await t('霧吹き: クリックした所の毛が濡れる（離れた毛は乾いたまま）', async () => {
  await p.evaluate(() => { bh.start(11); bh.dbg.pause(true); bh.S.ev.ahoge = []; bh.S.ev.catT = 999; bh.S.ev.cordT = 999; bh.setTool(2); bh.dbg.step(2) })
  await hold(p, 1, 2)
  const r = await p.evaluate(() => ({ near: +bh.strands[1].wet.toFixed(2), far: +bh.strands[15].wet.toFixed(2), sprays: bh.S.stats.sprays }))
  expect(r.near > 0.4 && r.far === 0 && r.sprays === 1, r); return r
})
await t('ドライヤー: 濡れて寝た毛を乾かすと「決まる」（set が上がり乾く）', async () => {
  await p.evaluate(() => { bh.start(11); bh.dbg.pause(true); bh.S.ev.ahoge = []; bh.S.ev.catT = 999; bh.S.ev.cordT = 999; bh.force.mess(0); bh.force.wet(0.8); bh.setTool(1); bh.dbg.step(2) })
  await hold(p, 4, 90)
  const r = await p.evaluate(() => ({ set: +bh.strands[4].set.toFixed(2), wet: +bh.strands[4].wet.toFixed(2), booms: bh.S.stats.booms }))
  expect(r.set > 0.7 && r.wet < 0.15 && r.booms === 0, r); return r
})
await t('ドライヤー: 乾いた毛に当てすぎると爆発（アフロ化・周りも跳ねる）', async () => {
  await p.evaluate(() => { bh.start(11); bh.dbg.pause(true); bh.S.ev.ahoge = []; bh.S.ev.catT = 999; bh.S.ev.cordT = 999; bh.force.mess(0); bh.setTool(1); bh.dbg.step(2) })
  const [x, y] = await p.evaluate(() => { bh.dbg.render(); return bh.toScreen(bh.strands[4].pts[3]) })
  await p.mouse.move(x, y); await p.mouse.down()
  let warm = 0; for (let k = 0; k < 12 && (await p.evaluate(() => bh.S.stats.booms)) === 0; k++) { await p.evaluate(() => bh.dbg.step(20)); warm = Math.max(warm, await p.evaluate(() => Math.max(...bh.strands.map(s => s.heat)))) }
  await p.mouse.up()
  const r = await p.evaluate(() => ({ booms: bh.S.stats.booms, frizz: bh.strands.filter(s => s.frizz > 0.5).length, risen: bh.strands.filter(s => s.m > 0.4).length, sec: +bh.S.t.toFixed(1) }))
  await p.evaluate(() => bh.dbg.render()); await p.screenshot({ path: ROOT + '/shots/v-boom.png' })
  expect(r.booms >= 1 && r.frizz >= 1 && r.risen >= 3 && r.sec > 1.0, { ...r, warm }); return r
})
await t('ピョン戻り: 寝かせただけの毛は時間で戻る、乾かして決めた毛＋ワックスはほぼ戻らない', async () => {
  const r = await p.evaluate(() => {
    const run = (set, wax) => { let tot = 0; for (let k = 0; k < 6; k++) { bh.start(100 + k); bh.dbg.pause(true); bh.S.ev.ahoge = []; bh.S.ev.catT = 999; bh.S.ev.cordT = 999; bh.S.t = 20; for (const s of bh.strands) { s.m = 0; s.mv = 0; s.set = set; s.wax = wax } bh.dbg.step(60 * 20); tot += bh.S.stats.boings } return tot }
    return { plain: run(0, 0), setWax: run(1, 0.8) }
  })
  expect(r.plain >= 25 && r.setWax * 6 <= r.plain, r); return r
})
await t('ワックス: 塗りすぎるとテカる（天ぷら頭）・ワックスが減る', async () => {
  await p.evaluate(() => { bh.start(11); bh.dbg.pause(true); bh.S.ev.ahoge = []; bh.S.ev.catT = 999; bh.S.ev.cordT = 999; bh.setTool(3); bh.dbg.step(2) })
  await hold(p, 1, 120)
  const r = await p.evaluate(() => ({ wax: +bh.strands[1].wax.toFixed(2), jar: +bh.S.jar.toFixed(2) }))
  const res = await p.evaluate(() => { bh.force.mess(0.7); bh.force.wax(2.2); return bh.computeResult(false) })
  expect(r.wax > 1.2 && r.jar < 1 && res.special === 'grease' && res.greasePen > 6, { ...r, res }); return { ...r, special: res.special }
})
await t('アホ毛が予定の時刻に生えて、毛束が増える', async () => {
  const r = await p.evaluate(() => { bh.start(21); bh.dbg.pause(true); const n0 = bh.strands.length, at = bh.S.ev.ahoge.slice(); bh.S.ev.catT = 999; bh.dbg.step(Math.ceil(at[0] * 60) + 2); return { n0, n1: bh.strands.length, at: at.map(v => +v.toFixed(1)), ahoge: bh.strands.filter(s => s.ahoge).length } })
  expect(r.n1 === r.n0 + 1 && r.ahoge === 1, r); return r
})
await t('猫: 台を歩いて頭に乗る → 頭の上の毛は触れない → 3回クリックでどく', async () => {
  await p.evaluate(() => { bh.start(31); bh.dbg.pause(true); bh.S.ev.ahoge = []; bh.S.ev.cordT = 999; bh.force.mess(0); bh.force.cat(); bh.dbg.step(Math.ceil(60 * 2.6)); bh.dbg.render() })
  const st = await p.evaluate(() => ({ st: bh.S.cat.st, banner: !document.querySelector('#banner').hidden }))
  await p.screenshot({ path: ROOT + '/shots/v-cat.png' })
  // 頭のてっぺんの毛は猫の下なので、くしが効かない
  const blocked = await p.evaluate(() => { const s = bh.strands[0]; s.m = 1; s.mv = 1; bh.dbg.step(1); bh.S.tool = 0; bh.inp.B.copy(s.pts[3]); bh.inp.V.copy(s.pts[3]).sub(new s.u.constructor(0, 2, 8)).normalize(); bh.inp.down = true; for (let k = 0; k < 30; k++) { bh.inp.moveAcc = 0.3; bh.dbg.step(1) } bh.inp.down = false; return s.m > 0.95 })
  // 猫の画面位置を探してクリック
  const hitPt = await p.evaluate(() => { for (let y = 0; y < innerHeight; y += 6) for (let x = 0; x < innerWidth; x += 6) if (bh.catHit(x, y)) return [x + 12, y + 12]; return null })
  expect(hitPt, 'cat not hittable')
  for (let i = 0; i < 3; i++) { await p.mouse.click(hitPt[0], hitPt[1]); await p.evaluate(() => bh.dbg.step(3)) }
  const after = await p.evaluate(() => { const a = bh.S.cat.st; bh.dbg.step(60); return { a, b: bh.S.cat.st, banner: !document.querySelector('#banner').hidden } })
  expect(st.st === 'on' && st.banner && blocked && after.a === 'leave' && after.b === 'off' && !after.banner, { st, after }); return { st, after }
})
await t('猫: 放っておくと寝て、乗せたまま出社すると「猫と出社」', async () => {
  const r = await p.evaluate(() => { bh.start(31); bh.dbg.pause(true); bh.S.ev.ahoge = []; bh.S.ev.cordT = 999; bh.force.catOn(); bh.dbg.step(60 * 8); const st = bh.S.cat.st, need = bh.S.cat.need; bh.finish(false); return { st, need, sp: bh.result().special, cat: bh.result().cat } })
  expect(r.st === 'sleep' && r.need === 5 && r.sp === 'cat' && r.cat, r); return r
})
await t('ドライヤーのコードが抜ける → 風が出ない → 「差す」を押すと直る', async () => {
  await p.evaluate(() => { bh.title(); bh.start(11); bh.dbg.pause(true); bh.S.ev.ahoge = []; bh.S.ev.catT = 999; bh.force.mess(0); bh.force.wet(0.8); bh.setTool(1); bh.force.cord(); bh.dbg.step(2) })
  const vis = await p.isVisible('#bPlug')
  await hold(p, 4, 40); const dead = await p.evaluate(() => +bh.strands[4].wet.toFixed(2))
  await p.click('#bPlug'); await p.evaluate(() => bh.dbg.step(2))
  await hold(p, 4, 40); const alive = await p.evaluate(() => +bh.strands[4].wet.toFixed(2))
  const r = { vis, dead, alive, plugged: await p.evaluate(() => bh.S.plugged), hidden: await p.isHidden('#bPlug') }
  expect(vis && dead > 0.75 && alive < 0.5 && r.plugged && r.hidden, r); return r
})
await t('電車の時計: 7:39:00 から始まり、半分で 7:40:30、時間切れは 7:42:00 で遅刻', async () => {
  const r = await p.evaluate(() => { bh.start(5); bh.dbg.pause(true); bh.S.ev.catT = 999; bh.dbg.render(); const a = document.querySelector('#clkTime').textContent; bh.dbg.step(25 * 60); bh.dbg.render(); const b = document.querySelector('#clkTime').textContent, left = document.querySelector('#clkLeft').textContent; bh.dbg.step(25 * 60 + 5); const R = bh.result(); return { a, b, left, view: bh.S.view, late: R.late, dep: R.depart } })
  expect(r.a === '7:39:00' && r.b === '7:40:30' && r.left === '1:30' && r.view === 'result' && r.late && r.dep === 7 * 3600 + 42 * 60, r); return r
})
await t('残り12秒で焦りモード（時計が赤く揺れる・顔が焦る）', async () => {
  const r = await p.evaluate(() => { bh.title(); bh.start(5); bh.dbg.pause(true); bh.S.ev.catT = 999; bh.dbg.step(60 * 39); return { hurry: bh.S.hurry, cls: document.querySelector('#clock').className, face: bh.S.face } })
  expect(r.hurry && /hurry/.test(r.cls) && r.face === 'panic', r); return r
})
await t('「行ってきます」で早めに出ると遅刻にならず、時間ボーナスが付く', async () => {
  const r = await p.evaluate(() => { bh.title(); bh.start(5); bh.dbg.pause(true); bh.S.ev.catT = 999; bh.force.mess(0.1); bh.dbg.step(60 * 20); return 1 })
  await p.click('#bLeave'); await p.evaluate(() => bh.dbg.step(1))
  const R = await p.evaluate(() => bh.result())
  const same = await p.evaluate(() => { const s = bh.S; return bh.computeResult(true).score })
  expect(R && !R.late && R.leftSec > 25 && R.depart < 7 * 3600 + 42 * 60, R); return { score: R.score, leftSec: R.leftSec, depart: R.depart }
})
await t('採点の再現性: 同じ seed と bot なら結果が同じ（画面サイズに依らない）', async () => {
  const r = await p.evaluate(() => [bh.simulate(77, 'good'), bh.simulate(77, 'good'), bh.simulate(77, 'normal'), bh.simulate(77, 'normal')])
  expect(JSON.stringify(r[0]) === JSON.stringify(r[1]) && JSON.stringify(r[2]) === JSON.stringify(r[3]) && r[0].steps > 2000, r); return { good: r[0].score, normal: r[2].score }
})
let dist
await t('難しさの分布（各20回）: 上手=A中心でSはたまに、ふつう=中間(C中心)、雑=低い、放置=D', async () => {
  dist = await p.evaluate(() => { const out = {}; for (const bot of ['good', 'normal', 'sloppy', 'idle']) { out[bot] = { ranks: {}, scores: [], titles: [] }; for (let s = 1; s <= 20; s++) { const x = bh.simulate(s * 37, bot); out[bot].ranks[x.rank] = (out[bot].ranks[x.rank] || 0) + 1; out[bot].scores.push(x.score); out[bot].titles.push(x.special || x.rank) } out[bot].avg = +(out[bot].scores.reduce((a, b) => a + b, 0) / 20).toFixed(1) } return out })
  const g = dist.good.ranks, n = dist.normal.ranks, sl = dist.sloppy.ranks, id = dist.idle.ranks
  const ok = (g.S || 0) >= 1 && (g.S || 0) <= 5 && (g.A || 0) >= 10 && !(n.S || n.A) && (n.C || 0) >= 8 && !(sl.S || sl.A || sl.B) && (id.D || 0) === 20 && dist.good.avg > dist.normal.avg && dist.normal.avg > dist.idle.avg
  expect(ok, Object.fromEntries(Object.entries(dist).map(([k, v]) => [k, { ranks: v.ranks, avg: v.avg }])))
  return Object.fromEntries(Object.entries(dist).map(([k, v]) => [k, { ranks: v.ranks, avg: v.avg }]))
})
await t('称号・反応が少なくとも6種類出る（bot 4種 × 20 seed）', async () => { const set = new Set(Object.values(dist).flatMap(v => v.titles)); expect(set.size >= 6, [...set]); return [...set] })
await t('境界: 全部整えたら S・全部爆発なら0点・びしょ濡れ・アフロ・アンテナの称号', async () => {
  const r = await p.evaluate(() => {
    const go = (fn, late = false) => { bh.start(9); bh.dbg.pause(true); bh.S.ev.catT = 999; fn(); bh.dbg.step(1); return bh.computeResult(late) }
    const perfect = go(() => { bh.force.mess(0); for (const s of bh.strands) s.set = 1 })
    const worst = go(() => { bh.force.mess(1); for (const s of bh.strands) s.frizz = 1 }, true)
    const wet = go(() => { bh.force.mess(0.35); bh.force.wet(1) })
    const afro = go(() => { bh.force.mess(0.5); for (let i = 0; i < 6; i++) bh.strands[i].frizz = 1 })
    const ant = go(() => { bh.force.mess(0.3); bh.force.ahoge(); bh.force.ahoge(); for (const s of bh.strands) if (s.ahoge) { s.m = 1; s.mv = 1 } })
    return { perfect: [perfect.score, perfect.rank], worst: [worst.score, worst.rank], wet: [wet.score, wet.special], afro: [afro.score, afro.special], ant: [ant.score, ant.special] }
  })
  expect(r.perfect[1] === 'S' && r.perfect[0] <= 100 && r.worst[0] === 0 && r.worst[1] === 'D' && r.wet[1] === 'wet' && r.afro[1] === 'afro' && r.ant[1] === 'antenna', r); return r
})
// --- 結果
await t('結果発表: 判定（ハンコ・称号）は点数の数え上げの後に出る・社員証の顔写真が入る', async () => {
  await p.evaluate(() => { bh.title(); bh.start(37); bh.dbg.pause(true); bh.setBot('good'); let k = 0; while (bh.S.view === 'play' && k++ < 4000) bh.dbg.step(1); bh.setBot(null); bh.dbg.pause(false) })
  await p.waitForTimeout(900)
  const early = await p.evaluate(() => ({ stamp: getComputedStyle(document.querySelector('#rStamp')).visibility, title: getComputedStyle(document.querySelector('#rTitle')).opacity, view: !document.querySelector('#vResult').hidden }))
  await p.waitForTimeout(2600)
  const r = await p.evaluate(() => ({ vis: getComputedStyle(document.querySelector('#rStamp')).visibility, rank: document.querySelector('#rRank').textContent, score: document.querySelector('#rScore').textContent, title: document.querySelector('#rTitle').textContent, react: document.querySelector('#rReact').textContent, res: bh.result(), photo: document.querySelector('#rPhoto').naturalWidth }))
  await p.screenshot({ path: ROOT + '/shots/v-result-good.png' })
  expect(early.view && early.stamp === 'hidden' && early.title === '0' && r.vis === 'visible' && r.rank === r.res.rank && r.score === String(r.res.score) && r.title.length > 1 && r.react.length > 3 && r.photo === 480, { early, ...r }); return { rank: r.rank, score: r.score, title: r.title, react: r.react }
})
await t('結果画像 1080x1350（顔写真入り）が描けて保存（ダウンロード）できる', async () => {
  const info = await p.evaluate(async () => { const c = await bh.makeCard(); const x = c.getContext('2d'); const ph = x.getImageData(140, 330, 320, 400).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < ph.length; i += 4 * 37) { const v = ph[i] * .3 + ph[i + 1] * .59 + ph[i + 2] * .11; s += v; s2 += v * v; n++ } return { w: c.width, h: c.height, photoVar: Math.round(s2 / n - (s / n) ** 2), url: c.toDataURL('image/png') } })
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }), p.click('#bSave')])
  writeFileSync(ROOT + '/shots/v-card.png', Buffer.from(info.url.split(',')[1], 'base64'))
  expect(info.w === 1080 && info.h === 1350 && info.photoVar > 300 && dl.suggestedFilename() === 'bedhead-rush.png', info.photoVar); return { w: info.w, h: info.h, photoVar: info.photoVar, file: dl.suggestedFilename() }
})
await t('Xでポスト: 日本語（ボタンが見える・x.com/intent/post・本文に点数と称号とハッシュタグ・url=公開URL）', async () => {
  const r = await xStub(p, 'bh', PUB, '#寝癖なおし3分前')
  const n = await p.evaluate(() => [document.querySelector('#rScore').textContent, document.querySelector('#rTitle').textContent])
  expect(r.label === 'Xでポスト' && r.text.includes(n[0] + '点') && r.text.includes('「' + n[1] + '」'), { r, n }); return r.text
})
await t('Xでポスト: 本物のクリックで新しいタブが開く', async () => { const tx = await xPopup(p, PUB); expect(/#寝癖なおし3分前/.test(tx), tx); return tx.length })
await t('Xでポスト: 英語', async () => {
  await p.click('#bLang')
  const r = await xStub(p, 'bh', PUB, '#BEDHEADRUSH')
  const n = await p.evaluate(() => [document.querySelector('#rScore').textContent, document.querySelector('#rTitle').textContent])
  await p.screenshot({ path: ROOT + '/shots/v-result-en-x.png' })
  await p.click('#bLang')
  expect(r.label === 'Post on X' && r.text.includes(n[0]) && r.text.includes(n[1]) && !/[ぁ-んァ-ン一-龥]/.test(r.text), { r, n }); return r.text
})
await t('もう一回ですぐ遊べる（状態が初期化される）', async () => {
  await p.click('#bAgain'); const r = await p.evaluate(() => ({ view: bh.S.view, t: bh.S.t, jar: bh.S.jar, plugged: bh.S.plugged, cat: bh.S.cat.st, n: bh.strands.length, messy: bh.strands.every(s => s.m >= 0.75), booms: bh.S.stats.booms }))
  expect(r.view === 'play' && r.t < 0.5 && r.jar === 1 && r.plugged && r.cat === 'off' && r.n === 16 && r.messy && r.booms === 0, r); return r
})
await t('猫と出社・遅刻の結果でも画面と画像が出る', async () => {
  const r = await p.evaluate(async () => { bh.dbg.pause(true); bh.title(); bh.start(31); bh.S.ev.cordT = 999; bh.force.catOn(); bh.dbg.step(60 * 51); bh.dbg.pause(false); const c = await bh.makeCard(); return { res: bh.result(), card: c.width } })
  await p.waitForTimeout(3600); await p.screenshot({ path: ROOT + '/shots/v-result-cat.png' })
  const txt = await p.evaluate(() => ({ title: document.querySelector('#rTitle').textContent, tag: document.querySelector('#rTag').textContent }))
  expect(r.res.special === 'cat' && r.res.late && r.card === 1080 && txt.title === '猫と出社' && txt.tag === '遅刻', { ...txt, sp: r.res.special }); return txt
})
await t('音: 全効果音と曲・ドライヤー音を鳴らしてもエラーなし・音が出ている', async () => {
  await p.mouse.click(5, 300)
  const r = await p.evaluate(async () => {
    const S = window.Snd; S.init(); S.setMute(false)
    for (const n of ['tap', 'tool', 'comb', 'spray', 'wax', 'boing', 'boom', 'ahoge', 'meow', 'hiss', 'purr', 'unplug', 'plug', 'scream', 'yawn', 'oops', 'tick', 'horn', 'door', 'roll', 'stamp', 'cheer', 'laugh', 'boo', 'hurry']) S.sfx(n)
    S.dryer(true, true)
    for (const tr of ['title', 'play', 'hurry', 'win', 'sad']) { S.setTrack(tr); for (let i = 0; i < 20; i++) { await new Promise(r => setTimeout(r, 20)); S.tick() } }
    let lv = 0; for (let i = 0; i < 10; i++) { await new Promise(r => setTimeout(r, 30)); lv = Math.max(lv, S.level()) }
    S.dryer(false)
    return { state: S.ctx?.state, level: +lv.toFixed(3), played: Object.keys(S.played).length }
  })
  expect((r.level > 0.01 && r.played >= 28 || r.state === 'suspended' && r.played >= 23) && p.errs.length === 0, { ...r, errs: p.errs }); return r
})
await t('ミュートが効いて保存される', async () => {
  await p.click('#bMute'); const r = await p.evaluate(() => ({ m: window.Snd.muted, g: window.Snd.master?.gain.value, ls: localStorage.getItem('bh.mute') }))
  await p.click('#bMute'); expect(r.m && r.g === 0 && r.ls === '1', r); return r
})
await t('英語に切り替わる（タイトル・遊び方・道具・結果）', async () => {
  await p.evaluate(() => bh.title()); await p.click('#bLang')
  const r = await p.evaluate(() => ({ l1: document.querySelector('.logo .l1').textContent, l2: document.querySelector('.logo .l2').textContent, start: document.querySelector('#bStart').textContent.trim(), lang: document.documentElement.lang, tool: document.querySelector('[data-tool-name="1"]').textContent }))
  await p.screenshot({ path: ROOT + '/shots/v-title-en.png' })
  await p.click('#bHow'); await p.screenshot({ path: ROOT + '/shots/v-how-en.png' }); const how = await p.textContent('#vHow')
  await p.evaluate(() => { bh.dbg.pause(true); bh.start(37); bh.setBot('good'); let k = 0; while (bh.S.view === 'play' && k++ < 4000) bh.dbg.step(1); bh.setBot(null); bh.dbg.pause(false) })
  await p.waitForTimeout(3300); await p.screenshot({ path: ROOT + '/shots/v-result-en.png' })
  const res = await p.evaluate(() => document.querySelector('#rCard').innerText)
  expect(r.l1 === 'BEDHEAD' && r.l2 === 'RUSH' && /Wake up/.test(r.start) && r.lang === 'en' && r.tool === 'Dryer' && !/[ぁ-んァ-ン]/.test(how) && !/[ぁ-んァ-ン]/.test(res), { ...r, res: res.slice(0, 120) })
  await p.click('#bLang'); return r
})
await t('fps（プレイ中・GPU 描画）', async () => {
  await p.evaluate(() => { bh.dbg.pause(false); bh.start(4) }); await p.waitForTimeout(800)
  const fps = await p.evaluate(() => bh.fps()); const info = await p.evaluate(() => ({ calls: bh.renderer.info.render.calls, tris: bh.renderer.info.render.triangles }))
  expect(fps >= 30, fps); return { fps, ...info }
})
await t('全体でエラーが出ていない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await p.close()

// ---- 6サイズ × 全画面で一画面に収まる
for (const [w, h, name] of SIZES) {
  const q = await open(browser, { viewport: { width: w, height: h } }, false)
  const views = {}
  await q.evaluate(() => { bh.dbg.pause(true); bh.dbg.step(30); bh.dbg.render() })
  views.title = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-title.png` })
  await q.click('#bHow'); views.how = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-how.png` })
  await q.click('#bHowGo'); await q.waitForTimeout(100); views.tut = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-tut.png` })
  for (let i = 0; i < 3; i++) await q.click('#bTut')
  await q.evaluate(() => { bh.dbg.pause(true); bh.dbg.step(60 * 6); bh.dbg.render() }); views.play = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-play.png` })
  await t(`${name}: プレイ中の頭が画面の使える所に収まっている（毛先・顔が HUD に隠れない）`, async () => {
    const r = await q.evaluate(() => {
      bh.dbg.render(); const pts = []; for (const s of bh.strands) for (const v of s.pts) pts.push(bh.toScreen(v))
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), face = bh.toScreen(new bh.head.position.constructor(0, 0, 0.9))
      const ck = document.querySelector('#clock').getBoundingClientRect(), dk = document.querySelector('.dock').getBoundingClientRect()
      return { minX: Math.round(Math.min(...xs)), maxX: Math.round(Math.max(...xs)), minY: Math.round(Math.min(...ys)), maxY: Math.round(Math.max(...ys)), face: face.map(Math.round), W: innerWidth, H: innerHeight, ckB: Math.round(ck.bottom), ckR: Math.round(ck.right), dkT: Math.round(dk.top), dkL: Math.round(dk.left), dkV: dk.height > dk.width * 1.5 }
    })
    const faceOk = r.face[1] < (r.dkV ? r.H : r.dkT) && r.face[0] < (r.dkV ? r.dkL : r.W) && r.face[1] > 0
    const inside = r.minX > -4 && r.maxX < r.W + 4 && (r.dkV ? r.maxX < r.dkL + 4 : r.maxY < r.dkT + 4) && r.minY > (r.dkV ? -4 : r.ckB - 30)
    expect(faceOk && inside, r); return { w: r.maxX - r.minX, h: r.maxY - r.minY }
  })
  await q.evaluate(() => { bh.force.catOn(); bh.force.cord(); bh.dbg.step(30); bh.dbg.render() }); views.hazard = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-hazard.png` })
  await q.click('#bPause'); views.pause = await fit(q)
  await q.click('#bResume'); await q.evaluate(() => { bh.dbg.pause(true); bh.plug(); bh.tapCat(); bh.tapCat(); bh.tapCat(); bh.setBot('good'); let k = 0; while (bh.S.view === 'play' && k++ < 4000) bh.dbg.step(1); bh.setBot(null); bh.dbg.pause(false) })
  await q.waitForTimeout(3300); views.result = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-result.png` })
  const clipJa = await btnClip(q)
  await q.click('#bLang'); await q.waitForTimeout(300); views.resultEn = await fit(q); const clipEn = await btnClip(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-result-en.png` }); await q.click('#bLang'); await q.waitForTimeout(300)
  await t(`${name}: 結果画面のボタンの文字が切れない（日英）`, async () => { expect(!clipJa.length && !clipEn.length, [clipJa, clipEn]) })
  for (const [v, r] of Object.entries(views)) await t(`一画面に収まる ${name} ${w}x${h} ${v}`, async () => { expect(!r.over.length, r) })
  await t(`${name}: はみ出し・エラーなし`, async () => { const o = await overflow(q); expect(o.sw <= o.W && !o.bad.length && !q.errs.length, JSON.stringify(o) + q.errs.join('|')) })
  await q.close()
}
await browser.close()

// ---- WebKit（iPhone 相当）でタッチの通し
const wb = await webkit.launch()
for (const [w, h, name] of [[390, 844, 'wk-phone'], [844, 390, 'wk-land']]) {
  const wp = await open(wb, { viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, false)
  await t(`${name}: タップで始まり、チュートリアルはスマホ向けの言い方`, async () => {
    await wp.tap('#bStart'); const r = await wp.evaluate(() => ({ view: bh.S.view, tut: document.querySelector('#tutP').textContent, ctrl: document.querySelector('#ctrlLine').textContent }))
    await wp.screenshot({ path: `${ROOT}/shots/${name}-tut.png` })
    for (let i = 0; i < 3; i++) await wp.tap('#bTut')
    expect(r.view === 'play' && /タップ/.test(r.tut) && /指/.test(r.ctrl), r); return r
  })
  await t(`${name}: 道具ボタンをタップで切り替え・指でなぞると毛が寝る（濡らしてから）`, async () => {
    await wp.evaluate(() => { bh.dbg.pause(true); bh.S.ev.catT = 999; bh.S.ev.cordT = 999; bh.S.ev.ahoge = []; bh.force.mess(1); bh.force.wet(1) })
    await wp.tap('.tool[data-tool="0"]'); const tool = await wp.evaluate(() => bh.S.tool)
    const m = await wp.evaluate(() => {
      bh.dbg.render(); const c = document.querySelector('#gl'), [x, y] = bh.toScreen(bh.strands[1].pts[3])
      const fire = (type, X) => c.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: X, clientY: y, bubbles: true, pointerType: 'touch' }))
      const m0 = bh.strands[1].m; fire('pointerdown', x); for (let k = 0; k < 16; k++) { fire('pointermove', x + (k % 2 ? -25 : 25)); bh.dbg.step(2) } fire('pointerup', x); return [m0, +bh.strands[1].m.toFixed(2)]
    })
    expect(tool === 0 && m[1] < m[0] - 0.4, { tool, m }); return { tool, m }
  })
  await wp.evaluate(() => { bh.force.catOn(); bh.dbg.step(60 * 3); bh.dbg.render() })
  await wp.screenshot({ path: `${ROOT}/shots/${name}-play.png` })
  await t(`${name}: 猫をタップでどかせる`, async () => {
    const pt = await wp.evaluate(() => { for (let y = 0; y < innerHeight; y += 6) for (let x = 0; x < innerWidth; x += 6) if (bh.catHit(x, y)) return [x + 12, y + 12]; return null })
    expect(pt, 'no cat'); for (let i = 0; i < 3; i++) { await wp.tap('#gl', { position: { x: pt[0], y: pt[1] } }); await wp.evaluate(() => bh.dbg.step(2)) }
    const st = await wp.evaluate(() => bh.S.cat.st); expect(st === 'leave', st); return st
  })
  await t(`${name}: 2本指の touchmove を止める`, async () => {
    const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
    expect(r, r)
  })
  await t(`${name}: 「行ってきます」で結果が出て一画面に収まる`, async () => {
    await wp.evaluate(() => bh.dbg.pause(false)); await wp.tap('#bLeave'); await wp.waitForTimeout(3600); await wp.screenshot({ path: `${ROOT}/shots/${name}-result.png` })
    const f = await fit(wp); expect(await wp.isVisible('#vResult') && !f.over.length && (await wp.evaluate(() => document.querySelector('#rPhoto').naturalWidth)) === 480, f)
  })
  await t(`${name}: エラーなし`, async () => { expect(wp.errs.length === 0, wp.errs.join('|')) })
  await wp.close()
}
await wb.close()
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
