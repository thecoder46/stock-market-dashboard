
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:5000"
).replace(/\/+$/, "");

export const WS_URL =
  import.meta.env.VITE_WS_URL ||
  API_BASE_URL.replace(/^http/, "ws") + "/ws/market";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message ||
      data.error?.message ||
      `Request failed with status ${response.status}`
    );
  }

  return data;
}

function encodeInstrumentKey(instrumentKey) {
  return encodeURIComponent(instrumentKey);
}

// Backend health/status
export const getApiStatus = () =>
  request("/api");

// Live market quotes
export const getQuotes = () =>
  request("/api/quotes");

// Current Upstox subscriptions
export const getSubscriptions = () =>
  request("/api/subscriptions");

// Subscribe instruments to the live feed
export const subscribeInstruments = (instrumentKeys) =>
  request("/api/subscribe", {
    method: "POST",
    body: JSON.stringify({ instrumentKeys })
  });

// Unsubscribe instruments from the live feed
export const unsubscribeInstruments = (instrumentKeys) =>
  request("/api/unsubscribe", {
    method: "POST",
    body: JSON.stringify({ instrumentKeys })
  });

// IPO Centre
export const getIPOs = (status = "open", issueType = "") => {
  const params = new URLSearchParams({ status });

  if (issueType) {
    params.set("issue_type", issueType);
  }

  return request(`/api/ipos?${params.toString()}`);
};

// Historical candles
export const getCandles = (
  instrumentKey,
  {
    unit = "days",
    interval = 1,
    fromDate,
    toDate
  } = {}
) => {
  const params = new URLSearchParams({
    unit,
    interval: String(interval)
  });

  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);

  return request(
    `/api/candles/${encodeInstrumentKey(instrumentKey)}?${params.toString()}`
  );
};

// Technical analysis, patterns, signals, risk and final score
export const getStockAnalysis = (instrumentKey) =>
  request(`/api/analysis/${encodeInstrumentKey(instrumentKey)}`);

// Stock news
export const getStockNews = (instrumentKey) =>
  request(`/api/news/${encodeInstrumentKey(instrumentKey)}`);

// Overall market context
export const getMarketContext = () =>
  request("/api/market-context");

// Multi-stock scanner
export const scanStocks = (instrumentKeys) =>
  request("/api/scanner", {
    method: "POST",
    body: JSON.stringify({ instrumentKeys })
  });

// Historical strategy backtest
export const getBacktest = (instrumentKey) =>
  request(`/api/backtest/${encodeInstrumentKey(instrumentKey)}`);
