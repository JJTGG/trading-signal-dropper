import { describe, expect, it } from "vitest";
import { handleCommand } from "../../src/telegram/commands.js";

describe("Telegram command handler", () => {
  it("responds to /start", () => {
    expect(handleCommand("/start")).toBe(
      [
        "TSD is online.",
        "",
        "Trading Signal Dropper",
        "Use /status to check system status."
      ].join("\n")
    );
  });

  it("responds to /status", () => {
    expect(handleCommand("/status")).toBe(
      [
        "TSD status: ONLINE",
        "Signal engine: READY",
        "Telegram interface: CONNECTED"
      ].join("\n")
    );
  });

  it("handles unknown commands", () => {
    expect(handleCommand("/unknown")).toBe(
      [
        "Unknown command.",
        "Available commands:",
        "/start",
        "/status"
      ].join("\n")
    );
  });
});