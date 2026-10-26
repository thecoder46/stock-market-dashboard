const positiveWords = [
  "rise", "rises", "rising", "rally", "rallies", "jump", "jumps",
  "gain", "gains", "higher", "strong", "positive", "growth",
  "bullish", "surge", "surges", "up", "improve", "improved",
  "beat", "beats", "profit", "profits", "upgrade", "upgraded",
  "outperform", "outperforms", "record", "recovery", "recover",
  "expansion", "optimism", "buy", "buyback"
];

const negativeWords = [
  "fall", "falls", "falling", "drop", "drops", "decline",
  "declines", "lower", "weak", "negative", "bearish", "loss",
  "losses", "down", "slump", "slumps", "concern", "concerns",
  "risk", "risks", "crash", "downgrade", "downgraded",
  "underperform", "debt", "fraud", "penalty", "lawsuit",
  "warning", "warning", "miss", "misses", "sell", "selling"
];

function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function calculateTextSentiment(text) {
  const normalized = normalizeText(text);

  if (!normalized) {
    return {
      sentiment: "NEUTRAL",
      score: 0,
      positiveCount: 0,
      negativeCount: 0
    };
  }

  const words = normalized.split(" ");
  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of words) {
    if (positiveWords.includes(word)) positiveCount++;
    if (negativeWords.includes(word)) negativeCount++;
  }

  const totalMatches = positiveCount + negativeCount;

  const score = totalMatches === 0
    ? 0
    : ((positiveCount - negativeCount) / totalMatches) * 100;

  let sentiment = "NEUTRAL";

  if (score >= 50) sentiment = "VERY_POSITIVE";
  else if (score >= 15) sentiment = "POSITIVE";
  else if (score <= -50) sentiment = "VERY_NEGATIVE";
  else if (score <= -15) sentiment = "NEGATIVE";

  return {
    sentiment,
    score: Number(score.toFixed(2)),
    positiveCount,
    negativeCount
  };
}

export function analyzeNews(articles = []) {
  if (!Array.isArray(articles) || articles.length === 0) {
    return {
      available: false,
      sentiment: "NEUTRAL",
      score: 0,
      articleCount: 0,
      articles: []
    };
  }

  const analyzedArticles = articles.map((article) => {
    const headline =
      article?.headline ||
      article?.title ||
      "";

    const summary =
      article?.summary ||
      article?.description ||
      "";

    const result = calculateTextSentiment(
      `${headline} ${summary}`
    );

    return {
      headline,
      summary,
      sentiment: result.sentiment,
      score: result.score,
      positiveCount: result.positiveCount,
      negativeCount: result.negativeCount,
      publishedAt:
        article?.published_at ||
        article?.publishedAt ||
        null,
      url: article?.url || article?.link || null
    };
  });

  // Average article scores equally.
  const averageScore =
    analyzedArticles.reduce(
      (sum, article) => sum + article.score,
      0
    ) / analyzedArticles.length;

  let overallSentiment = "NEUTRAL";

  if (averageScore >= 50) {
    overallSentiment = "VERY_POSITIVE";
  } else if (averageScore >= 15) {
    overallSentiment = "POSITIVE";
  } else if (averageScore <= -50) {
    overallSentiment = "VERY_NEGATIVE";
  } else if (averageScore <= -15) {
    overallSentiment = "NEGATIVE";
  }

  return {
    available: true,
    sentiment: overallSentiment,
    score: Number(averageScore.toFixed(2)),
    articleCount: analyzedArticles.length,
    articles: analyzedArticles
  };
}