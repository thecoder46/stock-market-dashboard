import express from "express";
import { getAllMarketData } from "./marketData.js";

const marketContextRouter = express.Router();

function calculateMarketScore(nifty, bankNifty, vix) {
  let score = 50;

  const niftyChange = nifty?.changePercent;
  const bankNiftyChange = bankNifty?.changePercent;
  const vixValue = vix?.ltp;

  // NIFTY 50 contribution
  if (Number.isFinite(niftyChange)) {
    if (niftyChange > 1) score += 20;
    else if (niftyChange > 0.3) score += 10;
    else if (niftyChange < -1) score -= 20;
    else if (niftyChange < -0.3) score -= 10;
  }

  // BANK NIFTY contribution
  if (Number.isFinite(bankNiftyChange)) {
    if (bankNiftyChange > 1) score += 15;
    else if (bankNiftyChange > 0.3) score += 8;
    else if (bankNiftyChange < -1) score -= 15;
    else if (bankNiftyChange < -0.3) score -= 8;
  }

  // Higher India VIX indicates greater volatility
  if (Number.isFinite(vixValue)) {
    if (vixValue >= 25) score -= 15;
    else if (vixValue >= 20) score -= 8;
    else if (vixValue < 15) score += 8;
  }

  score = Math.max(0, Math.min(100, score));

  let bias = "NEUTRAL";

  if (score >= 65) {
    bias = "BULLISH";
  } else if (score <= 35) {
    bias = "BEARISH";
  }

  return { score, bias };
}

marketContextRouter.get("/", (req, res) => {
  try {
    const data = getAllMarketData();

    const nifty = data["NSE_INDEX|Nifty 50"] || null;
    const bankNifty = data["NSE_INDEX|Nifty Bank"] || null;
    const vix = data["NSE_INDEX|India VIX"] || null;

    const marketScore = calculateMarketScore(
      nifty,
      bankNifty,
      vix
    );

    res.json({
      success: true,
      market: {
        nifty,
        bankNifty,
        vix
      },
      score: marketScore.score,
      bias: marketScore.bias,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("Market context error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default marketContextRouter;