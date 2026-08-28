export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type EntityId = Brand<string, "EntityId">;
export type JobId = Brand<string, "JobId">;
export type EvidenceId = Brand<string, "EvidenceId">;
export type Timestamp = Brand<string, "Timestamp">;
export type ContentHash = Brand<string, "ContentHash">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;

export function asEntityId(value: string): EntityId {
  if (!UUID.test(value)) throw new TypeError("Entity ID must be a UUID");
  return value as EntityId;
}

export function asJobId(value: string): JobId {
  if (!UUID.test(value)) throw new TypeError("Job ID must be a UUID");
  return value as JobId;
}

export function asEvidenceId(value: string): EvidenceId {
  if (!UUID.test(value)) throw new TypeError("Evidence ID must be a UUID");
  return value as EvidenceId;
}

export function asTimestamp(value: string): Timestamp {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value)
    throw new TypeError("Timestamp must be a canonical UTC ISO-8601 value");
  return value as Timestamp;
}

export function asContentHash(value: string): ContentHash {
  if (!SHA256.test(value)) throw new TypeError("Content hash must be lowercase SHA-256");
  return value as ContentHash;
}

