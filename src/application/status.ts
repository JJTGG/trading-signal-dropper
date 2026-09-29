export type SystemStatus = {
  application: string;
  process: "ONLINE";
  signalEngine: "READY";
  uptimeSeconds: number;
};

export function getSystemStatus(): SystemStatus {
  return {
    application: "Trading Signal Dropper",
    process: "ONLINE",
    signalEngine: "READY",
    uptimeSeconds: Math.floor(process.uptime())
  };
}