import { BinanceMarketDataAdapter, type BinanceStreamConfig, type ExchangeStreamSink, type SocketFactory, type SocketLike } from "./binance.js";
import { exponentialBackoff } from "./reliability.js";

export interface RuntimeClock {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

const systemClock: RuntimeClock = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Owns one public stream, reconnects with jitter, and rotates before Binance's 24-hour limit. */
export class BinanceStreamRuntime {
  #socket: SocketLike | null = null;
  #stopped = true;
  #attempt = 0;
  #reconnectTimer: unknown = null;
  #rotationTimer: unknown = null;
  public constructor(
    private readonly config: BinanceStreamConfig,
    private readonly sockets: SocketFactory,
    private readonly sink: ExchangeStreamSink,
    private readonly clock: RuntimeClock = systemClock,
    private readonly rotationMs = 23 * 60 * 60 * 1_000 + 30 * 60 * 1_000,
    private readonly random = Math.random,
  ) {}
  public start(): void { if (!this.#stopped) return; this.#stopped = false; this.#connect(); }
  public stop(): void {
    this.#stopped = true;
    if (this.#reconnectTimer) this.clock.clearTimeout(this.#reconnectTimer);
    if (this.#rotationTimer) this.clock.clearTimeout(this.#rotationTimer);
    this.#reconnectTimer = this.#rotationTimer = null;
    this.#socket?.close(); this.#socket = null;
  }
  #connect(): void {
    if (this.#stopped) return;
    const runtimeSink: ExchangeStreamSink = {
      onCandle: (event) => this.sink.onCandle(event), onBook: (event) => this.sink.onBook(event), onTicker: (event) => this.sink.onTicker(event),
      onState: (state, detail) => {
        void this.sink.onState(state, detail);
        if (state === "connected") { this.#attempt = 0; this.#scheduleRotation(); }
        if (state === "disconnected" && !this.#stopped) this.#scheduleReconnect();
      },
    };
    this.#socket = new BinanceMarketDataAdapter(this.config, this.sockets, runtimeSink).connect();
  }
  #scheduleReconnect(): void {
    if (this.#reconnectTimer) return;
    const { delayMs } = exponentialBackoff(this.#attempt++, this.random);
    this.#reconnectTimer = this.clock.setTimeout(() => { this.#reconnectTimer = null; this.#connect(); }, delayMs);
  }
  #scheduleRotation(): void {
    if (this.#rotationTimer) this.clock.clearTimeout(this.#rotationTimer);
    this.#rotationTimer = this.clock.setTimeout(() => {
      this.#rotationTimer = null;
      const previous = this.#socket;
      this.#socket = null;
      previous?.close();
      this.#connect();
    }, this.rotationMs);
  }
}
