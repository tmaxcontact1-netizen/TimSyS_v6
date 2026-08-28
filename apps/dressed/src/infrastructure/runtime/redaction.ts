const SENSITIVE = /authorization|cookie|secret|token|password|database.?url|private.?path/i;

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      SENSITIVE.test(key) ? "[REDACTED]" : redact(item),
    ]),
  );
}

