import {
  describe,
  expect,
  it,
  vi
} from "vitest";
import {
  formatSignalMessage,
  TelegramSignalNotifier
} from "../../src/telegram/notifier.js";
import type {
  GeneratedSignal
} from "../../src/application/signal.js";

function createSignal(): GeneratedSignal {
  return {
    symbol: "BTCUSDT",
    signal: {
      direction: "LONG",
      entry: 100,
      stopLoss: 95,
      takeProfits: [105, 110],
      strategy: "EMA Trend + Breakout",
      timeframe: "15m",
      reason:
        "Fast EMA is above slow EMA and price confirmed an upside breakout."
    }
  };
}

function createResponse(
  body: unknown,
  ok = true,
  status = 200,
  statusText = "OK"
): Response {
  return new Response(
    JSON.stringify(body),
    {
      status,
      statusText,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}

describe("formatSignalMessage", () => {
  it("formats a generated signal for Telegram", () => {
    expect(
      formatSignalMessage(createSignal())
    ).toBe(
      [
        "TSD signal: LONG",
        "",
        "Symbol: BTCUSDT",
        "Timeframe: 15m",
        "Strategy: EMA Trend + Breakout",
        "Entry: 100",
        "Stop loss: 95",
        "Take profit 1: 105",
        "Take profit 2: 110",
        "",
        "Reason: Fast EMA is above slow EMA and price confirmed an upside breakout."
      ].join("\n")
    );
  });
});

describe("TelegramSignalNotifier", () => {
  it("sends the generated signal to the configured chat", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        createResponse({
          ok: true,
          result: {
            message_id: 42
          }
        })
      );

    const notifier =
      new TelegramSignalNotifier({
        token: "test-token",
        chatId: 12345,
        fetchFn
      });

    await notifier.notify(
      createSignal()
    );

    expect(fetchFn).toHaveBeenCalledTimes(1);

    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.telegram.org/bottest-token/sendMessage",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: 12345,
          text: formatSignalMessage(
            createSignal()
          )
        })
      }
    );
  });

  it("rejects an HTTP failure", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        createResponse(
          {
            ok: false
          },
          false,
          500,
          "Internal Server Error"
        )
      );

    const notifier =
      new TelegramSignalNotifier({
        token: "test-token",
        chatId: 12345,
        fetchFn
      });

    await expect(
      notifier.notify(createSignal())
    ).rejects.toThrow(
      "Telegram notification request failed: 500 Internal Server Error"
    );
  });

  it("rejects a Telegram API failure", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        createResponse({
          ok: false,
          description:
            "Bad Request: chat not found"
        })
      );

    const notifier =
      new TelegramSignalNotifier({
        token: "test-token",
        chatId: 12345,
        fetchFn
      });

    await expect(
      notifier.notify(createSignal())
    ).rejects.toThrow(
      "Bad Request: chat not found"
    );
  });

  it("rejects an empty token", () => {
    expect(
      () =>
        new TelegramSignalNotifier({
          token: " ",
          chatId: 12345
        })
    ).toThrow(
      "Telegram bot token is required."
    );
  });

  it("rejects an invalid chat ID", () => {
    expect(
      () =>
        new TelegramSignalNotifier({
          token: "test-token",
          chatId: Number.NaN
        })
    ).toThrow(
      "Telegram chat ID must be a valid number."
    );
  });
});