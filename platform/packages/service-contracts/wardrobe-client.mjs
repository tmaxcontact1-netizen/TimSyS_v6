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
export function wardrobeRoute(url, method = "GET", body) {
  const target = new URL(url, "http://timsys.invalid"),
    p = target.pathname,
    m = method.toUpperCase();
  if (p === "/api/categories")
    return m === "GET"
      ? { operation: "categories", input: {} }
      : m === "POST"
        ? { operation: "create_category", input: body, command: true }
        : null;
  if (p === "/api/garment-uses" && m === "GET")
    return { operation: "uses", input: {} };
  if (p === "/api/garments") {
    if (m === "POST")
      return { operation: "create", input: body, command: true };
    if (m === "GET") {
      const input = {
        limit: Math.min(
          50,
          Math.max(
            1,
            parseInt(target.searchParams.get("limit") || "50", 10) || 50,
          ),
        ),
        offset: Math.max(
          0,
          parseInt(target.searchParams.get("offset") || "0", 10) || 0,
        ),
      };
      for (const key of ["search", "categoryId", "useId", "status"]) {
        const value = target.searchParams.get(key)?.trim();
        if (value) input[key] = value;
      }
      return { operation: "list", input };
    }
  }
  const match = /^\/api\/garments\/([0-9a-f-]{36})(\/archive)?$/i.exec(p);
  if (match) {
    const id = match[1];
    if (match[2] && m === "POST")
      return {
        operation: "archive",
        input: { id, version: body?.version },
        command: true,
      };
    if (!match[2]) {
      if (m === "GET") return { operation: "get", input: { id } };
      if (m === "PUT")
        return {
          operation: "update",
          input: { id, garment: body },
          command: true,
        };
      if (m === "DELETE")
        return {
          operation: "delete",
          input: { id, version: body?.version },
          command: true,
        };
    }
  }
  return null;
}
export function createWardrobeApi({
  invoke,
  storage = globalThis.sessionStorage,
  crypto = globalThis.crypto,
}) {
  return async function request(url, options = {}) {
    const body =
      typeof options.body === "string"
        ? JSON.parse(options.body)
        : options.body;
    const route = wardrobeRoute(url, options.method, body);
    if (!route) return null;
    let key, storageKey;
    if (route.command) {
      const bytes = new TextEncoder().encode(JSON.stringify(canonical(route)));
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      storageKey =
        "dressed.wardrobe.command." +
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
