import express from "express";
import { searchInstruments } from "./instrumentSearch.js";

const router = express.Router();

router.get("/instruments/search", async (req, res) => {
  try {
    const query = String(req.query.query || "").trim();

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const data = await searchInstruments(query);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Instrument search error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to search instruments",
    });
  }
});

export default router;