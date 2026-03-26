# B.L.A.K.E. Symbiote Organism Shape Preset

**Date:** 2026-03-25
**Status:** Approved
**Scope:** New "Symbiote" blob shape preset with spike extrusion shader, glossy black material, and configurable tendril behavior

---

## Problem Statement

B.L.A.K.E. currently has 5 blob shape presets (smooth, fluid, organic, crystal, sphere) and a helix mode. The user wants a 6th shape inspired by Venom's symbiote -- a glossy black 3D organism with sharp tendrils/spikes that taper to points, organic bulbous central mass, and subsurface scattering highlights.

---

## Design

### Section 1: Symbiote Shape Preset

**What it is:** A 6th blob shape preset called "Symbiote" added to the existing shape selector (smooth/fluid/organic/crystal/sphere). Uses the same `#blobContainer`, same Three.js renderer, same state machine (idle/thinking/responding).

**Vertex shader:**
- New displacement algorithm using multi-octave noise with spike extrusion
- Vertices exceeding a noise threshold are pushed dramatically outward and tapered to sharp points
- Spike count and length vary over time (the organism is constantly reshaping)
- Central mass stays bulbous and organic, spikes emerge from the surface

**Material:**
- Default: glossy black body (`#0a0a0f`) with cream/white subsurface scattering highlights (`#f0ece6`)
- If user has a non-default accent color: the cream highlights are replaced with the accent tint (gold, neon, aurora, etc.)
- High specularity + environment reflection for wet/glossy look
- Fresnel rim light for edge glow

**Tendril behavior modes** (user-selectable sub-setting):
- **"Calm to Fierce"** -- smooth organic idle, tendrils on thinking, full spikes on responding
- **"Always Fierce"** -- always has visible spikes like the reference, states just intensify
- **"Restless"** -- constantly cycles between more/less spiky, states shift the intensity range

**Config shape:**
```javascript
{ id: 'symbiote', label: 'Symbiote', amp: 0.45, freq: 1.8, spikeMode: 'restless' }
```

### Section 2: Integration with Existing Systems

**Shape selector UI:**
- Add "Symbiote" as 6th button in the blob shape selector (onboarding + settings)
- Icon: a spiky organic silhouette (SVG inline, matching existing button style)
- When selected, shows a sub-option for tendril behavior: Calm to Fierce / Always Fierce / Restless (three small toggle pills below the shape buttons)
- Sub-option only visible when Symbiote is the active shape

**State machine integration:**
- Same `setBlobState('idle' | 'thinking' | 'responding')` calls
- Each tendril behavior mode defines its own amplitude/speed/frequency modifiers per state:

| State | Calm to Fierce | Always Fierce | Restless |
|-------|---------------|--------------|----------|
| idle | amp +0, spikes 0 | amp +0.15, spikes 4-6 | amp cycles 0-0.2, spikes 2-5 |
| thinking | amp +0.3, spikes 5-8 | amp +0.35, spikes 6-10 | amp cycles 0.2-0.4, spikes 5-9 |
| responding | amp +0.5, spikes 8-12 | amp +0.5, spikes 10-14 | amp cycles 0.3-0.5, spikes 8-13 |

**Mouse interaction:**
- Same follow-cursor behavior as other shapes (lerp toward mouse)
- Spikes nearest to cursor reach slightly toward it (attraction effect)

**Persistence:**
- Shape selection already persists via localStorage (`roweos_blob_shape`) and syncs to Firestore
- Add `spikeMode` field: `localStorage.setItem('roweos_blob_spike_mode', mode)`
- Sync via `syncLifeAIToFirestore({ blobSpikeMode: mode })` (uses the v26.4 sync layer)

**Performance:**
- Same IcosahedronGeometry(1, 5) as other shapes -- spike effect is purely vertex shader math, no extra geometry
- No performance difference from existing blob presets

### Section 3: Vertex Shader Spike Algorithm

**Spike extrusion pipeline:**

1. **Base noise** -- multi-octave Simplex noise, higher amplitude/frequency than other presets
2. **Spike selection** -- vertices where noise exceeds a threshold become spike candidates
3. **Spike shaping** -- selected vertices pushed outward exponentially, neighbors fall off sharply (taper-to-point)
4. **Spike animation** -- each spike has lifecycle: grow ~0.5s, hold, retract ~0.3s. New spikes emerge as old ones retract.
5. **Spike curl** -- tips curve slightly via tangential offset at max extension (organic Venom tendril feel)

**Uniform inputs:**
```glsl
uniform float uSpikeThreshold;  // noise cutoff for spike activation (0.3-0.7)
uniform float uSpikeLength;     // max extension multiplier (1.5-4.0)
uniform float uSpikeTaper;      // how sharply spikes taper (2.0-6.0)
uniform float uSpikeCurl;       // tangential curl at tips (0.0-0.5)
uniform float uSpikeCount;      // approximate target spike count (controls threshold)
```

**Fragment shader:**
- Glossy black PBR-like material replacing current Fresnel + SSS for this preset
- High specular reflection (wet/organic look)
- Subsurface scattering tinted by accent color (default cream `#f0ece6`)
- Dark base color `#0a0a0f` with subtle noise texture for organic grain
- Environment map approximation using view-angle-based gradient (no cubemap needed)

---

## Files Modified

- `/Volumes/roweOS/RoweOS/dist/index.html` -- all changes (monolithic file)

## Key Areas Affected

| Area | Change |
|------|--------|
| Blob shape presets array | Add symbiote entry |
| Blob vertex shader | Add spike extrusion pass (conditional on shape) |
| Blob fragment shader | Add glossy black PBR material path |
| `initBlob()` | Add symbiote-specific uniforms |
| Blob animation loop | Add spike lifecycle management, spike-mode state modifiers |
| Shape selector UI (onboarding) | Add 6th button + tendril behavior sub-option |
| Shape selector UI (settings) | Same additions |
| `setBlobState()` | Add symbiote-specific modifier calculations per spike mode |
| Blob preview canvas (settings) | Support symbiote rendering |
| localStorage / Firestore sync | Add `blobSpikeMode` field |
| `loadFromFirebaseV2` | Restore `blobSpikeMode` |
| blake.html playground | Add symbiote shape option |

## Testing Checklist

- [ ] Select Symbiote in onboarding -- organism renders with spikes
- [ ] Select Symbiote in settings -- organism renders, preview works
- [ ] Switch between tendril modes (Calm/Fierce/Restless) -- behavior changes visually
- [ ] Trigger thinking state -- spikes intensify appropriately per mode
- [ ] Trigger responding state -- spikes at maximum per mode
- [ ] Return to idle -- spikes reduce per mode
- [ ] Mouse interaction -- spikes near cursor reach toward it
- [ ] Default accent (gold) -- cream/white highlights
- [ ] Custom accent (e.g., neon) -- highlights tinted with accent
- [ ] Switch from symbiote to another shape -- clean transition, no artifacts
- [ ] Switch from another shape to symbiote -- clean transition
- [ ] Reload -- shape and spike mode persist
- [ ] Cross-device -- shape and spike mode sync via Firestore
- [ ] Performance -- no frame drops compared to crystal preset
- [ ] Light mode -- organism still looks good (dark body on light bg)
- [ ] blake.html playground -- symbiote selectable and interactive
