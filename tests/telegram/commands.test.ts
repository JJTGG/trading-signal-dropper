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

  it("reports application status", () => {
    expect(handleCommand("/status")).toMatch(
      /^TSD status: ONLINE\nApplication: Trading Signal Dropper\nProcess: ONLINE\nSignal engine: READY\nUptime: \d+s$/
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