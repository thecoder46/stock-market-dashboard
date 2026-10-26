function round(value, decimals = 2) {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(decimals));
}

function calculateRiskReward(entry, stopLoss, target) {
  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(target - entry);

  if (risk === 0) return null;

  return round(reward / risk, 2);
}

function createSetup({
  direction,
  status,
  trigger,
  entry,
  stopLoss,
  target1,
  target2
}) {
  return {
    direction,
    status,
    trigger,
    entry: round(entry),
    stopLoss: round(stopLoss),
    target1: round(target1),
    target2: round(target2),
    riskRewardTarget1: calculateRiskReward(
      entry,
      stopLoss,
      target1
    ),
    riskRewardTarget2: calculateRiskReward(
      entry,
      stopLoss,
      target2
    )
  };
}

export function calculateRisk(analysis, patterns, signal) {
  const currentPrice = analysis?.currentPrice;
  const atr = analysis?.indicators?.atr14;

  const support =
    patterns?.supportResistance?.support ??
    analysis?.indicators?.support;

  const resistance =
    patterns?.supportResistance?.resistance ??
    analysis?.indicators?.resistance;

  if (
    !Number.isFinite(currentPrice) ||
    currentPrice <= 0 ||
    !Number.isFinite(atr) ||
    atr <= 0
  ) {
    return {
      available: false,
      reason: "Insufficient price or ATR data"
    };
  }

  let setup = null;

  if (signal === "WAIT_FOR_BREAKDOWN") {
    const entry =
      patterns?.breakout?.breakdownLevel ?? support;

    if (!Number.isFinite(entry) || entry <= 0) {
      return {
        available: false,
        reason: "A valid breakdown level is unavailable"
      };
    }

    setup = createSetup({
      direction: "SELL",
      status: "WAIT",
      trigger: `Wait for a candle close below ${round(entry)}`,
      entry,
      stopLoss: entry + atr * 1.5,
      target1: entry - atr * 2,
      target2: entry - atr * 3
    });
  } else if (signal === "WAIT_FOR_BREAKOUT") {
    const entry =
      patterns?.breakout?.breakoutLevel ?? resistance;

    if (!Number.isFinite(entry) || entry <= 0) {
      return {
        available: false,
        reason: "A valid breakout level is unavailable"
      };
    }

    setup = createSetup({
      direction: "BUY",
      status: "WAIT",
      trigger: `Wait for a candle close above ${round(entry)}`,
      entry,
      stopLoss: entry - atr * 1.5,
      target1: entry + atr * 2,
      target2: entry + atr * 3
    });
  } else if (signal === "BUY") {
    setup = createSetup({
      direction: "BUY",
      status: "ACTIVE",
      trigger: "BUY signal generated; confirm execution conditions",
      entry: currentPrice,
      stopLoss: currentPrice - atr * 1.5,
      target1: currentPrice + atr * 2,
      target2: currentPrice + atr * 3
    });
  } else if (signal === "SELL") {
    setup = createSetup({
      direction: "SELL",
      status: "ACTIVE",
      trigger: "SELL signal generated; confirm execution conditions",
      entry: currentPrice,
      stopLoss: currentPrice + atr * 1.5,
      target1: currentPrice - atr * 2,
      target2: currentPrice - atr * 3
    });
  }

  if (!setup) {
    return {
      available: true,
      status: "NO_SETUP",
      message: "No actionable trade setup currently exists"
    };
  }

  return {
    available: true,
    currentPrice: round(currentPrice),
    atr: round(atr),
    support: round(support),
    resistance: round(resistance),
    setup
  };
}