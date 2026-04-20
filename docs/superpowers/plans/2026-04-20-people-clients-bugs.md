# People/Clients Bug Fixes

## Goal
Fix two People/Clients bugs: (1) "Delete All Clients" bulk action is missing, and (2) People view default tab/pill should remember the user's last selection instead of hardcoding to "pipeline" sub-tab and "client" pill.

## Architecture
- **App type:** Monolithic ES5 JavaScript web app (single HTML file built from `src/`)
- **Storage:** `roweos_people` localStorage key (unified people/contacts), synced to Firebase `profile/people`
- **Data flow:** `getClients()` -> `getPeople('client')` -> filters by `personType === 'client'`. `saveClients()` merges back into the unified people array via `savePeople()`, which triggers Firebase write-through.
- **Views:** People view has two layers: top-level pill nav (Clients / Team / Reports) tracked by `_activePeopleType`, and sub-tabs (Pipeline / List / Address Book) tracked by `_clientsActiveTab`.

## Tech Stack
- ES5 JavaScript (no arrow functions, let/const, template literals, destructuring)
- No test framework - verification is manual
- Build: `bash src/build.sh`

## File Structure
```
src/html/brand/14-clients.html        -- Bulk action bar HTML (line ~88)
src/js/core/29-analytics-commerce.js  -- Bulk functions (~9405-9483), switchPeopleType (~6704), _activePeopleType (~6702)
src/js/core/30-automations-init.js    -- _clientsActiveTab declaration (line 5), switchClientsTab (line 6)
src/js/core/11-agents.js              -- showView('clients') handler (~2961-2976), renderPillNav (~999)
```

---

## Task 1: Add "Delete" Bulk Action for Clients

### Files
- `src/html/brand/14-clients.html` (add Delete button to bulk bar)
- `src/js/core/29-analytics-commerce.js` (add `clientBulkDelete()` function)

### Step 1.1: Add Delete button to bulk action bar

**File:** `src/html/brand/14-clients.html`

Find the bulk action bar (line ~88-94) and add a Delete button after Export, before Clear:

```javascript
// BEFORE (line 92-93):
            <button class="btn btn-small" onclick="clientBulkExport()" style="padding: 4px 10px; font-size: 11px;">Export</button>
            <button class="btn btn-small" onclick="clientClearBulkSelection()" style="padding: 4px 10px; font-size: 11px; color: var(--text-muted);">Clear</button>

// AFTER:
            <button class="btn btn-small" onclick="clientBulkExport()" style="padding: 4px 10px; font-size: 11px;">Export</button>
            <button class="btn btn-small" onclick="clientBulkDelete()" style="padding: 4px 10px; font-size: 11px; color: #ef4444;">Delete</button>
            <button class="btn btn-small" onclick="clientClearBulkSelection()" style="padding: 4px 10px; font-size: 11px; color: var(--text-muted);">Clear</button>
```

### Step 1.2: Add `clientBulkDelete()` function

**File:** `src/js/core/29-analytics-commerce.js`

Insert after `clientBulkExport()` (after line ~9483), before the `// --- 4.3: Dialogue History ---` comment:

```javascript
// v29.3: Bulk delete selected clients
function clientBulkDelete() {
  if (_clientBulkSelected.length === 0) return;
  if (!confirm('Delete ' + _clientBulkSelected.length + ' client(s)? This cannot be undone.')) return;
  var clients = getClients();
  var remaining = clients.filter(function(c) {
    return _clientBulkSelected.indexOf(String(c.id)) === -1;
  });
  var deletedCount = clients.length - remaining.length;
  saveClients(remaining);
  clientClearBulkSelection();
  renderClientsView();
  if (typeof renderClientsList === 'function') renderClientsList();
  if (typeof updatePeopleTypeCounts === 'function') updatePeopleTypeCounts();
  showToast('Deleted ' + deletedCount + ' client(s)', 'success');
}
```

Key details:
- Uses `String(c.id)` comparison because `_clientBulkSelected` stores string IDs from `data-cid` attributes (same pattern as `deleteClient()` at line ~6418 which does `String(id)` comparison)
- `saveClients(remaining)` handles Firebase sync via `savePeople()` write-through - no extra sync call needed
- Calls `renderClientsView()` to refresh pipeline tab and `renderClientsList()` for list tab
- Calls `updatePeopleTypeCounts()` to update pill nav badges
- `clientClearBulkSelection()` resets `_clientBulkSelected = []` and hides the bulk bar

### Verification
1. Open People view > Clients tab
2. Select multiple clients using checkboxes
3. Bulk bar should show "Delete" button in red between Export and Clear
4. Click Delete - confirm dialog shows count
5. Confirm - clients are removed, toast shows, bulk bar hides
6. Refresh page - deleted clients stay deleted (localStorage persisted)
7. Check another device - clients are deleted there too (Firebase sync)

### Commit
`fix(people): add bulk delete action for clients`

---

## Task 2: Remember Last-Used People Type (Pill) and Sub-Tab

### Files
- `src/js/core/29-analytics-commerce.js` (save pill selection in `switchPeopleType`)
- `src/js/core/11-agents.js` (restore pill selection in `showView('clients')`)

### Step 2.1: Save the active people type to localStorage

**File:** `src/js/core/29-analytics-commerce.js`

In `switchPeopleType()` (line ~6704), add a localStorage write after setting the variable:

```javascript
// BEFORE (lines 6704-6705):
function switchPeopleType(type) {
  _activePeopleType = type;

// AFTER:
function switchPeopleType(type) {
  _activePeopleType = type;
  // v29.3: Remember last-used people type pill
  try { localStorage.setItem('roweos_people_active_type', type); } catch(e) {}
```

### Step 2.2: Initialize `_activePeopleType` from localStorage

**File:** `src/js/core/29-analytics-commerce.js`

Change the `_activePeopleType` declaration (line ~6702) to read from localStorage:

```javascript
// BEFORE (line 6702):
var _activePeopleType = 'client';

// AFTER:
var _activePeopleType = localStorage.getItem('roweos_people_active_type') || 'client';
```

### Step 2.3: Restore pill selection in `showView('clients')`

**File:** `src/js/core/11-agents.js`

In the `showView('clients')` handler (lines ~2963-2976), use the saved `_activePeopleType` as the default pill instead of hardcoding `'client'`:

```javascript
// BEFORE (lines 2964-2976):
    renderPillNav('peoplePillNav', [
      { id: 'client', label: 'Clients' },
      { id: 'team', label: 'Team' },
      { id: 'report', label: 'Reports' }
    ], 'client', function(tabId) { showPeopleType(tabId); }, { viewId: 'clients' });
    if (typeof initClientsTabDrag === 'function') initClientsTabDrag();
    // v28.6: Ensure team/report container is hidden on init
    var _ptc = document.getElementById('peopleTypeContent');
    if (_ptc) _ptc.style.display = 'none';
    switchClientsTab(_clientsActiveTab || 'pipeline');
    if (typeof updatePeopleTypeCounts === 'function') updatePeopleTypeCounts();

// AFTER:
    // v29.3: Restore last-used people type pill (client/team/report)
    var _savedPeopleType = _activePeopleType || 'client';
    renderPillNav('peoplePillNav', [
      { id: 'client', label: 'Clients' },
      { id: 'team', label: 'Team' },
      { id: 'report', label: 'Reports' }
    ], _savedPeopleType, function(tabId) { showPeopleType(tabId); }, { viewId: 'clients' });
    if (typeof initClientsTabDrag === 'function') initClientsTabDrag();
    // v28.6: Ensure team/report container is hidden on init
    var _ptc = document.getElementById('peopleTypeContent');
    if (_ptc) _ptc.style.display = 'none';
    // v29.3: Switch to saved people type (triggers correct sub-tab/content display)
    switchPeopleType(_savedPeopleType);
    if (typeof updatePeopleTypeCounts === 'function') updatePeopleTypeCounts();
```

Key changes:
- `_savedPeopleType` reads from the already-initialized `_activePeopleType` (which Step 2.2 loads from localStorage)
- `renderPillNav` gets `_savedPeopleType` as the active pill instead of hardcoded `'client'`
- Replaced `switchClientsTab(_clientsActiveTab || 'pipeline')` with `switchPeopleType(_savedPeopleType)` which internally calls `switchClientsTab` when type is `'client'` (see line ~6723: `switchClientsTab(_clientsActiveTab || 'pipeline')`)
- This means: if the user was last on Team, the pill opens on Team; if they were on Clients > List, the pill opens on Clients and the sub-tab opens on List

Note: The sub-tab persistence (`_clientsActiveTab` / `roweos_clients_active_tab`) already works correctly via `switchClientsTab()` in `30-automations-init.js` - that part is not broken. The only missing piece was the top-level pill selection.

### Verification
1. Open People view - defaults to Clients pill (first time)
2. Click "Team" pill
3. Navigate to a different view (e.g. Chat)
4. Navigate back to People - should open on Team pill (not Clients)
5. Within Clients, switch to "List" sub-tab
6. Navigate away and back - should open on Clients > List (not Clients > Pipeline)
7. Click "Reports" pill, refresh the entire page - should open on Reports
8. Verify that switching between pills still shows correct content (no display bugs)

### Commit
`fix(people): remember last-used pill and sub-tab across navigation`

---

## Summary of All Changes

| File | Change | Lines |
|------|--------|-------|
| `src/html/brand/14-clients.html` | Add Delete button to bulk action bar | ~92 |
| `src/js/core/29-analytics-commerce.js` | Add `clientBulkDelete()` function | after ~9483 |
| `src/js/core/29-analytics-commerce.js` | Save people type to localStorage in `switchPeopleType()` | ~6705 |
| `src/js/core/29-analytics-commerce.js` | Initialize `_activePeopleType` from localStorage | ~6702 |
| `src/js/core/11-agents.js` | Restore saved pill + call `switchPeopleType()` in `showView('clients')` | ~2964-2976 |

No new localStorage keys need Firebase sync (`roweos_people_active_type` and `roweos_clients_active_tab` are UI preferences, device-local like theme).
