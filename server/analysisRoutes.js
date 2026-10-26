import express from "express";
import { analyzeCandles } from "./technicalAnalysis.js";
import { analyzePatterns } from "./patternAnalysis.js";
import { generateSignal } from "./signalEngine.js";
import { calculateRisk } from "./riskEngine.js";
import { analyzeNews } from "./sentimentEngine.js";
import { calculateFinalScore } from "./finalScoreEngine.js";
import { getAllMarketData } from "./marketData.js";

const analysisRouter = express.Router();

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

async function fetchHistoricalCandles(instrumentKey) {
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setFullYear(today.getFullYear() - 1);

  const toDateString = formatDate(today);
  const fromDateString = formatDate(fromDate);

  const url =
    "https://api.upstox.com/v3/historical-candle/" +
    `${encodeURIComponent(instrumentKey)}/days/1/` +
    `${toDateString}/${fromDateString}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${process.env.UPSTOX_ACCESS_TOKEN}`
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.errors?.[0]?.message ||
      "Unable to fetch historical candles"
    );
  }

  const candles = (data?.data?.candles || [])
    .map((candle) => ({
      time: candle[0],
      open: Number(candle[1]),
      high: Number(candle[2]),
      low: Number(candle[3]),
      close: Number(candle[4]),
      volume: Number(candle[5] || 0),
      openInterest: Number(candle[6] || 0)
    }))
    .reverse();

  return {
    candles,
    fromDateString,
    toDateString
  };
}

async function fetchStockNews(instrumentKey) {
  const params = new URLSearchParams({
    category: "instrument_keys",
    instrument_keys: instrumentKey,
    page_number: "1",
    page_size: "20"
  });

  const response = await fetch(
    `https://api.upstox.com/v2/news?${params.toString()}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${process.env.UPSTOX_ACCESS_TOKEN}`
      }
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.errors?.[0]?.message || "Unable to fetch stock news"
    );
  }

  return data?.data?.[instrumentKey] || [];
}

analysisRouter.get("/:instrumentKey", async (req, res) => {
  try {
    const instrumentKey = decodeURIComponent(
      req.params.instrumentKey
    ).trim();

    if (!instrumentKey) {
      return res.status(400).json({
        success: false,
        message: "instrumentKey is required"
      });
    }

    const {
      candles,
      fromDateString,
      toDateString
    } = await fetchHistoricalCandles(instrumentKey);

    if (candles.length < 200) {
      return res.status(400).json({
        success: false,
        message: "At least 200 historical candles are required"
      });
    }

    const analysis = analyzeCandles(candles);
    const patterns = analyzePatterns(candles);
    const signals = generateSignal(analysis, patterns);
    const risk = calculateRisk(
      analysis,
      patterns,
      signals.signal
    );

    let news = [];
    let sentiment = {
      available: false,
      sentiment: "NEUTRAL",
      score: 0,
      articleCount: 0,
      articles: []
    };
    let newsWarning = null;

    try {
      news = await fetchStockNews(instrumentKey);
      sentiment = analyzeNews(news);
    } catch (error) {
      newsWarning = error.message;
      console.error("News loading error:", newsWarning);
    }

    const allMarketData = getAllMarketData();

    const marketContext = {
      nifty: allMarketData["NSE_INDEX|Nifty 50"] || null,
      bankNifty: allMarketData["NSE_INDEX|Nifty Bank"] || null,
      vix: allMarketData["NSE_INDEX|India VIX"] || null
    };

    const finalScore = calculateFinalScore({
      analysis,
      patterns,
      signals,
      sentiment,
      marketContext
    });

    res.json({
      success: true,
      instrumentKey,
      period: {
        from: fromDateString,
        to: toDateString,
        interval: "1 day"
      },
      analysis,
      patterns,
      signals,
      risk,
      news: {
        count: news.length,
        articles: news
      },
      sentiment,
      marketContext,
      finalScore,
      ...(newsWarning ? { newsWarning } : {}),
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("Technical analysis error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default analysisRouter;