function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function emaSeries(values, period) {
  if (values.length < period) return [];

  const multiplier = 2 / (period + 1);
  const result = [];
  let previous = average(values.slice(0, period));

  result[period - 1] = previous;

  for (let i = period; i < values.length; i++) {
    previous =
      (values[i] - previous) * multiplier + previous;
    result[i] = previous;
  }

  return result;
}

function calculateEMA(values, period) {
  const series = emaSeries(values, period);
  return series.length ? series[series.length - 1] : null;
}

function calculateRSI(values, period = 14) {
  if (values.length <= period) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;

  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];

    averageGain =
      (averageGain * (period - 1) + Math.max(change, 0)) /
      period;

    averageLoss =
      (averageLoss * (period - 1) + Math.max(-change, 0)) /
      period;
  }

  if (averageLoss === 0) return 100;

  const rs = averageGain / averageLoss;
  return 100 - 100 / (1 + rs);
}

function calculateMACD(values) {
  const fast = emaSeries(values, 12);
  const slow = emaSeries(values, 26);

  const macdValues = [];

  for (let i = 0; i < values.length; i++) {
    if (Number.isFinite(fast[i]) && Number.isFinite(slow[i])) {
      macdValues[i] = fast[i] - slow[i];
    }
  }

  const validMacd = macdValues.filter(Number.isFinite);
  const signalSeries = emaSeries(validMacd, 9);

  if (!validMacd.length || !signalSeries.length) {
    return {
      macd: null,
      signal: null,
      histogram: null
    };
  }

  const macd = validMacd[validMacd.length - 1];
  const signal = signalSeries[signalSeries.length - 1];

  return {
    macd,
    signal,
    histogram: macd - signal
  };
}

function calculateATR(candles, period = 14) {
  if (candles.length < period + 1) return null;

  const trueRanges = [];

  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const previous = candles[i - 1];

    trueRanges.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close)
      )
    );
  }

  let atr = average(trueRanges.slice(0, period));

  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }

  return atr;
}

function calculateBollingerBands(values, period = 20) {
  if (values.length < period) return null;

  const recent = values.slice(-period);
  const middle = average(recent);

  const variance = average(
    recent.map((value) => (value - middle) ** 2)
  );

  const standardDeviation = Math.sqrt(variance);
  const upper = middle + 2 * standardDeviation;
  const lower = middle - 2 * standardDeviation;

  return {
    middle,
    upper,
    lower,
    width: middle !== 0
      ? ((upper - lower) / middle) * 100
      : null
  };
}

function calculateVolume(candles, period = 20) {
  const recent = candles.slice(-period);
  const current = candles[candles.length - 1].volume;
  const averageVolume = average(
    recent.map((candle) => candle.volume)
  );

  return {
    current,
    average: averageVolume,
    ratio: averageVolume > 0 ? current / averageVolume : null
  };
}

function calculateVWAP(candles) {
  let cumulativePriceVolume = 0;
  let cumulativeVolume = 0;

  for (const candle of candles) {
    const typicalPrice =
      (candle.high + candle.low + candle.close) / 3;

    const volume = Number(candle.volume) || 0;

    cumulativePriceVolume += typicalPrice * volume;
    cumulativeVolume += volume;
  }

  return cumulativeVolume > 0
    ? cumulativePriceVolume / cumulativeVolume
    : null;
}

function calculateSupportResistance(candles, period = 20) {
  const recent = candles.slice(-period);

  return {
    support: Math.min(...recent.map((candle) => candle.low)),
    resistance: Math.max(...recent.map((candle) => candle.high))
  };
}

function round(value, decimals = 2) {
  return Number.isFinite(value)
    ? Number(value.toFixed(decimals))
    : null;
}

function calculateTechnicalScore({
  currentPrice,
  ema20,
  ema50,
  ema200,
  rsi14,
  macdHistogram,
  vwap,
  volumeRatio
}) {
  let score = 50;

  if (Number.isFinite(ema20)) {
    score += currentPrice > ema20 ? 8 : -8;
  }

  if (Number.isFinite(ema50)) {
    score += currentPrice > ema50 ? 8 : -8;
  }

  if (Number.isFinite(ema200)) {
    score += currentPrice > ema200 ? 10 : -10;
  }

  if (Number.isFinite(rsi14)) {
    if (rsi14 >= 55 && rsi14 <= 70) score += 8;
    else if (rsi14 > 70) score -= 4;
    else if (rsi14 < 30) score += 2;
    else if (rsi14 < 45) score -= 6;
  }

  if (Number.isFinite(macdHistogram)) {
    score += macdHistogram > 0 ? 8 : -8;
  }

  if (Number.isFinite(vwap)) {
    score += currentPrice > vwap ? 5 : -5;
  }

  if (Number.isFinite(volumeRatio)) {
    if (volumeRatio >= 1.5) score += 7;
    else if (volumeRatio >= 1.1) score += 3;
    else if (volumeRatio < 0.7) score -= 3;
  }

  return Math.max(0, Math.min(100, score));
}

export function analyzeCandles(candles) {
  if (!Array.isArray(candles) || candles.length < 200) {
    throw new Error(
      "At least 200 candles are required for technical analysis"
    );
  }

  const validCandles = candles.every((candle) =>
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close) &&
    candle.high >= candle.low
  );

  if (!validCandles) {
    throw new Error("Candles contain invalid OHLC values");
  }

  const closes = candles.map((candle) => candle.close);
  const currentPrice = closes[closes.length - 1];

  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const rsi14 = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const atr14 = calculateATR(candles, 14);
  const bollinger = calculateBollingerBands(closes, 20);
  const volume = calculateVolume(candles, 20);
  const vwap = calculateVWAP(candles);
  const supportResistance = calculateSupportResistance(candles, 20);

  let trend = "SIDEWAYS";

  if (
    ema20 > ema50 &&
    ema50 > ema200 &&
    currentPrice > ema20
  ) {
    trend = "STRONG UPTREND";
  } else if (
    ema20 < ema50 &&
    ema50 < ema200 &&
    currentPrice < ema20
  ) {
    trend = "STRONG DOWNTREND";
  }

  const atrPercent = currentPrice > 0 && Number.isFinite(atr14)
    ? (atr14 / currentPrice) * 100
    : null;

  let volatility = "NORMAL";

  if (Number.isFinite(atrPercent)) {
    if (atrPercent >= 3) volatility = "HIGH";
    else if (atrPercent < 1) volatility = "LOW";
  }

  const score = calculateTechnicalScore({
    currentPrice,
    ema20,
    ema50,
    ema200,
    rsi14,
    macdHistogram: macd.histogram,
    vwap,
    volumeRatio: volume.ratio
  });

  const reasons = [];

  if (currentPrice < ema20) reasons.push("Price is below EMA 20");
  if (currentPrice < ema50) reasons.push("Price is below EMA 50");
  if (currentPrice < ema200) reasons.push("Price is below EMA 200");
  if (rsi14 < 45) reasons.push("RSI shows weak momentum");
  if (macd.histogram < 0) reasons.push("MACD momentum is negative");
  if (Number.isFinite(vwap) && currentPrice < vwap) {
    reasons.push("Price is below VWAP");
  }
  if (volume.ratio >= 1.1) {
    reasons.push("Volume is above average");
  }

  return {
    currentPrice: round(currentPrice),
    score,
    trend,
    volatility,
    indicators: {
      ema20: round(ema20),
      ema50: round(ema50),
      ema200: round(ema200),
      rsi14: round(rsi14),
      macd: round(macd.macd),
      macdSignal: round(macd.signal),
      macdHistogram: round(macd.histogram),
      atr14: round(atr14),
      atrPercent: round(atrPercent),
      bollinger: bollinger
        ? {
            middle: round(bollinger.middle),
            upper: round(bollinger.upper),
            lower: round(bollinger.lower),
            width: round(bollinger.width)
          }
        : null,
      volume: {
        current: volume.current,
        average: round(volume.average),
        ratio: round(volume.ratio)
      },
      vwap: round(vwap),
      support: round(supportResistance.support),
      resistance: round(supportResistance.resistance)
    },
    reasons
  };
}