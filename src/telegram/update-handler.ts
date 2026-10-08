import type { HistoricalDataProvider } from "../data/historical.js";
import { handleCommand } from "./commands.js";
import { handleSignalCommand } from "./signal.js";

export type TelegramUpdate = {
  update_id: number;
  message?: {
    chat: {
      id: number;
    };
    text?: string;
  };
};

export type TelegramOutboundMessage = {
  chatId: number;
  text: string;
};

export async function handleTelegramUpdate(
  update: TelegramUpdate,
  provider: HistoricalDataProvider
): Promise<TelegramOutboundMessage | null> {
  const message = update.message;
  const text = message?.text;

  if (
    message === undefined ||
    text === undefined
  ) {
    return null;
  }

  if (!text.startsWith("/")) {
    return null;
  }

  const parts = text
    .trim()
    .split(/\s+/);

  const command = parts[0]?.toLowerCase();

  if (command === undefined) {
    return null;
  }

  try {
    let response: string;

    if (command === "/signal") {
      response = await handleSignalCommand(
        parts.slice(1),
        provider
      );
    } else {
      response = handleCommand(command);
    }

    return {
      chatId: message.chat.id,
      text: response
    };
  } catch (error) {
    console.error(
      `Command failed: ${command}`,
      error
    );

    return {
      chatId: message.chat.id,
      text: [
        "TSD could not process that request.",
        "",
        "Check the symbol and timeframe, then try again."
      ].join("\n")
    };
  }
}