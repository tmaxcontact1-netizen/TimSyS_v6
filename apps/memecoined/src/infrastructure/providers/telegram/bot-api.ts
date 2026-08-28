import { z } from "zod";

import type {
  TelegramOperatorPort,
  TelegramOperatorUpdate,
} from "../../../application/services/telegram-operator.js";

const responseSchema = z.object({
  ok: z.literal(true),
  result: z.array(z.object({
    update_id: z.number().int().nonnegative(),
    message: z.object({
      text: z.string(),
      chat: z.object({ id: z.number().int() }),
      from: z.object({ id: z.number().int() }),
    }).optional(),
  })),
});

export class TelegramBotApi implements TelegramOperatorPort {
  public constructor(
    private readonly token: string,
    private readonly request: typeof fetch = fetch,
  ) {
    if (token.trim().length === 0) throw new TypeError("Telegram bot token is required");
  }

  private async call(method: string, body: Record<string, unknown>): Promise<unknown> {
    const response = await this.request(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Telegram ${method} request failed with HTTP ${response.status}`);
    return response.json();
  }

  public async poll(afterUpdateId: bigint | null): Promise<readonly TelegramOperatorUpdate[]> {
    const parsed = responseSchema.safeParse(await this.call("getUpdates", {
      ...(afterUpdateId === null ? {} : { offset: Number(afterUpdateId + 1n) }),
      timeout: 0,
      allowed_updates: ["message"],
    }));
    if (!parsed.success) throw new Error("Telegram returned a malformed update response");
    return Object.freeze(parsed.data.result.flatMap(({ update_id, message }) => message === undefined ? [] : [{
      updateId: BigInt(update_id), chatId: String(message.chat.id), userId: String(message.from.id), text: message.text,
    }]));
  }

  public async send(chatId: string, text: string): Promise<void> {
    if (text.trim().length === 0) throw new TypeError("Telegram message cannot be empty");
    const result = z.object({ ok: z.literal(true) }).safeParse(
      await this.call("sendMessage", { chat_id: chatId, text }),
    );
    if (!result.success) throw new Error("Telegram rejected the outbound message");
  }
}
