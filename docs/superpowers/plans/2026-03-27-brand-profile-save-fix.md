# Brand & Life Profile Save Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the race condition where cloud sync overwrites freshly saved brands and life profiles by replacing blind overwrites with timestamp-based merging.

**Architecture:** Add stable `id` and `_modifiedAt` fields to all brand objects, then replace `safeSyncWrite` calls for brands and life profiles with `mergeByTimestamp`-based merging. Also fix a key typo in `saveWebSearchResults()`.

**Tech Stack:** Vanilla JS (ES5), Firebase Firestore, localStorage

**File:** All changes in `/Volumes/roweOS/RoweOS/dist/index.html`

**Spec:** `docs/superpowers/specs/2026-03-27-brand-profile-save-fix-design.md`

---

### Task 1: Add `id` + `_modifiedAt` to brand creation in `completeBrandSetup()`

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:143582-143630`

- [ ] **Step 1: Add `id`, `_modifiedAt`, `_createdAt` to the new brand object**

At line 143583, where `var newBrand = {` begins, add these three fields at the top of the object literal:

```js
  var newBrand = {
    id: 'brand_' + Date.now(),
    _modifiedAt: Date.now(),
    _createdAt: Date.now(),
    name: brandName,
```

The rest of the object stays the same. Insert the three new lines right after `var newBrand = {` and before `name: brandName,`.

- [ ] **Step 2: Verify no syntax errors**

Open the browser console, reload the app, and confirm no JS parse errors. The onboarding flow should still render.

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "fix: add stable id + timestamps to brand creation in completeBrandSetup"
```

---

### Task 2: Add `id` + `_modifiedAt` to brand creation in `saveWebSearchResults()`

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:159227-159253`

- [ ] **Step 1: Add `id`, `_modifiedAt`, `_createdAt` to the web-search brand object**

At line 159227, where `brand = {` begins inside the `if (!brand)` block, add three fields at the top:

```js
      brand = {
        id: 'brand_' + Date.now(),
        _modifiedAt: Date.now(),
        _createdAt: Date.now(),
        name: brandName,
```

The rest of the object stays the same.

- [ ] **Step 2: Fix the brandSettings key typo**

At line 159251, replace:

```js
          try { localStorage.setItem('roweos_brand_settings', JSON.stringify(brandSettings)); } catch(e) {}
```

With:

```js
          try { localStorage.setItem(USER_DATA_KEYS.brandSettings, JSON.stringify(brandSettings)); } catch(e) {}
```

- [ ] **Step 3: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "fix: add id+timestamps to web-search brand creation, fix brandSettings key typo"
```

---

### Task 3: Add `id` + `_modifiedAt` to all other brand creation sites

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html` at lines ~160147, ~160434, ~162002, ~82683

- [ ] **Step 1: Template-based brand creation (~line 160147)**

Find the brand object literal that ends around line 160154 with `contacts: contact || ''`. Add `id`, `_modifiedAt`, `_createdAt` at the top of that object. Look for the `var newBrand = {` just above and add:

```js
    id: 'brand_' + Date.now(),
    _modifiedAt: Date.now(),
    _createdAt: Date.now(),
```

As the first three properties.

- [ ] **Step 2: Default/fallback brand creation (~line 160434)**

Find the brand object around line 160434 (the one with `name: 'My Brand'`). Add the same three fields:

```js
      id: 'brand_' + Date.now(),
      _modifiedAt: Date.now(),
      _createdAt: Date.now(),
```

As the first three properties of that object literal.

- [ ] **Step 3: Add Brand from memory view (~line 162002)**

Find the brand object around line 162002 (the one near `brands.push(newBrand)` at line 162011). Add the same three fields as the first properties.

- [ ] **Step 4: Restored brand from trash (~line 82683)**

After line 82683 (`brand.name = brand.name + ' (Restored)';`), add:

```js
    brand._modifiedAt = Date.now();
    if (!brand.id) brand.id = 'brand_' + Date.now();
```

This handles the case where a restored brand might not have an `id` (pre-migration brand).

- [ ] **Step 5: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "fix: add id+timestamps to all remaining brand creation paths"
```

---

### Task 4: Stamp `_modifiedAt` in `saveBrands()` and backfill `id`

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:63237-63266`

- [ ] **Step 1: Add `_modifiedAt` stamp and `id` backfill to `saveBrands()`**

Replace the entire `saveBrands()` function (lines 63237-63266) with:

```js
function saveBrands() {
  try {
    // Backfill id and stamp _modifiedAt on every brand before persisting
    var now = Date.now();
    for (var i = 0; i < brands.length; i++) {
      if (!brands[i].id) brands[i].id = 'brand_' + now + '_' + i;
      brands[i]._modifiedAt = now;
    }
    localStorage.setItem(USER_DATA_KEYS.brands, JSON.stringify(brands));
    // v23.0: Stamp brandSettings modification time whenever brands are saved
    try {
      var _bs = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brandSettings) || '{}');
      _bs._modifiedAt = now;
      localStorage.setItem(USER_DATA_KEYS.brandSettings, JSON.stringify(_bs));
    } catch(_bse) {}
    // v11.0.5: Track local save time to prevent same-device reload glitch
    stampLocalSave();
    console.log('[saveBrands] Saved', brands.length, 'brands to localStorage');
    // v25.1: Write-through -- sync each brand individually (no category gate, always synced)
    if (typeof brands !== 'undefined' && brands.length > 0) {
      brands.forEach(function(brand, idx) {
        var data = JSON.parse(JSON.stringify(brand));
        // Strip base64 data URLs to avoid Firestore 1MB limit
        Object.keys(data).forEach(function(k) {
          if (typeof data[k] === 'string' && data[k].indexOf('data:') === 0 && data[k].length > 50000) {
            data[k] = '';
          }
        });
        // Use in-memory _modifiedAt (already an ISO string or epoch) for Firestore doc
        data._modifiedAt = new Date(brand._modifiedAt || now).toISOString();
        writeDBDoc('brands', String(idx), data);
      });
    }
  } catch (e) {
    console.error('[saveBrands] Error saving brands:', e);
  }
}
```

Key changes vs original:
- Backfills `id` on any brand that doesn't have one
- Stamps `_modifiedAt` on every in-memory brand (not just the Firestore clone)
- Firestore doc uses ISO string derived from the in-memory epoch value

- [ ] **Step 2: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "fix: saveBrands stamps _modifiedAt on in-memory brands and backfills id"
```

---

### Task 5: Backfill `id` on brands in `loadBrands()`

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:63353-63370`

- [ ] **Step 1: Add id backfill after parsing brands from localStorage**

After line 63362 (`console.log('loadBrands: Parsed', parsed.length, 'brands');`) and before line 63365 (`brands.length = 0;`), insert:

```js
      // Backfill stable id on legacy brands (needed for mergeByTimestamp)
      var _needsIdSave = false;
      for (var _bi = 0; _bi < parsed.length; _bi++) {
        if (!parsed[_bi].id) {
          parsed[_bi].id = 'brand_' + Date.now() + '_' + _bi;
          _needsIdSave = true;
        }
      }
      if (_needsIdSave) {
        localStorage.setItem(USER_DATA_KEYS.brands, JSON.stringify(parsed));
        console.log('[loadBrands] Backfilled missing brand IDs');
      }
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "fix: backfill stable id on legacy brands at load time"
```

---

### Task 6: Replace `safeSyncWrite` with `mergeByTimestamp` for brands in realtime listener

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:130068-130076`

- [ ] **Step 1: Replace the brands realtime listener body**

Find the brands realtime `onSnapshot` handler. Replace lines 130068-130076:

```js
      console.log('[Firebase V3] Brands update from cloud -', snapshot.size, 'brands');
      var brandsArr = [];
      snapshot.forEach(function(doc) { brandsArr.push(doc.data()); });
      safeSyncWrite(USER_DATA_KEYS.brands, brandsArr);
      // Update in-memory brands array
      if (typeof brands !== 'undefined') {
        brands.length = 0;
        for (var bi = 0; bi < brandsArr.length; bi++) { brands.push(brandsArr[bi]); }
      }
```

With:

```js
      console.log('[Firebase V3] Brands update from cloud -', snapshot.size, 'brands');
      var brandsArr = [];
      snapshot.forEach(function(doc) { brandsArr.push(doc.data()); });
      // v27.0: Merge instead of overwrite -- preserves locally-created brands not yet in cloud
      var _localBrandsForMerge = [];
      try { _localBrandsForMerge = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brands) || '[]'); } catch(e) {}
      // Backfill id on cloud brands that predate the migration
      for (var _cbi = 0; _cbi < brandsArr.length; _cbi++) {
        if (!brandsArr[_cbi].id) brandsArr[_cbi].id = 'brand_cloud_' + _cbi;
      }
      for (var _lbi = 0; _lbi < _localBrandsForMerge.length; _lbi++) {
        if (!_localBrandsForMerge[_lbi].id) _localBrandsForMerge[_lbi].id = 'brand_local_' + _lbi;
      }
      var _mergedBrands = mergeByTimestamp(_localBrandsForMerge, brandsArr, 'id');
      localStorage.setItem(USER_DATA_KEYS.brands, JSON.stringify(_mergedBrands));
      // Update in-memory brands array
      if (typeof brands !== 'undefined') {
        brands.length = 0;
        for (var bi = 0; bi < _mergedBrands.length; bi++) { brands.push(_mergedBrands[bi]); }
      }
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "fix: brands realtime listener uses mergeByTimestamp instead of blind overwrite"
```

---

### Task 7: Replace `safeSyncWrite` with `mergeByTimestamp` for brands in `loadFromFirebaseV2`

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:136119-136126`

- [ ] **Step 1: Replace the brands section in `loadFromFirebaseV2`**

Replace lines 136119-136126:

```js
    // Brands — v25.0: Firestore is truth, use safeSyncWrite
    if (!brandsSnap.empty) {
      var cloudBrands = [];
      brandsSnap.forEach(function(doc) { cloudBrands.push(doc.data()); });
      if (cloudBrands.length > 0) {
        safeSyncWrite(USER_DATA_KEYS.brands, cloudBrands);
      }
    }
```

With:

```js
    // Brands — v27.0: Merge cloud with local instead of blind overwrite
    if (!brandsSnap.empty) {
      var cloudBrands = [];
      brandsSnap.forEach(function(doc) { cloudBrands.push(doc.data()); });
      if (cloudBrands.length > 0) {
        var _localBrandsV2 = [];
        try { _localBrandsV2 = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brands) || '[]'); } catch(e) {}
        // Backfill id on any brands that predate the migration
        for (var _cb2 = 0; _cb2 < cloudBrands.length; _cb2++) {
          if (!cloudBrands[_cb2].id) cloudBrands[_cb2].id = 'brand_cloud_' + _cb2;
        }
        for (var _lb2 = 0; _lb2 < _localBrandsV2.length; _lb2++) {
          if (!_localBrandsV2[_lb2].id) _localBrandsV2[_lb2].id = 'brand_local_' + _lb2;
        }
        var _mergedBrandsV2 = mergeByTimestamp(_localBrandsV2, cloudBrands, 'id');
        localStorage.setItem(USER_DATA_KEYS.brands, JSON.stringify(_mergedBrandsV2));
        // Also update in-memory brands array
        if (typeof brands !== 'undefined') {
          brands.length = 0;
          for (var _mb2 = 0; _mb2 < _mergedBrandsV2.length; _mb2++) { brands.push(_mergedBrandsV2[_mb2]); }
        }
      }
    }
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "fix: loadFromFirebaseV2 merges brands instead of overwriting"
```

---

### Task 8: Replace `safeSyncWrite` with `mergeByTimestamp` for life profiles in `loadFromFirebaseV2`

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:136278`

- [ ] **Step 1: Replace the life profiles line in `loadFromFirebaseV2`**

Replace line 136278:

```js
      if (life.profiles) safeSyncWrite('roweos_life_profiles', life.profiles);
```

With:

```js
      // v27.0: Merge life profiles instead of blind overwrite
      if (life.profiles) {
        var _localLifeProfiles = [];
        try { _localLifeProfiles = JSON.parse(localStorage.getItem('roweos_life_profiles') || '[]'); } catch(e) {}
        // Backfill id on cloud profiles that may predate migration
        for (var _clp = 0; _clp < (life.profiles || []).length; _clp++) {
          if (!life.profiles[_clp].id) life.profiles[_clp].id = 'life_cloud_' + _clp;
        }
        for (var _llp = 0; _llp < _localLifeProfiles.length; _llp++) {
          if (!_localLifeProfiles[_llp].id) _localLifeProfiles[_llp].id = 'life_local_' + _llp;
        }
        var _mergedLifeProfiles = mergeByTimestamp(_localLifeProfiles, life.profiles, 'id');
        localStorage.setItem('roweos_life_profiles', JSON.stringify(_mergedLifeProfiles));
      }
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "fix: loadFromFirebaseV2 merges life profiles instead of overwriting"
```

---

### Task 9: Stamp `_modifiedAt` on life profiles in `saveLifeProfiles()`

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:140037-140054`

- [ ] **Step 1: Add `_modifiedAt` stamping before localStorage write**

Replace lines 140037-140054:

```js
function saveLifeProfiles(profiles) {
  localStorage.setItem('roweos_life_profiles', JSON.stringify(profiles));

  // Also update single profile for compatibility
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  if (profiles[currentIdx]) {
    localStorage.setItem('roweos_life_profile', JSON.stringify(profiles[currentIdx]));
    localStorage.setItem('roweos_user_name', profiles[currentIdx].name || 'My Life');
  }

  // v26.4: Single sync path to Firestore (replaces dual Realtime DB + Firestore writes)
  syncLifeAIToFirestore({
    profiles: profiles,
    currentProfileIdx: parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0'),
    userName: localStorage.getItem('roweos_user_name') || 'My Life',
    appMode: localStorage.getItem('roweos_app_mode') || 'brand'
  });
}
```

With:

```js
function saveLifeProfiles(profiles) {
  // v27.0: Stamp _modifiedAt and backfill id on every profile before persisting
  var now = Date.now();
  for (var _spi = 0; _spi < profiles.length; _spi++) {
    profiles[_spi]._modifiedAt = now;
    if (!profiles[_spi].id) profiles[_spi].id = 'life_' + now + '_' + _spi;
  }

  localStorage.setItem('roweos_life_profiles', JSON.stringify(profiles));

  // Also update single profile for compatibility
  var currentIdx = parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0');
  if (profiles[currentIdx]) {
    localStorage.setItem('roweos_life_profile', JSON.stringify(profiles[currentIdx]));
    localStorage.setItem('roweos_user_name', profiles[currentIdx].name || 'My Life');
  }

  // v26.4: Single sync path to Firestore (replaces dual Realtime DB + Firestore writes)
  syncLifeAIToFirestore({
    profiles: profiles,
    currentProfileIdx: parseInt(localStorage.getItem('roweos_current_life_profile_idx') || '0'),
    userName: localStorage.getItem('roweos_user_name') || 'My Life',
    appMode: localStorage.getItem('roweos_app_mode') || 'brand'
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd /Volumes/roweOS && git add RoweOS/dist/index.html && git commit -m "fix: saveLifeProfiles stamps _modifiedAt and backfills id on all profiles"
```

---

### Task 10: Manual verification

- [ ] **Step 1: Test brand creation via onboarding wizard**

1. Clear localStorage (`localStorage.clear()` in console, then reload)
2. Sign in with Firebase
3. Complete onboarding: pick Brand mode, fill in brand basics, voice, audience
4. After Step 11 (Ready), check console for `[saveBrands] Saved 1 brands`
5. Reload the page
6. Verify the brand still exists (check sidebar dropdown, or `JSON.parse(localStorage.getItem('roweos_user_brands'))`)
7. Verify brand has `id` and `_modifiedAt` fields

- [ ] **Step 2: Test brand creation via web search**

1. Start onboarding, choose web search import
2. Enter a URL, let it complete all 5 stages
3. After save, check `JSON.parse(localStorage.getItem('roweos_user_brands'))` -- brand should have `id`, `_modifiedAt`, and `identityData` sections
4. Reload and verify brand persists
5. Check brandSettings: `JSON.parse(localStorage.getItem('roweos_user_brand_settings'))` -- the new brand index should have provider/model

- [ ] **Step 3: Test life profile creation**

1. Switch to Life AI mode
2. Create a new life profile via onboarding wizard
3. After completion, check `JSON.parse(localStorage.getItem('roweos_life_profiles'))` -- profile should have `id` and `_modifiedAt`
4. Reload and verify profile persists

- [ ] **Step 4: Test that existing brands survive the migration**

1. If you have existing brands from before this fix, verify they still load correctly
2. Check that `loadBrands()` logs `Backfilled missing brand IDs` on first load
3. After first save, verify all brands have `id` fields

- [ ] **Step 5: Final commit**

```bash
cd /Volumes/roweOS && git add -A && git commit -m "fix: brand and life profile save -- optimistic merge replaces blind cloud overwrite"
```
