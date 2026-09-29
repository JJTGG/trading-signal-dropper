import type { HistoricalDataProvider } from "../data/historical.js";
import { generateSignal } from "../application/signal.js";

export async function handleSignalCommand(
  args: string[],
  provider: HistoricalDataProvider
): Promise<string> {
  const symbol = args[0];

  if (symbol === undefined || !symbol.trim()) {
    return [
      "Usage:",
      "/signal BTCUSDT",
      "",
      "Optional timeframe:",
      "/signal BTCUSDT 1h"
    ].join("\n");
  }

  const timeframe = args[1] ?? "15m";

  if (!timeframe.trim()) {
    return "Timeframe is required.";
  }

  const result = await generateSignal(provider, {
    symbol,
    timeframe
  });

  if (result === null) {
    return [
      `No signal found for ${symbol.toUpperCase()}.`,
      `Timeframe: ${timeframe}`
    ].join("\n");
  }

  const { signal } = result;

  return [
    `TSD signal: ${signal.direction}`,
    "",
    `Symbol: ${result.symbol}`,
    `Timeframe: ${signal.timeframe}`,
    `Strategy: ${signal.strategy}`,
    `Entry: ${signal.entry}`,
    `Stop loss: ${signal.stopLoss}`,
    `Take profit 1: ${signal.takeProfits[0]}`,
    `Take profit 2: ${signal.takeProfits[1]}`,
    "",
    `Reason: ${signal.reason}`
  ].join("\n");
}