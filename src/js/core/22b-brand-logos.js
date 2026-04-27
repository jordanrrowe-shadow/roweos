// v32.0-C: Brand logo storage. Logos are bound by stable brand.id, never by
// array position. Small logos (<100KB base64) live inline on brand.logo. Large
// logos are stripped from brand.logo to '' for the localStorage write, with the
// full base64 stored in IndexedDB at roweos_brand_logo_<id>(_light) and pushed
// to a parallel Firestore subcollection brand_logos/<id>.

var LOGO_SIZE_THRESHOLD = 100 * 1024; // 100 KB base64 string length
window.LOGO_SIZE_THRESHOLD = LOGO_SIZE_THRESHOLD;

function _isLogoOversize(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return false;
  return dataUrl.length >= LOGO_SIZE_THRESHOLD;
}

function _idbLogoKey(brandId, isLight) {
  return 'roweos_brand_logo_' + brandId + (isLight ? '_light' : '');
}

// v32.0-C: Wrap callback-style _idbGet into a promise.
function _idbGetPromise(key) {
  return new Promise(function(resolve) {
    if (typeof window._idbGet !== 'function') { resolve(null); return; }
    try {
      window._idbGet(key, function(val) { resolve(val); });
    } catch (e) { resolve(null); }
  });
}

function readBrandLogoSync(brand, opts) {
  if (!brand) return '';
  var isLight = opts && opts.light;
  var inline = isLight ? brand.logoLight : brand.logo;
  if (inline) return inline;
  return ''; // sync read of IDB unsupported (callback-only) — caller must use async variant
}
window.readBrandLogoSync = readBrandLogoSync;

function readBrandLogoAsync(brand, opts) {
  if (!brand || !brand.id) return Promise.resolve('');
  var isLight = opts && opts.light;
  var inline = isLight ? brand.logoLight : brand.logo;
  if (inline) return Promise.resolve(inline);
  return _idbGetPromise(_idbLogoKey(brand.id, isLight)).then(function(v) { return v || ''; });
}
window.readBrandLogoAsync = readBrandLogoAsync;

// v32.0-C: writeDB call helper for brand_logos subcollection — uses the
// project's writeDB (fire-and-forget). We resolve immediately since writeDB
// is async-internal.
function _pushBrandLogoToCloud(brandId, payload) {
  if (typeof window.writeDB !== 'function') return Promise.resolve();
  try {
    window.writeDB('brand_logos/' + brandId, payload);
  } catch (e) { /* ignore — writeDB handles its own errors */ }
  return Promise.resolve();
}

function writeBrandLogo(brand, dataUrl, opts) {
  if (!brand || !brand.id) return Promise.resolve({ ok: false, error: 'brand.id required' });
  var isLight = opts && opts.light;
  var idbPut = (typeof window._idbPut === 'function') ? window._idbPut : null;

  if (_isLogoOversize(dataUrl)) {
    // OVERSIZE: strip from brand object, push to IDB + brand_logos subcollection
    if (isLight) {
      brand.logoLight = '';
      brand.logoLightOversize = true;
    } else {
      brand.logo = '';
      brand.logoOversize = true;
    }
    if (idbPut) {
      try { idbPut(_idbLogoKey(brand.id, isLight), dataUrl); } catch (e) {}
    }
    var payload = isLight
      ? { logoLight: dataUrl, _modifiedAt: Date.now() }
      : { logo: dataUrl, _modifiedAt: Date.now() };
    return _pushBrandLogoToCloud(brand.id, payload).then(function() {
      return { ok: true, oversize: true };
    }, function(err) { return { ok: false, error: err }; });
  }

  // SMALL: inline on brand object; clear any old IDB entry to avoid drift
  if (isLight) {
    brand.logoLight = dataUrl;
    brand.logoLightOversize = false;
  } else {
    brand.logo = dataUrl;
    brand.logoOversize = false;
  }
  if (idbPut) {
    try { idbPut(_idbLogoKey(brand.id, isLight), null); } catch (e) {}
  }
  return Promise.resolve({ ok: true, oversize: false });
}
window.writeBrandLogo = writeBrandLogo;

// v32.0-C: One-shot migration from position-keyed logo localStorage keys to
// ID-keyed inline / IDB / subcollection storage. Idempotent; guarded by flag.
function migrateBrandLogos_v32() {
  if (localStorage.getItem('roweos_brand_logo_migrated_v32') === 'done') {
    return Promise.resolve({ ok: true, skipped: true });
  }
  var brands = (function() {
    try {
      var raw = localStorage.getItem('roweos_user_brands') || '[]';
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  })();

  // 1. Find legacy position-keyed keys
  var legacyKeys = [];
  for (var i = 0; i < localStorage.length; i++) {
    var k = localStorage.key(i);
    if (k && /^roweos_brand_(\d+)_logo(_light)?$/.test(k)) legacyKeys.push(k);
  }

  var migrationOps = [];
  for (var j = 0; j < legacyKeys.length; j++) {
    var lk = legacyKeys[j];
    var m = lk.match(/^roweos_brand_(\d+)_logo(_light)?$/);
    if (!m) continue;
    var idx = parseInt(m[1], 10);
    var isLight = !!m[2];
    var b = brands[idx];
    if (!b || !b.id) {
      // Orphan — discard
      try { localStorage.removeItem(lk); } catch (e) {}
      continue;
    }
    var dataUrl = '';
    try { dataUrl = localStorage.getItem(lk) || ''; } catch (e2) {}
    if (dataUrl) {
      migrationOps.push(writeBrandLogo(b, dataUrl, { light: isLight }));
    }
    try { localStorage.removeItem(lk); } catch (e3) {}
  }

  // 2. Final pass: any brand with inline logo > threshold gets pushed to IDB+sub
  for (var n = 0; n < brands.length; n++) {
    var br = brands[n];
    if (!br || !br.id) continue;
    if (br.logo && _isLogoOversize(br.logo) && !br.logoOversize) {
      migrationOps.push(writeBrandLogo(br, br.logo, { light: false }));
    }
    if (br.logoLight && _isLogoOversize(br.logoLight) && !br.logoLightOversize) {
      migrationOps.push(writeBrandLogo(br, br.logoLight, { light: true }));
    }
  }

  return Promise.all(migrationOps).then(function() {
    // Persist updated brands (with stripped oversized inline logos)
    try { localStorage.setItem('roweos_user_brands', JSON.stringify(brands)); } catch (e) {}
    if (typeof window.saveBrands === 'function') {
      try { window.saveBrands(); } catch (e2) {}
    }
    try { localStorage.setItem('roweos_brand_logo_migrated_v32', 'done'); } catch (e3) {}
    return { ok: true, migrated: migrationOps.length };
  }, function(err) {
    return { ok: false, error: err };
  });
}
window.migrateBrandLogos_v32 = migrateBrandLogos_v32;
