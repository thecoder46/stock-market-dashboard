import "dotenv/config";
import express from "express";
import cors from "cors";
import {
  connectUpstox,
  subscribeInstruments,
  unsubscribeInstruments,
  getSubscriptions,
} from "./upstox.js";
import {
  processMarketData,
  getAllMarketData,
} from "./marketData.js";
import { createServer } from "http";
import { setupWebSocket } from "./websocket.js";
import routes from "./routes.js";
import ipoRouter from "./ipo.js";
import candleRouter from "./candleRoutes.js";

const app = express();
const server = createServer(app);

app.use(cors());
app.use(express.json());
app.use("/api", routes);
app.use("/api/ipos", ipoRouter);
app.use("/api/candles", candleRouter);

global.handleMarketData = processMarketData;

app.get("/api/quotes", (req, res) => {
  const data = getAllMarketData();

  res.json({
    success: true,
    count: Object.keys(data).length,
    data,
    timestamp: Date.now(),
  });
});

app.get("/api/subscriptions", (req, res) => {
  res.json({
    success: true,
    subscriptions: getSubscriptions(),
  });
});

app.post("/api/subscribe", (req, res) => {
  const { instrumentKeys } = req.body;

  if (!Array.isArray(instrumentKeys) || !instrumentKeys.length) {
    return res.status(400).json({
      success: false,
      message: "instrumentKeys must be a non-empty array",
    });
  }

  subscribeInstruments(instrumentKeys);

  res.json({
    success: true,
    subscriptions: getSubscriptions(),
  });
});

app.post("/api/unsubscribe", (req, res) => {
  const { instrumentKeys } = req.body;

  if (!Array.isArray(instrumentKeys) || !instrumentKeys.length) {
    return res.status(400).json({
      success: false,
      message: "instrumentKeys must be a non-empty array",
    });
  }

  unsubscribeInstruments(instrumentKeys);

  res.json({
    success: true,
    subscriptions: getSubscriptions(),
  });
});

setupWebSocket(server);

const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);

  try {
    await connectUpstox();

    subscribeInstruments([
      "NSE_INDEX|Nifty 50",
      "NSE_INDEX|Nifty Bank",
      "NSE_INDEX|India VIX",
    ]);
  } catch (error) {
    console.error("Unable to connect to Upstox:", error);
  }
});