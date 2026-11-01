const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((k) => [k, canonical(value[k])]),
        )
      : value;
export function stylingRoute(url,method='GET',body){const p=new URL(url,'http://timsys.invalid').pathname,m=method.toUpperCase();const routes={'GET /api/styling/catalogue':['catalogue',false],'POST /api/styling/evaluate':['evaluate',true],'GET /api/ensembles/catalogue':['ensemble_catalogue',false],'POST /api/ensembles/generate':['ensemble_generate',false],'POST /api/ensembles/save':['ensemble_save',true],'POST /api/ensembles/overrides':['ensemble_override',true]};const route=routes[m+' '+p];return route?{operation:route[0],command:route[1],input:m==='GET'?{}:body}:null;}
export function createStylingApi({
  invoke,
  storage = globalThis.sessionStorage,
  crypto = globalThis.crypto,
}) {
  return async function request(url, options = {}) {
    const body =
      typeof options.body === "string"
        ? JSON.parse(options.body)
        : options.body;
    const route = stylingRoute(url, options.method, body);
    if (!route) return null;
    let key, storageKey;
    if (route.command) {
      const bytes = new TextEncoder().encode(JSON.stringify(canonical(route)));
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      storageKey =
        "dressed.styling.command." +
        Array.from(new Uint8Array(digest), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("");
      key = storage.getItem(storageKey);
      if (!key) {
        key = crypto.randomUUID();
        storage.setItem(storageKey, key);
      }
    }
    try {
      const value = await invoke(route.operation, route.input, key);
      if (storageKey) storage.removeItem(storageKey);
      return value;
    } catch (error) {
      if (
        storageKey &&
        error.status >= 400 &&
        error.status < 500 &&
        ![408, 429, 499].includes(error.status)
      )
        storage.removeItem(storageKey);
      throw error;
    }
  };
}
