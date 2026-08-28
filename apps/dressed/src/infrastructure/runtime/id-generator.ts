import { randomUUID } from "node:crypto";
import type { IdGeneratorPort } from "../../application/ports/runtime.js";
import { asEntityId, type EntityId } from "../../domain/shared/types.js";

export class RandomIdGenerator implements IdGeneratorPort {
  public next(): EntityId {
    return asEntityId(randomUUID());
  }
}

