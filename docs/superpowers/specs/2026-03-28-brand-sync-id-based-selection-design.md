# Brand Sync: ID-Based Selection Fix

**Date**: 2026-03-28
**Approach**: B -- ID-Based Selection Everywhere
**Status**: Design

## Problem

Eight interconnected bugs in brand management, all stemming from the same root cause: brand selection and data storage uses **array indices** that shift when sync reorders the array.

### Reported Bugs

1. **Duplicate brand on add**: Adding "Riley" creates two copies. The brand gets a temp ID (`brand_1711234567890`), then `saveBrands()` backfills it to `brand_name_riley`. The Firestore listener sees the stable-ID doc as "new" because it doesn't match the temp ID.

2. **Selected brand randomly switches**: A `setInterval` runs every 3 seconds sorting brands by `_order`, which shifts array indices. `selectedBrand` is stored as a numeric index, so it silently points to a different brand after each sort.

3. **Click brand X, get brand 0**: `selectBrandFromDropdown(idx)` passes a numeric index. After the periodic sort, that index no longer corresponds to the brand the user clicked.

4. **Brands drop from 7 to 1**: `loadFromFirebaseV2()` prefers the `_all` doc over individual brand docs. If `_all` is stale or partially written, it overwrites the fuller local array during merge.

5. **Click Riley in sidebar, shows The Rowe Collection**: Same index-shift problem -- sidebar sends an index that's already stale by the time `onBrandChange()` runs.

6. **Brand delete not immediate**: After deleting a brand, sync listener or `_all` doc re-adds it before the delete propagates to Firestore.

7. **Old deleted logo reappears**: Logos stored as `roweos_brand_{INDEX}_logo` in localStorage. When brands reorder, a deleted brand's logo data persists at its old index and shows on whatever brand now occupies that position.

8. **Logo stuck on wrong brand after switching**: Same index-based logo key problem -- `roweos_brand_0_logo` is tied to array position 0, not to a specific brand. When brands reorder, logos display on the wrong brand.

### Root Cause

The `brands[]` global array is the single source of truth, referenced by numeric index everywhere. But three systems mutate the array order concurrently:
- Periodic `setInterval` sort by `_order` (every 3s)
- Firestore `onSnapshot` listener (appends/merges)
- `saveBrands()` ID backfill (renames IDs in-place)

Any index stored or passed between these mutations becomes stale.

## Design

### 1. Kill the Periodic Sort

**Location**: ~line 64072 (`setInterval` that sorts by `_order` every 3s)

**Change**: Remove entirely. This sort is actively destructive -- it rewrites localStorage every 3 seconds, triggers grace period blocks on the listener, and shifts indices mid-operation.

**Brand order** should only be applied:
- Once at load time in `loadBrands()`
- Once after sync merge completes
- Never on a timer

### 2. ID-Based Selection Everywhere

**Core principle**: `selectedBrand` (the global numeric index) becomes a **derived value** resolved from `selectedBrandId` (string) at render time.

**Changes**:

a) **Store selection as ID, not index**:
   - `localStorage.setItem('roweos_selected_brand', brandId)` -- store ID, not index
   - Keep `roweos_selected_brand_id` as the canonical key (already exists from v28.1)
   - Remove numeric index writes to `roweos_selected_brand` (or make it derived)

b) **Add `getBrandIndex(id)` helper**:
   ```javascript
   function getBrandIndex(brandId) {
     for (var i = 0; i < brands.length; i++) {
       if (brands[i].id === brandId) return i;
     }
     return 0; // fallback to first brand
   }
   ```

c) **Fix all selection sites** (each changes from index to ID):
   - `selectBrandFromDropdown(idx)` -- pass brand ID, resolve index internally
   - `onBrandChange()` -- read from `selectedBrandId`, resolve index
   - Sidebar brand click -- pass `brand.id`, not position
   - Landing page pills -- pass `brand.id`
   - Agent brand selector (`#agentBrand`) -- store brand ID as value, not index
   - Mobile brand selector
   - Brand dropdown in chat followup

d) **Resolve index at render time**:
   - Every place that reads `selectedBrand` (the index) should call `getBrandIndex(selectedBrandId)` to get the current index
   - This makes index-shift harmless -- even if array reorders, the ID resolves correctly

### 3. Dedup Guard in Sync Listener

**Location**: `watchCollection` for brands (~line 63982)

**Change**: When the listener receives an "added" doc, check for duplicates by **both ID and name**:

```javascript
// Before appending, check if brand already exists by name
var isDup = false;
for (var i = 0; i < localArr.length; i++) {
  if (localArr[i].id === docId) { isDup = true; break; }
  if (localArr[i].name && docData.name &&
      localArr[i].name.toLowerCase() === docData.name.toLowerCase()) {
    // Same brand, different ID -- update ID to match cloud
    localArr[i].id = docId;
    isDup = true;
    break;
  }
}
if (!isDup) {
  localArr.push(docData);
}
```

Also add dedup in `saveBrands()` before writing:
```javascript
// Dedup by name before save
var seen = {};
brands = brands.filter(function(b) {
  var key = (b.name || '').toLowerCase();
  if (seen[key]) return false;
  seen[key] = true;
  return true;
});
```

### 4. Protect `_all` Doc Merge from Shrinking

**Location**: `loadFromFirebaseV2()` brands merge (~line 138458)

**Change**: Never let `_all` doc replace a larger local brand set:

```javascript
if (_allDoc && _allDoc.items && _allDoc.items.length > 0) {
  // Only use _all doc if it has at least as many brands as local
  var localBrands = JSON.parse(localStorage.getItem('roweos_user_brands') || '[]');
  if (_allDoc.items.length >= localBrands.length) {
    cloudBrands = _allDoc.items;
  } else {
    console.warn('[Sync] _all doc has fewer brands (' + _allDoc.items.length +
      ') than local (' + localBrands.length + ') -- using individual docs');
  }
}
```

### 5. Stabilize Brand ID Assignment

**Location**: `saveBrands()` ID backfill (~line 64754)

**Change**: Assign stable IDs at creation time, not during save:

- In `createNewBrand()`: Generate the stable `brand_name_*` ID immediately (not `brand_` + timestamp)
- Remove the backfill loop in `saveBrands()` that renames IDs after the fact
- This eliminates the temp-ID-to-stable-ID rename race that causes the listener to see "new" brands

### 6. ID-Based Logo Storage

**Location**: Logo get/set using `roweos_brand_{INDEX}_logo` (~line 71983, 72198, 84364, etc.)

**Current**: `getBrandLogoKey(brandIdx)` returns `'roweos_brand_' + brandIdx + '_logo'` -- tied to array position.

**Change**: Migrate logo storage to use brand ID:
- New key format: `roweos_brand_logo_{brandId}` (e.g., `roweos_brand_logo_brand_name_riley`)
- Update `getBrandLogoKey()` to accept brand ID or resolve from index
- One-time migration on load: for each brand at index `i`, copy `roweos_brand_{i}_logo` to `roweos_brand_logo_{brand.id}` if the new key doesn't exist
- On brand delete: explicitly remove `roweos_brand_logo_{brand.id}` and `roweos_brand_logo_size_{brand.id}`

### 7. Brand Delete Propagation

**Location**: Brand delete function, sync listener

**Change**:
- On delete, immediately write a tombstone to Firestore (`_deleted: true, _deletedAt: timestamp`) before removing from local array
- Sync listener should check for `_deleted` flag and skip re-adding
- Update `_all` doc atomically with the delete (don't let stale `_all` re-add deleted brands)

## Edit Sites Summary

| Location | Current | Change |
|----------|---------|--------|
| `setInterval` sort (line ~64072) | Sorts brands every 3s | Remove entirely |
| `selectBrandFromDropdown` (line ~72494) | Uses numeric index | Accept brand ID, resolve index |
| `onBrandChange` (line ~69463) | Reads `selectedBrand` index | Reads `selectedBrandId`, resolves |
| Sidebar brand click | Passes index | Passes `brand.id` |
| Landing page pills | Uses index | Uses `brand.id` |
| `#agentBrand` dropdown | Index-based values | ID-based values |
| `saveBrands()` (line ~64754) | Backfills IDs during save | Remove backfill; IDs set at creation |
| `createNewBrand()` (line ~165663) | Temp ID `brand_` + timestamp | Stable ID `brand_name_*` immediately |
| `watchCollection` brands (line ~63982) | Dedup by ID only | Dedup by ID and name |
| `loadFromFirebaseV2` (line ~138458) | Prefers `_all` doc always | Only if >= local count |
| `loadBrands()` (line ~64973) | Sort by `_order` once | Keep (this is fine) |
| `getBrandLogoKey()` (line ~71983) | `roweos_brand_{idx}_logo` | `roweos_brand_logo_{id}` |
| Logo display (~72198, 78684, etc.) | Read by index key | Read by brand ID key |
| Logo delete (~84364) | Remove by index key | Remove by brand ID key |
| Brand delete function | No tombstone | Write `_deleted` tombstone to Firestore first |
| Sync listener brands | Re-adds deleted brands | Check `_deleted` flag, skip |

## Out of Scope (Deferred to Approach C)

- Replacing `brands[]` array with a `BrandStore` keyed by ID
- Removing the global `selectedBrand` index entirely
- Full elimination of index-based lookups in all downstream consumers

## Success Criteria

- Adding a brand never creates duplicates
- Selected brand persists correctly across sync events
- Clicking a brand in sidebar/pills/dropdown always navigates to the correct brand
- Brand count never decreases unless user explicitly deletes
- Works on single device and cross-device
