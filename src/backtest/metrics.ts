import type { SimulatedTrade } from "./trade-simulator.js";

export type PerformanceMetrics = {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageR: number;
  totalR: number;
  profitFactor: number;
  maximumDrawdown: number;
  largestWinningTrade: number;
  largestLosingTrade: number;
  longestWinningStreak: number;
  longestLosingStreak: number;
};

export function calculateMetrics(
  trades: SimulatedTrade[]
): PerformanceMetrics {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      averageR: 0,
      totalR: 0,
      profitFactor: 0,
      maximumDrawdown: 0,
      largestWinningTrade: 0,
      largestLosingTrade: 0,
      longestWinningStreak: 0,
      longestLosingStreak: 0
    };
  }

  const winningTrades = trades.filter(
    (trade) => trade.rMultiple > 0
  );

  const losingTrades = trades.filter(
    (trade) => trade.rMultiple < 0
  );

  const totalR = trades.reduce(
    (sum, trade) => sum + trade.rMultiple,
    0
  );

  const grossProfit = winningTrades.reduce(
    (sum, trade) => sum + trade.rMultiple,
    0
  );

  const grossLoss = Math.abs(
    losingTrades.reduce(
      (sum, trade) => sum + trade.rMultiple,
      0
    )
  );

  let equity = 0;
  let peak = 0;
  let maximumDrawdown = 0;

  for (const trade of trades) {
    equity += trade.rMultiple;

    peak = Math.max(peak, equity);

    const drawdown = peak - equity;

    maximumDrawdown = Math.max(
      maximumDrawdown,
      drawdown
    );
  }

  let currentWinningStreak = 0;
  let currentLosingStreak = 0;
  let longestWinningStreak = 0;
  let longestLosingStreak = 0;

  for (const trade of trades) {
    if (trade.rMultiple > 0) {
      currentWinningStreak += 1;
      currentLosingStreak = 0;

      longestWinningStreak = Math.max(
        longestWinningStreak,
        currentWinningStreak
      );
    } else if (trade.rMultiple < 0) {
      currentLosingStreak += 1;
      currentWinningStreak = 0;

      longestLosingStreak = Math.max(
        longestLosingStreak,
        currentLosingStreak
      );
    }
  }

  const largestWinningTrade =
    winningTrades.length > 0
      ? Math.max(
          ...winningTrades.map(
            (trade) => trade.rMultiple
          )
        )
      : 0;

  const largestLosingTrade =
    losingTrades.length > 0
      ? Math.min(
          ...losingTrades.map(
            (trade) => trade.rMultiple
          )
        )
      : 0;

  return {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: winningTrades.length / trades.length,
    averageR: totalR / trades.length,
    totalR,
    profitFactor:
      grossLoss === 0
        ? grossProfit > 0
          ? Infinity
          : 0
        : grossProfit / grossLoss,
    maximumDrawdown,
    largestWinningTrade,
    largestLosingTrade,
    longestWinningStreak,
    longestLosingStreak
  };
}