# Brilli Animation — Tech Spec

**Status:** Spec, draft v0.1
**Decision based on:** Animation research agent report, 2026-04-27
**Sibling:** `01-brilli-entity.md` (visual + behavior); `02-welcome-experience.md` (where Brilli first appears)
**Mockup:** `RoweOS/dist/brilliance-mockups/01-brilli-canvas-prototype.html`

---

## The decision

**Primary tech: Canvas 2D procedural particle system.** Single ES5 IIFE module (~6-10KB) that draws Brilli (body, eyes, antennae, wings, particle trail) with `requestAnimationFrame`, exposing a state machine (`idle | thinking | delivering | attending | pleased | asleep`) and a size variant (`hero | inline | pin`).

**Fallback: Static SVG.** Same Brilli silhouette as a flat SVG. Used when:
- `prefers-reduced-motion: reduce` is set
- Canvas init fails for any reason
- Inline contexts smaller than ~32px (particles look like noise at that scale)
- The rendered context is an `<img>` (favicon, OG card, email template, manifest icon)

**Rejected: Lottie, WebGL/three.js, SVG `feGaussianBlur` for glow.**

## Why this beats the alternatives

| Approach | Why rejected |
|---|---|
| **Lottie** | Safari has documented Lottie performance issues. JSON files are build artifacts, violating the no-build-pipeline constraint. Animations bake in at design time — cannot react to AI thinking state without swapping files. 50-200KB CDN tax. The Core Animation engine boost is iOS-native only; web build doesn't get it. None of Apple/OpenAI/Anthropic ship Lottie for their primary brand mark on web. |
| **WebGL / three.js** | Three.js ~150KB min+gz, regl ~50KB. iOS low-power mode throttles WebGL aggressively. Multiple concurrent contexts (would need at least 2: thinking indicator + landing) hit Safari's WebGL context limit. Overkill for a 24-280px insect. |
| **CSS + SVG `feGaussianBlur`** | Safari has documented bugs with cumulative `feGaussianBlur`. Filters force a paint per frame and break GPU compositing — worst case for battery. Color saturation issues. OK as a one-shot styling layer on a static badge, not as a per-frame animation driver. |
| **Pure CSS keyframes** | Cannot do real particle trails. `box-shadow` spread animation is paint-heavy. No reactivity to AI state. Wing flap is doable but the trail is the magic. |

## Why Canvas 2D is the right call

1. **Codebase precedent** — `src/html/shared/21-settings.html` lines 110-126 already ships a 160×160 canvas (`blobPreviewCanvas`) for the existing blob customizer. The team has shipped this pattern. Brilli is the natural successor.
2. **Performance** — One canvas = one composite layer regardless of particle count. Beats SVG (which scales DOM nodes) for animated cases by orders of magnitude.
3. **No CDN, no build** — pure vanilla ES5, lives in `src/js/core/` like every other module. `bash src/build.sh` concatenates it into `index.html` exactly like the other JS files. Single-file deploy preserved.
4. **State reactivity** — `Brilli.setMode('thinking')` tweaks a few floats; no asset swap, no animation file load.
5. **Battery friendly** — no `feGaussianBlur`, no `ctx.filter` (slow on iOS), no SMIL. Layered radial gradients + `globalCompositeOperation = 'lighter'` gives the bloom we need without filters.
6. **Multi-instance safe** — multiple Brilli instances (sidebar dot + chat landing + thinking indicator simultaneously) each get their own RAF loop, all gated by `document.visibilityState`.

## Module shape

File: `src/js/core/29-brilli.js` (numbered after 28-reminders; this puts Brilli on the visual layer)

```javascript
// src/js/core/29-brilli.js
// Brilli - the Brilliance entity
// v33.0

var Brilli = (function(){
  var instances = [];
  var rafId = null;
  var reducedMotion = false;
  var paused = false;

  function detectReducedMotion() {
    var mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = mq && mq.matches;
    if (mq && mq.addEventListener) {
      mq.addEventListener('change', function(e){
        reducedMotion = e.matches;
        instances.forEach(function(b){ b.dirty = true; });
      });
    }
  }

  function setupVisibilityHandler() {
    document.addEventListener('visibilitychange', function(){
      paused = document.hidden;
      if (!paused) startLoop();
    });
  }

  function mount(el, opts) {
    opts = opts || {};
    var size = opts.size || 'inline';     // 'hero' | 'inline' | 'pin'
    var mode = opts.mode || 'idle';       // 'idle' | 'thinking' | ...
    var brilli = createBrilli(el, size, mode);
    if (reducedMotion || size === 'pin' || opts.staticOnly) {
      renderStatic(brilli);
      return brilli;
    }
    instances.push(brilli);
    startLoop();
    return brilli;
  }

  function unmount(brilli) {
    var idx = instances.indexOf(brilli);
    if (idx > -1) instances.splice(idx, 1);
    if (brilli.cleanup) brilli.cleanup();
    if (instances.length === 0) stopLoop();
  }

  function setMode(brilli, mode) {
    brilli.mode = mode;
    brilli.modeChangedAt = performance.now();
  }

  function createBrilli(el, size, mode) { /* canvas init, scale, gradient cache */ }
  function renderStatic(brilli) { /* SVG fallback - injects pre-built SVG */ }
  function startLoop() { if (!rafId) rafId = requestAnimationFrame(tick); }
  function stopLoop() { if (rafId) cancelAnimationFrame(rafId); rafId = null; }

  function tick(t) {
    if (paused) { rafId = null; return; }
    var lastFrameMs = t - lastTickT;
    lastTickT = t;
    instances.forEach(function(b){ updateAndDraw(b, t, lastFrameMs); });
    rafId = requestAnimationFrame(tick);
  }

  function updateAndDraw(b, t, dt) {
    // 1. update particle physics (velocity, opacity decay)
    // 2. update wing phase (idle 2Hz, thinking 5Hz, delivering 3Hz)
    // 3. update body breathe phase
    // 4. clear canvas (or use composite for trails)
    // 5. draw body (radial gradient teardrop)
    // 6. draw wings (low-opacity ellipses, additive blend)
    // 7. draw head + eyes + antennae
    // 8. draw particles (additive, fade by life)
  }

  detectReducedMotion();
  setupVisibilityHandler();

  return { mount: mount, unmount: unmount, setMode: setMode };
})();
```

## API surface

```javascript
// Mount Brilli into an element
var b = Brilli.mount(document.getElementById('chatLanding'), {
  size: 'hero',     // 'hero' (~280px) | 'inline' (~64px) | 'pin' (~24px)
  mode: 'idle'      // initial state
});

// Change state in response to AI events
Brilli.setMode(b, 'thinking');     // wings flap fast, body intensifies
Brilli.setMode(b, 'delivering');   // pulse with each token
Brilli.setMode(b, 'idle');         // return to rest

// Cleanup when view is destroyed
Brilli.unmount(b);
```

## State machine details

| Mode | Wing flap rate | Body glow | Particles | Antennae | Trigger |
|---|---|---|---|---|---|
| `asleep` | 0 Hz (folded) | 20% | 0 | down | `document.hidden === true` |
| `idle` | 2 Hz | 60% steady | 12 (slow drift) | sway slight | default |
| `attending` | 2 Hz | 70% | 12 | point forward | hover on input/operation |
| `thinking` | 5 Hz | 90% | 30 (active) | stiffen forward | AI streaming |
| `delivering` | 3 Hz | pulse with tokens | 20 | forward | AI delivering response |
| `pleased` | 4 Hz briefly | flash 110% then settle | 30 burst | flutter | task completion |

Transition between modes is 200-400ms ease-out (the floats that drive flap/glow/particle-spawn smoothly interpolate).

## Performance budget

- **Hero size (280px), idle**: target 60fps desktop, 60fps iOS Safari
- **Hero size (280px), thinking**: target 60fps desktop, 30fps acceptable iOS
- **Inline size (64px), idle**: target 60fps everywhere
- **Pin size (24px), idle**: static SVG only; no canvas (particles look like noise)

Frame budget detection:
```javascript
// In tick(): if frame > 35ms, drop to particle-cap of 15 and target 30Hz
if (dt > 35) {
  b.particleCap = 15;
  b.targetFps = 30;
}
```

DPR cap: `Math.min(window.devicePixelRatio || 1, 2)`. Going to 3 on iPhone Pro is invisible at this scale and triples GPU upload cost.

## Color pipeline

All colors pulled from CSS variables at mount time and cached:
```javascript
var styles = getComputedStyle(document.documentElement);
b.gold1 = styles.getPropertyValue('--gold-1').trim() || '#f5e6c8';
b.gold2 = styles.getPropertyValue('--gold-2').trim() || '#e2c79b';
// ...
```

Re-read on `Brilli.refresh(b)` if the user toggles theme. (Brilli is gold always per `01-brilli-entity.md` — but allows future theming hooks.)

## SVG fallback

Pre-built static SVG of Brilli, exported once from the master illustration. Used for:
- `prefers-reduced-motion`
- Pin scale (24px and below)
- `<img>` contexts (favicon, OG, email)
- Init failure

The SVG is the source of truth for Brilli's silhouette. Canvas rasterizes the same silhouette procedurally for live versions. They MUST visually match — no "oh the SVG looks different from the canvas" drift.

Storage: `RoweOS/dist/images/brilliance/brilli.svg`
Inline fallback in JS: a base64-encoded version of the same SVG, ~3KB, embedded in `29-brilli.js` so reduced-motion paths don't depend on a network fetch.

## Wing implementation detail

Wings are the hardest part to get right without `feGaussianBlur`.

**Approach:** two pairs of stacked Bezier-curved ellipses with low alpha and additive blend.

```javascript
// Per wing: draw 3 stacked semi-translucent ellipses with slight offset
// to fake the gossamer texture without blur filter
function drawWing(ctx, x, y, w, h, phase, opacity) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(phase) * 0.2);  // subtle rotation per flap
  ctx.scale(1, Math.cos(phase) * 0.4 + 0.6);  // wing perspective on flap
  ctx.globalCompositeOperation = 'lighter';
  for (var i = 0; i < 3; i++) {
    ctx.fillStyle = 'rgba(232, 199, 155, ' + (opacity * (0.3 - i * 0.08)) + ')';
    ctx.beginPath();
    ctx.ellipse(0, 0, w * (1 - i * 0.05), h * (1 - i * 0.05), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
```

The wing veins (visible in the firefly reference) are drawn as 4-6 thin gold lines per wing, at higher opacity, with subtle bezier curves. Pre-computed at mount time, redrawn each frame at the current wing rotation.

## Particle trail implementation

```javascript
// Particle struct: { x, y, vx, vy, life, maxLife, size }
function spawnParticle(b, fromX, fromY) {
  if (b.particles.length >= b.particleCap) return;
  b.particles.push({
    x: fromX + (Math.random() - 0.5) * 8,
    y: fromY + (Math.random() - 0.5) * 4,
    vx: -Math.random() * 0.6,           // drift left/down
    vy: Math.random() * 0.3 - 0.05,
    life: 0,
    maxLife: 1500 + Math.random() * 1500,  // ms
    size: 1.2 + Math.random() * 1.5
  });
}

function drawParticles(b, ctx, dt) {
  ctx.globalCompositeOperation = 'lighter';
  for (var i = b.particles.length - 1; i >= 0; i--) {
    var p = b.particles[i];
    p.life += dt;
    if (p.life >= p.maxLife) { b.particles.splice(i, 1); continue; }
    p.x += p.vx;
    p.y += p.vy;
    var lifePct = p.life / p.maxLife;
    var alpha = (1 - lifePct) * 0.85;
    ctx.fillStyle = 'rgba(245, 230, 200, ' + alpha + ')';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}
```

Spawn rate per mode:
- `idle`: 1 particle every 200ms
- `attending`: 1 particle every 150ms
- `thinking`: 1 particle every 50ms
- `delivering`: 1 particle every 100ms (synchronized to streaming token rate if available)
- `pleased`: 30 particles in a single frame, then return to idle rate

## Integration points (where Brilli mounts)

| Location | Size | Initial mode | Reactivity |
|---|---|---|---|
| Chat landing (replaces blob) | hero | idle | input focus → attending; send → thinking; streaming → delivering; complete → pleased |
| Launch screen | hero | idle | one-shot intro animation, then idle |
| Welcome modal | hero | idle | intro animation, then idle, then pleased once before dismiss |
| Library empty state | inline | idle | static |
| Bloom empty state | inline | thinking (suggesting "gathering") | hover → attending |
| Studio empty state | inline | idle | hover op → attending |
| Pulse nudge cards | inline | idle | hover → attending |
| Sidebar status dot | pin | idle (static SVG) | automation completion → pleased flash |
| Streaming text indicator | pin | thinking | replaces dot loaders |

## Replaces (cleanup tied to Brilli ship)

- **Blob** in chat landing — see `04-cleanup-targets.md` for the file/CSS/JS cut list
- **Loading dots** in any AI streaming context (replaced by pin-scale Brilli in thinking mode)
- **Helix subordinated** — stays in LifeAI as a low-opacity ambient backdrop, no longer the hero element

## Testing checklist

- [ ] Renders correctly at hero, inline, and pin sizes on Chrome desktop
- [ ] Renders correctly at all sizes on iOS Safari (PWA + browser)
- [ ] 60fps idle on iPhone 12 (baseline)
- [ ] 60fps idle on iPhone 15 Pro
- [ ] 30fps+ thinking on iPhone 12
- [ ] Pause on `document.hidden` confirmed (open dev tools, switch tab, return — Brilli resumes cleanly)
- [ ] `prefers-reduced-motion` triggers static SVG fallback
- [ ] Multi-instance: 3 simultaneous Brilli (chat hero + sidebar pin + thinking indicator) all render without dropped frames
- [ ] Memory stable after 30 minutes of idle (no leak)
- [ ] DPR cap at 2 verified on iPhone Pro (no 3x render)
- [ ] State transitions smooth (no visible snap)
- [ ] `Brilli.unmount()` cleans up cleanly (no orphan RAF loops)
- [ ] Reduced-motion change while running (toggling iOS Control Center) → instances refresh to static
- [ ] Theme toggle → colors refresh correctly (when implemented)

## Bundle impact

- `29-brilli.js`: ~10KB minified
- `brilli.svg` (fallback, fetched once): ~3KB
- No new image assets except brilli.svg
- No new CSS — Brilli's canvas element gets sized via inline JS
- Total v33.0 Brilli payload: **~13KB**

For comparison: helix PNG `lifeai-helix-light.png` is currently ~2MB. Replacing it (or making it a backdrop) is a net *reduction* in payload.

## Known limitations / future work

- Brilli does not yet morph its silhouette in response to context (e.g., "looking at you" head tilt)
- Brilli is gold-only in v33.0; future theming hooks could allow brand-tinted Brilli in advanced settings
- Brilli does not yet have audio (a soft chime on `pleased` could be considered for v34+)
- The system prompt for the "Brilliance Helper" agent doesn't yet mention Brilli — consider tying the AI's voice to Brilli's behavior (when AI says "let me think", Brilli goes thinking; when AI completes, Brilli goes pleased) — this is a v33.x integration

## Open questions for Jordan

1. **Initial design pass on the master Brilli SVG** — illustrated by hand or by AI tool? If AI tool, recommend Midjourney → vectorize via SVG converter, then hand-clean. Reference image quality is high but it's a raster.
2. **Should Brilli ever face left vs right?** The reference is right-facing. Default right; mirror for layouts that need left-facing.
3. **Where does Brilli "live" in the file system / module structure?** Recommend `src/js/core/29-brilli.js` (after 28-reminders); easy to find, late enough in init order to be safe.
4. **Brilli on the `/brilliance` marketing page?** Currently uses the CSS gold orb. Consider replacing with the canvas Brilli at hero scale for a single shared visual identity. Or keep the orb as Brilli's "marketing simplification" mode. Recommend: **swap to canvas Brilli on /brilliance** for unity.
