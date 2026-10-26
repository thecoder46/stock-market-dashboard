function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function calculateNewsScore(sentiment) {
  if (!sentiment?.available) return 50;

  const score = Number(sentiment.score);

  if (!Number.isFinite(score)) return 50;

  return clamp(50 + score / 2, 0, 100);
}

function calculateVolumeScore(analysis) {
  const ratio = analysis?.indicators?.volume?.ratio;

  if (!Number.isFinite(ratio)) return 50;
  if (ratio >= 2) return 90;
  if (ratio >= 1.5) return 80;
  if (ratio >= 1.1) return 65;
  if (ratio >= 0.8) return 50;

  return 35;
}

function calculatePatternScore(patterns) {
  if (!patterns) return 50;

  switch (patterns.pattern) {
    case "BULLISH_BREAKOUT":
      return 90;
    case "BEARISH_BREAKDOWN":
      return 10;
    case "BULLISH_STRUCTURE":
    case "DOUBLE_BOTTOM":
      return 75;
    case "BEARISH_STRUCTURE":
    case "DOUBLE_TOP":
      return 25;
    case "CONSOLIDATION":
      return 50;
    default:
      return 50;
  }
}

function calculateMarketScore(marketContext) {
  if (!marketContext) return 50;

  let score = 50;

  const niftyChange = marketContext.nifty?.changePercent;
  const bankNiftyChange = marketContext.bankNifty?.changePercent;
  const vix = marketContext.vix?.ltp;

  if (Number.isFinite(niftyChange)) {
    if (niftyChange > 1) score += 20;
    else if (niftyChange > 0.3) score += 10;
    else if (niftyChange < -1) score -= 20;
    else if (niftyChange < -0.3) score -= 10;
  }

  if (Number.isFinite(bankNiftyChange)) {
    if (bankNiftyChange > 1) score += 15;
    else if (bankNiftyChange > 0.3) score += 8;
    else if (bankNiftyChange < -1) score -= 15;
    else if (bankNiftyChange < -0.3) score -= 8;
  }

  if (Number.isFinite(vix)) {
    if (vix >= 25) score -= 15;
    else if (vix >= 20) score -= 8;
    else if (vix < 15) score += 8;
  }

  return clamp(score, 0, 100);
}

export function calculateFinalScore({
  analysis,
  patterns,
  signals,
  sentiment,
  marketContext
}) {
  const technicalScore = Number.isFinite(analysis?.score)
    ? analysis.score
    : 50;

  const patternScore = calculatePatternScore(patterns);
  const volumeScore = calculateVolumeScore(analysis);
  const newsScore = calculateNewsScore(sentiment);
  const marketScore = calculateMarketScore(marketContext);

  const weightedScore =
    technicalScore * 0.40 +
    patternScore * 0.20 +
    volumeScore * 0.10 +
    newsScore * 0.15 +
    marketScore * 0.15;

  const score = Math.round(clamp(weightedScore, 0, 100));

  let bias = "NEUTRAL";

  if (score >= 70) bias = "BULLISH";
  else if (score <= 30) bias = "BEARISH";

  let decision = "NO_TRADE";

  if (signals?.signal === "BUY" && score >= 70) {
    decision = "BUY";
  } else if (signals?.signal === "SELL" && score <= 30) {
    decision = "SELL";
  } else if (
    signals?.signal === "WAIT_FOR_BREAKOUT" &&
    score >= 55
  ) {
    decision = "BUY_ON_BREAKOUT";
  } else if (
    signals?.signal === "WAIT_FOR_BREAKDOWN" &&
    score <= 45
  ) {
    decision = "SELL_ON_BREAKDOWN";
  } else if (score >= 40 && score <= 60) {
    decision = "HOLD";
  }

  return {
    score,
    bias,
    decision,
    components: {
      technical: Math.round(technicalScore),
      pattern: Math.round(patternScore),
      volume: Math.round(volumeScore),
      news: Math.round(newsScore),
      market: Math.round(marketScore)
    },
    weights: {
      technical: 40,
      pattern: 20,
      volume: 10,
      news: 15,
      market: 15
    }
  };
}