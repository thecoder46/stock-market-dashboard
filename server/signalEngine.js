function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function calculatePatternScore(patterns) {
  let score = 50;

  const structure = patterns?.trendStructure?.structure;
  const breakout = patterns?.breakout?.breakout;
  const breakdown = patterns?.breakout?.breakdown;
  const detectedPatterns = patterns?.patterns || [];

  if (structure === "BULLISH") score += 20;
  if (structure === "BEARISH") score -= 20;

  if (breakout) score += 20;
  if (breakdown) score -= 20;

  if (
    patterns?.pattern === "DOUBLE_BOTTOM" ||
    detectedPatterns.includes("DOUBLE_BOTTOM")
  ) {
    score += 10;
  }

  if (
    patterns?.pattern === "DOUBLE_TOP" ||
    detectedPatterns.includes("DOUBLE_TOP")
  ) {
    score -= 10;
  }

  if (patterns?.consolidation) {
    score = 50;
  }

  return clamp(score, 0, 100);
}

function determineBias(analysis, patterns) {
  const structure = patterns?.trendStructure?.structure;
  const trend = analysis?.trend;

  if (
    trend === "STRONG UPTREND" &&
    structure === "BULLISH"
  ) {
    return "STRONGLY_BULLISH";
  }

  if (
    trend === "STRONG DOWNTREND" &&
    structure === "BEARISH"
  ) {
    return "STRONGLY_BEARISH";
  }

  if (structure === "BULLISH") return "BULLISH";
  if (structure === "BEARISH") return "BEARISH";

  return "NEUTRAL";
}

function determineSignal(analysis, patterns, combinedScore) {
  const structure = patterns?.trendStructure?.structure;
  const breakout = patterns?.breakout?.breakout === true;
  const breakdown = patterns?.breakout?.breakdown === true;
  const volumeRatio = analysis?.indicators?.volume?.ratio ?? 0;

  const bullishConfirmation =
    breakout &&
    combinedScore >= 60 &&
    volumeRatio >= 1.1;

  const bearishConfirmation =
    breakdown &&
    combinedScore <= 40 &&
    volumeRatio >= 1.1;

  if (bullishConfirmation) return "BUY";
  if (bearishConfirmation) return "SELL";

  if (
    structure === "BEARISH" &&
    combinedScore <= 40 &&
    !breakdown
  ) {
    return "WAIT_FOR_BREAKDOWN";
  }

  if (
    structure === "BULLISH" &&
    combinedScore >= 60 &&
    !breakout
  ) {
    return "WAIT_FOR_BREAKOUT";
  }

  if (combinedScore >= 45 && combinedScore <= 65) {
    return "HOLD";
  }

  return "NO_TRADE";
}

export function generateSignal(analysis, patterns) {
  const technicalScore = Number.isFinite(analysis?.score)
    ? analysis.score
    : 50;

  const patternScore = calculatePatternScore(patterns);

  const combinedScore = Math.round(
    clamp(
      technicalScore * 0.7 + patternScore * 0.3,
      0,
      100
    )
  );

  const signal = determineSignal(
    analysis,
    patterns,
    combinedScore
  );

  const bias = determineBias(analysis, patterns);

  return {
    signal,
    bias,
    confidence: combinedScore,
    scores: {
      technicalScore: Math.round(technicalScore),
      patternScore: Math.round(patternScore),
      combinedScore
    },
    setup: {
      breakout: patterns?.breakout?.breakout === true,
      breakdown: patterns?.breakout?.breakdown === true,
      support: patterns?.supportResistance?.support ?? null,
      resistance: patterns?.supportResistance?.resistance ?? null
    }
  };
}