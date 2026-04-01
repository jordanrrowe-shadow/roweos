# Theme, Brand Switch, and API Status Bugfix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three persistent bugs: theme resetting to dark on reload, Identity view not updating on brand switch, and API key diamond not filling on startup.

**Architecture:** All three bugs stem from async race conditions where cloud data overwrites local state after the UI has already rendered. The fixes unify localStorage key usage, eliminate stale-ID brand resolution, and ensure API status re-checks after every cloud sync path completes.

**Tech Stack:** Vanilla JS (ES5), Firebase Firestore, localStorage

---

## Root Cause Analysis

### Bug 1: Theme resets to dark
- `loadTheme()` correctly applies light mode from localStorage
- Then `reconcileOnStartup()` → `loadFromFirebaseV2()` reads `profile/main.settings.theme` from Firestore
- If Firestore has `'dark'` (stale from old session), it overwrites localStorage AND removes `light-mode` class
- The 30s grace period is too short — user may reload 31s+ after toggling
- V4 `fieldMerge()` has NO grace period at all
- `writeDB('profile/main', {settings: {theme}})` is async and may not complete before next reload

### Bug 2: Identity view + logo don't update on brand switch
- `selectSidebarBrand(idx)` correctly sets `selectedBrand = idx` and calls `onBrandChange()`
- Previous fix removed stale ID pre-resolution in `onBrandChange()` — this is confirmed present
- **Real issue:** `getCurrentLogoKey()` (line 72028) uses brand ID-based keys (`roweos_brandlogo_BRANDID`) but the actual logo data is stored under OLD index-based keys (`roweos_brand_INDEX_logo`). The migration from index→ID in getCurrentLogoKey doesn't cover all cases.
- Additionally, `enterFromWelcome()` (welcome screen) uses a DIFFERENT code path that doesn't trigger full brand view refresh

### Bug 3: API diamond not filled on startup
- `checkApiConnection()` runs in `init()` BEFORE Firebase auth resolves
- At that point, `roweos_api_keys` may be empty in localStorage (keys come from cloud)
- Auth resolves → `reconcileOnStartup()` → `loadFromFirebaseV2()` loads keys → our v28.2 fix calls `checkApiConnection(true)` ← THIS IS CORRECT
- **Real issue:** The V2 secure/api_keys path only syncs keys when `cloudSchedulerEnabled` is true (line 138443). If scheduler isn't enabled, keys DON'T sync from that path. Keys might only exist in `settings/api_keys` (V4 path) which only runs when `syncEngine.isV4Active() && !profileDoc.exists`.
- Also: `updateProviderStatuses()` reads fresh from localStorage but uses stale `apiKeys` global for some sections

---

### Task 1: Fix theme persistence — make local theme authoritative over cloud

**Files:**
- Modify: `RoweOS/dist/index.html` — theme toggle, cloud pull, real-time listener, V4 merge

**Approach:** Instead of a grace period (fragile timing), make **local theme always authoritative**. Theme is a device-level preference — each device should keep its own theme. Cloud theme sync should only apply on FIRST load (no local preference set yet), not on every pull.

- [ ] **Step 1: Replace grace period logic in loadFromFirebaseV2 with "first-load only" check**

Find the block at approximately line 138387 (search for `v28.2: Only apply cloud theme if user hasn't toggled recently`):

```javascript
// REPLACE the entire theme block with:
      // v28.3: Cloud theme only applies on first load (no local preference yet)
      // Theme is device-local — user's toggle is always authoritative
      if (profile.settings && profile.settings.theme) {
        var _hasLocalTheme = localStorage.getItem('roweos-theme');
        if (!_hasLocalTheme) {
          // First load on this device — use cloud theme
          localStorage.setItem('roweos_theme', profile.settings.theme);
          localStorage.setItem('roweos-theme', profile.settings.theme);
          if (profile.settings.theme === 'light') {
            document.documentElement.classList.add('light-mode');
          } else {
            document.documentElement.classList.remove('light-mode');
          }
        }
      }
```

- [ ] **Step 2: Replace grace period logic in setupRealtimeSync listener**

Find the block at approximately line 132388 (search for `v28.2: Only apply cloud theme if user hasn't toggled locally within 30s`):

```javascript
// REPLACE with:
      // v28.3: Don't apply cloud theme — theme is device-local
      // Cloud theme only used for first-load (handled in loadFromFirebaseV2)
```

(Remove the entire theme block from the real-time listener — theme should never be overwritten by cross-device sync)

- [ ] **Step 3: Ensure toggleTheme still writes to Firestore for first-load on new devices**

The existing `writeDB('profile/main', { settings: { theme: _themeVal } })` in `toggleTheme()` is correct — keep it. This ensures new devices can pick up the preference on first load.

- [ ] **Step 4: Handle V4 fieldMerge for theme**

Search for `syncEngine.watchDoc('settings/main'` and the `fieldMerge` function. Add theme to a skip list:

In the `fieldMerge` function (around line 63813), add at the top:
```javascript
// v28.3: Theme is device-local, never overwrite from cloud merge
if (field === 'theme') continue;
```

- [ ] **Step 5: Remove the grace period timestamp code**

Remove `localStorage.setItem('roweos_theme_toggled_at', ...)` from `toggleTheme()` — no longer needed.

- [ ] **Step 6: Deploy and verify**

```bash
./deploy.sh
```
Verify: Toggle to light mode → reload → should stay light.

---

### Task 2: Fix Identity view and logo not updating on brand switch

**Files:**
- Modify: `RoweOS/dist/index.html` — getCurrentLogoKey, selectSidebarBrand, enterFromWelcome

**Approach:** The logo key format changed in v29 from index-based to ID-based, but `getCurrentLogoKey()` has a migration path that may not find the correct old key. Fix by ensuring the logo lookup checks BOTH key formats. Also fix the welcome screen path.

- [ ] **Step 1: Fix getCurrentLogoKey to reliably find logo data**

Find `getCurrentLogoKey()` (around line 72028). Read the full function. The function should:
1. Try the new ID-based key first: `roweos_brandlogo_BRANDID`
2. Fall back to the old index key: `roweos_brand_INDEX_logo`
3. Return whichever key has actual data

```javascript
function getCurrentLogoKey() {
  var mode = getCurrentMode();
  if (mode === 'life') {
    var lifeIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
    return 'roweos_lifeai_logo_profile_' + lifeIdx;
  }
  var brandIdx = selectedBrand;
  if (typeof brandIdx !== 'number' || isNaN(brandIdx) || brandIdx < 0) brandIdx = 0;
  var brand = brands[brandIdx];
  // v28.3: Try ID-based key first, fall back to index-based
  if (brand && brand.id) {
    var idKey = 'roweos_brandlogo_' + brand.id;
    if (localStorage.getItem(idKey)) return idKey;
  }
  // Fallback: index-based key (pre-v29)
  var indexKey = 'roweos_brand_' + brandIdx + '_logo';
  if (localStorage.getItem(indexKey)) return indexKey;
  // Return ID-based key for new saves even if empty
  if (brand && brand.id) return 'roweos_brandlogo_' + brand.id;
  return indexKey;
}
```

- [ ] **Step 2: Fix enterFromWelcome to trigger full brand refresh**

Find `enterFromWelcome()` (around line 78867). After it sets the brand, ensure it calls `selectSidebarBrand()` for a full refresh:

Add after the brand selection logic:
```javascript
// v28.3: Trigger full brand change including logo and sidebar update
var _welBrandIdx = getBrandIndex(getSelectedBrandId());
var brandSelect = document.getElementById('brand');
if (brandSelect) brandSelect.value = _welBrandIdx;
onBrandChange();
if (typeof initBrandLogo === 'function') initBrandLogo();
```

- [ ] **Step 3: Ensure selectSidebarBrand logo refresh uses correct key**

The existing belt-and-suspenders code at the end of `selectSidebarBrand` calls `initBrandLogo()` and `loadCurrentLogo()`. With the `getCurrentLogoKey()` fix in Step 1, these should now find the correct logo. No additional changes needed here.

- [ ] **Step 4: Deploy and verify**

```bash
./deploy.sh
```
Verify: On Identity view, switch brands via sidebar dropdown → Identity title, tagline, and sidebar logo should all update immediately.

---

### Task 3: Fix API key diamond not filling on startup

**Files:**
- Modify: `RoweOS/dist/index.html` — onAuthStateChanged callback, checkApiConnection

**Approach:** The diamond renders empty because `checkApiConnection()` runs before auth resolves. Move the API check to run AFTER auth resolves, and add a deferred re-check after cloud sync.

- [ ] **Step 1: Add checkApiConnection call inside onAuthStateChanged**

Find `firebase.auth().onAuthStateChanged` (around line 129454). After `firebaseUser` is set and before `reconcileOnStartup()`, add:

```javascript
// v28.3: Immediately check API keys once auth resolves — keys may already be in localStorage
if (typeof checkApiConnection === 'function') {
  checkApiConnection().then(function() {
    if (typeof updateProviderStatuses === 'function') updateProviderStatuses();
  });
}
```

- [ ] **Step 2: Fix the V2 key sync guard — don't require cloudSchedulerEnabled**

Find the V2 path at approximately line 138440 (search for `secure/api_keys`). The key sync is gated by `secData.cloudSchedulerEnabled`. Keys should sync regardless:

```javascript
// Change from:
if (secData.cloudSchedulerEnabled) {
  // ... sync keys
}

// To:
// v28.3: Always sync API keys cross-device, not just when scheduler enabled
{
  localStorage.setItem('roweos_cloud_scheduler', secData.cloudSchedulerEnabled ? 'true' : 'false');
  if (secData.cloudSchedulerEnabled && typeof updateCloudSchedulerUI === 'function') updateCloudSchedulerUI(true);
  // Cross-device API key sync
  try {
    var localKeys = {};
    try { localKeys = JSON.parse(localStorage.getItem('roweos_api_keys') || '{}'); } catch(e) {}
    var updated = false;
    if (secData.anthropic && !localKeys.anthropic) { localKeys.anthropic = secData.anthropic; updated = true; }
    if (secData.openai && !localKeys.openai) { localKeys.openai = secData.openai; updated = true; }
    if (secData.google && !localKeys.google) { localKeys.google = secData.google; updated = true; }
    if (updated) {
      localStorage.setItem('roweos_api_keys', JSON.stringify(localKeys));
      if (typeof checkApiConnection === 'function') checkApiConnection(true);
      if (typeof updateProviderStatuses === 'function') updateProviderStatuses();
    }
  } catch(e) {}
}
```

- [ ] **Step 3: Fix updateProviderStatuses to not use stale apiKeys global**

Find `updateProviderStatuses()` (around line 165398). Replace uses of the stale `apiKeys` global with fresh localStorage reads:

```javascript
// Replace: var hasGoogleKey = !!apiKeys.google;
// With: var hasGoogleKey = _actualKeys.google;

// Replace: if (apiKeys.anthropic) connectedCount++;
// With: if (_actualKeys.anthropic) connectedCount++;
// (same for openai and google)
```

- [ ] **Step 4: Deploy and verify**

```bash
./deploy.sh
```
Verify: Hard reload → diamond should fill within 2-3 seconds (after auth + cloud sync). AI & Models page should show correct status without needing "Refresh API Status".

---

### Task 4: Final verification and cleanup

- [ ] **Step 1: Test all three fixes together**

1. Toggle to light mode → reload → stays light ✓
2. Switch brand in sidebar while on Identity → title, tagline, logo all update ✓
3. Hard reload → diamond fills automatically within seconds ✓
4. Open AI & Models → shows correct connected/disconnected status ✓

- [ ] **Step 2: Clean up old grace period code**

Remove any remaining `roweos_theme_toggled_at` references.

- [ ] **Step 3: Deploy final version**

```bash
./deploy.sh
```
