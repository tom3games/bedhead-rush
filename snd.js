// 音のエンジン（素材なし・WebAudio）。bakage/templates/snd.js を土台に曲と効果音を書き換えた
window.Snd = {
  ctx: null, muted: false, next: 0, step: 0, track: null, want: null, switchAt: 0, played: {}, lastBrush: 0,
  TEMPO: { title: 104, play: 150, hurry: 172, win: 124, sad: 76 },
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return
    try {
      this.ctx = new AC()
      this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.7
      this.an = this.ctx.createAnalyser(); this.an.fftSize = 2048; this.master.connect(this.an); this.an.connect(this.ctx.destination)
      this.bgm = this.ctx.createGain(); this.bgm.gain.value = 0.0001; this.bgm.connect(this.master)
      const len = this.ctx.sampleRate; this.noiseBuf = this.ctx.createBuffer(1, len, len)
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      if (this.want) { const w = this.want; this.want = null; this.setTrack(w) }
    } catch (e) { this.ctx = null }
  },
  setMute(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.7 },
  tone(f, t0, dur, type = 'square', vol = 0.2, dest, f2) {
    if (!this.ctx) return; const c = this.ctx, o = c.createOscillator(), g = c.createGain()
    o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur)
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g); g.connect(dest || this.master); o.start(t0); o.stop(t0 + dur + 0.02)
  },
  noise(t0, dur, vol, freq, type = 'highpass', dest, q) {
    if (!this.ctx) return; const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain()
    s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq; if (q) f.Q.value = q
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    s.connect(f); f.connect(g); g.connect(dest || this.master); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02)
  },
  now() { return this.ctx ? this.ctx.currentTime : 0 },
  level() { if (!this.an) return 0; const d = new Float32Array(this.an.fftSize); this.an.getFloatTimeDomainData(d); let m = 0; for (const v of d) m = Math.max(m, Math.abs(v)); return m },
  mtof: m => 440 * Math.pow(2, (m - 69) / 12),
  mark(n) { this.played[n] = (this.played[n] || 0) + 1 },
  setTrack(name) {
    if (this.want === name) return
    this.want = name; if (!this.ctx) return
    const now = this.ctx.currentTime, g = this.bgm.gain
    g.cancelScheduledValues(now); g.setValueAtTime(Math.max(0.0001, g.value), now); g.linearRampToValueAtTime(0.0001, now + 0.25)
    this.switchAt = now + 0.27
  },
  tick() {
    if (!this.ctx) return; const c = this.ctx
    if (this.switchAt && c.currentTime >= this.switchAt) {
      this.track = this.want; this.step = 0; this.next = c.currentTime + 0.05; this.switchAt = 0
      const g = this.bgm.gain; g.cancelScheduledValues(c.currentTime); g.setValueAtTime(0.0001, c.currentTime); g.linearRampToValueAtTime(0.26, c.currentTime + 0.35)
      if (this.track) this.mark('bgm:' + this.track)
    }
    if (!this.track || this.switchAt) return
    const spb = 60 / this.TEMPO[this.track] / 4
    if (this.next < c.currentTime) this.next = c.currentTime + 0.05
    while (this.next < c.currentTime + 0.25) { this['p_' + this.track](this.step, this.next); this.next += spb; this.step++ }
  },
  kick(t, v = 0.7) { this.tone(150, t, 0.16, 'sine', v, this.bgm, 42) },
  clap(t, v = 0.2) { for (const d of [0, 0.012, 0.024]) this.noise(t + d, 0.09, v, 1500, 'bandpass', this.bgm) },
  hat(t, v = 0.06, open) { this.noise(t, open ? 0.12 : 0.03, v, 8000, 'highpass', this.bgm) },
  bass(n, t, dur = 0.18, vol = 0.45, type = 'triangle') { this.tone(this.mtof(n), t, dur, type, vol, this.bgm) },
  pad(n, t, dur, vol = 0.04) { this.tone(this.mtof(n), t, dur, 'sine', vol, this.bgm); this.tone(this.mtof(n) * 2.005, t, dur * 0.6, 'sine', vol * 0.3, this.bgm) },
  stab(ns, t, dur = 0.14, vol = 0.04) {
    if (!this.ctx) return; const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain()
    f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(600, t + dur)
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    for (const n of ns) for (const d of [-8, 8]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = this.mtof(n); o.detune.value = d; o.connect(f); o.start(t); o.stop(t + dur + 0.02) }
    f.connect(g); g.connect(this.bgm)
  },

  // タイトル: 寝ぼけた朝のボサノバ風（Fmaj7 - Em7 - Dm7 - G7）
  p_title(i, t) {
    const bar = Math.floor(i / 16) % 4, s = i % 16
    const root = [41, 40, 38, 43][bar], ch = [[57, 60, 64, 65], [55, 59, 62, 64], [53, 57, 60, 64], [53, 55, 59, 62]][bar]
    if (s === 0 || s === 10) this.kick(t, 0.35); if (s % 2 === 0) this.hat(t, 0.025)
    if (s === 0) this.bass(root, t, 0.4, 0.3, 'sine'); if (s === 6) this.bass(root + 7, t, 0.3, 0.24, 'sine'); if (s === 12) this.bass(root + 12, t, 0.2, 0.2, 'sine')
    if ([3, 6, 11, 14].includes(s)) for (const n of ch) this.tone(this.mtof(n), t, 0.22, 'triangle', 0.018, this.bgm)
    const mel = [[77, -1, 76, 72], [74, -1, 72, 71], [69, 72, 74, -1], [71, -1, 67, -1]]
    if (s % 4 === 0) { const n = mel[bar][s / 4]; if (n > 0) this.tone(this.mtof(n + 12), t, 0.3, 'sine', 0.05, this.bgm) }
  },
  // プレイ: せかせかした時計チクタク＋スカ（Am - F - G - E）
  p_play(i, t) { this._busy(i, t, 0) },
  p_hurry(i, t) { this._busy(i, t, 1) },
  _busy(i, t, h) {
    const bar = Math.floor(i / 16) % 4, s = i % 16
    const root = [45, 41, 43, 40][bar], ch = [[69, 72, 76], [69, 72, 77], [67, 71, 74], [68, 71, 76]][bar]
    if (s % 4 === 0) this.kick(t, 0.55); if (s === 4 || s === 12) this.clap(t, 0.1)
    if (s % 2 === 0) this.tone(s % 4 ? 2400 : 1800, t, 0.03, 'square', 0.03, this.bgm) // チクタク
    if (s % 4 === 2) this.stab(ch, t, 0.09, 0.03)
    if (s % 2 === 0) this.bass(root + (s % 8 === 6 ? 7 : 0), t, 0.12, 0.38, 'triangle')
    const mel = [76, 77, 76, 74, 72, 74, 76, 69, 77, 76, 74, 72, 71, 72, 74, 76]
    if (s % 2 === 1 && (h || bar % 2 === 1)) this.tone(this.mtof(mel[(bar * 4 + (s >> 2)) % 16] + (h ? 12 : 0)), t, 0.09, 'square', 0.025, this.bgm)
    if (h && s % 4 === 0) this.tone(this.mtof(93), t, 0.05, 'sine', 0.03, this.bgm)
  },
  // 結果（良い）: 明るいファンファーレ風
  p_win(i, t) {
    const bar = Math.floor(i / 16) % 4, s = i % 16
    const root = [48, 53, 55, 48][bar], ch = [[64, 67, 72], [65, 69, 72], [67, 71, 74], [64, 67, 72]][bar]
    if (s % 4 === 0) this.kick(t, 0.6); if (s === 4 || s === 12) this.clap(t, 0.12); if (s % 2) this.hat(t, 0.04)
    if (s % 4 === 0) this.bass(root, t, 0.2, 0.4); if (s === 0 || s === 6 || s === 10) this.stab(ch, t, 0.18, 0.04)
  },
  // 結果（残念）: しょんぼりワルツ
  p_sad(i, t) {
    const bar = Math.floor(i / 12) % 4, s = i % 12
    const ch = [[57, 60, 64], [57, 62, 65], [56, 59, 64], [57, 60, 64]][bar], root = [33, 38, 40, 33][bar]
    if (s === 0) this.bass(root, t, 0.8, 0.3, 'sine'); if (s === 4 || s === 8) for (const n of ch) this.tone(this.mtof(n), t, 0.4, 'triangle', 0.02, this.bgm)
    const mel = [[76, 74, 72], [74, 72, 69], [71, 69, 68], [69, -1, -1]][bar]
    if (s % 4 === 0) { const n = mel[s / 4]; if (n > 0) this.tone(this.mtof(n), t, 0.5, 'sine', 0.06, this.bgm) }
  },
  // 情けない声（のこぎり波＋母音っぽいフィルタ）
  voice(t, f0, f1, dur, vol = 0.12, formant = 900) {
    if (!this.ctx) return; const c = this.ctx, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain()
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur)
    lfo.frequency.value = 7; lg.gain.value = f0 * 0.04; lfo.connect(lg); lg.connect(o.frequency)
    f.type = 'bandpass'; f.frequency.value = formant; f.Q.value = 3
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(f); f.connect(g); g.connect(this.master); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05)
  },
  // ドライヤーの連続音（音量だけ毎フレーム変える）
  dryer(on, hot) {
    if (!this.ctx) return; const c = this.ctx
    if (!this.dry) {
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.7
      const g = c.createGain(); g.gain.value = 0.0001; s.connect(f); f.connect(g); g.connect(this.master); s.start()
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 180; const og = c.createGain(); og.gain.value = 0; o.connect(og); og.connect(g); o.start()
      this.dry = { g, f, og, o }
    }
    const tt = c.currentTime, d = this.dry
    d.g.gain.setTargetAtTime(on ? 0.16 : 0.0001, tt, 0.04); d.og.gain.setTargetAtTime(on ? 0.08 : 0, tt, 0.04)
    d.f.frequency.setTargetAtTime(hot ? 2600 : 1400, tt, 0.1); d.o.frequency.setTargetAtTime(hot ? 260 : 180, tt, 0.1)
  },
  // 効果音
  sfx(name, v = 1) {
    if (!this.ctx) return; const t = this.ctx.currentTime; this.mark(name)
    switch (name) {
      case 'tap': this.tone(880, t, 0.06, 'triangle', 0.12 * v); break
      case 'tool': this.tone(660, t, 0.05, 'triangle', 0.1); this.tone(990, t + 0.04, 0.06, 'triangle', 0.08); break
      case 'comb': if (t - this.lastBrush < 0.09) return; this.lastBrush = t; this.noise(t, 0.07, 0.07 * v, 3200, 'bandpass', null, 2); break
      case 'spray': this.noise(t, 0.22, 0.22, 5000, 'highpass'); this.noise(t, 0.12, 0.08, 2000, 'bandpass'); break
      case 'wax': this.tone(220, t, 0.12, 'sine', 0.15, null, 140); this.noise(t, 0.1, 0.05, 600, 'lowpass'); break
      case 'boing': { const f = 260 + Math.random() * 120; this.tone(f, t, 0.32, 'sine', 0.28, null, f * 3.2); this.tone(f * 1.5, t + 0.05, 0.22, 'triangle', 0.08, null, f * 4) } break
      case 'boom': this.tone(90, t, 0.6, 'sine', 0.6, null, 35); this.noise(t, 0.5, 0.35, 1200, 'lowpass'); this.voice(t + 0.05, 700, 1300, 0.35, 0.09, 1200); break
      case 'ahoge': this.tone(1200, t, 0.12, 'square', 0.06); this.tone(1800, t + 0.1, 0.25, 'square', 0.06); break
      case 'meow': this.voice(t, 620, 900, 0.18, 0.12, 1600); this.voice(t + 0.17, 900, 480, 0.32, 0.12, 1300); break
      case 'hiss': this.noise(t, 0.5, 0.25, 3500, 'highpass'); this.voice(t, 500, 380, 0.3, 0.06, 2200); break
      case 'purr': for (let k = 0; k < 8; k++) this.tone(55, t + k * 0.09, 0.07, 'sawtooth', 0.06); break
      case 'unplug': this.tone(1400, t, 0.04, 'square', 0.1); this.tone(300, t + 0.03, 0.25, 'sawtooth', 0.08, null, 60); break
      case 'plug': this.tone(500, t, 0.04, 'square', 0.12); this.tone(1000, t + 0.05, 0.08, 'triangle', 0.1); break
      case 'scream': this.voice(t, 520, 1100, 0.45, 0.14, 1100); break       // ひぃっ！
      case 'yawn': this.voice(t, 300, 420, 0.5, 0.1, 700); this.voice(t + 0.5, 420, 200, 0.7, 0.09, 600); break
      case 'oops': this.voice(t, 400, 260, 0.35, 0.1, 800); break
      case 'tick': this.tone(2600, t, 0.025, 'square', 0.05); break
      case 'horn': for (const f of [370, 466]) this.tone(f, t, 1.2, 'sawtooth', 0.07, null, f * 0.97); break
      case 'door': this.tone(140, t, 0.2, 'sine', 0.4, null, 70); this.noise(t, 0.15, 0.15, 800, 'lowpass'); this.tone(1320, t + 0.25, 0.4, 'triangle', 0.06); break
      case 'roll': for (let k = 0; k < 36; k++) this.noise(t + k * 0.04, 0.05, 0.05 + k * 0.004, 1800, 'bandpass'); break
      case 'stamp': this.tone(110, t, 0.3, 'sine', 0.7, null, 45); this.noise(t, 0.2, 0.3, 900, 'lowpass'); break
      case 'cheer': this.noise(t, 2.0, 0.14, 1200, 'bandpass', null, 0.6); for (let k = 0; k < 4; k++) this.tone(1800, t + k * 0.3, 0.3, 'sine', 0.05, null, 2600); break
      case 'laugh': for (let k = 0; k < 6; k++) this.voice(t + k * 0.16, 360 - k * 12, 300 - k * 10, 0.12, 0.08, 900); break
      case 'boo': for (let k = 0; k < 7; k++) { const f = 105 + Math.random() * 40; this.tone(f, t + Math.random() * 0.2, 1.2, 'sawtooth', 0.04, null, f * 0.7) } break
      case 'hurry': this.tone(988, t, 0.1, 'square', 0.07); this.tone(988, t + 0.15, 0.1, 'square', 0.07); break
    }
  },
}
