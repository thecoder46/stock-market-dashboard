import express from "express";

const ipoRouter = express.Router();

ipoRouter.get("/", async (req, res) => {
  try {
    const status = req.query.status || "open";
    const issueType = req.query.issue_type || "";

    const params = new URLSearchParams({
      status,
      page_number: "1",
      records: "30"
    });

    if (issueType) {
      params.set("issue_type", issueType);
    }

    const response = await fetch(
      `https://api.upstox.com/v2/ipos?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${process.env.UPSTOX_ACCESS_TOKEN}`
        }
      }
    );

    const data = await response.json();

    console.log("IPO API status:", response.status);

    if (!response.ok) {
      console.error("IPO API response:", data);
      return res.status(response.status).json(data);
    }

    res.json(data);
  } catch (error) {
    console.error("IPO API error:", error);

    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

export default ipoRouter;