import express from "express";

const newsRouter = express.Router();

newsRouter.get("/:instrumentKey", async (req, res) => {
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

    const accessToken = process.env.UPSTOX_ACCESS_TOKEN;

    if (!accessToken) {
      return res.status(500).json({
        success: false,
        message: "Upstox access token is not configured"
      });
    }

    const params = new URLSearchParams({
      category: "instrument_keys",
      instrument_keys: instrumentKey,
      page_number: "1",
      page_size: "20"
    });

    const url =
      `https://api.upstox.com/v2/news?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Upstox news API error:", data);

      return res.status(response.status).json({
        success: false,
        message: "Unable to fetch stock news",
        error: data
      });
    }

    const articles = data?.data?.[instrumentKey] || [];

    res.json({
      success: true,
      instrumentKey,
      count: articles.length,
      data: articles,
      metadata: data?.metadata || null,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("News API error:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default newsRouter;