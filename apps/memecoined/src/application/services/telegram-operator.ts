import type { OperatorApprovalService } from "./operator-approval.js";

export interface TelegramOperatorUpdate {
  readonly updateId: bigint;
  readonly chatId: string;
  readonly userId: string;
  readonly text: string;
}

export interface TelegramOperatorPort {
  poll(afterUpdateId: bigint | null): Promise<readonly TelegramOperatorUpdate[]>;
  send(chatId: string, text: string): Promise<void>;
}

export interface TelegramUpdateLedger {
  claim(update: TelegramOperatorUpdate): Promise<boolean>;
  complete(updateId: bigint, result: string): Promise<void>;
  fail(updateId: bigint, reason: string): Promise<void>;
  latest(): Promise<bigint | null>;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown command failure";
}

export class TelegramOperatorCycle {
  public constructor(
    private readonly telegram: TelegramOperatorPort,
    private readonly ledger: TelegramUpdateLedger,
    private readonly approvals: OperatorApprovalService,
    private readonly allowedUserIds: ReadonlySet<string>,
    private readonly configuredChatId: string,
    private readonly status: () => Promise<string>,
    private readonly emergencyStop: (actorId: string) => Promise<string>,
  ) {}

  /** Sends a bounded proactive recommendation, fill, exit, or critical-alert message. */
  public async notify(text: string): Promise<void> {
    const bounded = text.trim().slice(0, 4_000);
    if (bounded.length === 0) throw new TypeError("Telegram notification cannot be empty");
    await this.telegram.send(this.configuredChatId, bounded);
  }

  public async run(): Promise<number> {
    const updates = await this.telegram.poll(await this.ledger.latest());
    let completed = 0;
    for (const update of updates) {
      if (!(await this.ledger.claim(update))) continue;
      try {
        if (update.chatId !== this.configuredChatId || !this.allowedUserIds.has(update.userId))
          throw new Error("Unauthorized Telegram operator");
        const [command, id, nonce, ...reasonParts] = update.text.trim().split(/\s+/);
        let response: string;
        if (command === "/status") response = await this.status();
        else if (command === "/approve" && id !== undefined && nonce !== undefined) {
          await this.approvals.decide({ id, nonce, decision: "approve", actorId: `telegram:${update.userId}` });
          response = `Approved ${id}. The authority remains quote-bound and expires automatically.`;
        } else if (command === "/reject" && id !== undefined && nonce !== undefined) {
          await this.approvals.decide({
            id, nonce, decision: "reject", actorId: `telegram:${update.userId}`,
            reason: reasonParts.join(" ") || null,
          });
          response = `Rejected ${id}.`;
        } else if (command === "/stop") response = await this.emergencyStop(`telegram:${update.userId}`);
        else response = "Commands: /status, /approve <id> <nonce>, /reject <id> <nonce> [reason], /stop";
        await this.telegram.send(update.chatId, response);
        await this.ledger.complete(update.updateId, response);
        completed += 1;
      } catch (error) {
        const reason = message(error);
        await this.ledger.fail(update.updateId, reason);
        if (update.chatId === this.configuredChatId)
          await this.telegram.send(update.chatId, `Command refused: ${reason}`);
      }
    }
    return completed;
  }
}
