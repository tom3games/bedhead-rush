// 公開URLの確認。node live.mjs（ログインしていないブラウザで見る）。SKIPGH=1 で GitHub ページの確認を省く
import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { chromium, webkit } from 'playwright'
import { mkdirSync } from 'node:fs'
mkdirSync(import.meta.dirname + '/shots', { recursive: true })
const URL0 = 'https://tom3games.github.io/bedhead-rush/'
const ID = ['tmk', '4men'].join('') // 個人のIDは文字列を分けて持つ（公開物に直接書かない）
const out = []
for (const [name, bt, opts] of [['chromium', chromium, {}], ['webkit', webkit, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const b = await bt.launch(), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts }), p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) errs.push('fail ' + r.url()) })
  await p.addInitScript(() => { try { localStorage.setItem('bh.tut', '1') } catch (e) {} })
  await p.goto(URL0 + '?t=' + Date.now(), { waitUntil: 'networkidle' })
  await p.waitForFunction(() => window.__bhReady, null, { timeout: 20000 })
  // タイトル → 起きる → bot で最後まで → 結果
  await p.click('#bStart')
  await p.evaluate(() => { bh.dbg.pause(true); bh.setBot('good'); let k = 0; while (bh.S.view === 'play' && k++ < 4000) bh.dbg.step(1); bh.setBot(null); bh.dbg.pause(false) })
  await p.waitForTimeout(3500)
  const res = await p.evaluate(() => ({ view: !document.querySelector('#vResult').hidden, score: document.querySelector('#rScore').textContent, photo: document.querySelector('#rPhoto').naturalWidth }))
  await p.screenshot({ path: `shots/live-${name}.png` })
  const og = await p.evaluate(async () => { const r = await fetch(document.querySelector('meta[property="og:image"]').content); return r.status + ' ' + r.headers.get('content-type') })
  out.push(`${name}: result=${JSON.stringify(res)} og=${og} errors=${errs.length ? errs.join(' | ') : 'none'}`)
  await b.close()
}
if (process.env.SKIPGH) { console.log(out.join('\n')); process.exit(0) }
const b = await chromium.launch(), p = await b.newPage()
for (const u of ['https://github.com/tom3games/bedhead-rush', 'https://github.com/tom3games/bedhead-rush/commits/main', 'https://github.com/tom3games/bedhead-rush/activity']) {
  const res = await p.goto(u, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  out.push(`${u} status=${res.status()} id=${new RegExp(ID, 'i').test(await p.content()) ? 'FOUND' : 'none'}`)
}
await b.close()
console.log(out.join('\n'))
