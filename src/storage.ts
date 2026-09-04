/**
 * Where a child's stars live.
 *
 * localStorage is not a safe long-term home: one tap on "clear browsing data"
 * wipes it, Android may evict it under storage pressure, and a Capacitor build
 * serves from a different origin so it would not carry over anyway.
 *
 * So everything goes through this interface. On the web it is localStorage; in a
 * Capacitor build it is the Preferences plugin, which writes to native app
 * storage outside the WebView and survives clearing browser data and app
 * updates. Detection is at runtime against the global Capacitor injects, so the
 * npm package is not needed to build the web version.
 */
export interface Store {
  readonly kind: "native" | "web" | "memory";
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

interface PreferencesPlugin {
  get(o: { key: string }): Promise<{ value: string | null }>;
  set(o: { key: string; value: string }): Promise<void>;
}

function nativePreferences(): PreferencesPlugin | null {
  const cap = (globalThis as { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor;
  const p = cap?.Plugins?.["Preferences"] as PreferencesPlugin | undefined;
  return p && typeof p.get === "function" ? p : null;
}

/** Private browsing and some embedded WebViews throw on access, not just on write. */
function localStorageWorks(): boolean {
  try {
    const k = "__wattle_probe__";
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function createStore(): Store {
  const native = nativePreferences();
  if (native) {
    return {
      kind: "native",
      async get(key) {
        return (await native.get({ key })).value;
      },
      async set(key, value) {
        await native.set({ key, value });
      },
    };
  }

  if (localStorageWorks()) {
    return {
      kind: "web",
      async get(key) {
        return localStorage.getItem(key);
      },
      async set(key, value) {
        localStorage.setItem(key, value);
      },
    };
  }

  // Last resort: the session still works, it just will not be remembered.
  const mem = new Map<string, string>();
  return {
    kind: "memory",
    async get(key) {
      return mem.get(key) ?? null;
    },
    async set(key, value) {
      mem.set(key, value);
    },
  };
}

/**
 * Ask the browser not to evict our data. Chrome grants this to installed PWAs
 * and to sites the user visits often. Harmless where unsupported.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* not supported */
  }
  return false;
}
