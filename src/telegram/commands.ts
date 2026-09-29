import { getSystemStatus } from "../application/status.js";

export function handleCommand(
  command: string
): string {
  switch (command) {
    case "/start":
      return [
        "TSD is online.",
        "",
        "Trading Signal Dropper",
        "Use /status to check system status."
      ].join("\n");

    case "/status": {
      const status = getSystemStatus();

      return [
        "TSD status: ONLINE",
        `Application: ${status.application}`,
        `Process: ${status.process}`,
        `Signal engine: ${status.signalEngine}`,
        `Uptime: ${status.uptimeSeconds}s`
      ].join("\n");
    }

    default:
      return [
        "Unknown command.",
        "Available commands:",
        "/start",
        "/status"
      ].join("\n");
  }
}