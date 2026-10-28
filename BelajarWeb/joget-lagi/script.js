/* =========================
   Stickman Motion Studio
   Pengendali mode dan efek partikel (JavaScript native).
   ========================= */
(() => {
  'use strict';

  const stage = document.getElementById('stage');
  const character = document.getElementById('character');
  const particleLayer = document.getElementById('particle-layer');
  const speedLines = document.getElementById('speed-lines');
  const windStreaks = document.getElementById('wind-streaks');
  const statusText = document.getElementById('status-text');
  const statusDot = document.getElementById('status-dot');
  const modeLabel = document.getElementById('mode-label');
  const stageHint = document.getElementById('stage-hint');
  const buttons = [...document.querySelectorAll('.motion-button')];

  let activeMode = 'idle';
  let jumpFrame = 0;
  let effectFrame = 0;
  let hueTimer = 0;
  let particleTimer = 0;
  let landingTimer = 0;
  let lastParticleTime = 0;
  let lastHueTime = 0;
  let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const modeCopy = {
    idle: { label: 'IDLE', status: 'Siap bergerak', hint: 'Pilih salah satu gerakan di bawah' },
    dance: { label: 'DANCE MODE', status: 'Disco time!', hint: 'Goyang kanan, goyang kiri — lanjutkan iramanya!' },
    run: { label: 'FULL SPEED', status: 'Mode kecepatan tinggi', hint: 'Whoosh! Latar bergerak untuk memberi efek lari cepat.' },
    jump: { label: 'SKY HIGH', status: 'Melompat ke langit', hint: 'Melintasi awan, melayang sebentar, lalu mendarat.' }
  };

  // Ciptakan garis kecepatan dan embusan angin satu kali, lalu animasikan via CSS.
  function buildRunEffects() {
    for (let i = 0; i < 18; i += 1) {
      const line = document.createElement('span');
      line.style.setProperty('--line-top', `${5 + Math.random() * 88}%`);
      line.style.setProperty('--line-width', `${12 + Math.random() * 42}%`);
      line.style.setProperty('--line-duration', `${0.2 + Math.random() * 0.42}s`);
      line.style.setProperty('--line-delay', `${-Math.random() * 0.7}s`);
      speedLines.appendChild(line);
    }
    for (let i = 0; i < 10; i += 1) {
      const streak = document.createElement('span');
      streak.style.setProperty('--wind-top', `${42 + Math.random() * 44}%`);
      streak.style.setProperty('--wind-width', `${15 + Math.random() * 42}px`);
      streak.style.setProperty('--wind-delay', `${-Math.random() * 0.5}s`);
      windStreaks.appendChild(streak);
    }
  }

  function setStatus(mode) {
    const copy = modeCopy[mode] || modeCopy.idle;
    modeLabel.textContent = copy.label;
    statusText.textContent = copy.status;
    stageHint.textContent = copy.hint;
    statusDot.style.background = mode === 'dance' ? '#f472b6' : mode === 'run' ? '#38bdf8' : mode === 'jump' ? '#34d399' : '#5ce1a7';
    statusDot.style.boxShadow = `0 0 12px ${mode === 'dance' ? '#f472b6' : mode === 'run' ? '#38bdf8' : mode === 'jump' ? '#34d399' : '#5ce1a7'}`;
    buttons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    });
  }

  // Hapus seluruh efek JavaScript dari mode sebelumnya agar tidak ada animasi yang bertumpuk.
  function stopAllEffects() {
    if (jumpFrame) cancelAnimationFrame(jumpFrame);
    if (effectFrame) cancelAnimationFrame(effectFrame);
    if (hueTimer) cancelAnimationFrame(hueTimer);
    if (particleTimer) cancelAnimationFrame(particleTimer);
    if (landingTimer) window.clearTimeout(landingTimer);
    jumpFrame = 0;
    effectFrame = 0;
    hueTimer = 0;
    particleTimer = 0;
    landingTimer = 0;
    lastParticleTime = 0;
    lastHueTime = 0;
    particleLayer.replaceChildren();
    character.style.removeProperty('transform');
    character.style.removeProperty('filter');
    stage.style.removeProperty('--disco-hue');
    stage.classList.remove('is-dance', 'is-run', 'is-jump');
  }

  function spawnParticle({ x, y, color, size = 5, dx, dy, duration = 850 }) {
    const particle = document.createElement('span');
    particle.className = 'particle';
    particle.style.setProperty('--x', `${x}%`);
    particle.style.setProperty('--y', `${y}%`);
    particle.style.setProperty('--color', color);
    particle.style.setProperty('--size', `${size}px`);
    particle.style.setProperty('--dx', `${dx}px`);
    particle.style.setProperty('--dy', `${dy}px`);
    particle.style.setProperty('--duration', `${duration}ms`);
    particleLayer.appendChild(particle);
    particle.addEventListener('animationend', () => particle.remove(), { once: true });
  }

  function burstParticles(mode, count = 18) {
    const colors = mode === 'dance'
      ? ['#ff65bd', '#7cfcff', '#ffe66d', '#b8a0ff', '#ffffff']
      : mode === 'jump'
        ? ['#ffffff', '#b8e8ff', '#e0f2fe', '#a7f3d0']
        : ['#d7efff', '#91dcff', '#ffffff', '#b5caff'];
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i / count) + Math.random() * 0.35;
      const distance = 24 + Math.random() * (mode === 'jump' ? 90 : 60);
      const x = mode === 'run' ? 42 + Math.random() * 12 : 50;
      const y = mode === 'run' ? 78 + Math.random() * 15 : 68 + Math.random() * 16;
      spawnParticle({
        x: x + Math.cos(angle) * 7,
        y,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 5,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance - (mode === 'jump' ? 15 : 0),
        duration: 520 + Math.random() * 650
      });
    }
  }

  // Disco hue berubah terus selama mode Dance aktif, tanpa interval yang menumpuk.
  function animateDiscoHue(timestamp) {
    if (activeMode !== 'dance') return;
    if (!lastHueTime) lastHueTime = timestamp;
    const elapsed = timestamp - lastHueTime;
    if (elapsed >= 65) {
      const hue = Math.floor((timestamp * (reducedMotion ? 0.045 : 0.11)) % 360);
      stage.style.setProperty('--disco-hue', hue);
      lastHueTime = timestamp;
    }
    hueTimer = requestAnimationFrame(animateDiscoHue);
  }

  // Partikel debu/angin kecil muncul berkala selama karakter berlari.
  function animateRunParticles(timestamp) {
    if (activeMode !== 'run') return;
    if (!lastParticleTime || timestamp - lastParticleTime > (reducedMotion ? 220 : 95)) {
      spawnParticle({
        x: 44 + Math.random() * 10,
        y: 78 + Math.random() * 12,
        color: Math.random() > .5 ? '#b9e8ff' : '#dbeafe',
        size: 2 + Math.random() * 4,
        dx: -35 - Math.random() * 70,
        dy: -8 + Math.random() * 32,
        duration: 350 + Math.random() * 450
      });
      lastParticleTime = timestamp;
    }
    particleTimer = requestAnimationFrame(animateRunParticles);
  }

  // Jalur lompatan: akselerasi naik, melayang sebentar, kemudian jatuh dengan gravitasi.
  function runJump() {
    const start = performance.now();
    const duration = reducedMotion ? 1500 : 2250;
    const computedBottom = parseFloat(getComputedStyle(character).bottom) || 0;
    // Batasi ketinggian agar karakter melewati awan tetapi tetap terlihat di dalam stage.
    const maxHeight = Math.max(120, Math.min(355, stage.clientHeight - computedBottom - character.offsetHeight - 12));
    burstParticles('jump', 22);

    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
    function easeInCubic(t) { return t * t * t; }

    function frame(now) {
      if (activeMode !== 'jump') return;
      const progress = Math.min((now - start) / duration, 1);
      let lift = 0;
      let scaleX = 1;
      let scaleY = 1;

      if (progress < 0.34) {
        // Dorongan awal: tubuh memanjang untuk memberi kesan take-off.
        const t = progress / 0.34;
        lift = maxHeight * easeOutCubic(t);
        scaleY = 1 + 0.12 * Math.sin(Math.PI * t);
        scaleX = 1 - 0.055 * Math.sin(Math.PI * t);
      } else if (progress < 0.51) {
        // Fase melayang di titik tertinggi.
        const t = (progress - 0.34) / 0.17;
        lift = maxHeight * (1 + 0.012 * Math.sin(t * Math.PI * 2));
        scaleY = 1.025;
        scaleX = 0.985;
      } else if (progress < 0.91) {
        // Turun dengan kurva percepatan yang menyerupai gravitasi.
        const t = (progress - 0.51) / 0.40;
        lift = maxHeight * (1 - easeInCubic(t));
        scaleY = 1 - 0.06 * t;
        scaleX = 1 + 0.025 * t;
      } else {
        // Kontak dengan tanah: squash lalu pulih ke bentuk awal.
        const t = (progress - 0.91) / 0.09;
        const squash = Math.sin(Math.PI * t);
        lift = 0;
        scaleX = 1 + 0.12 * squash;
        scaleY = 1 - 0.15 * squash;
      }

      character.style.transform = `translateX(-50%) translateY(${-lift}px) scale(${scaleX}, ${scaleY})`;
      if (progress < 1) {
        jumpFrame = requestAnimationFrame(frame);
      } else {
        character.style.removeProperty('transform');
        burstParticles('jump', 14);
        // Kembali ke posisi diam setelah pendaratan, tanpa menghentikan animasi di tengah lompatan.
        landingTimer = window.setTimeout(() => {
          landingTimer = 0;
          if (activeMode === 'jump') startMode('idle');
        }, reducedMotion ? 80 : 130);
      }
    }
    jumpFrame = requestAnimationFrame(frame);
  }

  function startMode(mode) {
    stopAllEffects();
    activeMode = mode;
    stage.dataset.mode = mode;

    if (mode === 'idle') {
      setStatus('idle');
      return;
    }

    stage.classList.add(`is-${mode}`);
    setStatus(mode);

    if (mode === 'dance') {
      burstParticles('dance', 26);
      hueTimer = requestAnimationFrame(animateDiscoHue);
      return;
    }
    if (mode === 'run') {
      burstParticles('run', 12);
      particleTimer = requestAnimationFrame(animateRunParticles);
      return;
    }
    if (mode === 'jump') {
      runJump();
    }
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => startMode(button.dataset.mode));
  });

  // Pintasan keyboard: 1 = Dance, 2 = Run, 3 = Jump.
  document.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const keyModes = { '1': 'dance', '2': 'run', '3': 'jump', Escape: 'idle' };
    const mode = keyModes[event.key];
    if (mode) startMode(mode);
  });

  // Jika tab disembunyikan, hentikan loop JS; saat kembali, animasi tidak menumpuk.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAllEffects();
      activeMode = 'idle';
      stage.dataset.mode = 'idle';
      setStatus('idle');
    }
  });

  buildRunEffects();
  setStatus('idle');
})();
