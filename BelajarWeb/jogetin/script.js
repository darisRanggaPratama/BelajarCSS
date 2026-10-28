(() => {
  'use strict';

  /* =====================================================
   * KONFIGURASI (mudah diubah)
   * ===================================================== */
  const GROUND = 0.26;      // harus sama dengan --ground di style.css
  const BLEND = 0.3;        // detik transisi halus antar animasi
  const BEAT = 0.5;         // durasi 1 ketukan Dance (120 BPM)
  const JUMP_END = 2.93;    // total durasi lompatan (detik)
  const STATUS = { idle: 'Siap beraksi', dance: 'Joget gemoy!', run: 'Lari kencang!', jump: 'Lompat tinggi!' };

  const $ = s => document.querySelector(s);
  const { sin: S, cos: C, PI, abs, max, min } = Math;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const stage = $('#stage'), fig = $('#stickman'), shadow = $('#shadow'), rig = $('#rig');
  const fx = $('#fx'), disco = $('.bg-dance'), flash = $('.flash'), status = $('#status');

  /* Titik putar tiap sendi (relatif terhadap sendi induknya) */
  const PIVOT = {
    body: '0 0', head: '0 -70', armL: '0 -62', foreL: '0 32', armR: '0 -62', foreR: '0 32',
    thighL: '-4 0', shinL: '0 38', thighR: '4 0', shinR: '0 38'
  };
  const els = {};
  for (const id in PIVOT) els[id] = document.getElementById(id);

  /* =====================================================
   * POSE: setiap mode mengembalikan sudut sendi (derajat) pada waktu t.
   * Putar positif = anggota badan yang menggantung ke bawah berayun ke kiri layar.
   * x, y = geser karakter (unit SVG); sx, sy = skala (squash & stretch).
   * ===================================================== */
  const base = () => ({ body: 0, head: 0, armL: 14, foreL: -8, armR: -14, foreR: 8,
    thighL: 5, shinL: 2, thighR: -5, shinR: 2, x: 0, y: 0, sx: 1, sy: 1 });
  const P = o => Object.assign(base(), o);

  let k = 1, jumpH = 300; // k = px per unit SVG; jumpH = tinggi lompat (unit SVG), dihitung di measure()

  const poses = {
    /* Diam: napas pelan */
    idle: t => P({ head: 3 * S(t * 1.6), armL: 14 + 3 * S(t * 1.6), armR: -14 - 3 * S(t * 1.6), sy: 1 + .008 * S(t * 2) }),

    /* Joget gemoy: goyang pinggul ke kiri-kanan (1 Hz), tangan memompa naik-turun bergantian,
       lutut memantul tiap ketukan (2 Hz), kepala geleng-geleng. */
    dance: t => {
      const w = 2 * PI / BEAT, c = S(w * t), s = S(w * t / 2);
      return P({
        body: 10 * s, head: -16 * s + 6 * c,
        armL: 110 + 40 * c, foreL: -(40 + 30 * S(w * t + 1)),
        armR: -(110 - 40 * c), foreR: 40 + 30 * S(w * t + 2),
        thighL: 14 + 18 * c, shinL: -(8 + 20 * max(0, c)),
        thighR: -14 - 18 * c, shinR: 8 + 20 * max(0, -c),
        x: 22 * s, y: -6 * (.5 - .5 * c)
      });
    },

    /* Lari: badan condong, tangan & kaki berayun berlawanan, lutut menekuk saat kaki maju */
    run: t => {
      const w = 2 * PI * 3.4, c = S(w * t);
      return P({
        body: 16, head: -8,
        armL: 60 * c, foreL: -85, armR: -60 * c, foreR: -85,
        thighL: -55 * c, shinL: 50 + 50 * C(w * t),
        thighR: 55 * c, shinR: 50 - 50 * C(w * t),
        y: -12 * abs(c)
      });
    },

    /* Lompat: jongkok -> naik (stretch) -> melayang -> jatuh (gravitasi) -> mendarat (squash) */
    jump: t => {
      const H = jumpH, q = S;
      if (t < .28) {                                   // 1. antisipasi: jongkok
        const p = q(t / .28 * PI / 2);
        return P({ sx: 1 + .14 * p, sy: 1 - .2 * p, thighL: 35 * p, shinL: -35 * p, thighR: -35 * p, shinR: 35 * p, armL: 14 + 30 * p, armR: -14 - 30 * p });
      }
      if (t < 1.13) {                                  // 2. naik cepat lalu melambat (ease-out)
        const p = (t - .28) / .85;
        return P({ y: -H * (1 - (1 - p) ** 2), sx: .92 + .08 * p, sy: 1.18 - .18 * p, armL: 160, armR: -160, thighL: 8, shinL: 10, thighR: -8, shinR: -10 });
      }
      if (t < 1.53) {                                  // 3. melayang sesaat di puncak
        const p = (t - 1.13) / .4;
        return P({ y: -H - 5 * q(p * PI), armL: 125 + 12 * q(p * 2 * PI), armR: -(125 + 12 * q(p * 2 * PI)), thighL: 30, shinL: -10, thighR: -30, shinR: 10 });
      }
      if (t < 2.48) {                                  // 4. jatuh dipercepat (ease-in = gravitasi)
        const p = (t - 1.53) / .95;
        return P({ y: -H * (1 - p * p), sx: 1 - .06 * p, sy: 1 + .12 * p, armL: 150, armR: -150, thighL: 6, thighR: -6 });
      }
      const p = (t - 2.48) / .45, s = q(min(1, p) * PI); // 5. mendarat: squash lalu pulih
      return P({ sx: 1 + .16 * s, sy: 1 - .22 * s, thighL: 35 * s, shinL: -35 * s, thighR: -35 * s, shinR: 35 * s, armL: 14 + 40 * s, armR: -14 - 40 * s });
    }
  };

  /* =====================================================
   * STATE & TRANSISI HALUS
   * Saat mode berganti, pose saat ini disimpan (from) lalu dicampur
   * ke pose baru selama BLEND detik dengan kurva smoothstep.
   * ===================================================== */
  let mode = 'idle', t0 = performance.now(), mix = 1, last = t0;
  let cur = base(), from = base(), timers = {}, lastBeat = -1, landed = false;

  function setMode(next) {
    from = { ...cur }; mix = 0; mode = next; t0 = performance.now();
    timers = {}; lastBeat = -1; landed = false;
    fx.replaceChildren();                              // hentikan efek mode sebelumnya
    stage.dataset.mode = next;
    status.textContent = STATUS[next];
    document.querySelectorAll('button').forEach(b => {
      const on = b.dataset.action === next;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
    });
  }

  /* =====================================================
   * EFEK PARTIKEL (elemen DOM sementara, dihapus otomatis)
   * ===================================================== */
  function spawn(cls, css, life) {
    const e = document.createElement('i');
    e.className = cls; e.style.cssText = css; fx.appendChild(e);
    setTimeout(() => e.remove(), life);
  }
  const every = (name, sec, dt, fn) => { timers[name] = (timers[name] || 0) + dt; if (timers[name] >= sec) { timers[name] -= sec; fn(); } };
  const speedLine = () => spawn('speed', `top:${rnd(8, 80)}%;width:${rnd(120, 360)}px;animation-duration:${rnd(.25, .45)}s`, 500);
  const dust = () => { const z = rnd(10, 26); spawn('dust', `width:${z}px;height:${z}px;--dy:${rnd(-40, -5)}px`, 600); };
  const confetti = () => spawn('confetti', `left:${rnd(0, 100)}%;background:hsl(${rnd(0, 360)} 95% 60%);--dx:${rnd(-80, 80)}px;animation-duration:${rnd(1.6, 2.6)}s`, 2800);

  /* Tiap ketukan Dance: warna disco acak baru + kilatan lampu + hujan confetti */
  function onBeat() {
    ['--h1', '--h2', '--h3', '--h4'].forEach(v => disco.style.setProperty(v, Math.round(rnd(0, 360))));
    flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
    for (let i = 0; i < 8; i++) confetti();
  }

  function effects(t, dt) {
    if (mode === 'dance') {
      const b = Math.floor(t / BEAT);
      if (b !== lastBeat) { lastBeat = b; onBeat(); }
    } else if (mode === 'run') {
      every('speed', .04, dt, speedLine);
      every('dust', .07, dt, dust);
    } else if (mode === 'jump' && !landed && t > 2.48) {
      landed = true; for (let i = 0; i < 6; i++) dust();  // debu saat mendarat
    }
  }

  /* =====================================================
   * RENDER: terapkan pose ke SVG, posisi karakter, kamera, bayangan
   * ===================================================== */
  function render() {
    for (const id in PIVOT) els[id].setAttribute('transform', `translate(${PIVOT[id]}) rotate(${cur[id]})`);

    // Kaki terendah selalu menempel di tanah (hip turun otomatis saat lutut menekuk)
    const r = PI / 180, leg = (a, b) => 38 * C(a * r) + 38 * C((a + b) * r);
    rig.setAttribute('transform', `translate(0 ${76 - max(leg(cur.thighL, cur.shinL), leg(cur.thighR, cur.shinR))})`);

    fig.style.transform = `translate(${cur.x * k}px,${cur.y * k}px) scale(${cur.sx},${cur.sy})`;

    const lift = -cur.y * k;                            // tinggi karakter dari tanah (px)
    const alt = min(1, max(0, lift / (jumpH * k)));     // 0 = tanah, 1 = puncak
    stage.style.setProperty('--cam', max(0, lift - 30) * .45 + 'px'); // kamera ikut naik: awan & tanah turun
    stage.style.setProperty('--alt', alt);              // langit makin gelap di ketinggian
    shadow.style.transform = `translate(${cur.x * k}px,${max(0, lift - 30) * .45}px) scale(${1 - .5 * alt})`;
    shadow.style.opacity = 1 - .7 * alt;
  }

  /* Loop utama */
  function frame(now) {
    const dt = min(.05, (now - last) / 1000); last = now;
    let t = max(0, (now - t0) / 1000);
    if (mode === 'jump' && t > JUMP_END) { setMode('idle'); t = 0; }  // lompatan selesai -> kembali diam

    mix = min(1, mix + dt / BLEND);
    const e = mix * mix * (3 - 2 * mix), tgt = poses[mode](t);
    for (const key in cur) cur[key] = from[key] + (tgt[key] - from[key]) * e;

    render(); effects(t, dt);
    requestAnimationFrame(frame);
  }

  /* Ukuran responsif: hitung skala & tinggi lompat sesuai layar */
  function measure() {
    k = fig.offsetWidth / 220;
    jumpH = max(120, stage.clientHeight * (1 - GROUND) - fig.offsetHeight - 12) / k;
  }

  /* Awan: 6 di belakang & 4 di depan karakter, melayang dengan kecepatan berbeda */
  [['back', 6], ['front', 4]].forEach(([layer, n]) => {
    const box = $('.clouds.' + layer);
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div');
      c.className = 'cloud';
      c.style.cssText = `--y:${rnd(28, 88)}%;--s:${rnd(.7, 1.5)};animation-duration:${rnd(40, 90)}s;animation-delay:-${rnd(0, 90)}s`;
      box.appendChild(c);
    }
  });

  /* Tombol: klik mode aktif (Dance/Run) = berhenti; Jump diabaikan saat sedang melompat */
  document.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.action;
    if (a === mode) { if (a !== 'jump') setMode('idle'); return; }
    setMode(a);
  }));

  window.addEventListener('resize', measure);
  measure(); setMode('idle');
  requestAnimationFrame(frame);
})();
