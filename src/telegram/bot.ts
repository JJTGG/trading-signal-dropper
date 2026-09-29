import { handleCommand } from "./commands.js";

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
  const response = await fetch(
    `${TELEGRAM_API}/bot${token}/${method}`,
    {
      method: body ? "POST" : "GET",
      headers: body
        ? {
            "Content-Type": "application/json"
          }
        : undefined,
      body: body ? JSON.stringify(body) : undefined
    }
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

export async function startBot(): Promise<void> {
  const token = getToken();

  let offset = 0;

  console.log("TSD Telegram bot starting...");

  while (true) {
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

      const command = text
        .trim()
        .split(/\s+/)[0]
        ?.toLowerCase();

      if (command === undefined) {
        continue;
      }

      const response = handleCommand(command);

      await sendMessage(
        token,
        message.chat.id,
        response
      );
    }
  }
}