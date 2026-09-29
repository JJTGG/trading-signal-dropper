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

    case "/status":
      return [
        "TSD status: ONLINE",
        "Signal engine: READY",
        "Telegram interface: CONNECTED"
      ].join("\n");

    default:
      return [
        "Unknown command.",
        "Available commands:",
        "/start",
        "/status"
      ].join("\n");
  }
}