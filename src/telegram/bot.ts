import { BinanceHistoricalDataProvider } from "../data/providers/binance.js";
import { handleCommand } from "./commands.js";
import { handleSignalCommand } from "./signal.js";

type TelegramUpdate = {
  update_id: number;
  message?: {
    chat: {
      id: number;
    };
    text?: string;
  };
};

type TelegramResponse<T> = {
  ok: boolean;
  result: T;
};

const TELEGRAM_API = "https://api.telegram.org";
const POLLING_RETRY_DELAY_MS = 2_000;

function getToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN environment variable is required."
    );
  }

  return token;
}

async function telegramRequest<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>
): Promise<T> {
  const requestInit: RequestInit = body
    ? {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    : {
        method: "GET"
      };

  const response = await fetch(
    `${TELEGRAM_API}/bot${token}/${method}`,
    requestInit
  );

  if (!response.ok) {
    throw new Error(
      `Telegram API request failed: ${response.status} ${response.statusText}`
    );
  }

  const data =
    (await response.json()) as TelegramResponse<T>;

  if (!data.ok) {
    throw new Error(
      `Telegram API rejected the request: ${method}`
    );
  }

  return data.result;
}

async function sendMessage(
  token: string,
  chatId: number,
  text: string
): Promise<void> {
  await telegramRequest(token, "sendMessage", {
    chat_id: chatId,
    text
  });
}

async function getUpdates(
  token: string,
  offset: number
): Promise<TelegramUpdate[]> {
  return telegramRequest<TelegramUpdate[]>(
    token,
    "getUpdates",
    {
      offset,
      timeout: 30
    }
  );
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function startBot(): Promise<void> {
  const token = getToken();
  const provider = new BinanceHistoricalDataProvider();

  let offset = 0;

  console.log("TSD Telegram bot starting...");

  while (true) {
    try {
      const updates = await getUpdates(token, offset);

      for (const update of updates) {
        offset = update.update_id + 1;

        const message = update.message;
        const text = message?.text;

        if (
          message === undefined ||
          text === undefined
        ) {
          continue;
        }

        if (!text.startsWith("/")) {
          continue;
        }

        const parts = text
          .trim()
          .split(/\s+/);

        const command = parts[0]
          ?.toLowerCase();

        if (command === undefined) {
          continue;
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

          await sendMessage(
            token,
            message.chat.id,
            response
          );
        } catch (error) {
          console.error(
            `Command failed: ${command}`,
            error
          );

          await sendMessage(
            token,
            message.chat.id,
            [
              "TSD could not process that request.",
              "",
              "Check the symbol and timeframe, then try again."
            ].join("\n")
          );
        }
      }
    } catch (error) {
      console.error(
        "Telegram polling failed. Retrying in 2 seconds.",
        error
      );

      await sleep(POLLING_RETRY_DELAY_MS);
    }
  }
}