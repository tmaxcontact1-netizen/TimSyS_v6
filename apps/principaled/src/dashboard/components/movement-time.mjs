// SQLite CURRENT_TIMESTAMP values are UTC even though they omit a zone suffix.
export function movementTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return NaN;
  const text = value.trim();
  const utc = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text);
  return Date.parse(utc ? text.replace(' ', 'T') + 'Z' : text);
}

export function elapsedMovementMinutes(value, now = Date.now()) {
  const start = movementTimestamp(value);
  return Number.isFinite(start) ? Math.max(0, Math.floor((now - start) / 60000)) : null;
}
