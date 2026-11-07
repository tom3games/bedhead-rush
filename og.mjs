// SNS用サムネ og.png（1200x630）。爆発した寝癖に猫が乗った瞬間＋タイトル。node og.mjs
import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
const ROOT = import.meta.dirname
const PORT = await new Promise(r => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)) }) })
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 500))
const b = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, locale: 'ja-JP' })
await p.addInitScript(() => { try { localStorage.setItem('bh.tut', '1') } catch (e) {} })
await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__bhReady)
await p.evaluate(() => document.fonts.ready)
await p.addStyleTag({ content: `main.view,#corner,#bubbles{display:none!important}
  body::after{content:'';position:fixed;inset:0 0 0 50%;background:linear-gradient(90deg,rgba(42,34,51,0),rgba(42,34,51,.9) 24%);z-index:30}` })
await p.evaluate(() => {
  bh.dbg.pause(true); bh.start(8); bh.S.ev.ahoge = []; bh.S.ev.cordT = 999
  bh.force.mess(1); bh.force.ahoge(); bh.setTool(1); bh.dbg.step(30)
  bh.force.boom(3); bh.force.catOn(); bh.dbg.step(40)
  for (const i of [3, 7, 12]) bh.strands[i].heat = 0.75
  bh.S.faceTmp = { name: 'shock', t: 99 }
  bh.dbg.step(1)
})
await p.waitForTimeout(300) // start() の後の resize が終わってからカメラを置く
await p.evaluate(() => {
  const W = innerWidth, H = innerHeight, c = bh.camera
  c.position.set(0, 2.2, 7.4); c.lookAt(0, 0.75, 0); c.setViewOffset(W, H, 250, 0, W, H); c.updateProjectionMatrix()
  bh.dbg.render()
})
await p.evaluate(() => {
  const d = document.createElement('div'); d.style.cssText = 'position:fixed;right:44px;top:0;bottom:0;width:500px;z-index:31;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:20px;color:#fff;text-align:center'
  d.innerHTML = `<div style="display:flex;align-items:center;gap:10px;background:#2a2233;border:3px solid #fff;color:#ffcf33;font:400 30px 'Dela Gothic One';padding:6px 18px;border-radius:14px;transform:rotate(-3deg)">7:39<span style="font:900 18px 'M PLUS Rounded 1c';color:#fff">7:42発 快速</span></div>
  <div style="font-family:'Dela Gothic One';line-height:1;transform:rotate(-3deg)"><div style="font-size:84px;-webkit-text-stroke:10px #2a2233;paint-order:stroke fill">寝癖なおし</div><div style="font-size:150px;color:#ffcf33;-webkit-text-stroke:12px #2a2233;paint-order:stroke fill;transform:rotate(4deg)">3分前</div></div>
  <div style="font:900 30px/1.45 'M PLUS Rounded 1c',sans-serif">爆発した寝癖を、<br>電車の時間までに直せ。</div>`
  document.body.appendChild(d)
  const pop = (txt, x, y, rot, col, size) => { const o = document.createElement('div'); o.textContent = txt; o.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:31;font:400 ${size}px 'Dela Gothic One';color:${col};-webkit-text-stroke:9px #2a2233;paint-order:stroke fill;transform:rotate(${rot}deg)`; document.body.appendChild(o) }
  pop('ボフッ！', 40, 70, -10, '#ff5a4e', 64); pop('ニャー', 420, 50, 8, '#ffcf33', 52); pop('ひぃっ！', 60, 400, -6, '#fff', 50)
})
await p.waitForTimeout(500)
await p.screenshot({ path: ROOT + '/og.png' })
await b.close(); server.kill()
console.log('ok')
