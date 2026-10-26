import express from "express";

const ipoRouter = express.Router();

ipoRouter.get("/", async (req, res) => {
  try {
    const accessToken = process.env.UPSTOX_ACCESS_TOKEN;

    if (!accessToken) {
      return res.status(500).json({
        success: false,
        message: "Upstox access token is not configured"
      });
    }

    const allowedStatuses = new Set([
      "open",
      "upcoming",
      "closed",
      "listed"
    ]);

    const status = String(req.query.status || "open").toLowerCase();
    const issueType = req.query.issue_type
      ? String(req.query.issue_type).toLowerCase()
      : "";

    if (!allowedStatuses.has(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid status. Use open, upcoming, closed, or listed."
      });
    }

    const params = new URLSearchParams({
      status,
      page_number: "1",
      records: "30"
    });

    if (issueType) {
      params.set("issue_type", issueType);
    }

    const url =
      `https://api.upstox.com/v2/ipos?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Upstox IPO API error:", data);

      return res.status(response.status).json({
        success: false,
        message: "Unable to fetch IPO data",
        error: data
      });
    }

    return res.json({
      success: true,
      status,
      issueType: issueType || null,
      data: data?.data ?? [],
      metadata: data?.metadata ?? null,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("IPO API error:", error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default ipoRouter;