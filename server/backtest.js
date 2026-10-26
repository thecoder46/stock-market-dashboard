import { analyzeCandles } from "./technicalAnalysis.js";
import { analyzePatterns } from "./patternAnalysis.js";
import { generateSignal } from "./signalEngine.js";

const ATR_MULTIPLIER = 1.5;
const TARGET_MULTIPLIER = 2;
const MAX_HOLDING_CANDLES = 20;
const COST_PERCENT_PER_TRADE = 0.20;

function round(value, decimals = 2) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(decimals));
}

function calculateMetrics(trades) {
  const wins = trades.filter((trade) => trade.netReturnPercent > 0);
  const losses = trades.filter((trade) => trade.netReturnPercent < 0);
  const breakeven = trades.filter((trade) => trade.netReturnPercent === 0);

  const grossProfit = wins.reduce(
    (sum, trade) => sum + trade.netReturnPercent,
    0
  );

  const grossLoss = Math.abs(
    losses.reduce((sum, trade) => sum + trade.netReturnPercent, 0)
  );

  const totalNetReturn = trades.reduce(
    (sum, trade) => sum + trade.netReturnPercent,
    0
  );

  let cumulativeReturn = 0;
  let peakReturn = 0;
  let maxDrawdown = 0;

  for (const trade of trades) {
    cumulativeReturn += trade.netReturnPercent;
    peakReturn = Math.max(peakReturn, cumulativeReturn);
    maxDrawdown = Math.max(
      maxDrawdown,
      peakReturn - cumulativeReturn
    );
  }

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakeven: breakeven.length,
    winRate: trades.length
      ? round((wins.length / trades.length) * 100)
      : 0,
    grossProfitPercent: round(grossProfit, 3),
    grossLossPercent: round(grossLoss, 3),
    profitFactor: grossLoss > 0
      ? round(grossProfit / grossLoss, 2)
      : grossProfit > 0 ? null : 0,
    averageNetReturnPercent: trades.length
      ? round(totalNetReturn / trades.length, 3)
      : 0,
    cumulativeTradeReturnPercent: round(totalNetReturn, 3),
    maxDrawdownPercent: round(maxDrawdown, 3)
  };
}

export function runBacktest(candles) {
  if (!Array.isArray(candles) || candles.length < 220) {
    throw new Error("At least 220 historical candles are required");
  }

  const trades = [];
  let index = 200;

  while (index < candles.length - 1) {
    let analysis;
    let patterns;
    let signals;

    try {
      const history = candles.slice(0, index + 1);
      analysis = analyzeCandles(history);
      patterns = analyzePatterns(history);
      signals = generateSignal(analysis, patterns);
    } catch (error) {
      index++;
      continue;
    }

    const direction =
      signals?.signal === "BUY"
        ? "BUY"
        : signals?.signal === "SELL"
          ? "SELL"
          : null;

    if (!direction) {
      index++;
      continue;
    }

    const atr = analysis?.indicators?.atr14;
    const entryCandle = candles[index + 1];

    if (
      !Number.isFinite(atr) ||
      atr <= 0 ||
      !Number.isFinite(entryCandle?.open) ||
      entryCandle.open <= 0
    ) {
      index++;
      continue;
    }

    const entry = entryCandle.open;

    const stopLoss = direction === "BUY"
      ? entry - ATR_MULTIPLIER * atr
      : entry + ATR_MULTIPLIER * atr;

    const target = direction === "BUY"
      ? entry + TARGET_MULTIPLIER * atr
      : entry - TARGET_MULTIPLIER * atr;

    const lastIndex = Math.min(
      index + MAX_HOLDING_CANDLES,
      candles.length - 1
    );

    let exitPrice = null;
    let exitReason = "TIME_EXIT";
    let exitIndex = lastIndex;

    for (let j = index + 1; j <= lastIndex; j++) {
      const candle = candles[j];

      const stopHit = direction === "BUY"
        ? candle.low <= stopLoss
        : candle.high >= stopLoss;

      const targetHit = direction === "BUY"
        ? candle.high >= target
        : candle.low <= target;

      if (stopHit) {
        exitPrice = stopLoss;
        exitReason = "STOP_LOSS";
        exitIndex = j;
        break;
      }

      if (targetHit) {
        exitPrice = target;
        exitReason = "TARGET";
        exitIndex = j;
        break;
      }
    }

    if (exitPrice === null) {
      exitPrice = candles[exitIndex].close;
    }

    const grossReturnPercent = direction === "BUY"
      ? ((exitPrice - entry) / entry) * 100
      : ((entry - exitPrice) / entry) * 100;

    const netReturnPercent =
      grossReturnPercent - COST_PERCENT_PER_TRADE;

    trades.push({
      signalDate: candles[index].time,
      entryDate: entryCandle.time,
      exitDate: candles[exitIndex].time,
      direction,
      entry: round(entry),
      stopLoss: round(stopLoss),
      target: round(target),
      exit: round(exitPrice),
      exitReason,
      grossReturnPercent: round(grossReturnPercent, 3),
      estimatedCostPercent: COST_PERCENT_PER_TRADE,
      netReturnPercent: round(netReturnPercent, 3),
      outcome: netReturnPercent > 0
        ? "WIN"
        : netReturnPercent < 0 ? "LOSS" : "BREAKEVEN"
    });

    index = Math.max(exitIndex + 1, index + 1);
  }

  return {
    summary: calculateMetrics(trades),
    assumptions: {
      entry: "Next candle open after a confirmed BUY or SELL signal",
      stopLoss: `${ATR_MULTIPLIER} ATR from entry`,
      target: `${TARGET_MULTIPLIER} ATR from entry`,
      maximumHoldingCandles: MAX_HOLDING_CANDLES,
      sameCandleStopAndTarget: "Stop loss assumed first",
      estimatedRoundTripCostPercent: COST_PERCENT_PER_TRADE,
      transactionCostsAreEstimates: true,
      positionSizing: "Equal notional; returns are not compounded",
      drawdownMethod: "Cumulative sum of net trade returns",
      signalsIncluded: ["BUY", "SELL"],
      signalsExcluded: [
        "WAIT_FOR_BREAKOUT",
        "WAIT_FOR_BREAKDOWN",
        "HOLD",
        "NO_TRADE"
      ]
    },
    trades
  };
}