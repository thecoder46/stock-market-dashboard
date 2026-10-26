import express from "express";

const candleRouter = express.Router();

candleRouter.get("/:instrumentKey", async (req, res) => {
  try {
    const instrumentKey = decodeURIComponent(
      req.params.instrumentKey
    ).trim();

    const unit = String(req.query.unit || "minutes").toLowerCase();
    const interval = String(req.query.interval || "5");
    const toDate = String(req.query.toDate || "");
    const fromDate = req.query.fromDate
      ? String(req.query.fromDate)
      : "";

    const accessToken = process.env.UPSTOX_ACCESS_TOKEN;

    if (!accessToken) {
      return res.status(500).json({
        success: false,
        message: "Upstox access token is not configured"
      });
    }

    if (!instrumentKey) {
      return res.status(400).json({
        success: false,
        message: "instrumentKey is required"
      });
    }

    if (!toDate) {
      return res.status(400).json({
        success: false,
        message: "toDate query parameter is required (YYYY-MM-DD)"
      });
    }

    const validDate = /^\d{4}-\d{2}-\d{2}$/;

    if (
      !validDate.test(toDate) ||
      (fromDate && !validDate.test(fromDate))
    ) {
      return res.status(400).json({
        success: false,
        message: "Dates must use YYYY-MM-DD format"
      });
    }

    if (
      !["minutes", "hours", "days", "weeks", "months"].includes(unit)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid candle unit"
      });
    }

    if (!/^\d+$/.test(interval) || Number(interval) <= 0) {
      return res.status(400).json({
        success: false,
        message: "interval must be a positive integer"
      });
    }

    if (fromDate && fromDate > toDate) {
      return res.status(400).json({
        success: false,
        message: "fromDate cannot be later than toDate"
      });
    }

    const encodedInstrumentKey = encodeURIComponent(instrumentKey);

    let url =
      `https://api.upstox.com/v3/historical-candle/` +
      `${encodedInstrumentKey}/${unit}/${interval}/${toDate}`;

    if (fromDate) {
      url += `/${fromDate}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`
      }
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Upstox candle API error:", result);

      return res.status(response.status).json({
        success: false,
        message: "Unable to fetch historical candles",
        error: result
      });
    }

    const candles = result?.data?.candles || [];

    return res.json({
      success: true,
      instrumentKey,
      unit,
      interval: Number(interval),
      count: candles.length,
      data: candles,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("Candle API error:", error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default candleRouter;