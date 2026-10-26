import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";

import {
  connectUpstox,
  subscribeInstruments,
  unsubscribeInstruments,
  getSubscriptions,
  isUpstoxConnected
} from "./upstox.js";

import {
  processMarketData,
  getAllMarketData
} from "./marketData.js";

import { setupWebSocket } from "./websocket.js";
import routes from "./routes.js";
import ipoRouter from "./ipo.js";
import candleRouter from "./candleRoutes.js";
import analysisRouter from "./analysisRoutes.js";
import newsRouter from "./news.js";
import marketContextRouter from "./marketContext.js";
import scannerRouter from "./scannerRoutes.js";
import backtestRouter from "./backtestRoutes.js";

const app = express();
const server = createServer(app);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// API routes
app.use("/api", routes);
app.use("/api/ipos", ipoRouter);
app.use("/api/candles", candleRouter);
app.use("/api/analysis", analysisRouter);
app.use("/api/news", newsRouter);
app.use("/api/market-context", marketContextRouter);
app.use("/api/scanner", scannerRouter);
app.use("/api/backtest", backtestRouter);

// Connect incoming Upstox feed data to the market-data processor
global.handleMarketData = processMarketData;

// Live quotes
app.get("/api/quotes", (req, res) => {
  const data = getAllMarketData();

  res.json({
    success: true,
    connected: isUpstoxConnected(),
    count: Object.keys(data).length,
    data,
    timestamp: Date.now()
  });
});

// Current instrument subscriptions
app.get("/api/subscriptions", (req, res) => {
  res.json({
    success: true,
    connected: isUpstoxConnected(),
    subscriptions: getSubscriptions()
  });
});

// Subscribe to instruments
app.post("/api/subscribe", (req, res) => {
  const { instrumentKeys } = req.body;

  if (
    !Array.isArray(instrumentKeys) ||
    instrumentKeys.length === 0 ||
    !instrumentKeys.every(
      key => typeof key === "string" && key.trim().length > 0
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "instrumentKeys must be a non-empty array of strings"
    });
  }

  if (!isUpstoxConnected()) {
    return res.status(503).json({
      success: false,
      message: "Upstox market feed is not connected"
    });
  }

  const uniqueKeys = [...new Set(instrumentKeys.map(key => key.trim()))];
  subscribeInstruments(uniqueKeys);

  return res.json({
    success: true,
    subscriptions: getSubscriptions()
  });
});

// Unsubscribe from instruments
app.post("/api/unsubscribe", (req, res) => {
  const { instrumentKeys } = req.body;

  if (
    !Array.isArray(instrumentKeys) ||
    instrumentKeys.length === 0 ||
    !instrumentKeys.every(
      key => typeof key === "string" && key.trim().length > 0
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "instrumentKeys must be a non-empty array of strings"
    });
  }

  if (!isUpstoxConnected()) {
    return res.status(503).json({
      success: false,
      message: "Upstox market feed is not connected"
    });
  }

  const uniqueKeys = [...new Set(instrumentKeys.map(key => key.trim()))];
  unsubscribeInstruments(uniqueKeys);

  return res.json({
    success: true,
    subscriptions: getSubscriptions()
  });
});

// Unknown API routes
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found"
  });
});

// General error handler
app.use((error, req, res, next) => {
  console.error("Unhandled server error:", error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
});

// Browser WebSocket endpoint: /ws/market
setupWebSocket(server);

const PORT = Number(process.env.PORT) || 5000;

server.listen(PORT, async () => {
  console.log(`Stock Market Dashboard API listening on port ${PORT}`);

  try {
    await connectUpstox();

    subscribeInstruments([
      "NSE_INDEX|Nifty 50",
      "NSE_INDEX|Nifty Bank",
      "NSE_INDEX|India VIX"
    ]);

    console.log("Default market indices subscription requested");
  } catch (error) {
    console.error("Unable to connect to Upstox market feed:", error);
  }
});