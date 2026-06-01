// 34-brilli.js
// Brilli — the Brilliance entity (Canvas 2D, ES5)
// v33.1 — Phase C-full
//
// Forms (locked per docs/brilliance/17-master-roadmap.md):
//   'celestial' — primary, gold orb with halo + sparks (default)
//   'aura'      — secondary, pulsing field/rings
//   'classic'   — original WebGL blob (delegates to existing window.cycleBlobShape system)
//
// State machine: idle | attending | thinking | delivering | pleased | asleep
// Sizes: hero (~280px) | inline (~64px) | pin (~24px)
//
// Public API:
//   Brilli.mount(el, opts)              -> instance
//   Brilli.setMode(b, mode)             -> void
//   Brilli.unmount(b)                   -> void
//   Brilli.getActiveForm()              -> 'celestial' | 'aura' | 'classic'
//   Brilli.setActiveForm(form)          -> void  (re-renders all instances)
//   Brilli.refresh(b)                   -> void  (re-read CSS vars, e.g. on theme toggle)

var Brilli = (function(){
  var instances = [];
  var rafId = null;
  var paused = false;
  var lastTickT = 0;
  var reducedMotion = false;

  var FORM_KEY = 'roweos_brilli_form';
  var INTENSITY_KEY = 'roweos_brilli_intensity';
  // v33.97: Per-form Ambient default — each Brilli form (except classic, which has
  // its own BLAKE/Helix system) gets a passive ambient layer drawn behind the
  // primary glyph: celestial→2 counter-rotating orbit rings, aura→drifting field
  // particles, firefly→soft trail dots, signature→offset ribbon arcs. A click on
  // the host fires `ambientBurst=1` which decays over ~800ms, briefly speeding
  // up the rotation/drift and amplifying alpha — gives the orb a "click to spin
  // the circles" tactility without changing form.
  var AMBIENT_KEY = 'roweos_brilli_form_ambient';
  var DEFAULT_FORM = 'celestial';
  var DEFAULT_INTENSITY = 100; // 0-100
  var DEFAULT_AMBIENT = true;
  var VALID_FORMS = ['celestial','aura','firefly','signature','classic'];

  function isFormAmbientOn() {
    try {
      var v = localStorage.getItem(AMBIENT_KEY);
      if (v === null || v === undefined) return DEFAULT_AMBIENT;
      return v === 'true';
    } catch(e) { return DEFAULT_AMBIENT; }
  }
  function setFormAmbient(on) {
    try { localStorage.setItem(AMBIENT_KEY, on ? 'true' : 'false'); } catch(e){}
    try {
      if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('brilli:form-ambient-changed', { detail: { on: !!on } }));
      }
    } catch(e){}
  }

  function getIntensity() {
    try {
      var v = parseInt(localStorage.getItem(INTENSITY_KEY) || String(DEFAULT_INTENSITY), 10);
      if (isNaN(v) || v < 0 || v > 100) return DEFAULT_INTENSITY;
      return v;
    } catch(e) { return DEFAULT_INTENSITY; }
  }
  function setIntensity(v) {
    var clamped = Math.max(0, Math.min(100, parseInt(v, 10) || 0));
    try { localStorage.setItem(INTENSITY_KEY, String(clamped)); } catch(e){}
    try {
      if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('brilli:intensity-changed', { detail: { intensity: clamped } }));
      }
    } catch(e){}
  }

  function getActiveForm() {
    try {
      var v = localStorage.getItem(FORM_KEY);
      if (v && VALID_FORMS.indexOf(v) !== -1) return v;
    } catch(e){}
    return DEFAULT_FORM;
  }

  function setActiveForm(form) {
    if (VALID_FORMS.indexOf(form) === -1) return;
    try { localStorage.setItem(FORM_KEY, form); } catch(e){}
    // v33.99: Set data-brilli-form attribute on documentElement so any CSS or
    // listener that gates on it reacts immediately, regardless of whether the
    // picker UI also sets it.
    try { document.documentElement.setAttribute('data-brilli-form', form); } catch(e){}
    // Re-render every instance with the new form. Snapshot host/size/mode
    // BEFORE unmount so we can rebuild reliably (unmount mutates instances).
    var snapshots = [];
    for (var s = 0; s < instances.length; s++) {
      var inst = instances[s];
      snapshots.push({ host: inst.host, size: inst.size, mode: inst.mode });
    }
    // Unmount all (in reverse so splice indices stay sane).
    for (var u = instances.length - 1; u >= 0; u--) unmount(instances[u]);
    // Re-mount each with no explicit form so they pick up the new active form.
    for (var r = 0; r < snapshots.length; r++) {
      var snap = snapshots[r];
      if (snap.host && document.body.contains(snap.host)) {
        mount(snap.host, { size: snap.size, mode: snap.mode });
      }
    }
    // v34.5: Wake the WebGL classic blob immediately when classic is selected,
    // so the switch feels instantaneous like the canvas forms (user reported
    // "they all switch over immediately except blob"). The classic form lives
    // in #blobContainer outside the Brilli mount tree — CSS un-hides it but
    // its RAF loop may have stopped. Init if needed and restart animation.
    try {
      if (form === 'classic') {
        if (typeof initBlob === 'function') initBlob();
        if (typeof startBlobAnimation === 'function') startBlobAnimation();
        if (typeof resizeBlob === 'function') setTimeout(resizeBlob, 50);
      } else {
        if (typeof stopBlobAnimation === 'function') stopBlobAnimation();
      }
    } catch(eClassic){}
    // v33.99: Update the Settings row labels right here so the user gets
    // immediate feedback even if the picker was opened from a non-settings
    // entry point.
    try {
      var labels = { celestial:'Celestial', aura:'Aura', firefly:'Firefly', signature:'Signature', classic:'Classic' };
      var fullLabels = { celestial:'Celestial Orb', aura:'Aura / Field', firefly:'Firefly', signature:'Light Signature', classic:'Classic BLAKE' };
      var labelEl = document.getElementById('brilliFormToggleText');
      var descEl  = document.getElementById('brilliFormDesc');
      if (labelEl) labelEl.textContent = labels[form] || 'Celestial';
      if (descEl)  descEl.textContent  = fullLabels[form] || 'Celestial Orb';
      // v34.6: Update the Settings preview dot to reflect the active form's character.
      var prev = document.getElementById('brilliFormSettingsPreview');
      if (prev) updateBrilliSettingsPreview(prev, form);
      // v34.9: Highlight the active chip in the inline strip below the row.
      try {
        var chips = document.querySelectorAll('[data-brilli-chip]');
        for (var ci = 0; ci < chips.length; ci++) {
          var cf = chips[ci];
          var isActive = cf.getAttribute('data-brilli-chip') === form;
          cf.style.borderColor = isActive ? 'rgba(201,169,97,0.6)' : 'var(--border-color)';
          cf.style.background = isActive ? 'rgba(201,169,97,0.1)' : 'var(--bg-tertiary)';
          cf.style.color = isActive ? 'var(--text-primary)' : 'var(--text-secondary)';
        }
      } catch(eC){}
    } catch(e){}
    // Tell anything listening (sidebar dot, settings preview, etc.)
    try {
      if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('brilli:form-changed', { detail: { form: form } }));
      }
    } catch(e){}
    // v33.99: Toast confirmation so the user gets unambiguous feedback that
    // the form change took effect (Jordan reported "stuck on Celestial" — the
    // toast eliminates ambiguity even if a particular surface visually lags).
    try {
      var fullLabels2 = { celestial:'Celestial Orb', aura:'Aura / Field', firefly:'Firefly', signature:'Light Signature', classic:'Classic BLAKE' };
      if (typeof showToast === 'function') {
        showToast('Brilli form: ' + (fullLabels2[form] || form), 'info');
      }
    } catch(e){}
  }

  function detectReducedMotion() {
    try {
      var mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
      reducedMotion = !!(mq && mq.matches);
      if (mq && mq.addEventListener) {
        mq.addEventListener('change', function(e){
          reducedMotion = e.matches;
          for (var i = 0; i < instances.length; i++) instances[i].dirty = true;
        });
      }
    } catch(e){ reducedMotion = false; }
  }

  function setupVisibilityHandler() {
    try {
      document.addEventListener('visibilitychange', function(){
        paused = !!document.hidden;
        if (paused) {
          // v33.10: Park instances at low-glow asleep state for the visible frame
          // before the RAF loop pauses, so on return the wake-up looks intentional.
          for (var i = 0; i < instances.length; i++) {
            var inst = instances[i];
            inst._preSleepMode = inst.mode;
            inst.mode = 'asleep';
          }
        } else {
          for (var j = 0; j < instances.length; j++) {
            var b = instances[j];
            if (b._preSleepMode) {
              b.mode = b._preSleepMode;
              b._preSleepMode = null;
            }
          }
          startLoop();
        }
      });
    } catch(e){}
  }

  function readGold() {
    var styles;
    try { styles = getComputedStyle(document.documentElement); } catch(e){ styles = null; }
    function pick(name, fallback){
      if (!styles) return fallback;
      var v = styles.getPropertyValue(name);
      return (v && v.trim()) ? v.trim() : fallback;
    }
    return {
      light: pick('--gold-1', '#f5e6c8'),
      mid:   pick('--gold-2', '#e2c79b'),
      dark:  pick('--gold-3', '#c9a961'),
      core:  '#fff8e8'
    };
  }

  function clearHost(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function mount(el, opts) {
    if (!el) return null;
    opts = opts || {};
    var size = opts.size || 'inline';
    var mode = opts.mode || 'idle';
    var form = opts.form || getActiveForm();

    var b = {
      host: el,
      size: size,
      mode: mode,
      form: form,
      modeChangedAt: now(),
      mountedAt: now(),
      dirty: true,
      particles: [],
      lastSpawn: 0,
      colors: readGold(),
      pulseFlash: 0,
      ambientBurst: 0
    };

    clearHost(el);

    // v33.97 / v33.99: Click-to-burst. v33.99 fix — remove any stale listener
    // from a prior mount on the same host so listeners don't stack across
    // setActiveForm remounts (each remount used to add a new listener).
    if (size !== 'pin') {
      try {
        if (el.__brilliClickBurst) {
          el.removeEventListener('click', el.__brilliClickBurst);
        }
        var clickBurst = function _brilliClickBurst() {
          b.ambientBurst = 1;
          b.pulseFlash = Math.max(b.pulseFlash || 0, 0.85);
          // v34.38: Special firefly easter egg — clicking sends it on a
          // figure-eight loop around the host before settling.
          if (b.form === 'firefly') {
            b.flyOffset = 1;
          }
        };
        el.__brilliClickBurst = clickBurst;
        el.addEventListener('click', clickBurst);
      } catch(e){}
    }

    if (form === 'classic') {
      // Defer to existing blob system — don't reimplement WebGL blob.
      // Caller is expected to have placed the blob HTML; if not, render static fallback.
      b.kind = 'classic';
      b.staticOnly = true;
      renderClassicShim(b);
      // Don't add to RAF instances — classic blob runs its own loop.
      return b;
    }

    // Canvas-driven forms.
    var px = sizePx(size);
    var dpr = Math.min((window.devicePixelRatio || 1), 2);
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.width = px + 'px';
    canvas.style.height = px + 'px';
    canvas.style.display = 'block';
    canvas.width = Math.round(px * dpr);
    canvas.height = Math.round(px * dpr);
    el.appendChild(canvas);
    b.canvas = canvas;
    b.ctx = canvas.getContext('2d');
    b.dpr = dpr;
    b.px = px;

    if (reducedMotion || size === 'pin') {
      // Static one-shot render. Guard against null ctx (jsdom + headless test envs).
      b.staticOnly = true;
      if (b.ctx) drawFrame(b, 0, 16);
      return b;
    }

    if (!b.ctx) {
      // Canvas init failed — bail to static.
      b.staticOnly = true;
      return b;
    }

    instances.push(b);
    startLoop();
    return b;
  }

  function unmount(b) {
    if (!b) return;
    var idx = instances.indexOf(b);
    if (idx > -1) instances.splice(idx, 1);
    if (b.host) clearHost(b.host);
    if (instances.length === 0) stopLoop();
  }

  function setMode(b, mode) {
    if (!b || b.mode === mode) return;
    b.mode = mode;
    b.modeChangedAt = now();
    if (mode === 'pleased') b.pulseFlash = 1;
    if (b.staticOnly && b.ctx) drawFrame(b, 0, 16);
  }

  function refresh(b) {
    if (!b) return;
    b.colors = readGold();
    if (b.staticOnly && b.ctx) drawFrame(b, 0, 16);
  }

  function startLoop() {
    if (rafId || paused) return;
    lastTickT = now();
    rafId = requestAnimationFrame(tick);
  }

  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function tick(t) {
    if (paused) { rafId = null; return; }
    var dt = Math.min(60, t - lastTickT);
    lastTickT = t;
    for (var i = 0; i < instances.length; i++) {
      var b = instances[i];
      if (!b.staticOnly) drawFrame(b, t, dt);
    }
    rafId = requestAnimationFrame(tick);
  }

  function now() {
    try { return performance.now(); } catch(e){ return Date.now(); }
  }

  function sizePx(size) {
    if (size === 'hero') return 280;
    if (size === 'pin') return 24;
    return 64; // inline
  }

  // -------- Drawing --------

  function drawFrame(b, t, dt) {
    if (b.form === 'celestial') drawCelestial(b, t, dt);
    else if (b.form === 'aura') drawAura(b, t, dt);
    else if (b.form === 'firefly') drawFirefly(b, t, dt);
    else if (b.form === 'signature') drawSignature(b, t, dt);
  }

  function modeIntensity(mode) {
    // Returns { glow, pulseHz, sparkRate, scaleAmp }, scaled by user intensity (0-100).
    var base;
    switch (mode) {
      case 'asleep':     base = { glow: 0.20, pulseHz: 0.0, sparkRate: 0,    scaleAmp: 0.000 }; break;
      case 'attending':  base = { glow: 0.75, pulseHz: 0.6, sparkRate: 1/180,scaleAmp: 0.025 }; break;
      case 'thinking':   base = { glow: 0.95, pulseHz: 1.4, sparkRate: 1/55, scaleAmp: 0.045 }; break;
      case 'delivering': base = { glow: 0.90, pulseHz: 1.0, sparkRate: 1/120,scaleAmp: 0.035 }; break;
      case 'pleased':    base = { glow: 1.10, pulseHz: 0.9, sparkRate: 1/40, scaleAmp: 0.060 }; break;
      default:           base = { glow: 0.65, pulseHz: 0.4, sparkRate: 1/220,scaleAmp: 0.020 }; // idle
    }
    // v33.82: Widen the intensity range so the slider produces a visibly different
    // animation at 0 vs 100 — the prior 0.3 → 1.0 glow multiplier and the small
    // scaleAmp values made low-intensity nearly indistinguishable from default.
    // New ranges: glow 0.05 → 1.6, pulseHz 0.15 → 2.0, sparkRate 0 → 2× base,
    // scaleAmp 0 → 2× base. At 0 the orb should look near-static and dim;
    // at 100 it should pulse and spark visibly more than the previous default.
    var k = getIntensity() / 100;
    return {
      glow: base.glow * (0.05 + 1.55 * k),
      pulseHz: base.pulseHz * (0.15 + 1.85 * k),
      sparkRate: base.sparkRate * (k * 2),
      scaleAmp: base.scaleAmp * (k * 2)
    };
  }

  // v33.97: Per-form Ambient layer — drawn FIRST (behind the primary form)
  // when isFormAmbientOn(). Each form gets its own signature ambient.
  // `b.ambientBurst` (0..1) decays over ~800ms after a click and amplifies
  // rotation speed + alpha, giving a "spin the circles" feel.
  function drawFormAmbient(b, t, dt, cx, cy, R) {
    if (!isFormAmbientOn()) return;
    if (b.form === 'classic') return; // BLAKE/Helix handles its own ambient
    var ctx = b.ctx;
    var c = b.colors;
    var burst = b.ambientBurst || 0;
    if (burst > 0) b.ambientBurst = Math.max(0, burst - dt / 800);
    var alphaK = 1 + burst * 1.6;
    var speedK = 1 + burst * 3;

    ctx.globalCompositeOperation = 'lighter';

    if (b.form === 'celestial') {
      // Two counter-rotating arcs — gold thread orbits.
      var r1 = R * 1.55;
      var r2 = R * 1.95;
      var rot1 = (t / 1000) * 0.18 * speedK;
      var rot2 = -(t / 1000) * 0.12 * speedK;
      ctx.strokeStyle = 'rgba(' + hexToRgb(c.dark) + ',' + (0.22 * alphaK) + ')';
      ctx.lineWidth = Math.max(0.6, b.px * 0.0045);
      ctx.beginPath();
      ctx.arc(cx, cy, r1, rot1, rot1 + Math.PI * 1.35);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(' + hexToRgb(c.light) + ',' + (0.16 * alphaK) + ')';
      ctx.lineWidth = Math.max(0.5, b.px * 0.0035);
      ctx.beginPath();
      ctx.arc(cx, cy, r2, rot2, rot2 + Math.PI * 1.05);
      ctx.stroke();
    } else if (b.form === 'aura') {
      // 8 drifting field particles in slow procession.
      var pCount = 8;
      for (var i = 0; i < pCount; i++) {
        var ang = (i / pCount) * Math.PI * 2 + (t / 1000) * 0.32 * speedK;
        var rad = b.px * (0.34 + Math.sin((t / 1000) * 0.55 + i) * 0.05);
        var px = cx + Math.cos(ang) * rad;
        var py = cy + Math.sin(ang) * rad;
        ctx.fillStyle = 'rgba(' + hexToRgb(c.light) + ',' + (0.42 * alphaK) + ')';
        ctx.beginPath();
        ctx.arc(px, py, b.px * 0.013, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (b.form === 'firefly') {
      // v34.4: 10 fading trail dots tracing a slow lemniscate behind the firefly —
      // bumped count + size + alpha so the trail reads at a glance.
      var tc = 10;
      for (var ti = 0; ti < tc; ti++) {
        var ph = (t / 1000) * 0.45 * speedK - ti * 0.14;
        var fx = cx + Math.cos(ph) * b.px * 0.32;
        var fy = cy * 1.05 + Math.sin(ph * 1.4) * b.px * 0.18;
        var fa = (1 - ti / tc) * 0.55 * alphaK;
        ctx.fillStyle = 'rgba(' + hexToRgb(c.light) + ',' + fa + ')';
        ctx.beginPath();
        ctx.arc(fx, fy, b.px * 0.013 * (1 - ti / tc * 0.55), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (b.form === 'signature') {
      // Two offset ribbon arcs, behind and slower than the main trail.
      var rb;
      for (rb = 0; rb < 2; rb++) {
        var rR = R * (1.25 + rb * 0.22);
        var rRot = (t / 1000) * (0.45 + rb * 0.18) * speedK;
        var segs = 14;
        for (var s = 0; s < segs; s++) {
          var sf = s / segs;
          var sa = rRot + sf * Math.PI * 0.55;
          var sx = cx + Math.cos(sa) * rR;
          var sy = cy + Math.sin(sa) * rR;
          var saa = (1 - sf) * 0.28 * alphaK;
          ctx.fillStyle = 'rgba(' + hexToRgb(c.light) + ',' + saa + ')';
          ctx.beginPath();
          ctx.arc(sx, sy, b.px * 0.008 * (1 - sf * 0.45), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  function drawCelestial(b, t, dt) {
    var ctx = b.ctx;
    var W = b.canvas.width, H = b.canvas.height;
    var dpr = b.dpr;
    var c = b.colors;
    var m = modeIntensity(b.mode);

    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0, 0, W, H);
    ctx.scale(dpr, dpr);

    var cx = b.px / 2, cy = b.px / 2;
    var baseR = b.px * 0.32;
    var phase = (t / 1000) * Math.PI * 2 * (m.pulseHz || 0.4);
    var breathe = 1 + Math.sin(phase) * m.scaleAmp;
    var R = baseR * breathe;
    var flash = b.pulseFlash;
    if (flash > 0) {
      b.pulseFlash = Math.max(0, flash - dt / 600);
    }
    var glow = m.glow + flash * 0.35;

    // v33.97: per-form ambient layer (orbit rings) painted behind everything.
    drawFormAmbient(b, t, dt, cx, cy, R);

    // Bloom halo (additive)
    ctx.globalCompositeOperation = 'lighter';
    var haloR = R * 2.2;
    var halo = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, haloR);
    halo.addColorStop(0, 'rgba(' + hexToRgb(c.dark) + ',' + (0.30 * glow) + ')');
    halo.addColorStop(0.45, 'rgba(' + hexToRgb(c.dark) + ',' + (0.10 * glow) + ')');
    halo.addColorStop(1, 'rgba(' + hexToRgb(c.dark) + ',0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(cx, cy, haloR, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Sphere shell
    var shell = ctx.createRadialGradient(cx, cy - R * 0.1, R * 0.2, cx, cy, R);
    shell.addColorStop(0,   'rgba(' + hexToRgb(c.light) + ',' + (0.20 + glow * 0.05) + ')');
    shell.addColorStop(0.5, 'rgba(' + hexToRgb(c.dark)  + ',' + (0.20 + glow * 0.05) + ')');
    shell.addColorStop(0.8, 'rgba(168,138,74,' + (0.34 + glow * 0.05) + ')');
    shell.addColorStop(1,   'rgba(107,90,61,0.55)');
    ctx.fillStyle = shell;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

    // Shell rim
    ctx.strokeStyle = 'rgba(232,199,155,' + (0.45 + glow * 0.10) + ')';
    ctx.lineWidth = Math.max(0.75, b.px * 0.005);
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

    // Bright core
    var coreR = R * 0.38 * (1 + Math.sin(phase) * 0.04);
    var core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
    core.addColorStop(0,    'rgba(255,248,232,' + Math.min(1, 0.95 + flash * 0.5) + ')');
    core.addColorStop(0.4,  'rgba(' + hexToRgb(c.light) + ',' + (0.85 + flash * 0.4) + ')');
    core.addColorStop(0.85, 'rgba(' + hexToRgb(c.dark)  + ',' + (0.30 + flash * 0.2) + ')');
    core.addColorStop(1,    'rgba(' + hexToRgb(c.dark)  + ',0)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2); ctx.fill();

    // Internal sparks
    drawSparks(b, t, dt, cx, cy, R, m);
  }

  function drawAura(b, t, dt) {
    var ctx = b.ctx;
    var W = b.canvas.width, H = b.canvas.height;
    var dpr = b.dpr;
    var c = b.colors;
    var m = modeIntensity(b.mode);

    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0, 0, W, H);
    ctx.scale(dpr, dpr);

    var cx = b.px / 2, cy = b.px / 2;
    var baseR = b.px * 0.18;
    var phase = (t / 1000) * Math.PI * 2 * (m.pulseHz || 0.4);
    var flash = b.pulseFlash;
    if (flash > 0) b.pulseFlash = Math.max(0, flash - dt / 600);
    var glow = m.glow + flash * 0.35;

    // v33.97: per-form ambient layer (drifting field particles).
    drawFormAmbient(b, t, dt, cx, cy, baseR);

    // Outer field
    ctx.globalCompositeOperation = 'lighter';
    var fieldR = b.px * 0.5;
    var field = ctx.createRadialGradient(cx, cy, 0, cx, cy, fieldR);
    field.addColorStop(0,   'rgba(' + hexToRgb(c.light) + ',' + (0.18 * glow) + ')');
    field.addColorStop(0.5, 'rgba(' + hexToRgb(c.dark)  + ',' + (0.10 * glow) + ')');
    field.addColorStop(1,   'rgba(' + hexToRgb(c.dark)  + ',0)');
    ctx.fillStyle = field;
    ctx.fillRect(0, 0, b.px, b.px);

    // Concentric pulse rings
    var ringCount = 4;
    for (var i = 0; i < ringCount; i++) {
      var off = ((t / 1000) * (0.3 + m.pulseHz * 0.25) + i / ringCount) % 1;
      var r = baseR + (fieldR - baseR) * off;
      var alpha = (1 - off) * 0.45 * glow;
      ctx.strokeStyle = 'rgba(' + hexToRgb(c.light) + ',' + alpha + ')';
      ctx.lineWidth = Math.max(0.5, b.px * 0.006 * (1 - off * 0.5));
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Center seed
    var seedR = baseR * (1 + Math.sin(phase) * 0.15);
    var seed = ctx.createRadialGradient(cx, cy, 0, cx, cy, seedR);
    seed.addColorStop(0,   'rgba(255,248,232,' + Math.min(1, 0.95 + flash * 0.5) + ')');
    seed.addColorStop(0.6, 'rgba(' + hexToRgb(c.light) + ',' + (0.6 + flash * 0.3) + ')');
    seed.addColorStop(1,   'rgba(' + hexToRgb(c.dark)  + ',0)');
    ctx.fillStyle = seed;
    ctx.beginPath(); ctx.arc(cx, cy, seedR, 0, Math.PI * 2); ctx.fill();
  }

  function drawSparks(b, t, dt, cx, cy, R, m) {
    var ctx = b.ctx;
    var c = b.colors;
    // Spawn rate by mode (probabilistic per ms).
    if (m.sparkRate > 0 && b.particles.length < 40) {
      // Aim for "sparkRate" spawns per ms.
      var spawnChance = m.sparkRate * dt;
      if (Math.random() < spawnChance) spawnSpark(b, cx, cy, R);
    }

    ctx.globalCompositeOperation = 'lighter';
    for (var i = b.particles.length - 1; i >= 0; i--) {
      var p = b.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) { b.particles.splice(i, 1); continue; }
      var lifePct = p.life / p.maxLife;
      // Sparks orbit the core slightly with subtle drift.
      var orbit = p.angle + (t / 1000) * p.swirl * 0.6;
      var rr = p.radius * (1 + Math.sin(lifePct * Math.PI) * 0.05);
      var x = cx + Math.cos(orbit) * rr;
      var y = cy + Math.sin(orbit) * rr;
      var alpha = Math.sin(lifePct * Math.PI) * 0.95;
      ctx.fillStyle = 'rgba(' + hexToRgb(c.core) + ',' + alpha + ')';
      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // v33.9 / v34.38: Firefly form, redesigned to match Jordan's reference image —
  // round head with eyes, antennas with glowing tips, separated wings extending
  // fully side-to-side on the X axis, and a particle trail. Click → flies a
  // celebratory loop around the host (handled by `b.flyOffset`).
  function drawFirefly(b, t, dt) {
    var ctx = b.ctx;
    var W = b.canvas.width, H = b.canvas.height;
    var dpr = b.dpr;
    var c = b.colors;
    var m = modeIntensity(b.mode);

    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0, 0, W, H);
    ctx.scale(dpr, dpr);

    // v34.38: Optional fly-around offset. When `b.flyOffset` exists (set by the
    // click-burst handler below), the firefly traces a figure-eight around the
    // host's center over ~1.6s before settling back. Decays automatically.
    var flyDx = 0, flyDy = 0, flyTilt = 0;
    if (b.flyOffset && b.flyOffset > 0) {
      b.flyOffset = Math.max(0, b.flyOffset - dt / 1600);
      var flyT = (1 - b.flyOffset) * Math.PI * 2;
      flyDx = Math.sin(flyT) * b.px * 0.32 * b.flyOffset;
      flyDy = Math.sin(flyT * 2) * b.px * 0.18 * b.flyOffset;
      flyTilt = Math.cos(flyT) * 0.35 * b.flyOffset;
    }

    var cx0 = b.px / 2, cy0 = b.px * 0.55;
    var cx = cx0 + flyDx, cy = cy0 + flyDy;
    var headR = b.px * 0.13; // head/face radius
    var bodyR = b.px * 0.12; // abdomen radius
    var wingPhase = (t / 1000) * Math.PI * 2 * (m.pulseHz * 4 + 2.5);

    // v33.97: per-form ambient layer (lemniscate trail dots).
    drawFormAmbient(b, t, dt, cx0, cy0, bodyR);

    ctx.globalCompositeOperation = 'lighter';

    // ===== Halo behind the whole firefly =====
    var halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, b.px * 0.6);
    halo.addColorStop(0, 'rgba(' + hexToRgb(c.dark) + ',' + (0.45 * m.glow) + ')');
    halo.addColorStop(0.5, 'rgba(' + hexToRgb(c.dark) + ',' + (0.16 * m.glow) + ')');
    halo.addColorStop(1, 'rgba(' + hexToRgb(c.dark) + ',0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, b.px, b.px);

    // ===== Wings: two ellipses, hinged at body, fanned out fully on X axis =====
    // Wing scale on Y axis is the flap, scale on X stays close to 1 so wings
    // visibly extend left/right rather than just pulse vertically.
    var wingFlap = Math.cos(wingPhase) * 0.30 + 0.70;
    var wingTilt = Math.sin(wingPhase * 0.5) * 0.08; // gentle pivot
    for (var w = -1; w <= 1; w += 2) {
      ctx.save();
      // Hinge at the body, then fan outward.
      var hingeX = cx + w * b.px * 0.06;
      var hingeY = cy - b.px * 0.02;
      ctx.translate(hingeX, hingeY);
      ctx.rotate(w * (Math.PI * 0.18 + wingTilt) + flyTilt * w * 0.5);
      ctx.scale(1, wingFlap);
      // Wing fades from bright at hinge to translucent tip — full side-to-side.
      var wingW = b.px * 0.24; // X extent
      var wingH = b.px * 0.11;
      var wingGrad = ctx.createLinearGradient(0, 0, w * wingW, 0);
      wingGrad.addColorStop(0, 'rgba(' + hexToRgb(c.light) + ',0.65)');
      wingGrad.addColorStop(0.5, 'rgba(' + hexToRgb(c.light) + ',0.30)');
      wingGrad.addColorStop(1, 'rgba(' + hexToRgb(c.light) + ',0)');
      ctx.fillStyle = wingGrad;
      ctx.beginPath();
      ctx.ellipse(w * wingW * 0.5, 0, wingW * 0.55, wingH, 0, 0, Math.PI * 2);
      ctx.fill();
      // Subtle wing outline so it reads as separate from the other wing.
      ctx.strokeStyle = 'rgba(' + hexToRgb(c.light) + ',0.35)';
      ctx.lineWidth = Math.max(0.6, b.px * 0.0028);
      ctx.beginPath();
      ctx.ellipse(w * wingW * 0.5, 0, wingW * 0.55, wingH, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // ===== Abdomen (glowing teardrop trailing the head) =====
    var abdoCy = cy + b.px * 0.06;
    var abdoGrad = ctx.createRadialGradient(cx, abdoCy, 0, cx, abdoCy, bodyR * 1.6);
    abdoGrad.addColorStop(0, 'rgba(255,248,232,1)');
    abdoGrad.addColorStop(0.4, 'rgba(' + hexToRgb(c.light) + ',0.85)');
    abdoGrad.addColorStop(0.85, 'rgba(' + hexToRgb(c.dark) + ',0.4)');
    abdoGrad.addColorStop(1, 'rgba(' + hexToRgb(c.dark) + ',0)');
    ctx.fillStyle = abdoGrad;
    ctx.beginPath();
    ctx.ellipse(cx, abdoCy, bodyR * 0.85, bodyR * 1.25, 0, 0, Math.PI * 2);
    ctx.fill();

    // ===== Head (round, slightly above the abdomen) =====
    var headCy = cy - b.px * 0.04;
    var headGrad = ctx.createRadialGradient(cx, headCy, 0, cx, headCy, headR * 1.2);
    headGrad.addColorStop(0, 'rgba(' + hexToRgb(c.light) + ',0.95)');
    headGrad.addColorStop(0.7, 'rgba(' + hexToRgb(c.dark) + ',0.55)');
    headGrad.addColorStop(1, 'rgba(' + hexToRgb(c.dark) + ',0)');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(cx, headCy, headR, 0, Math.PI * 2);
    ctx.fill();

    // Head outline (gold contour)
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(' + hexToRgb(c.dark) + ',0.85)';
    ctx.lineWidth = Math.max(1, b.px * 0.005);
    ctx.beginPath();
    ctx.arc(cx, headCy, headR, 0, Math.PI * 2);
    ctx.stroke();

    // ===== Eyes (two glowing oval whites with no pupil — friendly look) =====
    var eyeOff = headR * 0.42;
    var eyeR = headR * 0.28;
    for (var e = -1; e <= 1; e += 2) {
      var eyeX = cx + e * eyeOff;
      var eyeY = headCy + headR * 0.04;
      // Whites
      ctx.fillStyle = 'rgba(255,248,232,0.95)';
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY, eyeR, eyeR * 1.05, 0, 0, Math.PI * 2);
      ctx.fill();
      // Subtle gold rim
      ctx.strokeStyle = 'rgba(' + hexToRgb(c.dark) + ',0.55)';
      ctx.lineWidth = Math.max(0.5, b.px * 0.002);
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY, eyeR, eyeR * 1.05, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ===== Antennas (two curved lines with glowing tips) =====
    ctx.strokeStyle = 'rgba(' + hexToRgb(c.dark) + ',0.85)';
    ctx.lineWidth = Math.max(1, b.px * 0.005);
    ctx.lineCap = 'round';
    var antennaSway = Math.sin((t / 1000) * 1.6) * 0.08;
    for (var a = -1; a <= 1; a += 2) {
      var rootX = cx + a * headR * 0.45;
      var rootY = headCy - headR * 0.85;
      var ctrlX = cx + a * (headR * 0.65 + antennaSway * b.px * 0.04);
      var ctrlY = headCy - headR * 1.5;
      var tipX = cx + a * (headR * 0.55 + antennaSway * b.px * 0.06);
      var tipY = headCy - headR * 2.0;
      ctx.beginPath();
      ctx.moveTo(rootX, rootY);
      ctx.quadraticCurveTo(ctrlX, ctrlY, tipX, tipY);
      ctx.stroke();
      // Glowing tip
      ctx.globalCompositeOperation = 'lighter';
      var tipGrad = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, headR * 0.32);
      tipGrad.addColorStop(0, 'rgba(255,248,232,1)');
      tipGrad.addColorStop(0.5, 'rgba(' + hexToRgb(c.light) + ',0.7)');
      tipGrad.addColorStop(1, 'rgba(' + hexToRgb(c.dark) + ',0)');
      ctx.fillStyle = tipGrad;
      ctx.beginPath();
      ctx.arc(tipX, tipY, headR * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      // Restore stroke style for next iteration.
      ctx.strokeStyle = 'rgba(' + hexToRgb(c.dark) + ',0.85)';
    }

    ctx.globalCompositeOperation = 'source-over';
    drawSparks(b, t, dt, cx, cy, b.px * 0.34, m);
  }

  // v33.9: Light Signature form. Pure trailing arc, like a sparkle moving in a circle.
  function drawSignature(b, t, dt) {
    var ctx = b.ctx;
    var W = b.canvas.width, H = b.canvas.height;
    var dpr = b.dpr;
    var c = b.colors;
    var m = modeIntensity(b.mode);

    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0, 0, W, H);
    ctx.scale(dpr, dpr);

    var cx = b.px / 2, cy = b.px / 2;
    var R = b.px * 0.32;
    var phase = (t / 1000) * Math.PI * (0.6 + m.pulseHz * 0.4);

    // v33.97: per-form ambient layer (offset ribbon arcs behind the trail).
    drawFormAmbient(b, t, dt, cx, cy, R);

    // Trailing arc — many fading dots along a circular path
    ctx.globalCompositeOperation = 'lighter';
    var TRAIL_LEN = 24;
    for (var i = 0; i < TRAIL_LEN; i++) {
      var trail = i / TRAIL_LEN;
      var ang = phase - trail * Math.PI * 0.7;
      var x = cx + Math.cos(ang) * R;
      var y = cy + Math.sin(ang) * R;
      var alpha = (1 - trail) * 0.85 * m.glow;
      var size = b.px * (0.014 + (1 - trail) * 0.022);
      ctx.fillStyle = 'rgba(' + hexToRgb(c.light) + ',' + alpha + ')';
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bright leading head
    var headX = cx + Math.cos(phase) * R;
    var headY = cy + Math.sin(phase) * R;
    var headGrad = ctx.createRadialGradient(headX, headY, 0, headX, headY, b.px * 0.06);
    headGrad.addColorStop(0, 'rgba(255,248,232,1)');
    headGrad.addColorStop(0.5, 'rgba(' + hexToRgb(c.light) + ',0.85)');
    headGrad.addColorStop(1, 'rgba(' + hexToRgb(c.light) + ',0)');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(headX, headY, b.px * 0.06, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
  }

  function spawnSpark(b, cx, cy, R) {
    b.particles.push({
      angle:  Math.random() * Math.PI * 2,
      radius: R * (0.25 + Math.random() * 0.55),
      swirl:  (Math.random() * 0.6 + 0.2) * (Math.random() < 0.5 ? -1 : 1),
      life: 0,
      maxLife: 1200 + Math.random() * 1800,
      size: Math.max(1, b.px * 0.012) + Math.random() * (b.px * 0.008)
    });
  }

  function renderClassicShim(b) {
    // Place a tiny gold dot if classic blob host hasn't been wired by the caller.
    // Real classic mounts use the existing #blobContainer + window.cycleBlobShape system,
    // managed outside this module. This shim just ensures a host that opted into 'classic'
    // doesn't render empty.
    if (!b.host) return;
    var dot = document.createElement('div');
    var px = sizePx(b.size);
    dot.setAttribute('aria-hidden', 'true');
    dot.style.width = px + 'px';
    dot.style.height = px + 'px';
    dot.style.borderRadius = '50%';
    dot.style.background = 'radial-gradient(circle,#f5e6c8 0%,#c9a961 60%,rgba(168,138,74,0.5) 100%)';
    dot.style.opacity = '0.7';
    b.host.appendChild(dot);
  }

  // v34.6: Repaint the Settings → Brilli Form preview dot to hint at the active form.
  // Uses pure CSS gradients/box-shadow per form so it stays cheap and never spins up RAF.
  function updateBrilliSettingsPreview(el, form) {
    if (!el) return;
    var styles = {
      celestial: 'background:radial-gradient(circle,#f5e6c8 0%,#c9a961 55%,rgba(168,138,74,0.3) 100%);box-shadow:0 0 12px rgba(201,169,97,0.42);',
      aura:      'background:radial-gradient(circle,#fff5dc 0%,#e2c79b 30%,#c9a961 60%,rgba(201,169,97,0) 100%);box-shadow:0 0 14px rgba(201,169,97,0.5),inset 0 0 6px rgba(255,248,232,0.3);',
      firefly:   'background:radial-gradient(circle at 45% 55%,#fff8e8 0%,#e2c79b 35%,rgba(168,138,74,0.45) 70%,rgba(168,138,74,0) 100%);box-shadow:0 0 14px rgba(201,169,97,0.55);',
      signature: 'background:conic-gradient(from 0deg,rgba(201,169,97,0.05),#e2c79b 30%,#fff8e8 50%,#e2c79b 70%,rgba(201,169,97,0.05));box-shadow:0 0 12px rgba(201,169,97,0.4);',
      classic:   'background:radial-gradient(circle,#f5e6c8 0%,#c9a961 60%,rgba(168,138,74,0.5) 100%);box-shadow:0 0 14px rgba(201,169,97,0.3);'
    };
    var common = 'width:24px;height:24px;border-radius:50%;flex-shrink:0;';
    el.setAttribute('style', common + (styles[form] || styles.celestial));
  }
  window._updateBrilliSettingsPreview = updateBrilliSettingsPreview;

  function hexToRgb(hex) {
    if (!hex) return '232,199,155';
    var h = hex.replace('#','').trim();
    if (h.length === 3) {
      h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    }
    var n = parseInt(h, 16);
    if (isNaN(n)) return '232,199,155';
    return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
  }

  detectReducedMotion();
  setupVisibilityHandler();

  // v33.20: Refresh all instances when theme toggles (light-mode class on <html>).
  function setupThemeWatcher() {
    try {
      if (typeof MutationObserver === 'undefined') return;
      var html = document.documentElement;
      var lastClass = html.className;
      var obs = new MutationObserver(function(){
        if (html.className !== lastClass) {
          lastClass = html.className;
          for (var i = 0; i < instances.length; i++) refresh(instances[i]);
        }
      });
      obs.observe(html, { attributes: true, attributeFilter: ['class'] });
    } catch(e){}
  }
  setupThemeWatcher();

  // v33.97: External click-burst trigger. Useful when an outer element
  // (e.g., a sidebar dot wrapper that captures click first) wants to fire
  // the ambient sparkle on a specific instance.
  function burst(b) {
    if (!b) return;
    b.ambientBurst = 1;
    b.pulseFlash = Math.max(b.pulseFlash || 0, 0.85);
  }

  return {
    mount: mount,
    unmount: unmount,
    setMode: setMode,
    refresh: refresh,
    getActiveForm: getActiveForm,
    setActiveForm: setActiveForm,
    getIntensity: getIntensity,
    setIntensity: setIntensity,
    isFormAmbientOn: isFormAmbientOn,
    setFormAmbient: setFormAmbient,
    burst: burst,
    _debugInstances: function(){ return instances.slice(); }
  };
})();

// Expose globally for inline handlers / Settings preview.
window.Brilli = Brilli;

// v34.63: Shared UI helpers for the v34.x modal/overlay surfaces. Before this,
// Quick Add Goal/Reminder/Note + Daily Brief + Yesterday Recap + Shortcuts +
// Form Picker + Welcome-back each duplicated:
//   - light/dark detection
//   - typing-target detection
//   - overlay create + fade-in
//   - modal box scaffold
//   - close handler + Esc key
//   - gold-monogram header
// That's hundreds of repeated lines. These helpers consolidate the pattern
// without changing visible behavior.
//
// **Storage key registry (v34.x additions to localStorage):**
//   roweos_chat_draft              v34.51 chat input draft
//   roweos_concierge_pills         v34.5  per-pill enable map
//   roweos_concierge_snooze_until  v34.40 snooze timestamp
//   roweos_daily_brief_auto        v34.50 auto-open toggle
//   roweos_daily_brief_last_shown  v34.50 last shown YYYY-MM-DD
//   roweos_bloom_last_seen         v34.15 Bloom badge last-seen
//   roweos_scribe_last_seen        v34.16 Notebooks badge last-seen
//   roweos_library_last_seen       v34.41 Library badge last-seen
//   roweos_pwa_install_dismissed   v34.34 PWA install banner dismissed
//   roweos_last_uid                v34.4  silent-restore anchor
window._brilliUI = (function(){
  function isInputTarget(el){
    if (!el) return false;
    if (el.isContentEditable) return true;
    var t = (el.tagName || '').toLowerCase();
    return t === 'input' || t === 'textarea' || t === 'select';
  }
  function isLight(){
    try { return document.documentElement.classList.contains('light-mode'); }
    catch(e){ return false; }
  }
  // Make a fade-in overlay + modal pair. Returns { overlay, modal, close }.
  // opts:
  //   id          - required, overlay element id
  //   alignTop    - boolean, true → align to 18vh from top (capture modals);
  //                 default false → vertically centered (Brief / Recap / Shortcuts)
  //   maxWidth    - default '560px'
  //   padding     - default '32px' (Brief), capture modals override to '22px 24px'
  //   z           - z-index, default 99100
  //   onClose     - optional fn called after fade
  //   escClose    - default true; pass false if you handle Esc yourself
  //   clickOutsideClose - default true
  function makeOverlay(opts){
    opts = opts || {};
    if (!opts.id) throw new Error('makeOverlay requires opts.id');
    var existing = document.getElementById(opts.id);
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    var lt = isLight();
    var overlay = document.createElement('div');
    overlay.id = opts.id;
    var alignment = opts.alignTop ? 'flex-start' : 'center';
    var padTop = opts.alignTop ? 'padding-top:18vh;' : '';
    overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:' + alignment + ';justify-content:center;' + padTop + 'background:rgba(0,0,0,0.7);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:' + (opts.z || 99100) + ';opacity:0;transition:opacity 0.3s;';
    var modal = document.createElement('div');
    modal.style.cssText = 'max-width:' + (opts.maxWidth || '560px') + ';width:92%;max-height:88vh;overflow:auto;background:' + (lt ? '#ffffff' : '#0f0f0f') + ';border:1px solid ' + (lt ? 'rgba(168,140,86,0.3)' : 'rgba(201,181,122,0.22)') + ';border-radius:14px;padding:' + (opts.padding || '32px') + ';color:' + (lt ? '#1a1a1a' : '#f5ecd9') + ';font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 24px 80px ' + (lt ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.6)') + ';';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(function(){ overlay.style.opacity = '1'; }, 16);

    var closed = false;
    function close(){
      if (closed) return;
      closed = true;
      overlay.style.opacity = '0';
      setTimeout(function(){
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (typeof opts.onClose === 'function') { try { opts.onClose(); } catch(e){} }
      }, 250);
      if (escFn) document.removeEventListener('keydown', escFn);
    }
    if (opts.clickOutsideClose !== false) {
      overlay.onclick = function(e){ if (e.target === overlay) close(); };
    }
    var escFn = null;
    if (opts.escClose !== false) {
      escFn = function(e){ if (e.key === 'Escape') close(); };
      document.addEventListener('keydown', escFn);
    }
    return { overlay: overlay, modal: modal, close: close, isLight: lt };
  }
  // Standard gold-monogram header used by Brief, Recap, Shortcuts, Welcome.
  // Returns the HTML string. Pass eyebrow + title + optional subtitle.
  function header(eyebrow, title, subtitle){
    var lt = isLight();
    var subHtml = subtitle ? ('<div style="font-family:Georgia,serif;font-style:italic;font-size:13px;color:' + (lt ? 'rgba(0,0,0,0.5)' : 'rgba(245,236,217,0.5)') + ';margin-top:2px;">' + subtitle + '</div>') : '';
    return '<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">' +
      '<div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
        '<div style="position:absolute;inset:-6px;background:radial-gradient(circle,rgba(201,169,97,0.22) 0%,rgba(201,169,97,0) 70%);border-radius:50%;"></div>' +
        '<img src="/images/brilliance/monogram-circle.png" alt="" style="position:relative;width:48px;height:48px;border-radius:50%;object-fit:cover;" onerror="this.style.display=\'none\'" />' +
      '</div>' +
      '<div>' +
        '<div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:' + (lt ? '#7a6741' : '#c9a961') + ';font-weight:500;">' + eyebrow + '</div>' +
        '<div style="font-size:22px;font-weight:600;letter-spacing:-0.01em;color:' + (lt ? '#1a1a1a' : '#f5ecd9') + ';">' + title + '</div>' +
        subHtml +
      '</div>' +
    '</div>';
  }
  // Standard gold-gradient pill button, used as primary CTA in modal footers.
  function primaryBtn(id, label){
    return '<button id="' + id + '" style="padding:11px 24px;background:linear-gradient(135deg,#e2c79b,#c9a961,#a88a4a);border:none;border-radius:99px;color:#0a0a0a;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;">' + label + '</button>';
  }
  // Standard outline pill button.
  function outlineBtn(id, label){
    var lt = isLight();
    return '<button id="' + id + '" style="padding:9px 16px;background:transparent;border:1px solid ' + (lt ? 'rgba(168,140,86,0.32)' : 'rgba(201,169,97,0.32)') + ';border-radius:99px;color:' + (lt ? '#7a6741' : '#c9a961') + ';font-size:11px;font-weight:500;letter-spacing:0.06em;cursor:pointer;">' + label + '</button>';
  }
  return {
    isInputTarget: isInputTarget,
    isLight: isLight,
    makeOverlay: makeOverlay,
    header: header,
    primaryBtn: primaryBtn,
    outlineBtn: outlineBtn
  };
})();

// v33.1: Settings picker for Brilli form. Inline modal with previews.
window.openBrilliFormPicker = function openBrilliFormPicker() {
  // Avoid stacking duplicates.
  var existing = document.getElementById('brilliFormPickerOverlay');
  if (existing) existing.parentNode.removeChild(existing);

  var current = (typeof Brilli !== 'undefined') ? Brilli.getActiveForm() : 'celestial';

  // v34.63: Brought in line with the v34.x modal voice — light-mode branch,
  // matching backdrop opacity / blur, eyebrow header, gold gradient Close
  // button, z-index 99100. Pre-v34.63 the picker was the only overlay modal
  // missing all of these and stood out next to Brief / Recap / Shortcuts.
  var lt = (function(){ try { return document.documentElement.classList.contains('light-mode'); } catch(e){ return false; } })();
  var overlay = document.createElement('div');
  overlay.id = 'brilliFormPickerOverlay';
  overlay.className = 'modal-overlay show';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Brilli Form');
  // visibility/opacity overrides — the global `.modal-overlay` rule sets
  // `visibility:hidden;opacity:0` by default and expects a `.show` class to
  // flip it. Inline visibility:visible + opacity:1 is belt-and-suspenders.
  overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:99100;visibility:visible;opacity:1;';
  overlay.onclick = function(e){ if (e.target === overlay) overlay.parentNode.removeChild(overlay); };

  var modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = 'max-width:560px;width:92%;background:' + (lt ? '#ffffff' : '#0f0f0f') + ';border:1px solid ' + (lt ? 'rgba(168,140,86,0.3)' : 'rgba(201,181,122,0.22)') + ';border-radius:14px;padding:24px;color:' + (lt ? '#1a1a1a' : '#f5ecd9') + ';font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 24px 80px ' + (lt ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.6)') + ';';
  modal.innerHTML =
    '<div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:' + (lt ? '#7a6741' : '#c9a961') + ';font-weight:500;margin-bottom:6px;">Appearance</div>' +
    '<div style="font-size:18px;font-weight:600;margin-bottom:6px;letter-spacing:-0.01em;color:' + (lt ? '#1a1a1a' : '#f5ecd9') + ';">Brilli Form</div>' +
    '<div style="font-size:13px;color:' + (lt ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)') + ';margin-bottom:18px;line-height:1.5;">Choose how Brilli appears in the chat hero and sidebar. Your selection applies immediately.</div>' +
    '<div id="brilliFormPickerGrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;"></div>' +
    '<div style="margin-top:18px;display:flex;justify-content:flex-end;gap:8px;">' +
      '<button id="brilliFormPickerCloseBtn" style="padding:9px 20px;background:linear-gradient(135deg,#e2c79b,#c9a961,#a88a4a);border:none;border-radius:99px;color:#0a0a0a;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;">Done</button>' +
    '</div>';
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  var forms = [
    { id: 'celestial', label: 'Celestial Orb', desc: 'Gold sphere with bloom and inner sparks. The default.' },
    { id: 'aura',      label: 'Aura / Field',  desc: 'Pulsing concentric rings around a bright seed.' },
    { id: 'firefly',   label: 'Firefly',       desc: 'Wings + glowing body + drifting trail.' },
    { id: 'signature', label: 'Light Signature', desc: 'A sparkle tracing a circle. Pure motion.' },
    { id: 'classic',   label: 'Classic BLAKE', desc: 'The original ambient blob, Brand & Life AI Knowledge Engine.' }
  ];

  var grid = modal.querySelector('#brilliFormPickerGrid');
  for (var i = 0; i < forms.length; i++) {
    (function(f){
      var card = document.createElement('div');
      var isActive = (f.id === current);
      var inactiveBorder = lt ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
      var activeBorder = lt ? 'rgba(168,140,86,0.55)' : 'rgba(201,181,122,0.7)';
      var cardBg = lt
        ? (isActive ? 'rgba(168,140,86,0.07)' : 'rgba(0,0,0,0.02)')
        : (isActive ? 'rgba(201,181,122,0.06)' : 'rgba(255,255,255,0.02)');
      card.style.cssText = 'cursor:pointer;border:1px solid ' + (isActive ? activeBorder : inactiveBorder) + ';border-radius:10px;padding:12px;background:' + cardBg + ';display:flex;flex-direction:column;align-items:center;gap:8px;transition:all 0.2s;';
      card.onmouseover = function(){ card.style.borderColor = lt ? 'rgba(168,140,86,0.4)' : 'rgba(201,181,122,0.5)'; };
      card.onmouseout  = function(){ card.style.borderColor = (f.id === Brilli.getActiveForm()) ? activeBorder : inactiveBorder; };

      var preview = document.createElement('div');
      preview.style.cssText = 'width:96px;height:96px;display:flex;align-items:center;justify-content:center;';
      card.appendChild(preview);

      var label = document.createElement('div');
      label.style.cssText = 'font-size:13px;font-weight:600;color:' + (lt ? '#1a1a1a' : '#f5ecd9') + ';text-align:center;';
      label.textContent = f.label;
      card.appendChild(label);

      var desc = document.createElement('div');
      desc.style.cssText = 'font-size:11px;color:' + (lt ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.45)') + ';text-align:center;line-height:1.4;';
      desc.textContent = f.desc;
      card.appendChild(desc);

      card.onclick = function(){
        if (typeof Brilli !== 'undefined') Brilli.setActiveForm(f.id);
        try { document.documentElement.setAttribute('data-brilli-form', f.id); } catch(e){}
        var labelEl = document.getElementById('brilliFormToggleText');
        var descEl  = document.getElementById('brilliFormDesc');
        if (labelEl) labelEl.textContent = f.label.split(' ')[0];
        if (descEl)  descEl.textContent  = f.label;
        // v34.4: Close picker after selection (was re-rendering before; user wants it dismissed).
        try { document.removeEventListener('keydown', keyHandler); } catch(eR){}
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        setTimeout(_brilliPruneOrphaned, 0);
        try { if (typeof showToast === 'function') showToast('Brilli set to ' + f.label, 'success'); } catch(eT){}
      };

      grid.appendChild(card);

      // Mount a mini Brilli into the preview card (skip RAF for 'classic' shim).
      try {
        if (f.id === 'classic') {
          var dot = document.createElement('div');
          dot.style.cssText = 'width:64px;height:64px;border-radius:50%;background:radial-gradient(circle,#f5e6c8 0%,#c9a961 60%,rgba(168,138,74,0.5) 100%);';
          preview.appendChild(dot);
        } else {
          Brilli.mount(preview, { size: 'inline', mode: 'idle', form: f.id });
        }
      } catch(e){}
    })(forms[i]);
  }

  // v33.17: Keyboard nav — Arrow Left/Right cycles, Enter selects, Esc closes.
  var keyHandler = function(ev){
    if (!document.body.contains(overlay)) return;
    var cards = grid.children;
    if (!cards || cards.length === 0) return;
    var currentIdx = forms.findIndex(function(f){ return f.id === Brilli.getActiveForm(); });
    if (currentIdx < 0) currentIdx = 0;
    if (ev.key === 'ArrowRight') {
      ev.preventDefault();
      var next = (currentIdx + 1) % forms.length;
      Brilli.setActiveForm(forms[next].id);
    } else if (ev.key === 'ArrowLeft') {
      ev.preventDefault();
      var prev = (currentIdx - 1 + forms.length) % forms.length;
      Brilli.setActiveForm(forms[prev].id);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      modal.querySelector('#brilliFormPickerCloseBtn').click();
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      modal.querySelector('#brilliFormPickerCloseBtn').click();
    }
  };
  document.addEventListener('keydown', keyHandler);

  modal.querySelector('#brilliFormPickerCloseBtn').onclick = function(){
    document.removeEventListener('keydown', keyHandler);
    // v33.12: Unmount all preview Brilli instances on close to free RAF.
    try {
      var previewCanvases = modal.querySelectorAll('canvas');
      for (var i = 0; i < previewCanvases.length; i++) {
        // Each preview canvas is wrapped in a Brilli host. We rely on instances
        // array cleanup via removing the host from DOM (Brilli.mount uses host).
        // The simplest safe move: remove modal, instances become orphaned but
        // instances array still references them — explicit unmount via Brilli.unmount
        // requires the instance object. Instead we trigger _all_ instance cleanup
        // by walking the instances list and unmounting orphaned hosts.
      }
      // Walk the global Brilli instances; unmount any whose host is no longer in DOM.
      // Defer slightly to allow DOM removal.
    } catch(e){}
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    setTimeout(_brilliPruneOrphaned, 0);
  };
};

// v33.12: Walk Brilli instances and unmount any whose host is detached from DOM.
function _brilliPruneOrphaned() {
  try {
    if (typeof Brilli === 'undefined' || !Brilli._debugInstances) return;
    var inst = Brilli._debugInstances();
    for (var i = inst.length - 1; i >= 0; i--) {
      var b = inst[i];
      if (b.host && !document.body.contains(b.host)) {
        Brilli.unmount(b);
      }
    }
  } catch(e){}
}

// v33.49: Reset all v33.x feature flags to defaults. Power-user affordance.
window.resetBrilliancePrefs = function resetBrilliancePrefs() {
  if (!confirm('Reset all Brilliance preferences to defaults?\n\n' +
    'This clears: Brilli form + intensity, Evolve flags, Quiz/Verifier engine flags, ' +
    'Concierge dismiss state, Sync v5 flags. Your data (brands, conversations, ' +
    'automations, evolve profile, etc.) is unaffected.\n\n' +
    'Reload after to apply.')) return;
  var keys = [
    'roweos_brilli_form',
    'roweos_brilli_intensity',
    'roweos_evolve_enabled',
    'roweos_evolve_quiz_engine',
    'roweos_evolve_verifier_engine',
    'roweos_sync_v5_enabled',
    'roweos_sync_v5_writes',
    'roweos_sync_v5_dual_write',
    'roweos_concierge_off',
    'brilliance_whatsnew_off',
    // v33.72: new surface modifiers
    'roweos_focus_mode_disabled',
    'roweos_letter_series',
    // v33.77: Tier 2 surface toggles
    'roweos_studio_split_pane',
    'roweos_folio_easel'
  ];
  for (var i = 0; i < keys.length; i++) {
    try { localStorage.removeItem(keys[i]); } catch(e){}
  }
  if (typeof showToast === 'function') showToast('Preferences reset. Reload to apply.', 'success');
};

// Sync settings row label on init.
(function syncBrilliFormLabel(){
  function apply(){
    try {
      var form = (typeof Brilli !== 'undefined') ? Brilli.getActiveForm() : 'celestial';
      var labels = { celestial:'Celestial Orb', aura:'Aura / Field', firefly:'Firefly', signature:'Light Signature', classic:'Classic BLAKE' };
      var shortLabels = { celestial:'Celestial', aura:'Aura', firefly:'Firefly', signature:'Signature', classic:'Classic' };
      var labelEl = document.getElementById('brilliFormToggleText');
      var descEl  = document.getElementById('brilliFormDesc');
      if (labelEl) labelEl.textContent = shortLabels[form] || 'Celestial';
      if (descEl)  descEl.textContent  = labels[form] || 'Celestial Orb';
      // v34.6: Init Brilli Settings preview dot.
      var prev = document.getElementById('brilliFormSettingsPreview');
      if (prev && typeof window._updateBrilliSettingsPreview === 'function') {
        window._updateBrilliSettingsPreview(prev, form);
      }
      // v34.9: Init chip-strip active state.
      try {
        var chips = document.querySelectorAll('[data-brilli-chip]');
        for (var ci = 0; ci < chips.length; ci++) {
          var cf = chips[ci];
          var isActive = cf.getAttribute('data-brilli-chip') === form;
          cf.style.borderColor = isActive ? 'rgba(201,169,97,0.6)' : 'var(--border-color)';
          cf.style.background = isActive ? 'rgba(201,169,97,0.1)' : 'var(--bg-tertiary)';
          cf.style.color = isActive ? 'var(--text-primary)' : 'var(--text-secondary)';
        }
      } catch(eCi){}
      // v33.13: Init intensity slider.
      var slider = document.getElementById('brilliIntensitySlider');
      var valEl = document.getElementById('brilliIntensityValue');
      if (slider && typeof Brilli !== 'undefined') {
        var v = Brilli.getIntensity();
        slider.value = v;
        if (valEl) valEl.textContent = v;
      }
      // v33.97: Init Per-form Ambient toggle.
      var formAmbToggle = document.getElementById('formAmbientToggle');
      if (formAmbToggle && typeof Brilli !== 'undefined' && typeof Brilli.isFormAmbientOn === 'function') {
        formAmbToggle.checked = Brilli.isFormAmbientOn();
      }
      // v33.23 / v33.48: Init concierge + Evolve + engine toggle labels.
      var conciergeText = document.getElementById('conciergeToggleText');
      if (conciergeText) {
        conciergeText.textContent = (localStorage.getItem('roweos_concierge_off') === 'true') ? 'Off' : 'On';
      }
      var evolveText = document.getElementById('evolveToggleText');
      if (evolveText) {
        evolveText.textContent = (localStorage.getItem('roweos_evolve_enabled') === 'true') ? 'On' : 'Off';
      }
      // v34.50: Init Daily Brief auto-show toggle label.
      var dbAutoText = document.getElementById('dailyBriefAutoText');
      if (dbAutoText) {
        dbAutoText.textContent = (localStorage.getItem('roweos_daily_brief_auto') === 'true') ? 'On' : 'Off';
      }
      // v34.79: Engines auto-activate. Toggle reads the *off* flag now.
      var quizEngineText = document.getElementById('quizEngineToggleText');
      if (quizEngineText) {
        quizEngineText.textContent = (localStorage.getItem('roweos_evolve_quiz_engine_off') === 'true') ? 'Off' : 'On';
      }
      var verifierEngineText = document.getElementById('verifierEngineToggleText');
      if (verifierEngineText) {
        verifierEngineText.textContent = (localStorage.getItem('roweos_evolve_verifier_engine_off') === 'true') ? 'Off' : 'On';
      }
      // v34.87: Native Workspace status refresh.
      try { if (typeof window.refreshNativeWorkspaceUI === 'function') window.refreshNativeWorkspaceUI(); } catch(_e){}
      // v33.72: Focus Mode + Letter Series labels.
      var focusModeAllowText = document.getElementById('focusModeAllowText');
      if (focusModeAllowText) {
        focusModeAllowText.textContent = (localStorage.getItem('roweos_focus_mode_disabled') === 'true') ? 'Off' : 'On';
      }
      var letterSeriesText = document.getElementById('letterSeriesToggleText');
      if (letterSeriesText) {
        letterSeriesText.textContent = (localStorage.getItem('roweos_letter_series') === 'true') ? 'On' : 'Off';
      }
      // v33.77: Studio Split-Pane + Folio Studio-at-Work labels.
      var splitPaneText = document.getElementById('splitPaneToggleText');
      if (splitPaneText) {
        splitPaneText.textContent = (localStorage.getItem('roweos_studio_split_pane') === 'true') ? 'On' : 'Off';
      }
      var folioEaselText = document.getElementById('folioEaselToggleText');
      if (folioEaselText) {
        folioEaselText.textContent = (localStorage.getItem('roweos_folio_easel') === 'true') ? 'On' : 'Off';
      }
    } catch(e){}
  }
  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(apply, 0);
  else document.addEventListener('DOMContentLoaded', apply);
  window.addEventListener('brilli:form-changed', apply);
})();

// v34.9: Keyboard shortcut to cycle through Brilli forms — ⌘⌥B on Mac,
// Ctrl+Alt+B on other platforms. Power-user affordance for trying each form
// without opening Settings → Appearance → Brilli Form picker every time.
(function _wireBrilliCycleShortcut(){
  var FORMS = ['celestial','aura','firefly','signature','classic'];
  function _isInputTarget(el){
    if (!el) return false;
    if (el.isContentEditable) return true;
    var t = (el.tagName || '').toLowerCase();
    return t === 'input' || t === 'textarea' || t === 'select';
  }
  document.addEventListener('keydown', function(ev){
    // Don't fire while user is typing.
    if (_isInputTarget(ev.target)) return;
    // Match ⌘⌥B (Mac) and Ctrl+Alt+B (others). Some keyboards report KeyB lowercase.
    var key = (ev.key || '').toLowerCase();
    if (key !== 'b' && key !== '∫') return; // ∫ = Mac's ⌥B character
    var modOK = (ev.metaKey && ev.altKey) || (ev.ctrlKey && ev.altKey);
    if (!modOK) return;
    ev.preventDefault();
    if (typeof Brilli === 'undefined') return;
    var current = Brilli.getActiveForm();
    var idx = FORMS.indexOf(current);
    var next = FORMS[(idx + 1) % FORMS.length];
    Brilli.setActiveForm(next);
  });
})();

// v34.19: Quick-add Pulse goal/task — ⌘ ⇧ G opens a tiny inline modal that
// captures one line and writes it as an item on the Unassigned Pulse goal,
// so users can capture a thought without losing context. Mirrors the keyboard
// + skip-on-input pattern used by the v34.9 Brilli cycle and v34.18 `?` key.
window.openQuickAddGoal = function openQuickAddGoal(prefill) {
  var existing = document.getElementById('brillianceQuickAddOverlay');
  if (existing) existing.parentNode.removeChild(existing);

  var isLight = (function(){ try { return document.documentElement.classList.contains('light-mode'); } catch(e){ return false; } })();

  var overlay = document.createElement('div');
  overlay.id = 'brillianceQuickAddOverlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Quick add to Pulse');
  overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:center;padding-top:18vh;background:rgba(0,0,0,0.7);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:99100;opacity:0;transition:opacity 0.3s;';
  overlay.onclick = function(e){ if (e.target === overlay) _close(); };

  var modal = document.createElement('div');
  modal.style.cssText = 'max-width:520px;width:92%;background:' + (isLight ? '#ffffff' : '#0f0f0f') + ';border:1px solid ' + (isLight ? 'rgba(168,140,86,0.3)' : 'rgba(201,181,122,0.22)') + ';border-radius:14px;padding:22px 24px;color:' + (isLight ? '#1a1a1a' : '#f5ecd9') + ';font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 24px 80px ' + (isLight ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.6)') + ';';

  modal.innerHTML =
    '<div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:' + (isLight ? '#7a6741' : '#c9a961') + ';font-weight:500;margin-bottom:6px;">Quick add to Pulse</div>' +
    '<div style="font-size:18px;font-weight:600;letter-spacing:-0.01em;color:' + (isLight ? '#1a1a1a' : '#f5ecd9') + ';margin-bottom:14px;">What needs to happen?</div>' +
    '<input id="brillianceQuickAddInput" type="text" placeholder="Type a goal or task and press Enter…" value="' + (prefill || '').replace(/"/g, '&quot;') + '" style="width:100%;padding:12px 14px;background:' + (isLight ? '#fafaf6' : '#1a1610') + ';border:1px solid ' + (isLight ? 'rgba(168,140,86,0.28)' : 'rgba(201,169,97,0.28)') + ';border-radius:10px;color:' + (isLight ? '#1a1a1a' : '#f5ecd9') + ';font-size:15px;outline:none;font-family:inherit;box-sizing:border-box;" />' +
    '<div style="margin-top:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;">' +
      '<div style="font-size:11px;color:' + (isLight ? 'rgba(0,0,0,0.45)' : 'rgba(245,236,217,0.45)') + ';">Saved to the <strong style="color:' + (isLight ? '#5a4d2e' : '#e2c79b') + ';">Unassigned</strong> goal in Pulse · Esc to cancel</div>' +
      '<button id="brillianceQuickAddSubmit" style="padding:9px 20px;background:linear-gradient(135deg,#e2c79b,#c9a961,#a88a4a);border:none;border-radius:99px;color:#0a0a0a;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;">Add</button>' +
    '</div>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  setTimeout(function(){ overlay.style.opacity = '1'; }, 16);
  var input = document.getElementById('brillianceQuickAddInput');
  if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }

  function _close() {
    overlay.style.opacity = '0';
    setTimeout(function(){ if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 250);
    document.removeEventListener('keydown', escH);
  }
  function escH(e) { if (e.key === 'Escape') _close(); }
  document.addEventListener('keydown', escH);

  function _submit() {
    var text = (input && input.value || '').trim();
    if (!text) { _close(); return; }
    try {
      if (typeof addItemToPulseGoal === 'function') {
        addItemToPulseGoal(null, { text: text });
        try {
          if (typeof showToast === 'function') showToast('Added to Pulse · Unassigned', 'success');
        } catch(eT){}
        // Refresh sidebar dot + concierge so the new item shows immediately.
        try { if (typeof updateSidebarBadges === 'function') updateSidebarBadges(); } catch(eS){}
        try { if (typeof _renderConciergeRow === 'function') _renderConciergeRow(); } catch(eR){}
      } else {
        if (typeof showToast === 'function') showToast('Pulse not loaded yet', 'error');
      }
    } catch(eAdd) {
      console.warn('[QuickAdd] error:', eAdd);
    }
    _close();
  }
  document.getElementById('brillianceQuickAddSubmit').onclick = _submit;
  if (input) {
    input.addEventListener('keydown', function(e){
      if (e.key === 'Enter') { e.preventDefault(); _submit(); }
    });
  }
};

// v34.20: Quick-add reminder — symmetrical to ⌘ ⇧ G for Pulse, but routes to
// `roweos_reminders` via the existing `saveReminderToHistory()` flow. Captures
// a title + a datetime; defaults to "in 1 hour" so a single-line capture still
// produces a usable reminder.
window.openQuickAddReminder = function openQuickAddReminder(prefill) {
  var existing = document.getElementById('brillianceQuickReminderOverlay');
  if (existing) existing.parentNode.removeChild(existing);
  var isLight = (function(){ try { return document.documentElement.classList.contains('light-mode'); } catch(e){ return false; } })();

  var overlay = document.createElement('div');
  overlay.id = 'brillianceQuickReminderOverlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Quick reminder');
  overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:center;padding-top:18vh;background:rgba(0,0,0,0.7);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:99100;opacity:0;transition:opacity 0.3s;';
  overlay.onclick = function(e){ if (e.target === overlay) _close(); };

  // Default scheduled time = now + 1 hour, formatted for <input type="datetime-local">.
  var d = new Date(Date.now() + 60 * 60 * 1000);
  var pad = function(n){ return n < 10 ? '0' + n : '' + n; };
  var dtDefault = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());

  var modal = document.createElement('div');
  modal.style.cssText = 'max-width:520px;width:92%;background:' + (isLight ? '#ffffff' : '#0f0f0f') + ';border:1px solid ' + (isLight ? 'rgba(168,140,86,0.3)' : 'rgba(201,181,122,0.22)') + ';border-radius:14px;padding:22px 24px;color:' + (isLight ? '#1a1a1a' : '#f5ecd9') + ';font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 24px 80px ' + (isLight ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.6)') + ';';
  modal.innerHTML =
    '<div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:' + (isLight ? '#7a6741' : '#c9a961') + ';font-weight:500;margin-bottom:6px;">Quick reminder</div>' +
    '<div style="font-size:18px;font-weight:600;letter-spacing:-0.01em;color:' + (isLight ? '#1a1a1a' : '#f5ecd9') + ';margin-bottom:14px;">Remind me to…</div>' +
    '<input id="brillianceQuickReminderTitle" type="text" placeholder="What\'s the reminder?" value="' + (prefill || '').replace(/"/g, '&quot;') + '" style="width:100%;padding:12px 14px;background:' + (isLight ? '#fafaf6' : '#1a1610') + ';border:1px solid ' + (isLight ? 'rgba(168,140,86,0.28)' : 'rgba(201,169,97,0.28)') + ';border-radius:10px;color:' + (isLight ? '#1a1a1a' : '#f5ecd9') + ';font-size:15px;outline:none;font-family:inherit;box-sizing:border-box;margin-bottom:10px;" />' +
    '<input id="brillianceQuickReminderTime" type="datetime-local" value="' + dtDefault + '" style="width:100%;padding:11px 14px;background:' + (isLight ? '#fafaf6' : '#1a1610') + ';border:1px solid ' + (isLight ? 'rgba(168,140,86,0.28)' : 'rgba(201,169,97,0.28)') + ';border-radius:10px;color:' + (isLight ? '#1a1a1a' : '#f5ecd9') + ';font-size:14px;outline:none;font-family:inherit;box-sizing:border-box;color-scheme:' + (isLight ? 'light' : 'dark') + ';" />' +
    '<div style="margin-top:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;">' +
      '<div style="font-size:11px;color:' + (isLight ? 'rgba(0,0,0,0.45)' : 'rgba(245,236,217,0.45)') + ';">Default time is <strong style="color:' + (isLight ? '#5a4d2e' : '#e2c79b') + ';">+1 hour</strong> · Esc to cancel</div>' +
      '<button id="brillianceQuickReminderSubmit" style="padding:9px 20px;background:linear-gradient(135deg,#e2c79b,#c9a961,#a88a4a);border:none;border-radius:99px;color:#0a0a0a;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;">Set</button>' +
    '</div>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  setTimeout(function(){ overlay.style.opacity = '1'; }, 16);
  var titleInput = document.getElementById('brillianceQuickReminderTitle');
  if (titleInput) { titleInput.focus(); titleInput.setSelectionRange(titleInput.value.length, titleInput.value.length); }

  function _close() {
    overlay.style.opacity = '0';
    setTimeout(function(){ if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 250);
    document.removeEventListener('keydown', escH);
  }
  function escH(e) { if (e.key === 'Escape') _close(); }
  document.addEventListener('keydown', escH);

  function _submit() {
    var title = (titleInput && titleInput.value || '').trim();
    var dtVal = document.getElementById('brillianceQuickReminderTime').value;
    if (!title) { _close(); return; }
    var when = Date.now() + 60 * 60 * 1000;
    if (dtVal) {
      var parsed = new Date(dtVal).getTime();
      if (!isNaN(parsed)) when = parsed;
    }
    try {
      if (typeof saveReminderToHistory === 'function') {
        saveReminderToHistory({
          title: title,
          scheduledAt: new Date(when).toISOString(),
          source: 'quick_add',
          status: 'pending'
        });
        if (typeof showToast === 'function') {
          var diffMin = Math.round((when - Date.now()) / 60000);
          var rel = diffMin < 60 ? diffMin + ' min' : (Math.round(diffMin / 60) + ' hr');
          showToast('Reminder set · in ' + rel, 'success');
        }
        try { if (typeof updateSidebarBadges === 'function') updateSidebarBadges(); } catch(eS){}
        try { if (typeof _renderConciergeRow === 'function') _renderConciergeRow(); } catch(eR){}
      } else {
        if (typeof showToast === 'function') showToast('Reminders not loaded yet', 'error');
      }
    } catch(eAdd) {
      console.warn('[QuickReminder] error:', eAdd);
    }
    _close();
  }
  document.getElementById('brillianceQuickReminderSubmit').onclick = _submit;
  if (titleInput) {
    titleInput.addEventListener('keydown', function(e){
      if (e.key === 'Enter') { e.preventDefault(); _submit(); }
    });
  }
};

// v34.25: Quick note — ⌘ ⇧ N / Ctrl + Shift + N captures a single line
// straight into a Scribe "Quick Capture" notebook so users can drop a thought
// without context-switching. Mirrors the v34.19 / v34.20 quick-add pattern.
window.openQuickAddNote = function openQuickAddNote(prefill) {
  var existing = document.getElementById('brillianceQuickNoteOverlay');
  if (existing) existing.parentNode.removeChild(existing);
  var isLight = (function(){ try { return document.documentElement.classList.contains('light-mode'); } catch(e){ return false; } })();

  var overlay = document.createElement('div');
  overlay.id = 'brillianceQuickNoteOverlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Quick note');
  overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:flex-start;justify-content:center;padding-top:18vh;background:rgba(0,0,0,0.7);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:99100;opacity:0;transition:opacity 0.3s;';
  overlay.onclick = function(e){ if (e.target === overlay) _close(); };

  var modal = document.createElement('div');
  modal.style.cssText = 'max-width:560px;width:92%;background:' + (isLight ? '#ffffff' : '#0f0f0f') + ';border:1px solid ' + (isLight ? 'rgba(168,140,86,0.3)' : 'rgba(201,181,122,0.22)') + ';border-radius:14px;padding:22px 24px;color:' + (isLight ? '#1a1a1a' : '#f5ecd9') + ';font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 24px 80px ' + (isLight ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.6)') + ';';
  modal.innerHTML =
    '<div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:' + (isLight ? '#7a6741' : '#c9a961') + ';font-weight:500;margin-bottom:6px;">Quick note</div>' +
    '<div style="font-size:18px;font-weight:600;letter-spacing:-0.01em;color:' + (isLight ? '#1a1a1a' : '#f5ecd9') + ';margin-bottom:14px;">Drop a thought…</div>' +
    '<textarea id="brillianceQuickNoteText" rows="4" placeholder="Type a note. Enter inserts a newline; ⌘ Enter saves." style="width:100%;padding:12px 14px;background:' + (isLight ? '#fafaf6' : '#1a1610') + ';border:1px solid ' + (isLight ? 'rgba(168,140,86,0.28)' : 'rgba(201,169,97,0.28)') + ';border-radius:10px;color:' + (isLight ? '#1a1a1a' : '#f5ecd9') + ';font-size:15px;outline:none;font-family:inherit;box-sizing:border-box;resize:vertical;line-height:1.5;">' + (prefill || '').replace(/</g, '&lt;') + '</textarea>' +
    '<div style="margin-top:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;">' +
      '<div style="font-size:11px;color:' + (isLight ? 'rgba(0,0,0,0.45)' : 'rgba(245,236,217,0.45)') + ';">Saved to <strong style="color:' + (isLight ? '#5a4d2e' : '#e2c79b') + ';">Quick Capture</strong> in Notebooks · Esc to cancel</div>' +
      '<button id="brillianceQuickNoteSubmit" style="padding:9px 20px;background:linear-gradient(135deg,#e2c79b,#c9a961,#a88a4a);border:none;border-radius:99px;color:#0a0a0a;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;">Save</button>' +
    '</div>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  setTimeout(function(){ overlay.style.opacity = '1'; }, 16);
  var ta = document.getElementById('brillianceQuickNoteText');
  if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }

  function _close() {
    overlay.style.opacity = '0';
    setTimeout(function(){ if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 250);
    document.removeEventListener('keydown', escH);
  }
  function escH(e) { if (e.key === 'Escape') _close(); }
  document.addEventListener('keydown', escH);

  function _submit() {
    var text = (ta && ta.value || '').trim();
    if (!text) { _close(); return; }
    try {
      var KEY = 'roweos_scribe_notebooks';
      var notebooks = [];
      try { var raw = localStorage.getItem(KEY); if (raw) notebooks = JSON.parse(raw) || []; } catch(eR){}
      if (!Array.isArray(notebooks)) notebooks = [];
      // Find the Quick Capture notebook (or create it).
      var qc = null;
      for (var i = 0; i < notebooks.length; i++) {
        if (notebooks[i] && notebooks[i].title === 'Quick Capture') { qc = notebooks[i]; break; }
      }
      var nowMs = Date.now();
      var nowIso = new Date(nowMs).toISOString();
      if (!qc) {
        qc = {
          id: 'nb_' + nowMs + '_' + Math.random().toString(36).substr(2, 6),
          title: 'Quick Capture',
          content: '',
          pages: [],
          sources: [],
          linkedPeople: [],
          linkedLibraryItems: [],
          tags: ['quick-capture'],
          brandIdx: (typeof selectedBrand !== 'undefined' ? selectedBrand : null),
          source: (typeof currentMode !== 'undefined' && currentMode === 'lifeai') ? 'lifeai' : 'brandai',
          createdAt: nowIso,
          updatedAt: nowIso,
          _modifiedAt: nowMs,
          archived: false
        };
        notebooks.unshift(qc);
      }
      // Append the note as a new line at the top of the notebook content.
      var datetime = (new Date()).toLocaleString();
      var entry = '<p><strong>' + datetime + '</strong></p><p>' + text.replace(/</g, '&lt;').replace(/\n/g, '<br>') + '</p><hr>';
      qc.content = entry + (qc.content || '');
      qc.updatedAt = nowIso;
      qc._modifiedAt = nowMs;
      try { localStorage.setItem(KEY, JSON.stringify(notebooks)); } catch(eS){}
      // Sync to cloud through writeDB if available.
      try { if (typeof writeDB === 'function') writeDB('scribe/main', { notebooks: JSON.stringify(notebooks) }); } catch(eW){}
      if (typeof showToast === 'function') showToast('Note saved · Quick Capture', 'success');
      try { if (typeof updateSidebarBadges === 'function') updateSidebarBadges(); } catch(eU){}
      try { if (typeof _renderConciergeRow === 'function') _renderConciergeRow(); } catch(eC){}
    } catch(eAdd) {
      console.warn('[QuickNote] error:', eAdd);
      if (typeof showToast === 'function') showToast('Note save failed, check console', 'error');
    }
    _close();
  }
  document.getElementById('brillianceQuickNoteSubmit').onclick = _submit;
  if (ta) {
    ta.addEventListener('keydown', function(e){
      // ⌘/Ctrl + Enter saves; plain Enter inserts a newline.
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); _submit(); }
    });
  }
};

// Bind ⌘ ⇧ N / Ctrl + Shift + N to the quick-note overlay.
(function _wireQuickNoteShortcut(){
  function _isInputTarget(el){
    if (!el) return false;
    if (el.isContentEditable) return true;
    var t = (el.tagName || '').toLowerCase();
    return t === 'input' || t === 'textarea' || t === 'select';
  }
  document.addEventListener('keydown', function(ev){
    if (_isInputTarget(ev.target)) return;
    var modOK = (ev.metaKey && ev.shiftKey) || (ev.ctrlKey && ev.shiftKey);
    if (!modOK) return;
    var key = (ev.key || '').toLowerCase();
    if (key !== 'n') return;
    if (document.getElementById('brillianceQuickNoteOverlay')) return;
    ev.preventDefault();
    if (typeof window.openQuickAddNote === 'function') window.openQuickAddNote();
  });
})();

// v34.21: ⌘ ⇧ L / Ctrl + Shift + L toggles light / dark mode. Familiar keystroke
// from Linear, Cron, Raycast — quicker than digging into Settings → Appearance.
(function _wireThemeToggleShortcut(){
  function _isInputTarget(el){
    if (!el) return false;
    if (el.isContentEditable) return true;
    var t = (el.tagName || '').toLowerCase();
    return t === 'input' || t === 'textarea' || t === 'select';
  }
  document.addEventListener('keydown', function(ev){
    if (_isInputTarget(ev.target)) return;
    var modOK = (ev.metaKey && ev.shiftKey) || (ev.ctrlKey && ev.shiftKey);
    if (!modOK) return;
    var key = (ev.key || '').toLowerCase();
    if (key !== 'l') return;
    ev.preventDefault();
    if (typeof toggleTheme === 'function') {
      toggleTheme();
      try { if (typeof showToast === 'function') {
        var nextLight = document.documentElement.classList.contains('light-mode');
        showToast(nextLight ? 'Light mode' : 'Dark mode', 'info');
      } } catch(e){}
    }
  });
})();

// Bind ⌘ ⇧ R / Ctrl + Shift + R to the quick-reminder overlay.
(function _wireQuickReminderShortcut(){
  function _isInputTarget(el){
    if (!el) return false;
    if (el.isContentEditable) return true;
    var t = (el.tagName || '').toLowerCase();
    return t === 'input' || t === 'textarea' || t === 'select';
  }
  document.addEventListener('keydown', function(ev){
    if (_isInputTarget(ev.target)) return;
    var modOK = (ev.metaKey && ev.shiftKey) || (ev.ctrlKey && ev.shiftKey);
    if (!modOK) return;
    var key = (ev.key || '').toLowerCase();
    if (key !== 'r') return;
    if (document.getElementById('brillianceQuickReminderOverlay')) return;
    ev.preventDefault();
    if (typeof window.openQuickAddReminder === 'function') window.openQuickAddReminder();
  });
})();

// v34.36: ⌘ ⇧ T / Ctrl + Shift + T opens the Daily Brief from anywhere.
// Mnemonic: T for Today. Same skip-when-typing guard as the rest of the
// quick-action family (⌘⇧G / ⌘⇧R / ⌘⇧N / ⌘⇧L).
(function _wireDailyBriefShortcut(){
  function _isInputTarget(el){
    if (!el) return false;
    if (el.isContentEditable) return true;
    var t = (el.tagName || '').toLowerCase();
    return t === 'input' || t === 'textarea' || t === 'select';
  }
  document.addEventListener('keydown', function(ev){
    if (_isInputTarget(ev.target)) return;
    var modOK = (ev.metaKey && ev.shiftKey) || (ev.ctrlKey && ev.shiftKey);
    if (!modOK) return;
    var key = (ev.key || '').toLowerCase();
    if (key !== 't') return;
    if (document.getElementById('brillianceDailyBriefOverlay')) return;
    ev.preventDefault();
    if (typeof window.openDailyBrief === 'function') window.openDailyBrief();
  });
})();

// Bind ⌘ ⇧ G / Ctrl + Shift + G to the quick-add overlay.
(function _wireQuickAddShortcut(){
  function _isInputTarget(el){
    if (!el) return false;
    if (el.isContentEditable) return true;
    var t = (el.tagName || '').toLowerCase();
    return t === 'input' || t === 'textarea' || t === 'select';
  }
  document.addEventListener('keydown', function(ev){
    if (_isInputTarget(ev.target)) return;
    var modOK = (ev.metaKey && ev.shiftKey) || (ev.ctrlKey && ev.shiftKey);
    if (!modOK || !ev.shiftKey) return;
    var key = (ev.key || '').toLowerCase();
    if (key !== 'g') return;
    // Don't stack on top of an already-open overlay.
    if (document.getElementById('brillianceQuickAddOverlay')) return;
    ev.preventDefault();
    if (typeof window.openQuickAddGoal === 'function') window.openQuickAddGoal();
  });
})();

// v34.35: Daily Brief — a focused at-a-glance summary modal that pulls today's
// signals into one calm panel. Open via ⌘K "brief" / "daily brief" / "today" /
// "what's next" or window.openDailyBrief() directly. Surfaces:
//  - Pulse: open goals + items due today + overdue items, brand vs life split
//  - Reminders: count of due now + count of upcoming today
//  - Outbox: pending mail sends
//  - Calendar: today's events
//  - Bloom: count of new items since last viewed
// Each section is a tap target into the relevant view. Designed to be the
// "morning landing" view without forcing a full pageload.
window.openDailyBrief = function openDailyBrief() {
  var existing = document.getElementById('brillianceDailyBriefOverlay');
  if (existing) existing.parentNode.removeChild(existing);
  var isLight = (function(){ try { return document.documentElement.classList.contains('light-mode'); } catch(e){ return false; } })();

  // Gather signals.
  var todayStr = (function(){
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  })();

  var openGoalsCount = 0, dueTodayCount = 0, overdueCount = 0;
  try {
    var pg = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]');
    if (Array.isArray(pg)) {
      for (var gi = 0; gi < pg.length; gi++) {
        var g = pg[gi];
        if (!g || g.archived) continue;
        if (g.completed) continue; // Closed goals don't count as "open"
        openGoalsCount++;
        if (!g.items || !g.items.length) continue;
        for (var ii = 0; ii < g.items.length; ii++) {
          var it = g.items[ii];
          if (!it) continue;
          // v34.49: Count items completed TODAY across every goal — a positive
          // counterweight to the overdue/due signals.
          if (it.completed && it.completedAt && String(it.completedAt).slice(0, 10) === todayStr) {
            // _winsToday is collected later via reuse — flag here.
          }
          if (it.completed) continue;
          var dt = it.date || it.dueDate;
          if (!dt) continue;
          var dtStr = String(dt).slice(0, 10);
          if (dtStr === todayStr) dueTodayCount++;
          else if (dtStr < todayStr) overdueCount++;
        }
      }
    }
  } catch(e){}

  // v34.49: Today's wins — completed Pulse items today across every goal.
  // v34.55: Also compute the active streak — consecutive days (ending today
  // OR yesterday) with at least one completed Pulse item. Walks every goal's
  // items once, builds a `Set` of `YYYY-MM-DD` strings, then counts back from
  // today/yesterday until a gap.
  var winsToday = 0;
  var streakDays = 0;
  try {
    var pgw = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]');
    if (Array.isArray(pgw)) {
      var doneDayMap = {};
      for (var gwi = 0; gwi < pgw.length; gwi++) {
        var gw = pgw[gwi];
        if (!gw || !gw.items) continue;
        for (var iwi = 0; iwi < gw.items.length; iwi++) {
          var iw = gw.items[iwi];
          if (iw && iw.completed && iw.completedAt) {
            var dayKey = String(iw.completedAt).slice(0, 10);
            doneDayMap[dayKey] = true;
            if (dayKey === todayStr) winsToday++;
          }
        }
      }
      // Streak: count back from today until a gap. If today has no completions
      // but yesterday does, start the count from yesterday so the streak doesn't
      // collapse before bedtime.
      var probe = new Date();
      var hasToday = !!doneDayMap[todayStr];
      if (!hasToday) probe.setDate(probe.getDate() - 1);
      while (true) {
        var pk = probe.getFullYear() + '-' + String(probe.getMonth() + 1).padStart(2, '0') + '-' + String(probe.getDate()).padStart(2, '0');
        if (doneDayMap[pk]) {
          streakDays++;
          probe.setDate(probe.getDate() - 1);
        } else break;
        // Hard cap at 365 to avoid pathological loops.
        if (streakDays >= 365) break;
      }
    }
  } catch(eW){}

  var dueRemNow = 0, upcomingRemToday = 0;
  try {
    var rems = JSON.parse(localStorage.getItem('roweos_reminders') || '[]');
    if (Array.isArray(rems)) {
      var nowMs = Date.now();
      var endOfDayMs = (function(){ var d = new Date(); d.setHours(23,59,59,999); return d.getTime(); })();
      for (var ri = 0; ri < rems.length; ri++) {
        var r = rems[ri];
        if (!r || r.status === 'completed' || r.status === 'dismissed' || r.status === 'archived') continue;
        var sched = r.scheduledAt ? Date.parse(r.scheduledAt) : 0;
        if (!sched) continue;
        if (sched <= nowMs) dueRemNow++;
        else if (sched <= endOfDayMs) upcomingRemToday++;
      }
    }
  } catch(e){}

  var outboxPending = 0;
  try {
    var outb = JSON.parse(localStorage.getItem('roweos_mail_outbox') || '[]');
    if (Array.isArray(outb)) {
      outboxPending = outb.filter(function(m){ return m && m.status !== 'sent' && m.status !== 'failed' && m.status !== 'cancelled'; }).length;
    }
  } catch(e){}

  var todayEvents = 0;
  try {
    var cal = JSON.parse(localStorage.getItem('roweos_calendar') || '[]');
    if (Array.isArray(cal)) {
      for (var ci = 0; ci < cal.length; ci++) {
        var ev = cal[ci];
        if (ev && ev.start && String(ev.start).indexOf(todayStr) === 0) todayEvents++;
      }
    }
  } catch(e){}

  var bloomNewCount = 0;
  try {
    var bl = JSON.parse(localStorage.getItem('roweos_bloom_library') || '{}');
    if (bl && typeof bl === 'object' && !Array.isArray(bl)) {
      var lastSeenBl = parseInt(localStorage.getItem('roweos_bloom_last_seen') || '0');
      var blScopes = Object.keys(bl);
      for (var bsi = 0; bsi < blScopes.length; bsi++) {
        var bsItems = bl[blScopes[bsi]];
        if (!Array.isArray(bsItems)) continue;
        for (var bii = 0; bii < bsItems.length; bii++) {
          var bItem = bsItems[bii];
          if (!bItem) continue;
          var bTs = (typeof bItem._modifiedAt === 'number') ? bItem._modifiedAt : (bItem.savedAt ? Date.parse(bItem.savedAt) : (bItem.createdAt ? Date.parse(bItem.createdAt) : 0));
          if (bTs > lastSeenBl) bloomNewCount++;
        }
      }
    }
  } catch(e){}

  var greeting = (function(){
    var h = new Date().getHours();
    if (h < 5) return 'Late night';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Late evening';
  })();
  var firstName = '';
  try {
    if (typeof firebaseUser !== 'undefined' && firebaseUser) {
      firstName = (firebaseUser.displayName || firebaseUser.email || '').split(/[\s@]/)[0] || '';
    }
  } catch(e){}

  var overlay = document.createElement('div');
  overlay.id = 'brillianceDailyBriefOverlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Daily Brief');
  overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:99100;opacity:0;transition:opacity 0.3s;';
  overlay.onclick = function(e){ if (e.target === overlay) _close(); };

  var modal = document.createElement('div');
  modal.style.cssText = 'max-width:560px;width:92%;max-height:88vh;overflow:auto;background:' + (isLight ? '#ffffff' : '#0f0f0f') + ';border:1px solid ' + (isLight ? 'rgba(168,140,86,0.3)' : 'rgba(201,181,122,0.22)') + ';border-radius:14px;padding:32px;color:' + (isLight ? '#1a1a1a' : '#f5ecd9') + ';font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 24px 80px ' + (isLight ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.6)') + ';';

  var sectionStyle = 'display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:' + (isLight ? 'rgba(168,140,86,0.05)' : 'rgba(201,169,97,0.05)') + ';border:1px solid ' + (isLight ? 'rgba(168,140,86,0.18)' : 'rgba(201,169,97,0.18)') + ';border-radius:10px;cursor:pointer;transition:all 0.15s;text-decoration:none;color:inherit;margin-bottom:8px;';
  var labelStyle = 'font-family:Georgia,serif;font-size:14px;font-weight:500;color:' + (isLight ? '#5a4d2e' : '#e2c79b') + ';';
  var subStyle = 'font-size:12px;color:' + (isLight ? 'rgba(0,0,0,0.55)' : 'rgba(245,236,217,0.55)') + ';margin-top:2px;';
  var countStyle = 'font-family:Georgia,serif;font-size:24px;font-weight:400;color:' + (isLight ? '#1a1a1a' : '#f5ecd9') + ';line-height:1;';

  function row(label, sub, count, view, action){
    var clickJs;
    if (action === 'shortcuts') clickJs = "if(typeof showShortcutsOverlay===\\'function\\')showShortcutsOverlay();window._closeDailyBrief&&window._closeDailyBrief();";
    else if (action === 'mail-outbox') clickJs = "if(typeof showView===\\'function\\')showView(\\'mail\\');setTimeout(function(){if(typeof switchMailTab===\\'function\\')switchMailTab(\\'outbox\\');},80);window._closeDailyBrief&&window._closeDailyBrief();";
    else clickJs = "if(typeof showView===\\'function\\')showView(\\'" + view + "\\');window._closeDailyBrief&&window._closeDailyBrief();";
    return '<a href="javascript:void(0)" onclick="' + clickJs.replace(/\\\\'/g, "'") + '" style="' + sectionStyle + '">' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="' + labelStyle + '">' + label + '</div>' +
        '<div style="' + subStyle + '">' + sub + '</div>' +
      '</div>' +
      '<div style="' + countStyle + '">' + count + '</div>' +
    '</a>';
  }

  var bodyHtml = '';
  var anySignal = false;

  // Pulse: prioritize overdue, then due today, then open goals.
  if (overdueCount > 0 || dueTodayCount > 0 || openGoalsCount > 0) {
    anySignal = true;
    if (overdueCount > 0) bodyHtml += row('Pulse · Overdue', 'Items past their date', overdueCount, 'pulse');
    if (dueTodayCount > 0) bodyHtml += row('Pulse · Due Today', 'Items dated for today', dueTodayCount, 'pulse');
    if (overdueCount === 0 && dueTodayCount === 0 && openGoalsCount > 0) bodyHtml += row('Pulse', 'Open ' + (openGoalsCount === 1 ? 'goal' : 'goals'), openGoalsCount, 'pulse');
  }
  if (dueRemNow > 0) {
    anySignal = true;
    bodyHtml += row('Reminders · Due Now', 'Triggered, awaiting action', dueRemNow, 'pulse');
  }
  if (upcomingRemToday > 0) {
    anySignal = true;
    bodyHtml += row('Reminders · Upcoming Today', 'Will fire later today', upcomingRemToday, 'pulse');
  }
  if (outboxPending > 0) {
    anySignal = true;
    bodyHtml += row('Outbox · Pending', 'Mail queued, not yet sent', outboxPending, 'mail', 'mail-outbox');
  }
  if (todayEvents > 0) {
    anySignal = true;
    bodyHtml += row('Calendar · Today', 'Events on the calendar', todayEvents, 'rhythm');
  }
  if (bloomNewCount > 0) {
    anySignal = true;
    bodyHtml += row('Bloom · New', 'Saved seeds since last viewed', bloomNewCount, 'bloom');
  }

  // v34.55: Streak row — consecutive days with completed items. Renders just
  // above Today's Wins. Only shows for streaks of 2+ (a single day reads
  // better as just "Today's Wins"); celebrates 7/30/100-day milestones with a
  // distinct copy ("7-day streak", "One full month", "100 days").
  if (streakDays >= 2) {
    var streakCopy = streakDays + '-day streak';
    if (streakDays === 7) streakCopy = '7-day streak · one week';
    else if (streakDays >= 30 && streakDays < 60) streakCopy = streakDays + '-day streak · one full month';
    else if (streakDays >= 100) streakCopy = streakDays + '-day streak · keep going';
    var streakLabelStyle = 'font-family:Georgia,serif;font-size:14px;font-weight:500;color:' + (isLight ? '#7a6741' : '#e2c79b') + ';';
    var streakSubStyle = 'font-size:12px;color:' + (isLight ? 'rgba(0,0,0,0.55)' : 'rgba(245,236,217,0.55)') + ';margin-top:2px;';
    var streakCountStyle = 'font-family:Georgia,serif;font-size:24px;font-weight:400;color:' + (isLight ? '#7a6741' : '#e2c79b') + ';line-height:1;';
    var streakRowStyle = 'display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:' + (isLight ? 'rgba(168,140,86,0.08)' : 'rgba(201,169,97,0.08)') + ';border:1px solid ' + (isLight ? 'rgba(168,140,86,0.25)' : 'rgba(201,169,97,0.25)') + ';border-radius:10px;cursor:pointer;text-decoration:none;color:inherit;margin-bottom:8px;';
    bodyHtml += '<a href="javascript:void(0)" onclick="if(typeof showView===\'function\')showView(\'pulse\');window._closeDailyBrief&&window._closeDailyBrief();" style="' + streakRowStyle + '">' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="' + streakLabelStyle + '">Streak</div>' +
        '<div style="' + streakSubStyle + '">' + streakCopy + '</div>' +
      '</div>' +
      '<div style="' + streakCountStyle + '">' + streakDays + '</div>' +
    '</a>';
  }

  // v34.49: Today's wins — positive counterweight at the bottom. Doesn't count
  // as `anySignal` for the empty-state check because closed items aren't pressing.
  if (winsToday > 0) {
    var winLabelStyle = 'font-family:Georgia,serif;font-size:14px;font-weight:500;color:' + (isLight ? '#3d6e3d' : '#86c986') + ';';
    var winSubStyle = 'font-size:12px;color:' + (isLight ? 'rgba(0,0,0,0.55)' : 'rgba(245,236,217,0.55)') + ';margin-top:2px;';
    var winCountStyle = 'font-family:Georgia,serif;font-size:24px;font-weight:400;color:' + (isLight ? '#3d6e3d' : '#86c986') + ';line-height:1;';
    var winRowStyle = 'display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:' + (isLight ? 'rgba(86,189,86,0.06)' : 'rgba(134,201,134,0.05)') + ';border:1px solid ' + (isLight ? 'rgba(61,110,61,0.2)' : 'rgba(134,201,134,0.18)') + ';border-radius:10px;cursor:pointer;text-decoration:none;color:inherit;margin-bottom:8px;';
    bodyHtml += '<a href="javascript:void(0)" onclick="if(typeof showView===\'function\')showView(\'pulse\');window._closeDailyBrief&&window._closeDailyBrief();" style="' + winRowStyle + '">' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="' + winLabelStyle + '">Today\'s Wins</div>' +
        '<div style="' + winSubStyle + '">Pulse items completed today</div>' +
      '</div>' +
      '<div style="' + winCountStyle + '">' + winsToday + '</div>' +
    '</a>';
  }

  if (!anySignal && winsToday === 0) {
    // v34.62: Empty-state copy is time-aware. Different framing for morning
    // (set the day), midday (still room to capture), evening (light landing).
    var hr = new Date().getHours();
    var emptyHeadline, emptyAction;
    if (hr < 11) {
      emptyHeadline = 'A clear morning. What\'s the one thing today?';
      emptyAction = 'Capture a goal';
    } else if (hr < 17) {
      emptyHeadline = 'Quiet so far. Anything you want to land before dinner?';
      emptyAction = 'Drop a quick goal';
    } else if (hr < 21) {
      emptyHeadline = 'Quiet evening. A note for tomorrow?';
      emptyAction = 'Capture a note';
    } else {
      emptyHeadline = 'Late and clear. Sleep on it, or capture something for tomorrow.';
      emptyAction = 'Capture a note';
    }
    var ctaJs = (hr < 17)
      ? "if(typeof window.openQuickAddGoal===\\'function\\')window.openQuickAddGoal();window._closeDailyBrief&&window._closeDailyBrief();"
      : "if(typeof window.openQuickAddNote===\\'function\\')window.openQuickAddNote();window._closeDailyBrief&&window._closeDailyBrief();";
    bodyHtml = '<div style="padding:20px 0 8px;text-align:center;">' +
      '<div style="font-family:Georgia,serif;font-style:italic;font-size:18px;line-height:1.45;color:' + (isLight ? '#3a2f17' : '#e2c79b') + ';margin-bottom:12px;">' + emptyHeadline + '</div>' +
      '<div style="font-size:13px;color:' + (isLight ? 'rgba(0,0,0,0.55)' : 'rgba(245,236,217,0.55)') + ';line-height:1.6;margin-bottom:20px;">No pressing items right now. Brilli will surface things as they show up.</div>' +
      '<button onclick="' + ctaJs.replace(/\\\\'/g, "'") + '" style="padding:11px 24px;background:linear-gradient(135deg,#e2c79b,#c9a961,#a88a4a);border:none;border-radius:99px;color:#0a0a0a;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;">' + emptyAction + '</button>' +
    '</div>';
  }

  modal.innerHTML =
    '<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">' +
      '<div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
        '<div style="position:absolute;inset:-6px;background:radial-gradient(circle,rgba(201,169,97,0.22) 0%,rgba(201,169,97,0) 70%);border-radius:50%;"></div>' +
        '<img src="/images/brilliance/monogram-circle.png" alt="" style="position:relative;width:48px;height:48px;border-radius:50%;object-fit:cover;" onerror="this.style.display=\'none\'" />' +
      '</div>' +
      '<div>' +
        '<div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:' + (isLight ? '#7a6741' : '#c9a961') + ';font-weight:500;">Daily Brief</div>' +
        '<div style="font-size:22px;font-weight:600;letter-spacing:-0.01em;color:' + (isLight ? '#1a1a1a' : '#f5ecd9') + ';">' + greeting + (firstName ? ', ' + firstName : '') + '.</div>' +
        // v34.37: Show today's date below the greeting so the panel anchors in time.
        '<div style="font-family:Georgia,serif;font-style:italic;font-size:13px;color:' + (isLight ? 'rgba(0,0,0,0.5)' : 'rgba(245,236,217,0.5)') + ';margin-top:2px;">' + (function(){ try { return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }); } catch(e){ return ''; } })() + '</div>' +
      '</div>' +
    '</div>' +
    '<div>' + bodyHtml + '</div>' +
    '<div style="margin-top:18px;display:flex;justify-content:space-between;align-items:center;gap:12px;">' +
      // v34.59: Cross-link to Yesterday's Recap so the forward-looking and
      // backward-looking views are one click apart.
      '<button id="dailyBriefYesterdayBtn" style="padding:9px 16px;background:transparent;border:1px solid ' + (isLight ? 'rgba(168,140,86,0.32)' : 'rgba(201,169,97,0.32)') + ';border-radius:99px;color:' + (isLight ? '#7a6741' : '#c9a961') + ';font-size:11px;font-weight:500;letter-spacing:0.06em;cursor:pointer;">← Yesterday\'s Recap</button>' +
      '<button id="dailyBriefCloseBtn" style="padding:11px 24px;background:linear-gradient(135deg,#e2c79b,#c9a961,#a88a4a);border:none;border-radius:99px;color:#0a0a0a;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;">Close</button>' +
    '</div>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  setTimeout(function(){ overlay.style.opacity = '1'; }, 16);

  function _close(){
    overlay.style.opacity = '0';
    setTimeout(function(){ if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 250);
    document.removeEventListener('keydown', escH);
  }
  function escH(e){ if (e.key === 'Escape') _close(); }
  document.addEventListener('keydown', escH);
  window._closeDailyBrief = _close;

  modal.querySelector('#dailyBriefCloseBtn').onclick = _close;
  // v34.59: Cross-link to Yesterday's Recap.
  var yLink = modal.querySelector('#dailyBriefYesterdayBtn');
  if (yLink) yLink.onclick = function(){
    _close();
    setTimeout(function(){ if (typeof window.openYesterdayRecap === 'function') window.openYesterdayRecap(); }, 300);
  };
};

// v34.47: Brand cycle shortcuts. ⌘ ⇧ [ goes to previous brand, ⌘ ⇧ ] to next.
// Skips when typing or in life mode (where there's only one current profile to
// pick from in the same UX flow). Uses `selectBrandFromDropdown(idx)` so all
// the existing brand-change side effects (sidebar update, accent color, mode
// flip, view rerenders) fire normally.
(function _wireBrandCycleShortcut(){
  function _isInputTarget(el){
    if (!el) return false;
    if (el.isContentEditable) return true;
    var t = (el.tagName || '').toLowerCase();
    return t === 'input' || t === 'textarea' || t === 'select';
  }
  document.addEventListener('keydown', function(ev){
    if (_isInputTarget(ev.target)) return;
    if (!(ev.metaKey || ev.ctrlKey) || !ev.shiftKey) return;
    var key = ev.key;
    var isPrev = (key === '[' || key === '{');
    var isNext = (key === ']' || key === '}');
    if (!isPrev && !isNext) return;
    if (typeof brands === 'undefined' || !brands || !brands.length) return;
    if (typeof selectedBrand === 'undefined') return;
    // Don't fire in life mode — brand cycling is a brand-mode concept.
    try {
      if (typeof currentMode !== 'undefined' && currentMode === 'life') return;
      if (document.documentElement.classList.contains('life-mode')) return;
    } catch(e){}
    ev.preventDefault();
    var n = brands.length;
    var cur = (typeof selectedBrand === 'number') ? selectedBrand : parseInt(selectedBrand) || 0;
    var nextIdx = isNext ? (cur + 1) % n : (cur - 1 + n) % n;
    if (typeof selectBrandFromDropdown === 'function') {
      selectBrandFromDropdown(nextIdx);
    } else {
      try { selectedBrand = nextIdx; localStorage.setItem('roweos_selectedBrand', String(nextIdx)); } catch(eS){}
    }
    try {
      var nm = (brands[nextIdx] && (brands[nextIdx].shortName || brands[nextIdx].name)) || ('Brand ' + (nextIdx + 1));
      if (typeof showToast === 'function') showToast('Switched to ' + nm, 'info');
    } catch(eT){}
    // v34.53: Visual confirmation — pulse-flash every Brilli instance so the
    // brand cycle feels tactile, not just a toast popping up off-screen.
    try {
      if (typeof Brilli !== 'undefined' && typeof Brilli._debugInstances === 'function') {
        var inst = Brilli._debugInstances();
        for (var ii = 0; ii < inst.length; ii++) {
          var b = inst[ii];
          if (!b) continue;
          b.ambientBurst = 1;
          b.pulseFlash = Math.max(b.pulseFlash || 0, 0.85);
        }
      }
    } catch(eP){}
  });
})();

// v34.46: Inline slash-command autocomplete. When the chat input starts with
// just `/` (or `/<partial>`), show a small chip strip above the input with the
// available slash commands. Click a chip to insert the full command + a space.
// Matches the Slack/Linear pattern. Tracks both the landing input and the
// followup input.
(function _wireSlashAutocomplete(){
  var COMMANDS = [
    { cmd: '/goal',    desc: 'Save to Pulse' },
    { cmd: '/note',    desc: 'Quick note' },
    { cmd: '/remind',  desc: 'Quick reminder' },
    { cmd: '/brief',   desc: 'Daily Brief' },
    { cmd: '/yesterday', desc: 'Yesterday\'s Recap' },
    { cmd: '/brilli',  desc: 'Switch Brilli form' },
    { cmd: '/random',  desc: 'Random Brilli form' },
    { cmd: '/theme',   desc: 'Toggle light/dark' },
    { cmd: '/focus',   desc: 'Toggle Focus Mode' },
    { cmd: '/sync',    desc: 'Sync now' },
    { cmd: '/pulse',   desc: 'Open Pulse' },
    { cmd: '/notebooks', desc: 'Open Notebooks' },
    { cmd: '/library', desc: 'Open Library' },
    { cmd: '/automations', desc: 'Open Automations' },
    { cmd: '/mail',    desc: 'Open Mail' },
    { cmd: '/bloom',   desc: 'Open Bloom' },
    { cmd: '/studio',  desc: 'Open Studio' },
    { cmd: '/help',    desc: 'Shortcuts' }
  ];
  function _ensureChipBar(input, anchorContainer) {
    var id = 'brillianceSlashChips_' + (input.id || 'x');
    var existing = document.getElementById(id);
    if (existing) return existing;
    var bar = document.createElement('div');
    bar.id = id;
    bar.style.cssText = 'display:none;flex-wrap:wrap;gap:4px;padding:6px 12px 4px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
    // Insert just before the textarea inside the chat input wrapper.
    if (anchorContainer && anchorContainer.parentNode) {
      anchorContainer.parentNode.insertBefore(bar, anchorContainer);
    }
    return bar;
  }
  function _renderChips(bar, partial, input) {
    var matches = COMMANDS.filter(function(c){ return c.cmd.indexOf(partial.toLowerCase()) === 0; });
    if (!matches.length) { bar.style.display = 'none'; bar.innerHTML = ''; return; }
    var html = '';
    for (var i = 0; i < matches.length; i++) {
      var m = matches[i];
      html += '<button type="button" data-slash-cmd="' + m.cmd + '" style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:rgba(201,169,97,0.10);border:1px solid rgba(201,169,97,0.28);border-radius:99px;color:#e2c79b;font-size:11px;cursor:pointer;font-family:\'SF Mono\',Monaco,monospace;letter-spacing:0.02em;">' +
        m.cmd +
        '<span style="color:rgba(245,236,217,0.5);font-family:inherit;">' + m.desc + '</span>' +
      '</button>';
    }
    bar.innerHTML = html;
    bar.style.display = 'flex';
    var btns = bar.querySelectorAll('[data-slash-cmd]');
    for (var bi = 0; bi < btns.length; bi++) {
      btns[bi].onmousedown = function(ev){ ev.preventDefault(); }; // Don't blur input.
      btns[bi].onclick = function(){
        var cmd = this.getAttribute('data-slash-cmd');
        input.value = cmd + ' ';
        input.focus();
        bar.style.display = 'none';
      };
    }
  }
  function _wire(inputId) {
    var input = document.getElementById(inputId);
    if (!input || input._slashWired) return;
    input._slashWired = true;
    var bar = _ensureChipBar(input, input);
    if (!bar) return;
    function _refresh() {
      var v = (input.value || '');
      // Only show when input STARTS with `/` and contains no space yet.
      if (v.charAt(0) === '/' && v.indexOf(' ') === -1) {
        _renderChips(bar, v, input);
      } else {
        bar.style.display = 'none';
      }
    }
    input.addEventListener('input', _refresh);
    input.addEventListener('blur', function(){ setTimeout(function(){ bar.style.display = 'none'; }, 200); });
    input.addEventListener('focus', _refresh);
    // v34.52: Tab key completes the first matching slash command. Familiar
    // terminal-style autocomplete. Esc hides the chip strip without clearing
    // input, so users can keep typing free-form text after hitting `/` by
    // mistake. Only fires when the chip strip is visible.
    input.addEventListener('keydown', function(ev){
      if (bar.style.display !== 'flex') return;
      if (ev.key === 'Tab') {
        var firstChip = bar.querySelector('[data-slash-cmd]');
        if (!firstChip) return;
        ev.preventDefault();
        var cmd = firstChip.getAttribute('data-slash-cmd');
        input.value = cmd + ' ';
        bar.style.display = 'none';
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        bar.style.display = 'none';
      }
    });
  }
  function _boot() {
    _wire('agentCommand');
    _wire('followupCommand');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _boot);
  else _boot();
  // Re-wire if inputs are remounted later.
  setInterval(_boot, 1500);
})();

// v34.56: True user-idle detection. After 5 minutes with no mouse / keyboard /
// touch activity, every Brilli instance enters `asleep` mode (slower, dimmer
// breathing). Any interaction wakes them. v33.10 already had `asleep` keyed off
// `document.hidden` for the tab-switch case — this layers user-idle on top so
// Brilli rests visually when you do.
(function _wireBrilliIdleSleep(){
  if (typeof document === 'undefined') return;
  var IDLE_MS = 5 * 60 * 1000; // 5 minutes
  var idleTimer = null;
  var asleep = false;
  function _wake(){
    if (!asleep) return;
    asleep = false;
    try {
      if (typeof Brilli === 'undefined' || typeof Brilli._debugInstances !== 'function') return;
      var inst = Brilli._debugInstances();
      for (var i = 0; i < inst.length; i++) {
        var b = inst[i];
        if (!b) continue;
        // Restore mode if we previously stamped asleep.
        if (b.mode === 'asleep' && b._userIdleSavedMode) {
          b.mode = b._userIdleSavedMode;
        }
        b._userIdleSavedMode = null;
      }
    } catch(e){}
  }
  function _sleep(){
    if (asleep) return;
    asleep = true;
    try {
      if (typeof Brilli === 'undefined' || typeof Brilli._debugInstances !== 'function') return;
      var inst = Brilli._debugInstances();
      for (var i = 0; i < inst.length; i++) {
        var b = inst[i];
        if (!b) continue;
        if (b.mode !== 'asleep') {
          b._userIdleSavedMode = b.mode;
          b.mode = 'asleep';
        }
      }
    } catch(e){}
  }
  function _reset(){
    _wake();
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(_sleep, IDLE_MS);
  }
  // Listen for any user activity. Passive listeners so we never block scroll.
  var EVTS = ['mousemove', 'keydown', 'pointerdown', 'touchstart', 'wheel', 'scroll'];
  for (var ei = 0; ei < EVTS.length; ei++) {
    document.addEventListener(EVTS[ei], _reset, { passive: true, capture: true });
  }
  _reset();
})();

// v34.61: ⌘K alias `clear draft` and a small visual hint when a draft was
// restored. After v34.51, restored drafts could surprise users on next load
// — they'd see old text and not realize it came from yesterday. New tiny
// "Restored draft, ⌘ ⇧ X to clear" pill that floats just above the input for
// 5 seconds when a draft is restored. Plus a ⌘ ⇧ X shortcut + ⌘K command to
// wipe the draft on demand.
window.clearChatDraft = function clearChatDraft(){
  try { localStorage.removeItem('roweos_chat_draft'); } catch(e){}
  ['agentCommand', 'followupCommand'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) {
      el.value = '';
      if (typeof autoResizeTextarea === 'function') autoResizeTextarea(el);
    }
  });
  if (typeof showToast === 'function') showToast('Draft cleared', 'info');
};
(function _wireDraftClearShortcut(){
  function _isInputTarget(el){
    if (!el) return false;
    if (el.isContentEditable) return true;
    var t = (el.tagName || '').toLowerCase();
    return t === 'input' || t === 'textarea' || t === 'select';
  }
  document.addEventListener('keydown', function(ev){
    var modOK = (ev.metaKey && ev.shiftKey) || (ev.ctrlKey && ev.shiftKey);
    if (!modOK) return;
    var key = (ev.key || '').toLowerCase();
    if (key !== 'x') return;
    // Allow even when typing in the chat input (this is its dedicated keystroke).
    var t = (ev.target && (ev.target.tagName || '').toLowerCase()) || '';
    var isChatInput = (ev.target && (ev.target.id === 'agentCommand' || ev.target.id === 'followupCommand'));
    if (_isInputTarget(ev.target) && !isChatInput) return;
    ev.preventDefault();
    if (typeof window.clearChatDraft === 'function') window.clearChatDraft();
  });
})();

// v34.51: Auto-save chat input drafts. If you type a message but refresh,
// switch tabs, or close the PWA before sending, the draft restores on next
// load. Persisted in `roweos_chat_draft` (single key, since only one chat
// input is editable at a time). Cleared after send (we hook into the textarea
// going empty as the signal). Only saves drafts > 8 chars to avoid stamping
// `/g` half-typed slash commands.
(function _wireChatDraftSaver(){
  var DRAFT_KEY = 'roweos_chat_draft';
  function _wire(inputId){
    var el = document.getElementById(inputId);
    if (!el || el._draftWired) return;
    el._draftWired = true;
    // Restore on first wire only (don't clobber what's already in landing input).
    if (!el.value) {
      try {
        var saved = localStorage.getItem(DRAFT_KEY);
        if (saved && saved.length > 0) {
          el.value = saved;
          // Trigger autoresize.
          if (typeof autoResizeTextarea === 'function') autoResizeTextarea(el);
        }
      } catch(e){}
    }
    var saveTimer = null;
    el.addEventListener('input', function(){
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(function(){
        try {
          var v = el.value || '';
          if (v.length > 8) localStorage.setItem(DRAFT_KEY, v);
          else if (!v) localStorage.removeItem(DRAFT_KEY);
        } catch(e){}
      }, 400);
    });
  }
  function _boot(){
    _wire('agentCommand');
    _wire('followupCommand');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _boot);
  else _boot();
  setInterval(_boot, 1500);
})();

// v34.58: `window.openYesterdayRecap()` — a focused recap of what was
// completed YESTERDAY across Pulse goals + reminders + outbox sends. Useful
// for Monday-morning catch-up. Same modal aesthetic as Daily Brief, distinct
// purpose: backwards-looking accomplishment vs forward-looking pressure.
window.openYesterdayRecap = function openYesterdayRecap() {
  var existing = document.getElementById('brillianceYesterdayOverlay');
  if (existing) existing.parentNode.removeChild(existing);
  var isLight = (function(){ try { return document.documentElement.classList.contains('light-mode'); } catch(e){ return false; } })();

  // Compute yesterday's date string + relative label.
  var y = new Date(); y.setDate(y.getDate() - 1);
  var yStr = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
  var dayLabel = (function(){
    try {
      var t = new Date(); t.setDate(t.getDate() - 1);
      var d = new Date();
      // Friday-on-Monday is "Friday", weekend-on-Monday is also calendar.
      // Use the long weekday + month + day for clarity.
      return t.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    } catch(e){ return 'Yesterday'; }
  })();

  // Pulse items completed yesterday.
  var goalsCompleted = 0;
  try {
    var pgY = JSON.parse(localStorage.getItem('roweos_pulse_goals') || '[]');
    if (Array.isArray(pgY)) {
      for (var gyi = 0; gyi < pgY.length; gyi++) {
        var gy = pgY[gyi];
        if (!gy || !gy.items) continue;
        for (var iyi = 0; iyi < gy.items.length; iyi++) {
          var iy = gy.items[iyi];
          if (iy && iy.completed && iy.completedAt && String(iy.completedAt).slice(0, 10) === yStr) {
            goalsCompleted++;
          }
        }
      }
    }
  } catch(e){}

  // Reminders fired yesterday (status moved to completed/dismissed and modifiedAt yesterday).
  var remindersClosed = 0;
  try {
    var ry = JSON.parse(localStorage.getItem('roweos_reminders') || '[]');
    if (Array.isArray(ry)) {
      for (var ryi = 0; ryi < ry.length; ryi++) {
        var rr = ry[ryi];
        if (!rr) continue;
        if (rr.status !== 'completed' && rr.status !== 'dismissed') continue;
        var rTs = rr.completedAt || rr._modifiedAt;
        if (!rTs) continue;
        var rDay = (typeof rTs === 'number') ? new Date(rTs).toISOString().slice(0, 10) : String(rTs).slice(0, 10);
        if (rDay === yStr) remindersClosed++;
      }
    }
  } catch(e){}

  // Outbox sends yesterday.
  var sendsYesterday = 0;
  try {
    var st = JSON.parse(localStorage.getItem('roweos_mail_sent') || '[]');
    if (Array.isArray(st)) {
      for (var sti = 0; sti < st.length; sti++) {
        var sm = st[sti];
        if (!sm) continue;
        var sTs = sm.sentAt || sm._modifiedAt;
        if (!sTs) continue;
        var sDay = (typeof sTs === 'number') ? new Date(sTs).toISOString().slice(0, 10) : String(sTs).slice(0, 10);
        if (sDay === yStr) sendsYesterday++;
      }
    }
  } catch(e){}

  // Notebook entries updated yesterday.
  var notesYesterday = 0;
  try {
    var nbY = JSON.parse(localStorage.getItem('roweos_scribe_notebooks') || '[]');
    if (Array.isArray(nbY)) {
      for (var nyi = 0; nyi < nbY.length; nyi++) {
        var nyn = nbY[nyi];
        if (!nyn) continue;
        var nTs = nyn._modifiedAt || (nyn.updatedAt ? Date.parse(nyn.updatedAt) : 0);
        if (!nTs) continue;
        var nDay = new Date(nTs).toISOString().slice(0, 10);
        if (nDay === yStr) notesYesterday++;
      }
    }
  } catch(e){}

  var anyActivity = goalsCompleted + remindersClosed + sendsYesterday + notesYesterday;

  var overlay = document.createElement('div');
  overlay.id = 'brillianceYesterdayOverlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', "Yesterday's Recap");
  overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:99100;opacity:0;transition:opacity 0.3s;';
  overlay.onclick = function(e){ if (e.target === overlay) _close(); };
  var modal = document.createElement('div');
  modal.style.cssText = 'max-width:560px;width:92%;max-height:88vh;overflow:auto;background:' + (isLight ? '#ffffff' : '#0f0f0f') + ';border:1px solid ' + (isLight ? 'rgba(168,140,86,0.3)' : 'rgba(201,181,122,0.22)') + ';border-radius:14px;padding:32px;color:' + (isLight ? '#1a1a1a' : '#f5ecd9') + ';font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 24px 80px ' + (isLight ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.6)') + ';';

  var rowStyle = 'display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:' + (isLight ? 'rgba(86,189,86,0.06)' : 'rgba(134,201,134,0.05)') + ';border:1px solid ' + (isLight ? 'rgba(61,110,61,0.2)' : 'rgba(134,201,134,0.18)') + ';border-radius:10px;margin-bottom:8px;';
  var labelStyle = 'font-family:Georgia,serif;font-size:14px;font-weight:500;color:' + (isLight ? '#3d6e3d' : '#86c986') + ';';
  var subStyle = 'font-size:12px;color:' + (isLight ? 'rgba(0,0,0,0.55)' : 'rgba(245,236,217,0.55)') + ';margin-top:2px;';
  var countStyle = 'font-family:Georgia,serif;font-size:24px;font-weight:400;color:' + (isLight ? '#3d6e3d' : '#86c986') + ';line-height:1;';

  function row(label, sub, count){
    return '<div style="' + rowStyle + '">' +
      '<div style="flex:1;min-width:0;"><div style="' + labelStyle + '">' + label + '</div><div style="' + subStyle + '">' + sub + '</div></div>' +
      '<div style="' + countStyle + '">' + count + '</div>' +
    '</div>';
  }

  var bodyHtml = '';
  if (goalsCompleted > 0) bodyHtml += row('Pulse · Completed', 'Items closed yesterday', goalsCompleted);
  if (remindersClosed > 0) bodyHtml += row('Reminders · Cleared', 'Marked done or dismissed', remindersClosed);
  if (sendsYesterday > 0) bodyHtml += row('Mail · Sent', 'Messages delivered yesterday', sendsYesterday);
  if (notesYesterday > 0) bodyHtml += row('Notebooks · Touched', 'Entries updated yesterday', notesYesterday);
  if (anyActivity === 0) {
    bodyHtml = '<div style="padding:24px 0;text-align:center;color:' + (isLight ? 'rgba(0,0,0,0.5)' : 'rgba(245,236,217,0.5)') + ';font-size:14px;line-height:1.6;">No tracked activity yesterday.<br>Today\'s a new day. <strong style="color:' + (isLight ? '#5a4d2e' : '#e2c79b') + ';">⌘ ⇧ G</strong> to set a goal.</div>';
  }

  modal.innerHTML =
    '<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">' +
      '<div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
        '<div style="position:absolute;inset:-6px;background:radial-gradient(circle,rgba(201,169,97,0.22) 0%,rgba(201,169,97,0) 70%);border-radius:50%;"></div>' +
        '<img src="/images/brilliance/monogram-circle.png" alt="" style="position:relative;width:48px;height:48px;border-radius:50%;object-fit:cover;" onerror="this.style.display=\'none\'" />' +
      '</div>' +
      '<div>' +
        '<div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:' + (isLight ? '#7a6741' : '#c9a961') + ';font-weight:500;">Yesterday\'s Recap</div>' +
        '<div style="font-size:22px;font-weight:600;letter-spacing:-0.01em;color:' + (isLight ? '#1a1a1a' : '#f5ecd9') + ';">' + dayLabel + '</div>' +
      '</div>' +
    '</div>' +
    '<div>' + bodyHtml + '</div>' +
    '<div style="margin-top:18px;display:flex;justify-content:space-between;align-items:center;gap:12px;">' +
      // v34.60: Mirror of v34.59 cross-link — Yesterday → Today.
      '<button id="yesterdayBriefBtn" style="padding:9px 16px;background:transparent;border:1px solid ' + (isLight ? 'rgba(168,140,86,0.32)' : 'rgba(201,169,97,0.32)') + ';border-radius:99px;color:' + (isLight ? '#7a6741' : '#c9a961') + ';font-size:11px;font-weight:500;letter-spacing:0.06em;cursor:pointer;">Today\'s Brief →</button>' +
      '<button id="yesterdayCloseBtn" style="padding:11px 24px;background:linear-gradient(135deg,#e2c79b,#c9a961,#a88a4a);border:none;border-radius:99px;color:#0a0a0a;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;">Close</button>' +
    '</div>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  setTimeout(function(){ overlay.style.opacity = '1'; }, 16);
  function _close(){
    overlay.style.opacity = '0';
    setTimeout(function(){ if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 250);
    document.removeEventListener('keydown', escH);
  }
  function escH(e){ if (e.key === 'Escape') _close(); }
  document.addEventListener('keydown', escH);
  modal.querySelector('#yesterdayCloseBtn').onclick = _close;
  // v34.60: Cross-link to Daily Brief.
  var todayLink = modal.querySelector('#yesterdayBriefBtn');
  if (todayLink) todayLink.onclick = function(){
    _close();
    setTimeout(function(){ if (typeof window.openDailyBrief === 'function') window.openDailyBrief(); }, 300);
  };
};

// v34.50: Auto-show Daily Brief once per day when the user opts in.
// Pref: `roweos_daily_brief_auto = "true"`. Last-shown date is tracked via
// `roweos_daily_brief_last_shown` (YYYY-MM-DD). Fires ~2.5s after load so
// welcome / restore / auth modals settle first, and skips if any is up.
(function _wireDailyBriefAutoShow(){
  function _maybeShow(){
    try {
      if (localStorage.getItem('roweos_daily_brief_auto') !== 'true') return;
      // Don't compete with first-launch surfaces.
      if (document.getElementById('dataRestorePrompt') && document.getElementById('dataRestorePrompt').style.display === 'flex') return;
      if (document.getElementById('authGate') && document.getElementById('authGate').style.display !== 'none') return;
      if (document.getElementById('postLoginWelcome') && document.getElementById('postLoginWelcome').classList.contains('active')) return;
      if (document.getElementById('brillianceWelcomeModal') && document.getElementById('brillianceWelcomeModal').style.display === 'flex') return;
      if (document.getElementById('brillianceWhatsNewOverlay')) return;
      if (document.getElementById('brillianceDailyBriefOverlay')) return;
      var todayStr = (function(){ var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
      var last = localStorage.getItem('roweos_daily_brief_last_shown') || '';
      if (last === todayStr) return;
      localStorage.setItem('roweos_daily_brief_last_shown', todayStr);
      if (typeof window.openDailyBrief === 'function') window.openDailyBrief();
    } catch(e){}
  }
  function _boot(){ setTimeout(_maybeShow, 2500); }
  if (document.readyState === 'complete') _boot();
  else window.addEventListener('load', _boot);
})();

// v34.44: Hash-based deep links into quick actions. Lets users bookmark, share,
// or automation-link to any of the v34.x capture/help surfaces. Recognized:
//   #brief / #today        → Daily Brief
//   #help / #shortcuts / #? → Keyboard Shortcuts overlay
//   #goal                  → Quick-add Pulse goal modal
//   #reminder              → Quick-add reminder modal
//   #note                  → Quick-add note modal
//   #search / #k           → Open Spotlight
// After firing, the hash is cleared so a refresh doesn't re-trigger.
(function _wireBrillianceHashLinks(){
  function _runHash(){
    var h = (location.hash || '').replace(/^#/, '').toLowerCase().trim();
    if (!h) return;
    var fired = false;
    if (h === 'brief' || h === 'today') {
      if (typeof window.openDailyBrief === 'function') { window.openDailyBrief(); fired = true; }
    } else if (h === 'help' || h === 'shortcuts' || h === '?') {
      if (typeof window.showShortcutsOverlay === 'function') { window.showShortcutsOverlay(); fired = true; }
    } else if (h === 'goal') {
      if (typeof window.openQuickAddGoal === 'function') { window.openQuickAddGoal(); fired = true; }
    } else if (h === 'reminder') {
      if (typeof window.openQuickAddReminder === 'function') { window.openQuickAddReminder(); fired = true; }
    } else if (h === 'note') {
      if (typeof window.openQuickAddNote === 'function') { window.openQuickAddNote(); fired = true; }
    } else if (h === 'search' || h === 'k') {
      if (typeof openSpotlight === 'function') { openSpotlight(); fired = true; }
    }
    if (fired) {
      // Clear hash without scrolling.
      try { history.replaceState(null, '', location.pathname + location.search); } catch(e){}
    }
  }
  // Run after boot so the target functions are defined.
  if (document.readyState === 'complete') setTimeout(_runHash, 600);
  else window.addEventListener('load', function(){ setTimeout(_runHash, 600); });
  // Re-fire if the hash changes during the session.
  window.addEventListener('hashchange', _runHash);
})();

// v34.43: Mobile Quick Capture FAB. Mobile users can't easily reach ⌘⇧G/R/N/T,
// so we surface a floating "+" button bottom-right (above the liquid nav) that
// expands into a 4-action sheet: Goal, Reminder, Note, Brief. Hidden on
// desktop (>= 769px), inside Focus Mode, and when any modal is open.
(function _wireMobileQuickFab(){
  if (typeof document === 'undefined') return;
  function _shouldShow(){
    if (window.innerWidth >= 769) return false;
    if (document.body.classList.contains('focus-mode')) return false;
    // Don't compete with active modals.
    if (document.getElementById('brillianceQuickAddOverlay')) return false;
    if (document.getElementById('brillianceQuickReminderOverlay')) return false;
    if (document.getElementById('brillianceQuickNoteOverlay')) return false;
    if (document.getElementById('brillianceDailyBriefOverlay')) return false;
    if (document.getElementById('brillianceShortcutsOverlay')) return false;
    if (document.getElementById('dataRestorePrompt') && document.getElementById('dataRestorePrompt').style.display === 'flex') return false;
    return true;
  }
  function _ensureFab(){
    if (document.getElementById('brillianceMobileFab')) return;
    // v34.63: light-mode branch — sheet was hardcoded dark and looked wrong
    // floating against the cream UI in light mode. Now flips bg / border /
    // text / kbd-hint colors based on the theme at construction time.
    var lt = (function(){ try { return document.documentElement.classList.contains('light-mode'); } catch(e){ return false; } })();
    var sheetBg = lt ? 'rgba(255,255,255,0.96)' : 'rgba(15,15,15,0.96)';
    var sheetBorder = lt ? 'rgba(168,140,86,0.3)' : 'rgba(201,169,97,0.28)';
    var sheetShadow = lt ? '0 12px 32px rgba(0,0,0,0.12)' : '0 12px 32px rgba(0,0,0,0.5)';
    var rowColor = lt ? '#1a1a1a' : '#f5ecd9';
    var kbdColor = lt ? 'rgba(0,0,0,0.4)' : 'rgba(245,236,217,0.4)';
    var fab = document.createElement('div');
    fab.id = 'brillianceMobileFab';
    // v34.108: bottom is now dynamic via _refreshFabBottom() below so it lifts
    // above the chat input as the textarea grows. The default 70px offset
    // matches the liquid nav height; _refreshFabBottom adds the live input
    // height when the chat composer is visible.
    fab.style.cssText = 'position:fixed;bottom:calc(70px + env(safe-area-inset-bottom, 0px));right:18px;z-index:9000;display:none;flex-direction:column;align-items:flex-end;gap:8px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;transition:bottom 0.18s ease;';
    // v34.108: dropped ⌘ shortcut hints on mobile (no keyboard - the symbols
    // didn't actually do anything for touch users). Added a "New Chat" row.
    fab.innerHTML =
      '<div id="brillianceFabSheet" style="display:none;flex-direction:column;gap:6px;align-items:stretch;background:' + sheetBg + ';border:1px solid ' + sheetBorder + ';border-radius:12px;padding:6px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);min-width:200px;box-shadow:' + sheetShadow + ';">' +
        '<button data-fab-action="newchat" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:transparent;border:none;border-radius:8px;color:' + rowColor + ';font-size:13px;text-align:left;cursor:pointer;font-family:inherit;">' +
          '<span style="width:6px;height:6px;border-radius:50%;background:#f5e6c8;box-shadow:0 0 6px rgba(245,230,200,0.6);flex-shrink:0;"></span>' +
          '<span style="flex:1;">New Chat</span>' +
        '</button>' +
        '<button data-fab-action="brief" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:transparent;border:none;border-radius:8px;color:' + rowColor + ';font-size:13px;text-align:left;cursor:pointer;font-family:inherit;">' +
          '<span style="width:6px;height:6px;border-radius:50%;background:radial-gradient(circle,#f5e6c8,#c9a961);box-shadow:0 0 6px rgba(201,169,97,0.55);flex-shrink:0;"></span>' +
          '<span style="flex:1;">Daily Brief</span>' +
        '</button>' +
        '<button data-fab-action="goal" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:transparent;border:none;border-radius:8px;color:' + rowColor + ';font-size:13px;text-align:left;cursor:pointer;font-family:inherit;">' +
          '<span style="width:6px;height:6px;border-radius:50%;background:#c9a961;box-shadow:0 0 6px rgba(201,169,97,0.45);flex-shrink:0;"></span>' +
          '<span style="flex:1;">Quick Goal</span>' +
        '</button>' +
        '<button data-fab-action="reminder" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:transparent;border:none;border-radius:8px;color:' + rowColor + ';font-size:13px;text-align:left;cursor:pointer;font-family:inherit;">' +
          '<span style="width:6px;height:6px;border-radius:50%;background:#e2c79b;box-shadow:0 0 6px rgba(201,169,97,0.45);flex-shrink:0;"></span>' +
          '<span style="flex:1;">Reminder</span>' +
        '</button>' +
        '<button data-fab-action="note" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:transparent;border:none;border-radius:8px;color:' + rowColor + ';font-size:13px;text-align:left;cursor:pointer;font-family:inherit;">' +
          '<span style="width:6px;height:6px;border-radius:50%;background:#a89878;box-shadow:0 0 6px rgba(201,169,97,0.4);flex-shrink:0;"></span>' +
          '<span style="flex:1;">Note</span>' +
        '</button>' +
      '</div>' +
      '<button id="brillianceFabBtn" aria-label="Quick capture" style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#e2c79b,#c9a961,#a88a4a);border:none;color:#0a0a0a;font-size:24px;font-weight:300;cursor:pointer;box-shadow:0 8px 24px rgba(201,169,97,0.35);transition:transform 0.2s ease;display:flex;align-items:center;justify-content:center;line-height:1;">' +
        '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#0a0a0a" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>' +
      '</button>';
    document.body.appendChild(fab);
    var btn = document.getElementById('brillianceFabBtn');
    var sheet = document.getElementById('brillianceFabSheet');
    btn.onclick = function(){
      var open = sheet.style.display === 'flex';
      sheet.style.display = open ? 'none' : 'flex';
      btn.style.transform = open ? '' : 'rotate(45deg)';
    };
    fab.onclick = function(ev){
      var t = ev.target.closest('[data-fab-action]');
      if (!t) return;
      var action = t.getAttribute('data-fab-action');
      sheet.style.display = 'none';
      btn.style.transform = '';
      if (action === 'newchat') {
        // Match the desktop New Chat behavior: clear the conversation and route
        // to the agent view. Best-effort - falls through to showView('agent')
        // if the dedicated helper isn't loaded.
        try {
          if (typeof window.startNewConversation === 'function') window.startNewConversation();
          else if (typeof window.newConversation === 'function') window.newConversation();
          else if (typeof window.clearChatDraft === 'function') window.clearChatDraft();
        } catch(_eNC) {}
        try { if (typeof showView === 'function') showView('agent'); } catch(_eSV) {}
      }
      else if (action === 'brief' && typeof window.openDailyBrief === 'function') window.openDailyBrief();
      else if (action === 'goal' && typeof window.openQuickAddGoal === 'function') window.openQuickAddGoal();
      else if (action === 'reminder' && typeof window.openQuickAddReminder === 'function') window.openQuickAddReminder();
      else if (action === 'note' && typeof window.openQuickAddNote === 'function') window.openQuickAddNote();
    };
    // Close sheet on outside tap.
    document.addEventListener('click', function(ev){
      if (sheet.style.display !== 'flex') return;
      if (fab.contains(ev.target)) return;
      sheet.style.display = 'none';
      btn.style.transform = '';
    });
  }
  // v34.108: lift the FAB above the chat composer as it grows. Without this,
  // typing a long message bumps the textarea up over the FAB's send button.
  function _refreshFabBottom(){
    var fab = document.getElementById('brillianceMobileFab');
    if (!fab) return;
    var navOffset = 70; // liquid nav baseline
    // Look for whichever chat composer is visible (followup if a thread is
    // active, otherwise the landing input). measureing the *outer* container
    // gives the full footprint including padding + toolbar buttons.
    var composer = null;
    var followup = document.getElementById('followupCommand');
    var landing = document.getElementById('agentCommand');
    if (followup && followup.offsetParent) {
      composer = followup.closest('.chat-input-container, .input-container, .agent-input-wrap, .followup-bar') || followup.parentElement;
    } else if (landing && landing.offsetParent) {
      composer = landing.closest('.chat-input-container, .input-container, .agent-input-wrap, .landing-input-wrap') || landing.parentElement;
    }
    var composerH = 0;
    if (composer && composer.getBoundingClientRect) {
      composerH = Math.round(composer.getBoundingClientRect().height || 0);
    }
    // Cap the lift so the FAB never floats off-screen on tiny viewports.
    var lift = Math.min(composerH, Math.max(0, window.innerHeight - 200));
    fab.style.bottom = 'calc(' + (navOffset + lift + 12) + 'px + env(safe-area-inset-bottom, 0px))';
  }
  function _refresh(){
    var fab = document.getElementById('brillianceMobileFab');
    if (!fab) return;
    fab.style.display = _shouldShow() ? 'flex' : 'none';
    _refreshFabBottom();
  }
  function _boot(){
    _ensureFab();
    _refresh();
  }
  // v34.63: Theme toggle hook — destroy the FAB and rebuild so its inline
  // colors flip to the current theme. Without this the sheet stays dark in
  // light mode (and vice versa) until a reload.
  window._rebuildMobileFab = function _rebuildMobileFab(){
    var existing = document.getElementById('brillianceMobileFab');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    _ensureFab();
    _refresh();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _boot);
  else _boot();
  window.addEventListener('resize', _refresh);
  // v34.108: re-measure on chat-input growth so the FAB tracks the textarea.
  // Hooks both inputs because either can be the live composer depending on
  // whether a chat thread is active. Idempotent flag prevents stacking.
  function _wireInputResize(){
    ['agentCommand', 'followupCommand'].forEach(function(id){
      var el = document.getElementById(id);
      if (!el || el._fabResizeWired) return;
      el._fabResizeWired = true;
      el.addEventListener('input', _refreshFabBottom);
      el.addEventListener('focus', _refreshFabBottom);
      el.addEventListener('blur', _refreshFabBottom);
    });
  }
  setInterval(_wireInputResize, 1500);
  // Re-check when modals open/close (poll cheaply since we don't have hooks).
  setInterval(_refresh, 500);
})();

// v34.42: Dynamic tooltip on the sidebar version label. Shows the version,
// last cloud sync time (relative), and the "click to view changelog" hint.
window.updateSidebarVersionTooltip = function updateSidebarVersionTooltip(el) {
  if (!el) return;
  var v = (typeof ROWEOS_VERSION === 'string') ? ROWEOS_VERSION : 'v?';
  var syncTip = '';
  try {
    var lastSync = parseInt(localStorage.getItem('roweos_last_sync') || '0');
    if (lastSync > 0) {
      var diff = Date.now() - lastSync;
      var relRel;
      if (diff < 60000) relRel = 'a moment ago';
      else if (diff < 3600000) relRel = Math.round(diff / 60000) + ' min ago';
      else if (diff < 86400000) relRel = Math.round(diff / 3600000) + ' hr ago';
      else relRel = Math.round(diff / 86400000) + ' days ago';
      syncTip = '\nLast sync: ' + relRel;
    } else {
      syncTip = '\nNot yet synced';
    }
  } catch(e){}
  el.title = 'Brilliance ' + v + syncTip + '\nClick for changelog';
};

// v34.34: PWA install affordance. Captures `beforeinstallprompt`, defers it,
// and shows a small gold-accented banner in the bottom-right corner offering
// install. Hidden when already installed (`display-mode: standalone`), when
// user dismissed it (persisted to localStorage), or when not installable
// (Safari iOS doesn't fire the event — those users use Add to Home Screen).
(function _wirePWAInstallPrompt(){
  if (typeof window === 'undefined') return;
  // Already installed?
  try {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return;
    if (window.navigator && window.navigator.standalone === true) return; // iOS PWA
  } catch(e){}
  // User snoozed forever?
  var DISMISS_KEY = 'roweos_pwa_install_dismissed';
  try { if (localStorage.getItem(DISMISS_KEY) === 'true') return; } catch(e){}

  var deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    deferredPrompt = e;
    // Defer the banner render until DOM is ready and after the welcome modal closes.
    setTimeout(_renderInstallBanner, 1200);
  });

  function _renderInstallBanner(){
    if (!deferredPrompt) return;
    if (document.getElementById('brillianceInstallBanner')) return;
    // Don't compete with onboarding or auth flows.
    if (document.getElementById('authGate') && document.getElementById('authGate').style.display !== 'none') return;
    if (document.querySelector('.welcome-overlay.active')) return;

    var isLight = (function(){ try { return document.documentElement.classList.contains('light-mode'); } catch(e){ return false; } })();
    // v34.63: Position higher on mobile so the banner doesn't sit on top of
    // the v34.43 mobile Quick Capture FAB (bottom-right, ~70px above the
    // liquid nav). On desktop, keep the original 24px corner.
    var isMobile = window.innerWidth < 769;
    var bannerBottom = isMobile
      ? 'calc(140px + env(safe-area-inset-bottom, 0px))'
      : '24px';

    var banner = document.createElement('div');
    banner.id = 'brillianceInstallBanner';
    banner.style.cssText = 'position:fixed;bottom:' + bannerBottom + ';right:' + (isMobile ? '12px' : '24px') + ';z-index:9500;display:flex;align-items:center;gap:14px;padding:14px 18px;background:' + (isLight ? '#ffffff' : '#0f0f0f') + ';border:1px solid ' + (isLight ? 'rgba(168,140,86,0.3)' : 'rgba(201,169,97,0.28)') + ';border-radius:14px;box-shadow:0 16px 40px ' + (isLight ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.5)') + ';max-width:' + (isMobile ? 'calc(100vw - 24px)' : '340px') + ';font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;animation:brillianceInstallSlide 0.45s ease both;';
    banner.innerHTML =
      '<div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
        '<div style="position:absolute;inset:-6px;background:radial-gradient(circle,rgba(201,169,97,0.22) 0%,rgba(201,169,97,0) 70%);border-radius:50%;"></div>' +
        '<img src="/images/brilliance/monogram-circle.png" alt="" style="position:relative;width:40px;height:40px;border-radius:50%;object-fit:cover;" onerror="this.style.display=\'none\'" />' +
      '</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:' + (isLight ? '#7a6741' : '#c9a961') + ';font-weight:500;margin-bottom:2px;">Install Brilliance</div>' +
        '<div style="font-size:13px;color:' + (isLight ? '#1a1a1a' : '#f5ecd9') + ';line-height:1.4;">Run as an app, faster open, native notifications.</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;">' +
        '<button id="brillianceInstallAccept" style="padding:7px 14px;background:linear-gradient(135deg,#e2c79b,#c9a961,#a88a4a);border:none;border-radius:99px;color:#0a0a0a;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;">Install</button>' +
        '<button id="brillianceInstallDismiss" style="padding:5px 14px;background:transparent;border:none;color:' + (isLight ? 'rgba(0,0,0,0.45)' : 'rgba(245,236,217,0.45)') + ';font-size:11px;cursor:pointer;letter-spacing:0.06em;">Not now</button>' +
      '</div>';
    document.body.appendChild(banner);

    document.getElementById('brillianceInstallAccept').onclick = function(){
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function(choice){
        if (choice && choice.outcome === 'accepted') {
          try { localStorage.setItem(DISMISS_KEY, 'true'); } catch(e){}
        }
        deferredPrompt = null;
        _removeBanner();
      });
    };
    document.getElementById('brillianceInstallDismiss').onclick = function(){
      try { localStorage.setItem(DISMISS_KEY, 'true'); } catch(e){}
      _removeBanner();
    };
  }

  function _removeBanner(){
    var b = document.getElementById('brillianceInstallBanner');
    if (b) {
      b.style.opacity = '0';
      b.style.transform = 'translateY(8px)';
      b.style.transition = 'opacity 0.3s, transform 0.3s';
      setTimeout(function(){ if (b.parentNode) b.parentNode.removeChild(b); }, 300);
    }
  }

  // Inject the slide-in keyframe once.
  try {
    var style = document.createElement('style');
    style.textContent = '@keyframes brillianceInstallSlide { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }';
    document.head.appendChild(style);
  } catch(e){}

  // Hide when transitioning to installed (e.g. user installs via menu).
  window.addEventListener('appinstalled', function(){
    try { localStorage.setItem(DISMISS_KEY, 'true'); } catch(e){}
    _removeBanner();
  });
})();

// v34.18: Plain `?` key opens the Keyboard Shortcuts overlay when focus is not
// in an input/textarea/contentEditable. Familiar convention (GitHub, Linear,
// Notion). `Shift+/` registers as `?` natively, so we just match the resulting
// `?` key event.
(function _wireShortcutsKeyboard(){
  function _isInputTarget(el){
    if (!el) return false;
    if (el.isContentEditable) return true;
    var t = (el.tagName || '').toLowerCase();
    return t === 'input' || t === 'textarea' || t === 'select';
  }
  document.addEventListener('keydown', function(ev){
    if (_isInputTarget(ev.target)) return;
    // Skip if a modifier is held (we want plain `?`, not ⌘? / ⌃? combos).
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.key !== '?') return;
    // Don't fire if any modal/overlay is already open — e.g. the shortcuts
    // overlay itself, the picker, or the search panel — to avoid stacking.
    if (document.getElementById('brillianceShortcutsOverlay')) return;
    if (document.querySelector('.search-modal.open, #spotlightModal.open')) return;
    ev.preventDefault();
    if (typeof window.showShortcutsOverlay === 'function') window.showShortcutsOverlay();
  });
})();

// v34.17: Keyboard Shortcuts overlay — surfaced via ⌘K "help" / "shortcuts" /
// "?" or via direct call to window.showShortcutsOverlay(). Single panel that
// lists every Brilliance shortcut + ⌘K command alias in one place. Mirrors the
// What's New modal aesthetic so the two feel like a pair.
window.showShortcutsOverlay = function showShortcutsOverlay() {
  var existing = document.getElementById('brillianceShortcutsOverlay');
  if (existing) existing.parentNode.removeChild(existing);

  var isLight = (function(){ try { return document.documentElement.classList.contains('light-mode'); } catch(e){ return false; } })();

  var sections = [
    {
      title: 'Brilli',
      items: [
        { kbd: '⌘ ⌥ B', text: 'Cycle Brilli form (celestial → aura → firefly → signature → classic)' },
        { kbd: 'Settings → Appearance', text: 'Pick a specific form, change intensity, toggle per-form ambient' }
      ]
    },
    {
      title: 'Studio',
      items: [
        { kbd: '⌘ ⌥ P', text: 'Toggle Studio Split-Pane workspace (Studio view only)' }
      ]
    },
    {
      title: 'Brand switcher',
      items: [
        { kbd: '⌘ ⇧ [', text: 'Previous brand' },
        { kbd: '⌘ ⇧ ]', text: 'Next brand' }
      ]
    },
    {
      title: 'Focus / Universal',
      items: [
        { kbd: '⌘ ⇧ F', text: 'Toggle Focus Mode. Strips chrome, just Brilli + content' },
        { kbd: '⌘ ⇧ L', text: 'Toggle light / dark mode' },
        { kbd: '⌘ ⇧ T', text: 'Open the Daily Brief, today\'s at-a-glance summary' },
        { kbd: '⌘ K', text: 'Universal Search and command palette (see below)' },
        { kbd: '⌘ ⇧ G', text: 'Quick-add a goal or task to Pulse, Unassigned goal' },
        { kbd: '⌘ ⇧ R', text: 'Quick-add a reminder (default time +1 hour)' },
        { kbd: '⌘ ⇧ N', text: 'Quick note. Drops a line into the Quick Capture notebook' },
        { kbd: '⌘ ⇧ X', text: 'Clear the auto-saved chat input draft' },
        { kbd: '?', text: 'Open this shortcuts overlay (when not typing)' },
        { kbd: 'Esc', text: 'Close any modal, exit Focus Mode' }
      ]
    },
    {
      title: 'Chat slash commands',
      items: [
        { kbd: '/goal …', text: 'Save text to Pulse Unassigned (does not send to AI)' },
        { kbd: '/note …', text: 'Open Quick Note modal pre-filled' },
        { kbd: '/remind …', text: 'Open Quick Reminder modal pre-filled' },
        { kbd: '/brief', text: 'Open Daily Brief' },
        { kbd: '/brilli {form}', text: 'Set Brilli form (celestial / aura / firefly / signature / classic)' },
        { kbd: '/theme', text: 'Toggle light / dark mode' },
        { kbd: '/focus', text: 'Toggle Focus Mode' },
        { kbd: '/sync', text: 'Force cloud sync' },
        { kbd: '/help', text: 'Open this shortcuts overlay' }
      ]
    },
    {
      title: '⌘K command examples',
      items: [
        { kbd: '"brief"', text: 'Open Daily Brief, today\'s at-a-glance summary' },
        { kbd: '"brilli firefly"', text: 'Set Brilli to firefly' },
        { kbd: '"cycle brilli"', text: 'Advance to next form' },
        { kbd: '"split-pane"', text: 'Toggle Studio Split-Pane' },
        { kbd: '"customize concierge"', text: 'Open Concierge customizer' },
        { kbd: '"reset prefs"', text: 'Reset Brilliance preferences' },
        { kbd: '"what\'s new"', text: 'Open this version\'s changelog' },
        { kbd: '"new email to {name}"', text: 'Open Mail composer for that person' },
        { kbd: '"run {automation}"', text: 'Trigger a saved automation' },
        { kbd: '"open {view}"', text: 'Jump to any nav surface' },
        { kbd: '"add goal {text}"', text: 'New Pulse goal' }
      ]
    }
  ];

  var overlay = document.createElement('div');
  overlay.id = 'brillianceShortcutsOverlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Keyboard shortcuts');
  overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:99100;opacity:0;transition:opacity 0.3s;';
  overlay.onclick = function(e){ if (e.target === overlay) _close(); };

  var modal = document.createElement('div');
  modal.style.cssText = 'max-width:600px;width:92%;max-height:88vh;overflow:auto;background:' + (isLight ? '#ffffff' : '#0f0f0f') + ';border:1px solid ' + (isLight ? 'rgba(168,140,86,0.3)' : 'rgba(201,181,122,0.22)') + ';border-radius:14px;padding:32px;color:' + (isLight ? '#1a1a1a' : '#f5ecd9') + ';font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 24px 80px ' + (isLight ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.6)') + ';';

  var bodyHtml = '';
  for (var si = 0; si < sections.length; si++) {
    var s = sections[si];
    bodyHtml += '<div style="margin-bottom:20px;">';
    bodyHtml += '<div style="font-family:Georgia,serif;font-size:14px;font-weight:500;color:' + (isLight ? '#5a4d2e' : '#e2c79b') + ';margin-bottom:10px;letter-spacing:0.04em;text-transform:uppercase;font-style:italic;">' + s.title + '</div>';
    for (var ii = 0; ii < s.items.length; ii++) {
      var it = s.items[ii];
      bodyHtml += '<div style="display:flex;align-items:flex-start;gap:14px;padding:8px 0;border-bottom:1px solid ' + (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)') + ';">';
      bodyHtml += '<div style="flex-shrink:0;min-width:120px;font-family:\'SF Mono\',Monaco,Menlo,monospace;font-size:11.5px;color:' + (isLight ? '#7a6741' : '#c9a961') + ';padding:3px 8px;background:' + (isLight ? 'rgba(168,140,86,0.08)' : 'rgba(201,169,97,0.10)') + ';border:1px solid ' + (isLight ? 'rgba(168,140,86,0.18)' : 'rgba(201,169,97,0.18)') + ';border-radius:6px;text-align:center;letter-spacing:0.02em;">' + it.kbd + '</div>';
      bodyHtml += '<div style="font-size:13px;color:' + (isLight ? 'rgba(0,0,0,0.72)' : 'rgba(245,236,217,0.72)') + ';line-height:1.55;">' + it.text + '</div>';
      bodyHtml += '</div>';
    }
    bodyHtml += '</div>';
  }

  modal.innerHTML =
    '<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">' +
      '<div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
        '<div style="position:absolute;inset:-6px;background:radial-gradient(circle,rgba(201,169,97,0.22) 0%,rgba(201,169,97,0) 70%);border-radius:50%;"></div>' +
        '<img src="/images/brilliance/monogram-circle.png" alt="" style="position:relative;width:48px;height:48px;border-radius:50%;object-fit:cover;" onerror="this.style.display=\'none\'" />' +
      '</div>' +
      '<div>' +
        '<div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:' + (isLight ? '#7a6741' : '#c9a961') + ';font-weight:500;">Brilliance</div>' +
        '<div style="font-size:22px;font-weight:600;letter-spacing:-0.01em;color:' + (isLight ? '#1a1a1a' : '#f5ecd9') + ';">Keyboard Shortcuts</div>' +
      '</div>' +
    '</div>' +
    '<div>' + bodyHtml + '</div>' +
    '<div style="margin-top:18px;display:flex;justify-content:flex-end;">' +
      '<button id="shortcutsCloseBtn" style="padding:11px 24px;background:linear-gradient(135deg,#e2c79b,#c9a961,#a88a4a);border:none;border-radius:99px;color:#0a0a0a;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;">Close</button>' +
    '</div>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  setTimeout(function(){ overlay.style.opacity = '1'; }, 16);

  function _close(){
    overlay.style.opacity = '0';
    setTimeout(function(){ if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 300);
  }
  modal.querySelector('#shortcutsCloseBtn').onclick = _close;
  document.addEventListener('keydown', function escH(e){
    if (e.key === 'Escape') { _close(); document.removeEventListener('keydown', escH); }
  });
};
