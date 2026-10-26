import express from "express";
import { runBacktest } from "./backtest.js";

const backtestRouter = express.Router();

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

backtestRouter.get("/:instrumentKey", async (req, res) => {
  try {
    const instrumentKey = decodeURIComponent(req.params.instrumentKey);

    if (!instrumentKey) {
      return res.status(400).json({
        success: false,
        message: "instrumentKey is required"
      });
    }

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
      return res.status(response.status).json({
        success: false,
        message: "Unable to fetch historical candles",
        error: data
      });
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

    const result = runBacktest(candles);

    res.json({
      success: true,
      instrumentKey,
      period: {
        from: fromDateString,
        to: toDateString,
        interval: "1 day"
      },
      ...result,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("Backtest error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default backtestRouter;