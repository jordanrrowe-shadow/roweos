# Brand & Life Profile Save Fix: Optimistic Merge

**Date:** 2026-03-27
**Problem:** New brands and life profiles created during onboarding are silently erased by cloud sync before Firestore receives the write.

---

## Root Cause

Three interacting bugs:

### 1. Race: Cloud sync overwrites freshly saved local data

`saveBrands()` writes to localStorage (synchronous) and fires `writeDBDoc()` to Firestore (async). But:

- The **realtime `onSnapshot` listener** on `/brands` fires immediately on subscribe with the current cloud state (which doesn't have the new brand yet). It calls `safeSyncWrite()` which unconditionally overwrites localStorage AND clears the in-memory `brands` array.
- **`reconcileOnStartup()`** calls `loadFromFirebaseV2()` which does the same: pulls cloud brands via `safeSyncWrite()` before the async write from `saveBrands()` has landed in Firestore.
- `safeSyncWrite()` (line 135825) is a blind overwrite -- no merge, no timestamp check. Comment says "Cloud is authoritative -- always apply, even if empty."

For life profiles: `saveLifeProfiles()` writes to localStorage then `syncLifeAIToFirestore()` (debounced 300ms). `loadFromFirebaseV2()` at line 136278 calls `safeSyncWrite('roweos_life_profiles', life.profiles)` -- same blind overwrite.

### 2. Brands lack stable IDs and `_modifiedAt` timestamps

- Brands are identified by array index, not a stable ID field
- `_modifiedAt` is set on the Firestore clone (line 63259) but NOT on the in-memory brand object
- The existing `mergeByTimestamp()` function (line 63182) requires a stable `id` field and `_modifiedAt` -- brands have neither consistently

### 3. Key typo in `saveWebSearchResults()`

Line 159251 saves brandSettings to `roweos_brand_settings` (wrong key) instead of `roweos_user_brand_settings` (`USER_DATA_KEYS.brandSettings`). This means web-search-created brands lose their provider/model config on reload.

---

## Design: Optimistic Merge

Replace blind `safeSyncWrite` overwrites with `mergeByTimestamp`-based merging for brands and life profiles. This requires brands to have stable IDs and consistent `_modifiedAt` timestamps.

### Change 1: Add stable `id` and `_modifiedAt` to brands on creation

**Where:** `completeBrandSetup()` (line 143582), `saveWebSearchResults()` (line 159227)

Add to brand object at creation time:
```js
id: 'brand_' + Date.now(),
_modifiedAt: Date.now(),
_createdAt: Date.now()
```

**Where:** `saveBrands()` (line 63237)

Stamp `_modifiedAt = Date.now()` on each in-memory brand object (not just the Firestore clone):
```js
brands.forEach(function(brand, idx) {
  if (!brand.id) brand.id = 'brand_' + Date.now() + '_' + idx; // Backfill
  brand._modifiedAt = Date.now();
  // ... existing Firestore write
});
```

### Change 2: Backfill IDs on existing brands at load time

**Where:** `loadBrands()` (line 63353)

After parsing brands from localStorage, backfill any missing IDs:
```js
for (var i = 0; i < parsed.length; i++) {
  if (!parsed[i].id) {
    parsed[i].id = 'brand_' + Date.now() + '_' + i;
    needsSave = true;
  }
}
if (needsSave) {
  localStorage.setItem(USER_DATA_KEYS.brands, JSON.stringify(parsed));
}
```

### Change 3: Replace `safeSyncWrite` with merge for brands

**Where:** Realtime listener (line 130071), `loadFromFirebaseV2` brands section (line 136124)

Replace:
```js
safeSyncWrite(USER_DATA_KEYS.brands, cloudBrands);
```

With:
```js
var localBrands = [];
try { localBrands = JSON.parse(localStorage.getItem(USER_DATA_KEYS.brands) || '[]'); } catch(e) {}
var merged = mergeByTimestamp(localBrands, cloudBrands, 'id');
localStorage.setItem(USER_DATA_KEYS.brands, JSON.stringify(merged));
```

**Where:** Realtime listener in-memory update (lines 130073-130076)

Replace:
```js
brands.length = 0;
for (var bi = 0; bi < brandsArr.length; bi++) { brands.push(brandsArr[bi]); }
```

With:
```js
var localBrandsForMerge = brands.slice(); // snapshot before clearing
var mergedBrands = mergeByTimestamp(localBrandsForMerge, brandsArr, 'id');
brands.length = 0;
for (var bi = 0; bi < mergedBrands.length; bi++) { brands.push(mergedBrands[bi]); }
```

### Change 4: Replace `safeSyncWrite` with merge for life profiles

**Where:** `loadFromFirebaseV2` life profiles section (line 136278)

Replace:
```js
if (life.profiles) safeSyncWrite('roweos_life_profiles', life.profiles);
```

With:
```js
if (life.profiles) {
  var localLifeProfiles = [];
  try { localLifeProfiles = JSON.parse(localStorage.getItem('roweos_life_profiles') || '[]'); } catch(e) {}
  var mergedLife = mergeByTimestamp(localLifeProfiles, life.profiles, 'id');
  localStorage.setItem('roweos_life_profiles', JSON.stringify(mergedLife));
}
```

### Change 5: Add `_modifiedAt` to life profiles on save

**Where:** `saveLifeProfiles()` (line 140037)

Before writing to localStorage, stamp each profile:
```js
profiles.forEach(function(p) {
  p._modifiedAt = Date.now();
  if (!p.id) p.id = 'life_' + Date.now();
});
```

### Change 6: Fix `saveWebSearchResults` brandSettings key

**Where:** Line 159251

Replace:
```js
localStorage.setItem('roweos_brand_settings', JSON.stringify(brandSettings));
```

With:
```js
localStorage.setItem(USER_DATA_KEYS.brandSettings, JSON.stringify(brandSettings));
```

### Change 7: Stamp `_modifiedAt` on Firestore brand docs using in-memory value

**Where:** `saveBrands()` Firestore write loop (line 63259)

Currently sets `_modifiedAt` only on the Firestore clone. Change to use the in-memory value (already set in Change 1):
```js
data._modifiedAt = brand._modifiedAt || Date.now();
```

This ensures the Firestore document's `_modifiedAt` matches what's in localStorage, so `mergeByTimestamp` compares correctly.

---

## Files Modified

All changes in a single file: `/Volumes/roweOS/RoweOS/dist/index.html`

| Line Area | Function | Change |
|-----------|----------|--------|
| ~63237 | `saveBrands()` | Stamp `_modifiedAt` on in-memory brands, backfill `id` |
| ~63353 | `loadBrands()` | Backfill missing `id` fields |
| ~130060-130076 | Realtime brands listener | Replace `safeSyncWrite` + blind overwrite with `mergeByTimestamp` |
| ~136120-136126 | `loadFromFirebaseV2` brands | Replace `safeSyncWrite` with `mergeByTimestamp` |
| ~136278 | `loadFromFirebaseV2` life profiles | Replace `safeSyncWrite` with `mergeByTimestamp` |
| ~140037 | `saveLifeProfiles()` | Stamp `_modifiedAt` on profiles |
| ~143582 | `completeBrandSetup()` | Add `id`, `_modifiedAt`, `_createdAt` to new brand |
| ~159227 | `saveWebSearchResults()` | Add `id`, `_modifiedAt`, `_createdAt` to new brand |
| ~159251 | `saveWebSearchResults()` | Fix brandSettings key typo |

---

## Edge Cases

- **Existing brands without `id`**: Backfilled at load time with index-based IDs. On first save after upgrade, they get proper `_modifiedAt` stamps.
- **Two devices create brands simultaneously**: `mergeByTimestamp` keeps both (different IDs). No data loss.
- **Empty cloud, local has data**: `mergeByTimestamp` preserves local items created after last sync (the `createdAt > lastSync` path at line 63212).
- **Brand deleted on another device**: Cloud won't have it; `mergeByTimestamp` treats local-only items older than `lastSync` as deleted (line 63210-63215). Correct behavior.
- **`selectedBrand` index shift**: After merge, the `selectedBrand` index may point to a different brand. The existing clamp logic (line 130078) handles out-of-bounds; we should also re-resolve by brand `id` after merge. Minor follow-up.

---

## Testing

1. Create new brand via onboarding wizard -- verify it persists after page reload
2. Create new brand via web search import -- verify it persists and has correct provider/model
3. Create new life profile via onboarding -- verify it persists after page reload
4. Sign in on a second device -- verify brands and profiles sync without loss
5. Create brand while offline, then reconnect -- verify brand survives reconciliation
6. Verify existing brands (without `id` field) get backfilled and don't duplicate
