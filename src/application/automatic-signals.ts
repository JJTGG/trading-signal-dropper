import type { HistoricalDataProvider } from "../data/historical.js";
import type { SignalNotifier } from "./signal-dispatcher.js";
import { SignalMonitor } from "./signal-monitor.js";
import {
  SignalScheduler,
  type SignalSchedulerConfig
} from "./signal-scheduler.js";

export type AutomaticSignalConfig = {
  symbol: string;
  timeframe?: string;
  intervalMs?: number;
  onError?: SignalSchedulerConfig["onError"];
};

export function createAutomaticSignalScheduler(
  provider: HistoricalDataProvider,
  notifier: SignalNotifier,
  {
    symbol,
    timeframe = "15m",
    intervalMs = 60_000,
    onError
  }: AutomaticSignalConfig
): SignalScheduler {
  const monitor = new SignalMonitor(provider, {
    symbol,
    timeframe
  });

  return new SignalScheduler(
    monitor,
    notifier,
    {
      intervalMs,
      onError
    }
  );
}