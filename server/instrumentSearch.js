import dotenv from "dotenv";
import { fileURLToPath } from "url";

const envPath = fileURLToPath(new URL("../.env", import.meta.url));
dotenv.config({ path: envPath });

const accessToken = process.env.UPSTOX_ACCESS_TOKEN;

if (!accessToken) {
  throw new Error("UPSTOX_ACCESS_TOKEN is missing in .env");
}

export async function searchInstruments(query) {
  const params = new URLSearchParams({
    query: query.slice(0, 50),
    exchanges: "NSE",
    segments: "EQ",
    page_number: "1",
    records: "30",
  });

  const response = await fetch(
    `https://api.upstox.com/v2/instruments/search?${params}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Upstox search failed: ${response.status} ${errorText}`
    );
  }

  const result = await response.json();

  return (result.data || []).map((instrument) => ({
    symbol: instrument.trading_symbol,
    name: instrument.name,
    instrumentKey: instrument.instrument_key,
    exchange: instrument.exchange,
    segment: instrument.segment,
    isin: instrument.isin || null,
  }));
}