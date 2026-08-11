import { createHash } from "node:crypto";

import type { ObservationIdentityFactory } from "../../application/contracts/observations.js";
import { asUuid, type EvidenceId } from "../../domain/shared/types.js";

/** Stable evidence identity derived solely from normalized provider provenance. */
export class DeterministicEvidenceIdentityFactory implements ObservationIdentityFactory {
  public createEvidenceId(input: {
    readonly provider: string;
    readonly sourceKey: string;
    readonly contentHash: string;
  }): EvidenceId {
    const hex = createHash("sha256")
      .update(input.provider)
      .update("\0")
      .update(input.sourceKey)
      .update("\0")
      .update(input.contentHash)
      .digest("hex");
    return asUuid<EvidenceId>(
      `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`,
    );
  }
}
