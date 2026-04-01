# Brand Sync: ID-Based Selection Fix - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 brand management bugs by replacing index-based brand selection/storage with ID-based lookups, eliminating the destructive periodic sort, and adding dedup/delete guards.

**Architecture:** All brand selection, logo storage, and UI click handlers switch from array index to stable brand ID (`brand_name_*`). A `getBrandById(id)` helper resolves the current index at render time. The 3-second setInterval sort is removed. Sync listener gets dedup by name. `_all` doc merge protects against shrinking.

**Tech Stack:** Vanilla JS (ES5), localStorage, Firestore real-time listeners. Single-file app at `/Volumes/roweOS/RoweOS/dist/index.html`.

**Spec:** `/Volumes/roweOS/docs/superpowers/specs/2026-03-28-brand-sync-id-based-selection-design.md`

---

### Task 1: Kill the Periodic Sort and Add Helper Functions

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:64072-64080` (remove setInterval)
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:66682` (near selectedBrand declaration, add helpers)

- [ ] **Step 1: Remove the 3-second setInterval sort**

Find and delete lines 64072-64080:
```javascript
// DELETE THIS ENTIRE BLOCK:
setInterval(function() {
  try {
    var _bArr = JSON.parse(localStorage.getItem('roweos_user_brands') || '[]');
    if (_bArr.length > 0 && typeof _bArr[0]._order === 'number') {
      _bArr.sort(function(a, b) { return (a._order || 0) - (b._order || 0); });
      localStorage.setItem('roweos_user_brands', JSON.stringify(_bArr));
    }
  } catch(e) {}
}, 3000);
```

- [ ] **Step 2: Add `getBrandIndex` and `getSelectedBrandId` helpers**

Insert after `var selectedBrand = 0;` (line ~66682):
```javascript
// v29.0: ID-based brand selection helpers
function getBrandIndex(brandId) {
  if (!brandId) return 0;
  for (var i = 0; i < brands.length; i++) {
    if (brands[i] && brands[i].id === brandId) return i;
  }
  return 0;
}

function getSelectedBrandId() {
  return localStorage.getItem('roweos_selected_brand_id') || (brands[0] && brands[0].id) || '';
}

function setSelectedBrand(brandId) {
  localStorage.setItem('roweos_selected_brand_id', brandId);
  var idx = getBrandIndex(brandId);
  selectedBrand = idx;
  localStorage.setItem('roweos_selected_brand', String(idx));
}
```

- [ ] **Step 3: Verify no JS errors on load**

Open the app in browser, check console for errors. Brands should still load and display (order may differ from before since periodic sort is gone -- that's expected).

---

### Task 2: Fix `createNewBrand` -- Stable ID at Creation

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:165636-165689` (createNewBrand)
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:64748-64760` (saveBrands ID backfill)

- [ ] **Step 1: Generate stable ID in createNewBrand**

In `createNewBrand()` (~line 165663), change the brand ID from timestamp to name-based:
```javascript
// FIND (line ~165663):
id: 'brand_' + Date.now(),

// REPLACE WITH:
id: 'brand_name_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
```

- [ ] **Step 2: Add dedup check in createNewBrand before push**

After the duplicate name check (~line 165652) and before `brands.push(newBrand)` (~line 165683), add:
```javascript
    // v29.0: Dedup -- check if brand with same name already exists
    var _dupId = 'brand_name_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    for (var _di = 0; _di < brands.length; _di++) {
      if (brands[_di].id === _dupId) {
        showToast('Brand "' + name + '" already exists', 'warning');
        return;
      }
    }
```

- [ ] **Step 3: Remove saveBrands ID backfill loop**

In `saveBrands()` (~lines 64754-64757), find and remove the ID backfill:
```javascript
// DELETE THIS BLOCK in saveBrands():
var _nameId = 'brand_name_' + (brands[i].name || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
if (!brands[i].id || brands[i].id.indexOf('brand_name_') !== 0) {
  brands[i].id = _nameId;
}
```

Keep the `loadBrands()` backfill (line ~64989) as a migration path for old brands that still have temp IDs.

- [ ] **Step 4: Test brand creation**

Create a new test brand. Verify:
- Only one copy appears in the brand list
- The brand has a `brand_name_*` ID immediately (check localStorage `roweos_user_brands`)
- No duplicate appears after a few seconds (sync listener doesn't re-add)

---

### Task 3: Fix `selectBrandFromDropdown` and `enterFromWelcome` -- ID-Based

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:72489-72531` (selectBrandFromDropdown)
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:78742-78760` (enterFromWelcome)
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:78688-78731` (welcome card/pill rendering)
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:63020-63023` (registerAction select-brand)

- [ ] **Step 1: Update selectBrandFromDropdown to accept ID or index**

Replace the function (~line 72489):
```javascript
function selectBrandFromDropdown(idxOrId) {
  // v29.0: Accept brand ID (string) or index (number) for backwards compat
  var idx;
  if (typeof idxOrId === 'string' && idxOrId.indexOf('brand_') === 0) {
    idx = getBrandIndex(idxOrId);
  } else {
    idx = parseInt(idxOrId, 10) || 0;
  }
  var brandSelect = document.getElementById('brand');
  var agentBrandInput = document.getElementById('agentBrand');

  if (brandSelect) brandSelect.value = idx;
  if (agentBrandInput) agentBrandInput.value = idx;
```
Keep the rest of the function as-is. After the index is resolved, add:
```javascript
  // v29.0: Store selected brand by ID
  if (brands[idx] && brands[idx].id) {
    setSelectedBrand(brands[idx].id);
  }
```

- [ ] **Step 2: Update enterFromWelcome to pass brand ID**

In `enterFromWelcome` (~line 78755-78758), change:
```javascript
  if (mode === 'brand') {
    // v29.0: Store by ID, not just index
    var _brandObj = brands[idx];
    if (_brandObj && _brandObj.id) {
      setSelectedBrand(_brandObj.id);
    }
    window.lastActiveBrandIdx = idx;
    switchToBrandMode();
    showView('agent');
```

- [ ] **Step 3: Update welcome card/pill rendering to pass brand ID**

In the welcome card onclick (~line 78688), change from index to ID:
```javascript
// FIND (line ~78688):
onclick="enterFromWelcome(\'brand\', ' + primaryBrandIdx + ')"

// REPLACE WITH:
onclick="enterFromWelcome(\'brand\', ' + primaryBrandIdx + ')"
```
This still passes index to `enterFromWelcome` which is fine since Step 2 resolves to ID internally.

For the extra brand pills (~line 78730-78731), same pattern -- `enterFromWelcome` already handles index input and stores as ID now.

- [ ] **Step 4: Update registerAction 'select-brand' to use ID**

Find ~line 63020:
```javascript
// FIND:
registerAction('select-brand', function(data) {
  if (data.brand && typeof selectBrandFromDropdown === 'function') {
    selectBrandFromDropdown(parseInt(data.brand, 10));

// REPLACE WITH:
registerAction('select-brand', function(data) {
  if (data.brand && typeof selectBrandFromDropdown === 'function') {
    selectBrandFromDropdown(data.brand);  // v29.0: Accept ID or index
```

- [ ] **Step 5: Test brand selection**

Click different brands in the sidebar dropdown, welcome pills, and welcome cards. Verify:
- Correct brand loads every time
- `roweos_selected_brand_id` in localStorage matches the clicked brand
- Switching brands multiple times doesn't get "stuck" on wrong brand

---

### Task 4: Fix `onBrandChange` -- Resolve from ID

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:69463-69539` (onBrandChange)

- [ ] **Step 1: Add ID resolution at top of onBrandChange**

At the start of `onBrandChange()` (~line 69463), after the modal-close try/catch, add:
```javascript
  // v29.0: Resolve selectedBrand index from stored ID
  var _sbId = getSelectedBrandId();
  if (_sbId) {
    var _sbIdx = getBrandIndex(_sbId);
    selectedBrand = _sbIdx;
  }
```

- [ ] **Step 2: Ensure onBrandChange saves ID, not just index**

Find where `onBrandChange` stores selectedBrand (~line 69509). Verify this line exists:
```javascript
try { if (brands[brandIdx] && brands[brandIdx].id) localStorage.setItem('roweos_selected_brand_id', brands[brandIdx].id); } catch(e) {}
```
If it does, this is already correct. If not, add it after the index is determined.

- [ ] **Step 3: Test brand switching via sidebar**

Switch brands using the sidebar dropdown. Verify correct brand loads, identity page shows correct brand, and switching back and forth works reliably.

---

### Task 5: Fix Sync Listener -- Dedup by Name

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:63982-64012` (watchCollection brands handler)

- [ ] **Step 1: Add name-based dedup to watchCollection**

In the `watchCollection` function, replace the "not found, append" block (~lines 64009-64011):
```javascript
          } else {
            // v29.0: Dedup by name before appending (catches temp-ID-to-stable-ID rename race)
            var _isDup = false;
            if (collectionName === 'brands' && docData.name) {
              for (var _ddi = 0; _ddi < localArr.length; _ddi++) {
                if (localArr[_ddi].name && localArr[_ddi].name.toLowerCase() === docData.name.toLowerCase()) {
                  // Same brand, different ID -- update to cloud ID and merge
                  localArr[_ddi].id = docId;
                  var _mergeResult = syncEngine.fieldMerge(collectionName, docId, docData, localArr[_ddi]);
                  localArr[_ddi] = _mergeResult.merged;
                  _isDup = true;
                  break;
                }
              }
            }
            if (!_isDup) {
              localArr.push(docData);
            }
            localStorage.setItem(localStorageKey, JSON.stringify(localArr));
          }
```

- [ ] **Step 2: Test brand add doesn't duplicate**

Add a new brand. Wait 10 seconds. Verify:
- Only one copy in brand list
- Check `roweos_user_brands` in localStorage -- no duplicate names
- Check Firestore console if accessible -- single doc per brand

---

### Task 6: Protect `_all` Doc Merge from Shrinking

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:138458-138461` (loadFromFirebaseV2 _all doc)

- [ ] **Step 1: Add count guard to _all doc preference**

Find ~line 138458:
```javascript
// FIND:
    if (_allDoc && _allDoc.items && _allDoc.items.length > 0) {
      cloudBrands = _allDoc.items;

// REPLACE WITH:
    if (_allDoc && _allDoc.items && _allDoc.items.length > 0) {
      // v29.0: Only use _all doc if it has at least as many brands as local
      var _localBrandCount = 0;
      try { _localBrandCount = JSON.parse(localStorage.getItem('roweos_user_brands') || '[]').length; } catch(e) {}
      if (_allDoc.items.length >= _localBrandCount || _localBrandCount === 0) {
        cloudBrands = _allDoc.items;
        console.log('[Sync V3.1] Brands: using _all doc (' + cloudBrands.length + ' brands)');
      } else {
        console.warn('[Sync V3.1] _all doc has fewer brands (' + _allDoc.items.length + ') than local (' + _localBrandCount + ') -- using individual docs instead');
      }
```

- [ ] **Step 2: Verify brand count stability**

Reload the app several times. Verify brand count stays consistent and doesn't drop.

---

### Task 7: ID-Based Logo Storage

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:71983` (getBrandLogoKey / getCurrentLogoKey)
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:72198` (logo preview read)
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:78684` (welcome card logo)
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:84364-84365` (logo delete)
- Modify: Multiple other logo read sites

- [ ] **Step 1: Create ID-based logo key helper**

Find `getCurrentLogoKey` or the function returning `'roweos_brand_' + brandIdx + '_logo'` (~line 71983). Replace with:
```javascript
function getBrandLogoKeyById(brandId) {
  return 'roweos_brandlogo_' + (brandId || 'unknown');
}
function getCurrentLogoKey(brandIdx) {
  // v29.0: Use brand ID for logo key, fallback to index for migration
  if (typeof brandIdx === 'undefined') brandIdx = selectedBrand;
  var brand = brands[brandIdx];
  if (brand && brand.id) {
    var idKey = getBrandLogoKeyById(brand.id);
    // Migration: if new key doesn't exist but old index key does, copy over
    if (!localStorage.getItem(idKey)) {
      var oldKey = 'roweos_brand_' + brandIdx + '_logo';
      var oldLogo = localStorage.getItem(oldKey);
      if (oldLogo) {
        localStorage.setItem(idKey, oldLogo);
        var oldSize = localStorage.getItem('roweos_brand_' + brandIdx + '_logo_size');
        if (oldSize) localStorage.setItem(idKey + '_size', oldSize);
      }
    }
    return idKey;
  }
  return 'roweos_brand_' + brandIdx + '_logo';
}
```

- [ ] **Step 2: Update logo reads to use getCurrentLogoKey**

Search for all `localStorage.getItem('roweos_brand_' + brandIdx + '_logo')` patterns and replace with `localStorage.getItem(getCurrentLogoKey(brandIdx))`.

Key locations:
- Line ~72198: `var brandLogo = localStorage.getItem(getCurrentLogoKey(brandIdx));`
- Line ~78684: `var brandLogo = localStorage.getItem(getCurrentLogoKey(primaryBrandIdx));`
- Line ~106639: `_prevLogo = localStorage.getItem(getCurrentLogoKey(_prevBidx)) || '';`
- Line ~107106: `_logo = localStorage.getItem(getCurrentLogoKey(_bidx)) || '';`
- Line ~131037: `var brandLogo = localStorage.getItem(getCurrentLogoKey(i));`
- Line ~136230: `brandLogo = localStorage.getItem(getCurrentLogoKey(brandIdx)) || '';`

- [ ] **Step 3: Update logo delete to use ID key**

In `deleteBrand` (~line 84364-84365):
```javascript
// FIND:
    localStorage.removeItem('roweos_brand_' + brandIdx + '_logo');
    localStorage.removeItem('roweos_brand_' + brandIdx + '_logo_size');

// REPLACE WITH:
    // v29.0: Remove both ID-based and index-based logo keys
    if (brand && brand.id) {
      localStorage.removeItem(getBrandLogoKeyById(brand.id));
      localStorage.removeItem(getBrandLogoKeyById(brand.id) + '_size');
    }
    localStorage.removeItem('roweos_brand_' + brandIdx + '_logo');
    localStorage.removeItem('roweos_brand_' + brandIdx + '_logo_size');
```

- [ ] **Step 4: Test logo display**

Switch between brands. Verify:
- Each brand shows its own logo (not another brand's)
- Deleting a brand removes its logo
- Logos persist correctly after page reload

---

### Task 8: Brand Delete Hardening

**Files:**
- Modify: `/Volumes/roweOS/RoweOS/dist/index.html:84344-84393` (deleteBrand)

- [ ] **Step 1: Add immediate Firestore delete and tombstone**

At the start of `deleteBrand` (~line 84344), after getting the brand object, add immediate Firestore cleanup:
```javascript
function deleteBrand(brandIdx) {
  var brand = brands[brandIdx];
  if (!brand) return;

  // v29.0: Immediately delete from Firestore to prevent sync listener re-adding
  var _delBrandId = brand.id;
  if (_delBrandId) {
    try {
      var db = typeof getDB === 'function' ? getDB() : null;
      var basePath = _getV4BasePath ? _getV4BasePath() : null;
      if (db && basePath) {
        db.doc(basePath + '/brands/' + _delBrandId).delete();
        // Also update _all doc immediately
        var _remainingBrands = brands.filter(function(b, i) { return i !== brandIdx; });
        var _allItems = _remainingBrands.map(function(b) {
          return { name: b.name, id: b.id, _modifiedAt: b._modifiedAt || Date.now(), tagline: b.tagline || '', voice: b.voice || '' };
        });
        db.doc(basePath + '/brands/_all').set({ items: _allItems, _modifiedAt: Date.now() }, { merge: false });
      }
    } catch(e) {
      console.error('[deleteBrand] Firestore cleanup error:', e);
    }
  }
```

- [ ] **Step 2: Add grace period stamp after delete**

After removing from the local brands array (wherever `brands.splice(brandIdx, 1)` is called), add:
```javascript
  // v29.0: Stamp local save to prevent listener from re-adding
  if (typeof stampLocalSave === 'function') stampLocalSave();
```

- [ ] **Step 3: Test brand deletion**

Delete a brand. Verify:
- Brand disappears immediately
- Brand does not reappear after a few seconds
- Other brands are unaffected
- Reload the app -- deleted brand stays gone

---

### Task 9: Deploy and Verify

- [ ] **Step 1: Deploy to production**

```bash
cd /Volumes/roweOS/RoweOS/dist
vercel --prod --yes
```

- [ ] **Step 2: Full verification checklist**

On mobile AND desktop:
1. Add a new brand -- no duplicate
2. Click each brand pill/card -- correct brand loads
3. Switch brands via sidebar -- correct brand and logo
4. Delete a brand -- disappears immediately, stays gone
5. Reload -- brand count stable, selected brand correct
6. Check logos -- each brand shows its own logo
