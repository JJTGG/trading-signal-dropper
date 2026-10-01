import type { GeneratedSignal } from "../application/signal.js";
import type { SignalNotifier } from "../application/signal-dispatcher.js";

type TelegramResponse<T> = {
  ok: boolean;
  result: T;
  description?: string;
};

type TelegramMessage = {
  message_id: number;
};

export type TelegramSignalNotifierConfig = {
  token: string;
  chatId: number;
  apiBaseUrl?: string;
  fetchFn?: typeof fetch;
};

const TELEGRAM_API = "https://api.telegram.org";

export class TelegramSignalNotifier
  implements SignalNotifier
{
  private readonly token: string;
  private readonly chatId: number;
  private readonly apiBaseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor({
    token,
    chatId,
    apiBaseUrl = TELEGRAM_API,
    fetchFn = fetch
  }: TelegramSignalNotifierConfig) {
    if (!token.trim()) {
      throw new Error(
        "Telegram bot token is required."
      );
    }

    if (!Number.isFinite(chatId)) {
      throw new Error(
        "Telegram chat ID must be a valid number."
      );
    }

    if (!apiBaseUrl.trim()) {
      throw new Error(
        "Telegram API base URL is required."
      );
    }

    this.token = token;
    this.chatId = chatId;
    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
    this.fetchFn = fetchFn;
  }

  async notify(
    result: GeneratedSignal
  ): Promise<void> {
    const response = await this.fetchFn(
      `${this.apiBaseUrl}/bot${this.token}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: formatSignalMessage(result)
        })
      }
    );

    if (!response.ok) {
      throw new Error(
        `Telegram notification request failed: ${response.status} ${response.statusText}`
      );
    }

    const data =
      (await response.json()) as TelegramResponse<TelegramMessage>;

    if (!data.ok) {
      throw new Error(
        data.description ??
          "Telegram rejected the notification."
      );
    }
  }
}

export function formatSignalMessage(
  result: GeneratedSignal
): string {
  const { signal } = result;

  const takeProfits = signal.takeProfits
    .map(
      (takeProfit, index) =>
        `Take profit ${index + 1}: ${takeProfit}`
    );

  return [
    `TSD signal: ${signal.direction}`,
    "",
    `Symbol: ${result.symbol}`,
    `Timeframe: ${signal.timeframe}`,
    `Strategy: ${signal.strategy}`,
    `Entry: ${signal.entry}`,
    `Stop loss: ${signal.stopLoss}`,
    ...takeProfits,
    "",
    `Reason: ${signal.reason}`
  ].join("\n");
}