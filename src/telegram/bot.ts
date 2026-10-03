import https from "node:https";

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
const TELEGRAM_POLL_TIMEOUT_SECONDS = 5;
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

function telegramRequest<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(
      `${TELEGRAM_API}/bot${token}/${method}`
    );

    const payload =
      body === undefined
        ? undefined
        : JSON.stringify(body);

    const request = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: payload === undefined ? "GET" : "POST",
        headers:
          payload === undefined
            ? {
                Connection: "close"
              }
            : {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(
                  payload
                ),
                Connection: "close"
              },
        agent: false,
        timeout:
          method === "getUpdates"
            ? (TELEGRAM_POLL_TIMEOUT_SECONDS + 10) *
              1_000
            : 10_000
      },
      (response) => {
        let responseBody = "";

        response.setEncoding("utf8");

        response.on("data", (chunk) => {
          responseBody += chunk;
        });

        response.on("end", () => {
          const statusCode =
            response.statusCode ?? 0;

          if (
            statusCode < 200 ||
            statusCode >= 300
          ) {
            reject(
              new Error(
                `Telegram API request failed: ${statusCode} ${response.statusMessage ?? ""}`.trim()
              )
            );
            return;
          }

          let data: TelegramResponse<T>;

          try {
            data =
              JSON.parse(
                responseBody
              ) as TelegramResponse<T>;
          } catch {
            reject(
              new Error(
                "Telegram API returned invalid JSON."
              )
            );
            return;
          }

          if (!data.ok) {
            reject(
              new Error(
                `Telegram API rejected the request: ${method}`
              )
            );
            return;
          }

          resolve(data.result);
        });

        response.on("error", reject);
      }
    );

    request.on("timeout", () => {
      request.destroy(
        new Error(
          "Telegram API request timed out."
        )
      );
    });

    request.on("error", reject);

    if (payload !== undefined) {
      request.write(payload);
    }

    request.end();
  });
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
      timeout: TELEGRAM_POLL_TIMEOUT_SECONDS
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
      const updates = await getUpdates(
        token,
        offset
      );

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