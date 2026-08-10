import type { Timestamp } from "../../domain/shared/types.js";
import {
  producePortfolioAccountingCheckpoint,
  type PortfolioAccountingCheckpoint,
  type PortfolioAccountingCheckpointSink,
  type PortfolioAccountingObservationSource,
} from "./portfolio-accounting-producer.js";

export interface PortfolioCheckpointPublicationCycle {
  publish(observedAt: Timestamp): Promise<PortfolioAccountingCheckpoint>;
}

/** Publishes exactly one complete, immutable accounting checkpoint for an authority instant. */
export class LivePortfolioCheckpointPublicationCycle implements PortfolioCheckpointPublicationCycle {
  public constructor(
    private readonly source: PortfolioAccountingObservationSource,
    private readonly sink: PortfolioAccountingCheckpointSink,
  ) {}

  public publish(observedAt: Timestamp): Promise<PortfolioAccountingCheckpoint> {
    return producePortfolioAccountingCheckpoint({
      source: this.source,
      sink: this.sink,
      observedAt,
    });
  }
}
