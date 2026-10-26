import { analyzeCandles } from "./technicalAnalysis.js";
import { analyzePatterns } from "./patternAnalysis.js";
import { generateSignal } from "./signalEngine.js";
import { calculateRisk } from "./riskEngine.js";
import { calculateFinalScore } from "./finalScoreEngine.js";
import { analyzeNews } from "./sentimentEngine.js";
import { getAllMarketData } from "./marketData.js";

export function analyzeStock(instrumentKey, candles, news = []) {
  if (!Array.isArray(candles) || candles.length < 200) {
    return {
      instrumentKey,
      available: false,
      reason: "At least 200 historical candles are required"
    };
  }

  try {
    const analysis = analyzeCandles(candles);
    const patterns = analyzePatterns(candles);
    const signals = generateSignal(analysis, patterns);
    const risk = calculateRisk(
      analysis,
      patterns,
      signals?.signal
    );

    const sentiment = analyzeNews(news);

    const marketData = getAllMarketData();

    const marketContext = {
      nifty: marketData["NSE_INDEX|Nifty 50"] || null,
      bankNifty: marketData["NSE_INDEX|Nifty Bank"] || null,
      vix: marketData["NSE_INDEX|India VIX"] || null
    };

    const finalScore = calculateFinalScore({
      analysis,
      patterns,
      signals,
      sentiment,
      marketContext
    });

    return {
      instrumentKey,
      available: true,
      currentPrice: analysis.currentPrice,
      trend: analysis.trend,
      volatility: analysis.volatility,
      pattern: patterns.pattern,
      technicalScore: signals.scores.technicalScore,
      patternScore: signals.scores.patternScore,
      signal: signals.signal,
      bias: signals.bias,
      risk,
      sentiment: {
        available: sentiment.available,
        sentiment: sentiment.sentiment,
        score: sentiment.score,
        articleCount: sentiment.articleCount
      },
      marketContext: {
        niftyChangePercent:
          marketContext.nifty?.changePercent ?? null,
        bankNiftyChangePercent:
          marketContext.bankNifty?.changePercent ?? null,
        indiaVix: marketContext.vix?.ltp ?? null
      },
      finalScore
    };
  } catch (error) {
    console.error(`Scanner error for ${instrumentKey}:`, error);

    return {
      instrumentKey,
      available: false,
      reason: error.message
    };
  }
}

export function rankStocks(results) {
  return results
    .filter((stock) => stock.available)
    .sort((a, b) => {
      const scoreA = a.finalScore?.score ?? 0;
      const scoreB = b.finalScore?.score ?? 0;
      return scoreB - scoreA;
    });
}