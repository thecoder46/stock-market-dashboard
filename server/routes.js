import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Stock Market Dashboard API is running",
    timestamp: Date.now(),
    endpoints: {
      health: "/api",
      quotes: "/api/quotes",
      subscriptions: "/api/subscriptions",
      subscribe: "POST /api/subscribe",
      unsubscribe: "POST /api/unsubscribe",
      ipos: "/api/ipos",
      candles: "/api/candles/:instrumentKey",
      analysis: "/api/analysis/:instrumentKey",
      news: "/api/news/:instrumentKey",
      marketContext: "/api/market-context",
      scanner: "POST /api/scanner",
      backtest: "/api/backtest/:instrumentKey",
      websocket: "/ws/market"
    }
  });
});

export default router;