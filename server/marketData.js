const marketData = new Map();
const listeners = new Set();

export function processMarketData(data) {
  if (!data) return;

  let decodedData = data;

  try {
    if (Buffer.isBuffer(data)) {
      decodedData = JSON.parse(data.toString("utf-8"));
    } else if (typeof data === "string") {
      decodedData = JSON.parse(data);
    }
  } catch (error) {
    console.error("Unable to decode market data:", error.message);
    return;
  }

  const feeds = decodedData.feeds;

  if (!feeds || typeof feeds !== "object") {
    console.log("No feeds found in market data");
    return;
  }

  for (const [instrumentKey, feed] of Object.entries(feeds)) {
    const ltpc =
      feed?.ltpc ||
      feed?.fullFeed?.marketFF?.ltpc ||
      feed?.fullFeed?.indexFF?.ltpc;

    const market =
      feed?.fullFeed?.marketFF ||
      feed?.fullFeed?.indexFF;

    if (!ltpc) {
      console.log("No LTPC data for:", instrumentKey);
      continue;
    }

    const ltp = Number(ltpc.ltp);
    const previousClose = Number(ltpc.cp);

    if (!Number.isFinite(ltp)) {
      console.log("Invalid LTP for:", instrumentKey, ltpc);
      continue;
    }

    const change = Number.isFinite(previousClose)
      ? ltp - previousClose
      : null;

    const changePercent =
      Number.isFinite(previousClose) && previousClose !== 0
        ? (change / previousClose) * 100
        : null;

    const ohlc = market?.marketOHLC?.ohlc?.[0];

    const cleanData = {
      instrumentKey,
      ltp,
      previousClose,
      change,
      changePercent,
      open: ohlc?.open != null ? Number(ohlc.open) : null,
      high: ohlc?.high != null ? Number(ohlc.high) : null,
      low: ohlc?.low != null ? Number(ohlc.low) : null,
      close: ohlc?.close != null ? Number(ohlc.close) : null,
      volume: market?.vtt != null ? Number(market.vtt) : null,
      lastTradeTime: ltpc.ltt != null ? Number(ltpc.ltt) : null,
      lastTradeQuantity: ltpc.ltq != null ? Number(ltpc.ltq) : null,
      receivedAt: Date.now(),
    };

    marketData.set(instrumentKey, cleanData);

    listeners.forEach((listener) => {
      try {
        listener(cleanData);
      } catch (error) {
        console.error("Market-data listener error:", error);
      }
    });
  }
}

export function getMarketData(instrumentKey) {
  return marketData.get(instrumentKey) || null;
}

export function getAllMarketData() {
  return Object.fromEntries(marketData);
}

export function addMarketDataListener(listener) {
  listeners.add(listener);
}

export function removeMarketDataListener(listener) {
  listeners.delete(listener);
}

export function getMarketDataCount() {
  return marketData.size;
}