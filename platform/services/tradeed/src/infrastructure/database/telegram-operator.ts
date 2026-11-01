import { createHash } from "node:crypto";
import type { Pool } from "pg";

import type {
  TelegramOperatorUpdate,
  TelegramUpdateLedger,
} from "../../application/services/telegram-operator.js";

export class PostgresTelegramUpdateLedger implements TelegramUpdateLedger {
  public constructor(private readonly database: Pick<Pool, "query">) {}

  public async claim(update: TelegramOperatorUpdate): Promise<boolean> {
    const commandHash = createHash("sha256").update(update.text).digest("hex");
    const result = await this.database.query(
      `INSERT INTO telegram_operator_updates
        (update_id,chat_id,user_id,command_hash,state)
       VALUES ($1,$2,$3,$4,'processing') ON CONFLICT DO NOTHING`,
      [update.updateId.toString(), update.chatId, update.userId, commandHash],
    );
    return result.rowCount === 1;
  }

  public async complete(updateId: bigint, result: string): Promise<void> {
    const updated = await this.database.query(
      `UPDATE telegram_operator_updates SET state='completed',result=$2,completed_at=now()
        WHERE update_id=$1 AND state='processing'`,
      [updateId.toString(), result.slice(0, 2_000)],
    );
    if (updated.rowCount !== 1) throw new Error("Telegram update completion requires its claim");
  }

  public async fail(updateId: bigint, reason: string): Promise<void> {
    const updated = await this.database.query(
      `UPDATE telegram_operator_updates SET state='failed',result=$2,completed_at=now()
        WHERE update_id=$1 AND state='processing'`,
      [updateId.toString(), reason.slice(0, 2_000)],
    );
    if (updated.rowCount !== 1) throw new Error("Telegram update failure requires its claim");
  }

  public async latest(): Promise<bigint | null> {
    const result = await this.database.query<{ update_id: string | null }>(
      "SELECT max(update_id)::text AS update_id FROM telegram_operator_updates",
    );
    const value = result.rows[0]?.update_id;
    return value === undefined || value === null ? null : BigInt(value);
  }
}
