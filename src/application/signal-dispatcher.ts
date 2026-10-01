import type {
  GeneratedSignal
} from "./signal.js";
import type {
  SignalMonitorResult
} from "./signal-monitor.js";

export interface SignalMonitorPort {
  check(): Promise<SignalMonitorResult>;
  markProcessed(candleTimestamp: number): void;
}

export interface SignalNotifier {
  notify(signal: GeneratedSignal): Promise<void>;
}

export async function dispatchSignalCheck(
  monitor: SignalMonitorPort,
  notifier: SignalNotifier
): Promise<SignalMonitorResult> {
  const result = await monitor.check();

  if (!result.newCandle) {
    return result;
  }

  if (result.signal !== null) {
    await notifier.notify(result.signal);
  }

  monitor.markProcessed(
    result.candleTimestamp
  );

  return result;
}