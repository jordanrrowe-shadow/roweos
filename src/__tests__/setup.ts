// Vitest setup. v33.2 scaffold.
// jsdom is the default test environment per vitest.config.ts.
// Add any globals or polyfills future tests need here.

if (typeof (globalThis as any).performance === 'undefined') {
  (globalThis as any).performance = { now: () => Date.now() };
}

// v33.3: Vitest 4.x jsdom doesn't ship a working localStorage out of the box —
// `window.localStorage` is a frozen `{}` with null prototype. Polyfill a Map-backed
// Storage for our tests so SyncV5 / Evolve / sync facade tests work.
function makeStoragePolyfill(): Storage {
  const m = new Map<string, string>();
  const store: Storage = {
    get length() { return m.size; },
    key(i: number) {
      const keys = Array.from(m.keys());
      return i >= 0 && i < keys.length ? keys[i]! : null;
    },
    getItem(k: string) { return m.has(k) ? m.get(k)! : null; },
    setItem(k: string, v: string) { m.set(String(k), String(v)); },
    removeItem(k: string) { m.delete(k); },
    clear() { m.clear(); },
  };
  return store;
}

const ls = makeStoragePolyfill();
const ss = makeStoragePolyfill();
try { Object.defineProperty(window, 'localStorage', { value: ls, configurable: true }); } catch {}
try { Object.defineProperty(window, 'sessionStorage', { value: ss, configurable: true }); } catch {}
try { (globalThis as any).localStorage = ls; } catch {}
try { (globalThis as any).sessionStorage = ss; } catch {}
