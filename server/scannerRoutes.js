import express from "express";
import { analyzeStock, rankStocks } from "./scanner.js";

const scannerRouter = express.Router();

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

async function fetchHistoricalCandles(instrumentKey) {
  const today = new Date();
  const fromDate = new Date(today);
  fromDate.setFullYear(today.getFullYear() - 1);

  const url =
    "https://api.upstox.com/v3/historical-candle/" +
    `${encodeURIComponent(instrumentKey)}/days/1/` +
    `${formatDate(today)}/${formatDate(fromDate)}`;

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

  return (data?.data?.candles || [])
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
      data?.errors?.[0]?.message ||
      "Unable to fetch stock news"
    );
  }

  return data?.data?.[instrumentKey] || [];
}

scannerRouter.post("/", async (req, res) => {
  try {
    const { instrumentKeys } = req.body;

    if (
      !Array.isArray(instrumentKeys) ||
      instrumentKeys.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "instrumentKeys must be a non-empty array"
      });
    }

    if (
      instrumentKeys.some(
        (key) => typeof key !== "string" || !key.trim()
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Every instrument key must be a non-empty string"
      });
    }

    const uniqueKeys = [...new Set(
      instrumentKeys.map((key) => key.trim())
    )];

    if (uniqueKeys.length > 20) {
      return res.status(400).json({
        success: false,
        message: "Scan a maximum of 20 stocks per request"
      });
    }

    const results = [];

    for (const instrumentKey of uniqueKeys) {
      try {
        console.log(`Scanning ${instrumentKey}...`);

        const candles = await fetchHistoricalCandles(instrumentKey);

        let news = [];
        let newsWarning = null;

        try {
          news = await fetchStockNews(instrumentKey);
        } catch (error) {
          newsWarning = error.message;
          console.error(
            `News error for ${instrumentKey}:`,
            newsWarning
          );
        }

        const result = analyzeStock(
          instrumentKey,
          candles,
          news
        );

        if (result.available && newsWarning) {
          result.newsWarning = newsWarning;
        }

        results.push(result);
      } catch (error) {
        console.error(
          `Unable to scan ${instrumentKey}:`,
          error.message
        );

        results.push({
          instrumentKey,
          available: false,
          reason: error.message
        });
      }
    }

    const ranked = rankStocks(results);
    const unavailable = results.filter(
      (stock) => !stock.available
    );

    res.json({
      success: true,
      requested: uniqueKeys.length,
      available: ranked.length,
      unavailable: unavailable.length,
      data: ranked,
      errors: unavailable,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("Stock scanner error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default scannerRouter;