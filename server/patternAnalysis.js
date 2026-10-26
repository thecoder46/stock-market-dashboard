function findSwingHighs(candles, left = 3, right = 3) {
  const swingHighs = [];

  for (let i = left; i < candles.length - right; i++) {
    const high = candles[i].high;
    let isSwingHigh = true;

    for (let j = i - left; j <= i + right; j++) {
      if (j !== i && candles[j].high >= high) {
        isSwingHigh = false;
        break;
      }
    }

    if (isSwingHigh) {
      swingHighs.push({ index: i, price: high });
    }
  }

  return swingHighs;
}

function findSwingLows(candles, left = 3, right = 3) {
  const swingLows = [];

  for (let i = left; i < candles.length - right; i++) {
    const low = candles[i].low;
    let isSwingLow = true;

    for (let j = i - left; j <= i + right; j++) {
      if (j !== i && candles[j].low <= low) {
        isSwingLow = false;
        break;
      }
    }

    if (isSwingLow) {
      swingLows.push({ index: i, price: low });
    }
  }

  return swingLows;
}

function detectTrendStructure(swingHighs, swingLows) {
  const recentHighs = swingHighs.slice(-3);
  const recentLows = swingLows.slice(-3);

  const higherHigh =
    recentHighs.length >= 2 &&
    recentHighs[recentHighs.length - 1].price >
      recentHighs[recentHighs.length - 2].price;

  const lowerHigh =
    recentHighs.length >= 2 &&
    recentHighs[recentHighs.length - 1].price <
      recentHighs[recentHighs.length - 2].price;

  const higherLow =
    recentLows.length >= 2 &&
    recentLows[recentLows.length - 1].price >
      recentLows[recentLows.length - 2].price;

  const lowerLow =
    recentLows.length >= 2 &&
    recentLows[recentLows.length - 1].price <
      recentLows[recentLows.length - 2].price;

  let structure = "NEUTRAL";

  if (higherHigh && higherLow) {
    structure = "BULLISH";
  } else if (lowerHigh && lowerLow) {
    structure = "BEARISH";
  }

  const patterns = [];

  if (higherHigh) patterns.push("HIGHER_HIGH");
  if (lowerHigh) patterns.push("LOWER_HIGH");
  if (higherLow) patterns.push("HIGHER_LOW");
  if (lowerLow) patterns.push("LOWER_LOW");

  return {
    structure,
    higherHigh,
    lowerHigh,
    higherLow,
    lowerLow,
    swingHighs: recentHighs,
    swingLows: recentLows,
    patterns
  };
}

function detectSupportResistance(swingHighs, swingLows) {
  const support = swingLows.length
    ? Math.min(...swingLows.slice(-5).map((item) => item.price))
    : null;

  const resistance = swingHighs.length
    ? Math.max(...swingHighs.slice(-5).map((item) => item.price))
    : null;

  return { support, resistance };
}

function detectBreakoutBreakdown(candles, supportResistance) {
  const current = candles[candles.length - 1];
  const previous = candles[candles.length - 2];

  const { support, resistance } = supportResistance;

  const breakout =
    Number.isFinite(resistance) &&
    current.close > resistance &&
    previous.close <= resistance;

  const breakdown =
    Number.isFinite(support) &&
    current.close < support &&
    previous.close >= support;

  return {
    breakout,
    breakdown,
    breakoutLevel: breakout ? resistance : null,
    breakdownLevel: breakdown ? support : null
  };
}

function detectConsolidation(candles, period = 20) {
  if (candles.length < period) return false;

  const recent = candles.slice(-period);

  const highs = recent.map((candle) => candle.high);
  const lows = recent.map((candle) => candle.low);

  const highest = Math.max(...highs);
  const lowest = Math.min(...lows);

  const averageClose =
    recent.reduce((sum, candle) => sum + candle.close, 0) /
    recent.length;

  if (!Number.isFinite(averageClose) || averageClose <= 0) {
    return false;
  }

  const rangePercent =
    ((highest - lowest) / averageClose) * 100;

  return rangePercent < 5;
}

function detectDoubleTop(swingHighs) {
  if (swingHighs.length < 2) return false;

  const first = swingHighs[swingHighs.length - 2];
  const second = swingHighs[swingHighs.length - 1];

  const difference =
    Math.abs(first.price - second.price) /
    Math.max(first.price, second.price);

  return difference <= 0.02 && second.index > first.index;
}

function detectDoubleBottom(swingLows) {
  if (swingLows.length < 2) return false;

  const first = swingLows[swingLows.length - 2];
  const second = swingLows[swingLows.length - 1];

  const difference =
    Math.abs(first.price - second.price) /
    Math.max(first.price, second.price);

  return difference <= 0.02 && second.index > first.index;
}

export function analyzePatterns(candles) {
  if (!Array.isArray(candles) || candles.length < 20) {
    throw new Error("At least 20 candles are required for pattern analysis");
  }

  const swingHighs = findSwingHighs(candles);
  const swingLows = findSwingLows(candles);

  const trendStructure = detectTrendStructure(
    swingHighs,
    swingLows
  );

  const supportResistance = detectSupportResistance(
    swingHighs,
    swingLows
  );

  const breakout = detectBreakoutBreakdown(
    candles,
    supportResistance
  );

  const consolidation = detectConsolidation(candles);
  const doubleTop = detectDoubleTop(swingHighs);
  const doubleBottom = detectDoubleBottom(swingLows);

  const detectedPatterns = [...trendStructure.patterns];

  if (breakout.breakout) {
    detectedPatterns.push("BREAKOUT");
  }

  if (breakout.breakdown) {
    detectedPatterns.push("BREAKDOWN");
  }

  if (doubleTop) {
    detectedPatterns.push("DOUBLE_TOP");
  }

  if (doubleBottom) {
    detectedPatterns.push("DOUBLE_BOTTOM");
  }

  if (consolidation) {
    detectedPatterns.push("CONSOLIDATION");
  }

  let pattern = "NEUTRAL";
  let confidence = 50;

  if (breakout.breakout) {
    pattern = "BULLISH_BREAKOUT";
    confidence = 80;
  } else if (breakout.breakdown) {
    pattern = "BEARISH_BREAKDOWN";
    confidence = 80;
  } else if (doubleBottom) {
    pattern = "DOUBLE_BOTTOM";
    confidence = 65;
  } else if (doubleTop) {
    pattern = "DOUBLE_TOP";
    confidence = 65;
  } else if (trendStructure.structure === "BULLISH") {
    pattern = "BULLISH_STRUCTURE";
    confidence = 70;
  } else if (trendStructure.structure === "BEARISH") {
    pattern = "BEARISH_STRUCTURE";
    confidence = 70;
  } else if (consolidation) {
    pattern = "CONSOLIDATION";
    confidence = 60;
  }

  return {
    pattern,
    confidence,
    patterns: detectedPatterns,
    trendStructure,
    supportResistance,
    breakout,
    consolidation,
    doubleTop,
    doubleBottom
  };
}