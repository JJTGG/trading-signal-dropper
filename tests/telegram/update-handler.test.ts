import { describe, expect, it, vi } from "vitest";

import type { HistoricalDataProvider } from "../../src/data/historical.js";
import {
  handleTelegramUpdate,
  type TelegramUpdate
} from "../../src/telegram/update-handler.js";

function createProvider(): HistoricalDataProvider {
  return {
    getCandles: vi.fn()
  };
}

describe("Telegram update handler", () => {
  it("handles a standard command", async () => {
    const provider = createProvider();

    const update: TelegramUpdate = {
      update_id: 1,
      message: {
        chat: {
          id: 123
        },
        text: "/status"
      }
    };

    await expect(
      handleTelegramUpdate(update, provider)
    ).resolves.toMatchObject({
      chatId: 123
    });

    const result =
      await handleTelegramUpdate(
        update,
        provider
      );

    expect(result).not.toBeNull();
    expect(result?.text).toMatch(
      /^TSD status: ONLINE/
    );
  });

  it("handles the signal command through the signal handler", async () => {
    const provider: HistoricalDataProvider = {
      getCandles: vi.fn().mockResolvedValue(
        Array.from(
          { length: 100 },
          (_, index) => ({
            timestamp: index + 1,
            open: 100 + index,
            high: 101 + index,
            low: 99 + index,
            close: 100 + index
          })
        )
      )
    };

    const update: TelegramUpdate = {
      update_id: 2,
      message: {
        chat: {
          id: 456
        },
        text: "/signal BTCUSDT 15m"
      }
    };

    const result =
      await handleTelegramUpdate(
        update,
        provider
      );

    expect(result).toEqual({
      chatId: 456,
      text: [
        "No signal found for BTCUSDT.",
        "Timeframe: 15m"
      ].join("\n")
    });

    expect(provider.getCandles).toHaveBeenCalledWith({
      symbol: "BTCUSDT",
      timeframe: "15m",
      limit: 100
    });
  });

  it("ignores updates without messages", async () => {
    const provider = createProvider();

    const update: TelegramUpdate = {
      update_id: 3
    };

    await expect(
      handleTelegramUpdate(update, provider)
    ).resolves.toBeNull();

    expect(provider.getCandles).not.toHaveBeenCalled();
  });

  it("ignores messages without text", async () => {
    const provider = createProvider();

    const update: TelegramUpdate = {
      update_id: 4,
      message: {
        chat: {
          id: 789
        }
      }
    };

    await expect(
      handleTelegramUpdate(update, provider)
    ).resolves.toBeNull();
  });

  it("ignores non-command messages", async () => {
    const provider = createProvider();

    const update: TelegramUpdate = {
      update_id: 5,
      message: {
        chat: {
          id: 789
        },
        text: "hello TSD"
      }
    };

    await expect(
      handleTelegramUpdate(update, provider)
    ).resolves.toBeNull();

    expect(provider.getCandles).not.toHaveBeenCalled();
  });
});