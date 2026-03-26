# B.L.A.K.E. Symbiote Organism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Symbiote" shape preset to B.L.A.K.E.'s blob system -- a glossy black Venom-inspired organism with sharp spike tendrils, configurable behavior modes, and accent-color-tinted highlights.

**Architecture:** Extend the existing blob shape preset system (BLOB_SHAPES object, vertex/fragment shaders, animation loop) with a new `symbiote` entry. The spike effect lives entirely in the vertex shader via a spike extrusion pass. The glossy black look is a conditional path in the fragment shader. A new `spikeMode` setting controls tendril behavior (calm/fierce/restless). All rendering uses the same IcosahedronGeometry and Three.js pipeline.

**Tech Stack:** Three.js (WebGL), GLSL shaders, vanilla JS (ES5), localStorage + Firestore sync

**Spec:** `docs/superpowers/specs/2026-03-25-blake-symbiote-design.md`

---

## File Map

All changes in a single file:
- **Modify:** `/Volumes/roweOS/RoweOS/dist/index.html`

Key regions (line numbers approximate -- use string search):

| Region | Lines | Purpose |
|--------|-------|---------|
| Blob vertex shader (`<script id="blobVertexShader">`) | 52232-52307 | GLSL vertex displacement |
| Blob fragment shader (`<script id="blobFragmentShader">`) | 52309-52338 | GLSL material/lighting |
| Onboarding shape buttons (`#onboardingBlobShapes`) | 51728-51735 | Shape selector UI |
| Settings shape buttons (`#blobShapeSelector`) | 57343-57349 | Shape selector UI |
| BLOB_SHAPES object | 188717-188724 | Shape preset definitions |
| initBlob() uniforms | 188797-188808 | Uniform setup |
| setBlobShape() | ~188900 | Shape switching logic |
| setBlobState() | 188887-188889 | State machine |
| startBlobAnimation() state modifiers | 190302-190319 | Per-frame state-driven animation |
| initBlobPreview() uniforms | 189307-189318 | Preview canvas uniforms |
| Preview animation loop | 189348-189353 | Preview per-frame updates |

---

### Task 1: Add Symbiote to BLOB_SHAPES and UI buttons

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html`

- [ ] **Step 1: Add symbiote entry to BLOB_SHAPES object**

Search for `var BLOB_SHAPES = {`. Add after the `sphere` entry:

```javascript
  symbiote: { amp: 0.45, freq: 1.8, speed: 0.35, detail: 0.8, fresnel: 2.0, label: 'Symbiote', isSymbiote: true }
```

- [ ] **Step 2: Add symbiote button to onboarding shape selector**

Search for `id="onboardingBlobShapes"`. After the sphere button, add:

```html
<button class="blob-shape-btn" data-shape="symbiote" onclick="selectOnboardingBlob('symbiote')">Symbiote</button>
```

- [ ] **Step 3: Add symbiote button to settings shape selector**

Search for `id="blobShapeSelector"`. After the sphere button, add:

```html
<button class="blob-shape-btn" data-shape="symbiote" onclick="setBlobShape('symbiote')">Symbiote</button>
```

- [ ] **Step 4: Add spike mode sub-option UI below settings shape selector**

After the `#blobShapeSelector` closing `</div>` (search for it), add:

```html
<div id="symbioteSpikeModeSelector" style="display:none;margin-bottom:10px;">
  <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px;">Tendril Behavior</div>
  <div style="display:flex;gap:6px;">
    <button class="blob-shape-btn" data-spike-mode="calm" onclick="setSymbioteSpikeMode('calm')" style="font-size:11px;padding:4px 10px;">Calm to Fierce</button>
    <button class="blob-shape-btn" data-spike-mode="fierce" onclick="setSymbioteSpikeMode('fierce')" style="font-size:11px;padding:4px 10px;">Always Fierce</button>
    <button class="blob-shape-btn active" data-spike-mode="restless" onclick="setSymbioteSpikeMode('restless')" style="font-size:11px;padding:4px 10px;">Restless</button>
  </div>
</div>
```

- [ ] **Step 5: Add spike mode persistence functions**

Search for `function setBlobShape(`. Before it, add:

```javascript
// v26.4: Symbiote spike mode
var _symbioteSpikeMode = localStorage.getItem('roweos_blob_spike_mode') || 'restless';

function setSymbioteSpikeMode(mode) {
  _symbioteSpikeMode = mode;
  localStorage.setItem('roweos_blob_spike_mode', mode);
  if (typeof syncLifeAIToFirestore === 'function') {
    syncLifeAIToFirestore({ blobSpikeMode: mode });
  }
  // Update button states
  var container = document.getElementById('symbioteSpikeModeSelector');
  if (container) {
    container.querySelectorAll('.blob-shape-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.spikeMode === mode);
    });
  }
}
```

- [ ] **Step 6: Show/hide spike mode selector when symbiote is selected**

Search for `function setBlobShape(`. Inside this function, after the line that sets `localStorage.setItem('roweos_blob_shape', shapeName)`, add:

```javascript
  // v26.4: Show/hide symbiote spike mode selector
  var spikeSel = document.getElementById('symbioteSpikeModeSelector');
  if (spikeSel) spikeSel.style.display = (shapeName === 'symbiote') ? '' : 'none';
```

- [ ] **Step 7: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(blake): add symbiote shape preset entry, UI buttons, spike mode selector"
```

---

### Task 2: Write the Symbiote vertex shader (spike extrusion)

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html`

- [ ] **Step 1: Add spike uniforms to vertex shader**

Search for `<script id="blobVertexShader" type="x-shader/x-vertex">`. After the existing uniform declarations (after `uniform vec2 uMouse;`), add:

```glsl
// v26.4: Symbiote spike uniforms
uniform float uIsSymbiote;
uniform float uSpikeThreshold;
uniform float uSpikeLength;
uniform float uSpikeTaper;
uniform float uSpikeCurl;
```

- [ ] **Step 2: Add spike extrusion logic to vertex shader**

In the vertex shader, find the line `vec3 newPos=pos+normal*displacement;` (near the end). Replace that single line with:

```glsl
  vec3 newPos=pos+normal*displacement;

  // v26.4: Symbiote spike extrusion pass
  if (uIsSymbiote > 0.5) {
    // Multi-octave spike noise
    float spikeNoise = snoise(pos * 2.0 + uTime * uSpeed * 0.4) * 0.5
                     + snoise(pos * 4.0 - uTime * uSpeed * 0.6) * 0.25
                     + snoise(pos * 8.0 + uTime * uSpeed * 0.3) * 0.125;

    // Spike activation
    float spikeActivation = smoothstep(uSpikeThreshold, uSpikeThreshold + 0.15, spikeNoise);

    // Exponential spike extrusion with taper
    float spikeExt = pow(spikeActivation, uSpikeTaper) * uSpikeLength;

    // Spike curl: add tangential offset at tip
    vec3 tangent = normalize(cross(normal, vec3(0.0, 1.0, 0.0)));
    float curlAmount = spikeExt * uSpikeCurl * sin(uTime * 1.5 + length(pos) * 3.0);
    vec3 curlOffset = tangent * curlAmount;

    newPos += normal * spikeExt + curlOffset;
    displacement += spikeExt;
  }
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(blake): symbiote vertex shader with spike extrusion, curl, and taper"
```

---

### Task 3: Write the Symbiote fragment shader (glossy black PBR)

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html`

- [ ] **Step 1: Add symbiote uniforms to fragment shader**

Search for `<script id="blobFragmentShader" type="x-shader/x-fragment">`. After the existing uniform declarations (after `uniform float uTime;`), add:

```glsl
// v26.4: Symbiote material uniforms
uniform float uIsSymbiote;
uniform vec3 uSSSColor;
```

- [ ] **Step 2: Add glossy black material path to fragment shader**

Find the line `gl_FragColor=vec4(color,alpha);` at the end of the fragment shader. Replace everything from `vec3 color=baseColor;` to `gl_FragColor=vec4(color,alpha);` with:

```glsl
  vec3 color=baseColor;

  if (uIsSymbiote > 0.5) {
    // v26.4: Glossy black PBR-like material
    vec3 darkBase = vec3(0.04, 0.04, 0.06);

    // Environment reflection approximation (view-angle gradient)
    float envReflect = pow(1.0 - abs(dot(viewDir, norm)), 1.5);
    vec3 envColor = mix(vec3(0.15, 0.14, 0.13), vec3(0.4, 0.38, 0.35), envReflect);

    // Subsurface scattering with accent tint
    vec3 sssColor2 = uSSSColor * sss * 1.2;

    // High specular (wet/glossy)
    float glossySpec = pow(max(dot(reflect(-lightDir, norm), viewDir), 0.0), 64.0);
    vec3 glossySpecColor = mix(uSSSColor, vec3(1.0), 0.6);

    // Organic noise grain
    float grain = snoise(vPosition * 12.0 + uTime * 0.1) * 0.03;

    color = darkBase + grain;
    color += envColor * envReflect * 0.3;
    color += sssColor2;
    color += glossySpec * glossySpecColor * 0.8;

    // Fresnel rim with accent
    float symFresnel = pow(1.0 - abs(dot(viewDir, norm)), 3.0);
    color += uSSSColor * symFresnel * 0.4;

    float alpha2 = 0.95;
    gl_FragColor = vec4(color, alpha2);
  } else {
    // Original material path
    color += sssColor * sss;
    color += spec * specColor;
    color = mix(color, rimColor, fresnel * 0.6);
    float alpha = mix(uOpacity, uOpacity * 0.3, fresnel);
    alpha = clamp(alpha, 0.0, 1.0);
    gl_FragColor = vec4(color, alpha);
  }
```

**Note:** The `snoise` function used in the fragment shader for grain needs to be available. Check if there's already a noise function in the fragment shader. If not, add a simple hash-based noise at the top of the fragment shader:

```glsl
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float snoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z) * 2.0 - 1.0;
}
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(blake): symbiote glossy black PBR fragment shader with SSS and accent tint"
```

---

### Task 4: Wire symbiote uniforms into initBlob() and initBlobPreview()

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html`

- [ ] **Step 1: Add symbiote uniforms to initBlob()**

Search for `_blobUniforms = {`. After the `uOpacity` entry, add:

```javascript
    // v26.4: Symbiote uniforms
    uIsSymbiote: { value: (shape.isSymbiote ? 1.0 : 0.0) },
    uSpikeThreshold: { value: 0.35 },
    uSpikeLength: { value: 2.5 },
    uSpikeTaper: { value: 3.0 },
    uSpikeCurl: { value: 0.25 },
    uSSSColor: { value: new THREE.Color('#f0ece6') }
```

- [ ] **Step 2: Set SSS color based on accent**

After the uniforms block, add logic to tint SSS color with accent:

```javascript
  // v26.4: Symbiote SSS color -- use accent if non-default, otherwise cream
  if (shape.isSymbiote) {
    var accentDark = localStorage.getItem('roweos_life_accent_dark_mode') || localStorage.getItem('roweos_accent_dark_mode');
    var defaultGold = '#a89878';
    if (accentDark && accentDark !== defaultGold && accentDark !== '#22c55e') {
      _blobUniforms.uSSSColor.value = new THREE.Color(accentDark);
    }
  }
```

- [ ] **Step 3: Add same uniforms to initBlobPreview()**

Search for `_blobPreviewUniforms = {`. After the `uOpacity` entry, add the same symbiote uniforms:

```javascript
    uIsSymbiote: { value: (shape.isSymbiote ? 1.0 : 0.0) },
    uSpikeThreshold: { value: 0.35 },
    uSpikeLength: { value: 2.5 },
    uSpikeTaper: { value: 3.0 },
    uSpikeCurl: { value: 0.25 },
    uSSSColor: { value: new THREE.Color('#f0ece6') }
```

- [ ] **Step 4: Update setBlobShape() to toggle uIsSymbiote**

Search for `function setBlobShape(`. Inside the function, find where `_blobShapeTarget` is set (search for `_blobShapeTarget =`). After that line, add:

```javascript
    // v26.4: Toggle symbiote mode
    if (_blobUniforms && _blobUniforms.uIsSymbiote) {
      _blobUniforms.uIsSymbiote.value = (newShape.isSymbiote ? 1.0 : 0.0);
    }
    if (_blobPreviewUniforms && _blobPreviewUniforms.uIsSymbiote) {
      _blobPreviewUniforms.uIsSymbiote.value = (newShape.isSymbiote ? 1.0 : 0.0);
    }
```

- [ ] **Step 5: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(blake): wire symbiote uniforms into initBlob, preview, and shape switching"
```

---

### Task 5: Add spike mode state modifiers to animation loop

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html`

- [ ] **Step 1: Add symbiote state modifiers to startBlobAnimation()**

Search for `if (_blobState === 'thinking')` inside `startBlobAnimation()`. Replace the entire state modifier section (from `var ampMod = 0` through `var tFresnel = base.fresnel;`) with:

```javascript
    var ampMod = 0, speedMod = 0, freqMod = 0;
    var spikeThreshold = 0.35, spikeLength = 2.5, spikeTaper = 3.0, spikeCurl = 0.25;

    if (base.isSymbiote) {
      // v26.4: Symbiote state modifiers vary by spike mode
      var mode = typeof _symbioteSpikeMode !== 'undefined' ? _symbioteSpikeMode : 'restless';
      var t = Date.now() * 0.001;

      if (mode === 'calm') {
        if (_blobState === 'thinking') {
          ampMod = 0.3; speedMod = 0.4; freqMod = 0.3;
          spikeThreshold = 0.3; spikeLength = 3.0;
        } else if (_blobState === 'responding') {
          ampMod = 0.5; speedMod = 0.6; freqMod = 0.5;
          spikeThreshold = 0.2; spikeLength = 4.0;
        } else {
          spikeThreshold = 0.7; spikeLength = 0.5;
        }
      } else if (mode === 'fierce') {
        spikeThreshold = 0.25; spikeLength = 2.8;
        if (_blobState === 'thinking') {
          ampMod = 0.35; speedMod = 0.5; freqMod = 0.4;
          spikeThreshold = 0.18; spikeLength = 3.5;
        } else if (_blobState === 'responding') {
          ampMod = 0.5; speedMod = 0.7; freqMod = 0.5;
          spikeThreshold = 0.12; spikeLength = 4.0;
        }
      } else {
        // restless: continuously cycling
        var cycle = Math.sin(t * 0.4) * 0.5 + 0.5;
        spikeThreshold = 0.4 - cycle * 0.15;
        spikeLength = 1.5 + cycle * 1.5;
        if (_blobState === 'thinking') {
          ampMod = 0.2 + cycle * 0.2; speedMod = 0.4; freqMod = 0.3;
          spikeThreshold -= 0.1; spikeLength += 1.0;
        } else if (_blobState === 'responding') {
          ampMod = 0.3 + cycle * 0.2; speedMod = 0.5; freqMod = 0.4;
          spikeThreshold -= 0.15; spikeLength += 1.5;
        }
      }

      // Lerp spike uniforms
      if (_blobUniforms.uSpikeThreshold) {
        _blobUniforms.uSpikeThreshold.value += (spikeThreshold - _blobUniforms.uSpikeThreshold.value) * 0.03;
        _blobUniforms.uSpikeLength.value += (spikeLength - _blobUniforms.uSpikeLength.value) * 0.03;
        _blobUniforms.uSpikeTaper.value += (spikeTaper - _blobUniforms.uSpikeTaper.value) * 0.03;
        _blobUniforms.uSpikeCurl.value += (spikeCurl - _blobUniforms.uSpikeCurl.value) * 0.03;
      }
    } else {
      // Non-symbiote: original state modifiers
      if (_blobState === 'thinking') {
        ampMod = 0.2; speedMod = 0.5; freqMod = 0.5;
      } else if (_blobState === 'responding') {
        ampMod = 0.1; speedMod = 0.2; freqMod = 0.3;
      }
    }

    var tAmp = base.amp + ampMod;
    var tSpeed = base.speed + speedMod;
    var tFreq = base.freq + freqMod;
    var tDetail = base.detail;
    var tFresnel = base.fresnel;
```

- [ ] **Step 2: Add mouse-toward-spike attraction**

In the same animation loop, find where mouse position is updated (search for `uMouse.value`). After the existing mouse lerp code, add:

```javascript
    // v26.4: Symbiote spikes reach toward cursor
    if (base.isSymbiote && _blobUniforms.uSpikeCurl) {
      var mouseLen = Math.sqrt(_blobMouseTarget.x * _blobMouseTarget.x + _blobMouseTarget.y * _blobMouseTarget.y);
      if (mouseLen > 0.1) {
        _blobUniforms.uSpikeCurl.value = Math.min(0.4, 0.25 + mouseLen * 0.15);
      }
    }
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(blake): symbiote spike mode state modifiers with calm/fierce/restless behavior"
```

---

### Task 6: Persistence and Firestore sync

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html`

- [ ] **Step 1: Restore blobSpikeMode from Firestore on startup**

Search for `if (life.rhythmWidgetConfig)` inside `loadFromFirebaseV2`. After the rhythmWidgetConfig restore, add:

```javascript
    // v26.4: Restore symbiote spike mode
    if (life.blobSpikeMode) {
      localStorage.setItem('roweos_blob_spike_mode', life.blobSpikeMode);
      if (typeof _symbioteSpikeMode !== 'undefined') _symbioteSpikeMode = life.blobSpikeMode;
    }
```

- [ ] **Step 2: Include blobSpikeMode in the syncToFirebase payload**

Search for `syncLifeAIToFirestore` calls in the existing `setBlobShape` function. If there isn't one, find where `roweos_blob_shape` is written in `setBlobShape` and add after it:

```javascript
  // v26.4: Sync blob shape to Firestore
  syncLifeAIToFirestore({ blobShape: shapeName, blobSpikeMode: _symbioteSpikeMode });
```

- [ ] **Step 3: Show spike mode selector on settings panel open**

Search for where the settings panel initializes the blob shape buttons (look for code that reads `roweos_blob_shape` and sets the `active` class on buttons). After that code, add:

```javascript
  // v26.4: Show spike mode selector if symbiote is active
  var spikeSel = document.getElementById('symbioteSpikeModeSelector');
  if (spikeSel) {
    var currentShape = localStorage.getItem('roweos_blob_shape') || 'crystal';
    spikeSel.style.display = (currentShape === 'symbiote') ? '' : 'none';
    // Set active button
    var currentMode = localStorage.getItem('roweos_blob_spike_mode') || 'restless';
    spikeSel.querySelectorAll('.blob-shape-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.spikeMode === currentMode);
    });
  }
```

- [ ] **Step 4: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(blake): symbiote spike mode persistence and Firestore sync"
```

---

### Task 7: Final verification and deploy

- [ ] **Step 1: Test in browser**

Open roweOS, go to Settings > B.L.A.K.E. section:
1. Select "Symbiote" shape -- verify organism renders with spikes
2. Switch between Calm/Fierce/Restless -- verify visual difference
3. Start a conversation -- verify thinking state intensifies spikes
4. Move mouse over blob -- verify spikes reach toward cursor
5. Switch to another shape (Crystal) -- verify clean transition, no artifacts
6. Switch back to Symbiote -- verify it restores correctly
7. Check the preview canvas in settings -- verify it shows symbiote
8. Reload -- verify shape and spike mode persist

- [ ] **Step 2: Test accent color tinting**

1. With default gold accent -- verify cream/white highlights
2. Change accent to Neon -- verify highlights tint cyan/magenta
3. Change accent to Aurora -- verify highlights tint green

- [ ] **Step 3: Test onboarding**

If accessible, verify the Symbiote button appears in onboarding shape selector and works.

- [ ] **Step 4: Check console for shader errors**

Open browser console, switch to Symbiote. Look for any WebGL shader compilation errors (red text).

- [ ] **Step 5: Deploy**

```bash
cd /Volumes/roweOS/RoweOS/dist && vercel --prod
```

- [ ] **Step 6: Commit version note**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "feat(blake): Symbiote organism shape preset -- glossy black Venom-style with spike tendrils"
```
