import express from "express";

const candleRouter = express.Router();

candleRouter.get("/:instrumentKey", async (req, res) => {
  try {
    const instrumentKey = decodeURIComponent(req.params.instrumentKey);
    const unit = req.query.unit || "minutes";
    const interval = req.query.interval || "5";
    const toDate = req.query.toDate;
    const fromDate = req.query.fromDate;

    if (!toDate) {
      return res.status(400).json({
        success: false,
        message: "toDate is required"
      });
    }

    const encodedInstrumentKey = encodeURIComponent(instrumentKey);

    let url =
      `https://api.upstox.com/v3/historical-candle/` +
      `${encodedInstrumentKey}/${unit}/${interval}/${toDate}`;

    if (fromDate) {
      url += `/${fromDate}`;
    }

    console.log("Candle request:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${process.env.UPSTOX_ACCESS_TOKEN}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Upstox candle error:", data);

      return res.status(response.status).json({
        success: false,
        message: "Unable to fetch historical candles",
        error: data
      });
    }

    const candles = data?.data?.candles || [];

    res.json({
      success: true,
      count: candles.length,
      data: candles,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("Candle API error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default candleRouter;