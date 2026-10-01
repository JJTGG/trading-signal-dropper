import { BinanceHistoricalDataProvider } from "./data/providers/binance.js";
import {
  createAutomaticSignalScheduler
} from "./application/automatic-signals.js";
import {
  TelegramSignalNotifier
} from "./telegram/notifier.js";
import { startBot } from "./telegram/bot.js";

function getRequiredEnv(
  name: string
): string {
  const value = process.env[name];

  if (value === undefined || !value.trim()) {
    throw new Error(
      `${name} environment variable is required.`
    );
  }

  return value;
}

function getChatId(): number {
  const raw = getRequiredEnv(
    "TELEGRAM_SIGNAL_CHAT_ID"
  );

  const chatId = Number(raw);

  if (!Number.isSafeInteger(chatId)) {
    throw new Error(
      "TELEGRAM_SIGNAL_CHAT_ID must be a valid integer."
    );
  }

  return chatId;
}

function getPollInterval(): number {
  const raw =
    process.env.TSD_SIGNAL_POLL_INTERVAL_MS ??
    "60000";

  const intervalMs = Number(raw);

  if (
    !Number.isFinite(intervalMs) ||
    intervalMs <= 0
  ) {
    throw new Error(
      "TSD_SIGNAL_POLL_INTERVAL_MS must be greater than zero."
    );
  }

  return intervalMs;
}

const token = getRequiredEnv(
  "TELEGRAM_BOT_TOKEN"
);

const signalSymbol = getRequiredEnv(
  "TSD_SIGNAL_SYMBOL"
);

const signalTimeframe =
  process.env.TSD_SIGNAL_TIMEFRAME ??
  "15m";

const signalChatId = getChatId();

const provider =
  new BinanceHistoricalDataProvider();

const notifier =
  new TelegramSignalNotifier({
    token,
    chatId: signalChatId
  });

const scheduler =
  createAutomaticSignalScheduler(
    provider,
    notifier,
    {
      symbol: signalSymbol,
      timeframe: signalTimeframe,
      intervalMs: getPollInterval(),
      onError: (error) => {
        console.error(
          "Automatic signal monitoring failed.",
          error
        );
      }
    }
  );

console.log("Trading Signal Dropper");
console.log("Core engine initializing...");
console.log("Telegram interface starting...");
console.log(
  `Automatic signals: ${signalSymbol} ${signalTimeframe}`
);

await Promise.all([
  startBot(),
  scheduler.start()
]);