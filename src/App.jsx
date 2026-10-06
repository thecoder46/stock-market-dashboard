import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import "./features.css";

const API_URL = "http://localhost:5000";
const WS_URL = "ws://localhost:5000/ws/market";
const NIFTY_KEY = "NSE_INDEX|Nifty 50";

const INDEXES = [
  { symbol: "NIFTY 50", name: "Nifty 50", instrumentKey: "NSE_INDEX|Nifty 50" },
  { symbol: "BANK NIFTY", name: "Nifty Bank", instrumentKey: "NSE_INDEX|Nifty Bank" },
  { symbol: "INDIA VIX", name: "India VIX", instrumentKey: "NSE_INDEX|India VIX" },
];

const RANGE_OPTIONS = ["1D", "1W", "1M", "3M", "6M", "1Y"];
const INTERVAL_OPTIONS = ["1", "5", "15", "30"];

const TABLE_COLUMNS = [
  ["symbol", "Symbol"],
  ["ltp", "LTP"],
  ["change", "Change"],
  ["changePercent", "Change %"],
  ["open", "Open"],
  ["high", "High"],
  ["low", "Low"],
  ["volume", "Volume"],
];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatPrice(value) {
  if (value === null || value === undefined) return "--";
  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value) {
  if (value === null || value === undefined) return "--";
  return Number(value).toFixed(2);
}

function signed(value) {
  if (value === null || value === undefined) return "--";
  const n = Number(value);
  return `${n > 0 ? "+" : ""}${formatPrice(n)}`;
}

function signedPercent(value) {
  if (value === null || value === undefined) return "--";
  const n = Number(value);
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}`;
}

function formatVolume(value) {
  return value != null ? Number(value).toLocaleString("en-IN") : "--";
}

function readStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// YYYY-MM-DD in IST (toISOString() would give the UTC date, which is
// yesterday for the first 5.5 hours of every IST day).
function istDate(date) {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function formatCandleTime(time, range) {
  const intraday = range !== "6M" && range !== "1Y";
  return new Date(time).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    ...(intraday
      ? { hour: "2-digit", minute: "2-digit" }
      : { year: "numeric" }),
  });
}

async function postJSON(path, body) {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}

// One place that knows both what to request and the candle size.
function getCandleConfig(range, interval) {
  const from = new Date();

  switch (range) {
    case "1W":
      from.setDate(from.getDate() - 7);
      return { unit: "minutes", interval: "15", seconds: 15 * 60, from };
    case "1M":
      from.setMonth(from.getMonth() - 1);
      return { unit: "minutes", interval: "30", seconds: 30 * 60, from };
    case "3M":
      from.setMonth(from.getMonth() - 3);
      return { unit: "hours", interval: "1", seconds: 60 * 60, from };
    case "6M":
      from.setMonth(from.getMonth() - 6);
      return { unit: "days", interval: "1", seconds: 86400, from };
    case "1Y":
      from.setFullYear(from.getFullYear() - 1);
      return { unit: "days", interval: "1", seconds: 86400, from };
    default:
      // Look back several days so weekends/holidays still show the last
      // trading session, then keep only that session.
      from.setDate(from.getDate() - 7);
      return {
        unit: "minutes",
        interval: String(interval),
        seconds: Number(interval) * 60,
        from,
        latestDayOnly: true,
      };
  }
}

function getMarketStatus() {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const time = ist.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const day = ist.getDay();
  const minutes = ist.getHours() * 60 + ist.getMinutes();

  if (day === 0 || day === 6) {
    return { status: "CLOSED", label: "Market Closed (Weekend)", time };
  }
  if (minutes >= 555 && minutes < 930) {
    return { status: "OPEN", label: "Market Open", time };
  }
  if (minutes >= 540 && minutes < 555) {
    return { status: "PREOPEN", label: "Pre-Open", time };
  }
  if (minutes >= 930 && minutes < 960) {
    return { status: "POSTMARKET", label: "Post Market", time };
  }
  return { status: "CLOSED", label: "Market Closed", time };
}

function computeSma(candles, period) {
  const out = [];
  let sum = 0;
  candles.forEach((candle, index) => {
    sum += candle.close;
    if (index >= period) sum -= candles[index - period].close;
    if (index >= period - 1) out.push({ index, value: sum / period });
  });
  return out;
}

function alertHit(alert, price) {
  if (price == null) return false;
  const p = Number(price);
  return alert.condition === "above" ? p >= alert.price : p <= alert.price;
}

/* ------------------------------------------------------------------ */
/* Small presentational components                                     */
/* ------------------------------------------------------------------ */

function Sparkline({ points }) {
  if (!points || points.length < 2) {
    return <span className="spark-empty">--</span>;
  }

  const prices = points.map((point) => point.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const width = 90;
  const height = 28;
  const path = prices
    .map(
      (price, index) =>
        `${((index / (prices.length - 1)) * width).toFixed(1)},${(
          height - 2 - ((price - min) / range) * (height - 4)
        ).toFixed(1)}`
    )
    .join(" ");
  const up = prices[prices.length - 1] >= prices[0];

  return (
    <svg
      className={`sparkline ${up ? "up" : "down"}`}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
    >
      <polyline
        points={path}
        fill="none"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MarketCard({ item, data, direction }) {
  const header = (
    <div className="card-top">
      <div>
        <h2>{item.symbol}</h2>
        <span>{item.name}</span>
      </div>
    </div>
  );

  if (!data) {
    return (
      <div className="market-card">
        {header}
        <div className="price">₹--</div>
        <div className="updated">Waiting for market data...</div>
      </div>
    );
  }

  const change = Number(data.change ?? 0);
  const positive = change >= 0;

  return (
    <div className="market-card">
      {header}

      <div className={`price ${direction || ""}`}>
        ₹{formatPrice(data.ltp)}
        {direction === "up" && <span className="price-arrow">▲</span>}
        {direction === "down" && <span className="price-arrow">▼</span>}
      </div>

      <div className={positive ? "change positive" : "change negative"}>
        {signed(data.change)} ({signedPercent(data.changePercent)}%)
      </div>

      <div className={positive ? "market-direction positive" : "market-direction negative"}>
        {positive ? "▲ Bullish" : "▼ Bearish"}
      </div>

      <div className="market-stats">
        <div>
          <span>Open</span>
          <strong>₹{formatPrice(data.open)}</strong>
        </div>
        <div>
          <span>High</span>
          <strong>₹{formatPrice(data.high)}</strong>
        </div>
        <div>
          <span>Low</span>
          <strong>₹{formatPrice(data.low)}</strong>
        </div>
        <div>
          <span>Prev Close</span>
          <strong>₹{formatPrice(data.previousClose)}</strong>
        </div>
      </div>

      <div className="volume-row">
        <span>Volume</span>
        <strong>{formatVolume(data.volume)}</strong>
      </div>

      <div className="updated">
        Updated: {data.receivedAt ? new Date(data.receivedAt).toLocaleTimeString() : "--"}
      </div>
    </div>
  );
}

function Toasts({ toasts, onDismiss }) {
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.tone}`}>
          <span>{toast.message}</span>
          <button onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stock detail: owns candle loading, live candle merge, alerts form   */
/* ------------------------------------------------------------------ */

function StockDetail({
  stock,
  data,
  marketOpen,
  alerts,
  onAddAlert,
  onRemoveAlert,
  onClose,
}) {
  const [range, setRange] = useState("1D");
  const [candleInterval, setCandleInterval] = useState("5");
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hover, setHover] = useState(null);
  const [showSma, setShowSma] = useState(true);
  const [alertCondition, setAlertCondition] = useState("above");
  const [alertPrice, setAlertPrice] = useState("");
  const [alertError, setAlertError] = useState("");

  const key = stock.instrumentKey;
  const ltp = data?.ltp != null ? Number(data.ltp) : null;
  const rawTs = data?.lastTradeTime != null ? Number(data.lastTradeTime) : NaN;
  // Accept seconds or milliseconds.
  const tradeTs = Number.isFinite(rawTs) ? (rawTs < 1e12 ? rawTs * 1000 : rawTs) : null;

  // Escape closes the panel.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Load historical candles. AbortController prevents a slow, older
  // response from overwriting the newer range/interval the user picked.
  useEffect(() => {
    const controller = new AbortController();
    const config = getCandleConfig(range, candleInterval);

    (async () => {
      setLoading(true);
      setError("");
      setCandles([]);
      setHover(null);

      try {
        const params = new URLSearchParams({
          unit: config.unit,
          interval: config.interval,
          toDate: istDate(new Date()),
          fromDate: istDate(config.from),
        });

        const response = await fetch(
          `${API_URL}/api/candles/${encodeURIComponent(key)}?${params.toString()}`,
          { signal: controller.signal }
        );
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Unable to load candles");
        }

        const raw = Array.isArray(result.data) ? result.data : result.data?.candles || [];

        let parsed = raw
          .map((candle) => ({
            time: candle[0],
            open: Number(candle[1]),
            high: Number(candle[2]),
            low: Number(candle[3]),
            close: Number(candle[4]),
            volume: Number(candle[5] || 0),
          }))
          .sort((a, b) => new Date(a.time) - new Date(b.time));

        if (config.latestDayOnly && parsed.length) {
          const lastDay = parsed[parsed.length - 1].time.slice(0, 10);
          parsed = parsed.filter((candle) => candle.time.slice(0, 10) === lastDay);
        }

        setCandles(parsed);
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("Candle loading error:", err);
        setError(err.message || "Unable to load candles");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [key, range, candleInterval]);

  // Merge live ticks into the last candle. The bucket is derived from the
  // last candle's own start time, so it always lines up with the API's
  // candle grid (09:15-aligned hourly / 30m candles, IST day candles).
  useEffect(() => {
    if (ltp == null || !Number.isFinite(ltp)) return;

    const span = getCandleConfig(range, candleInterval).seconds * 1000;
    const ts = tradeTs ?? Date.now();

    setCandles((previous) => {
      if (!previous.length) return previous;

      const last = previous[previous.length - 1];
      const lastStart = new Date(last.time).getTime();
      if (ts < lastStart) return previous;

      const steps = Math.floor((ts - lastStart) / span);

      if (steps === 0) {
        if (last.close === ltp && last.high >= ltp && last.low <= ltp) return previous;
        return [
          ...previous.slice(0, -1),
          {
            ...last,
            high: Math.max(last.high, ltp),
            low: Math.min(last.low, ltp),
            close: ltp,
          },
        ];
      }

      // Never invent new candles while the market is closed.
      if (!marketOpen) return previous;

      return [
        ...previous,
        {
          time: new Date(lastStart + steps * span).toISOString(),
          open: ltp,
          high: ltp,
          low: ltp,
          close: ltp,
          volume: 0,
        },
      ].slice(-500);
    });
  }, [ltp, tradeTs, range, candleInterval, marketOpen]);

  const view = useMemo(() => {
    if (!candles.length) return null;

    let high = -Infinity;
    let low = Infinity;
    let volume = 1;
    for (const candle of candles) {
      if (candle.high > high) high = candle.high;
      if (candle.low < low) low = candle.low;
      if (candle.volume > volume) volume = candle.volume;
    }

    const pad = (high - low) * 0.06 || high * 0.01 || 1;
    const top = high + pad;
    const bottom = low - pad;
    const span = top - bottom;
    const y = (price) => ((top - price) / span) * 100;

    let smaPoints = "";
    if (showSma) {
      smaPoints = computeSma(candles, 20)
        .map(({ index, value }) => `${(((index + 0.5) / candles.length) * 100).toFixed(2)},${y(value).toFixed(2)}`)
        .join(" ");
    }

    const ticks =
      candles.length > 1
        ? [0, 1, 2, 3, 4].map((s) => Math.round((s * (candles.length - 1)) / 4))
        : [0];

    return { top, bottom, span, volume, y, smaPoints, ticks };  }, [candles, showSma]);

  function submitAlert(event) {
    event.preventDefault();
    const price = Number(alertPrice);

    if (!Number.isFinite(price) || price <= 0) {
      setAlertError("Enter a valid price");
      return;
    }
    if (ltp != null && alertCondition === "above" && price <= ltp) {
      setAlertError("Target must be above the current price");
      return;
    }
    if (ltp != null && alertCondition === "below" && price >= ltp) {
      setAlertError("Target must be below the current price");
      return;
    }

    setAlertError("");
    setAlertPrice("");
    onAddAlert({
      instrumentKey: key,
      symbol: stock.symbol,
      condition: alertCondition,
      price,
    });
  }

  const positive = Number(data?.change ?? 0) >= 0;
  const displayPrice = ltp ?? (candles.length ? candles[candles.length - 1].close : null);
  const shown = candles.length ? candles[hover ?? candles.length - 1] : null;
  const shownUp = shown ? shown.close >= shown.open : true;

  const dayRangePct =
    data && data.high != null && data.low != null && ltp != null && data.high > data.low
      ? Math.min(100, Math.max(0, ((ltp - data.low) / (data.high - data.low)) * 100))
      : null;

  const activeAlerts = alerts.filter((alert) => !alert.triggered).length;

  return (
    <div className="stock-detail-card">
      <div className="detail-header">
        <div>
          <h2>{stock.symbol}</h2>
          <p>{stock.name}</p>
        </div>
        <button className="detail-close" onClick={onClose} aria-label="Close details">
          ×
        </button>
      </div>

      <div className="detail-main">
        <div>
          <div className="detail-price">₹{formatPrice(displayPrice)}</div>
          {data ? (
            <div className={positive ? "detail-change positive" : "detail-change negative"}>
              {signed(data.change)} ({signedPercent(data.changePercent)}%)
            </div>
          ) : (
            <div className="detail-change">Waiting for live data...</div>
          )}
        </div>
      </div>

      {dayRangePct != null && (
        <div className="range-bar" title="Today's low to high">
          <span>₹{formatPrice(data.low)}</span>
          <div className="range-track">
            <i style={{ left: `${dayRangePct}%` }} />
          </div>
          <span>₹{formatPrice(data.high)}</span>
        </div>
      )}

      <div className="candle-chart-container">
        <div className="candle-toolbar">
          <div className="candle-range-buttons">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option}
                className={range === option ? "candle-button active" : "candle-button"}
                onClick={() => setRange(option)}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="toolbar-group">
            {range === "1D" && (
              <div className="candle-interval-buttons">
                {INTERVAL_OPTIONS.map((option) => (
                  <button
                    key={option}
                    className={candleInterval === option ? "candle-button active" : "candle-button"}
                    onClick={() => setCandleInterval(option)}
                  >
                    {option}m
                  </button>
                ))}
              </div>
            )}
            <div className="candle-interval-buttons">
              <button
                className={showSma ? "candle-button active" : "candle-button"}
                onClick={() => setShowSma((value) => !value)}
                title="20-period simple moving average"
              >
                SMA 20
              </button>
            </div>
          </div>
        </div>

        {shown && (
          <div className="candle-readout">
            <span className="readout-time">{formatCandleTime(shown.time, range)}</span>
            <span>O <b>{formatPrice(shown.open)}</b></span>
            <span>H <b>{formatPrice(shown.high)}</b></span>
            <span>L <b>{formatPrice(shown.low)}</b></span>
            <span>C <b className={shownUp ? "positive" : "negative"}>{formatPrice(shown.close)}</b></span>
            <span>Vol <b>{formatVolume(shown.volume)}</b></span>
          </div>
        )}

        {loading ? (
          <div className="chart-empty">Loading historical candles...</div>
        ) : error ? (
          <div className="chart-empty error">{error}</div>
        ) : !view ? (
          <div className="chart-empty">No historical candle data available</div>
        ) : (
          <>
            <div className="candle-chart-wrap">
              <div className="candle-chart" onMouseLeave={() => setHover(null)}>
                <div className="candle-plot">
                  {candles.map((candle, index) => {
                    const bullish = candle.close >= candle.open;
                    const wickTop = view.y(candle.high);
                    const wickBottom = view.y(candle.low);
                    const bodyTop = view.y(Math.max(candle.open, candle.close));
                    const bodyBottom = view.y(Math.min(candle.open, candle.close));

                    return (
                      <div
                        className={hover === index ? "candle-item hovered" : "candle-item"}
                        key={`${candle.time}-${index}`}
                        onMouseEnter={() => setHover(index)}
                      >
                        <div
                          className="candle-wick"
                          style={{
                            top: `${wickTop}%`,
                            height: `${Math.max(wickBottom - wickTop, 0.5)}%`,
                          }}
                        />
                        <div
                          className={bullish ? "candle-body bullish" : "candle-body bearish"}
                          style={{
                            top: `${bodyTop}%`,
                            height: `${Math.max(bodyBottom - bodyTop, 0.5)}%`,
                          }}
                        />
                      </div>
                    );
                  })}

                  {showSma && view.smaPoints && (
                    <svg className="sma-layer" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <polyline
                        points={view.smaPoints}
                        fill="none"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                  )}

                  {ltp != null && ltp <= view.top && ltp >= view.bottom && (
                    <div className="ltp-line" style={{ top: `${view.y(ltp)}%` }}>
                      <span>₹{formatPrice(ltp)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="price-axis">
                {[0, 1, 2, 3, 4].map((step) => (
                  <span key={step}>{formatPrice(view.top - (view.span * step) / 4)}</span>
                ))}
              </div>
            </div>

             <div className="time-axis">
              {view.ticks.map((i) => (
                <span key={i}>{formatCandleTime(candles[i].time, range)}</span>
              ))}
            </div>

            <div className="candle-volume-chart">
              {candles.map((candle, index) => (
                <div className="volume-column" key={`volume-${candle.time}-${index}`}>
                  <div
                    className={candle.close >= candle.open ? "volume-bar bullish" : "volume-bar bearish"}
                    style={{ height: `${Math.max((candle.volume / view.volume) * 100, 1)}%` }}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="detail-stats">
        <div>
          <span>Open</span>
          <strong>₹{formatPrice(data?.open)}</strong>
        </div>
        <div>
          <span>High</span>
          <strong>₹{formatPrice(data?.high)}</strong>
        </div>
        <div>
          <span>Low</span>
          <strong>₹{formatPrice(data?.low)}</strong>
        </div>
        <div>
          <span>Previous Close</span>
          <strong>₹{formatPrice(data?.previousClose)}</strong>
        </div>
        <div>
          <span>Volume</span>
          <strong>{formatVolume(data?.volume)}</strong>
        </div>
      </div>

      <div className="alerts-panel">
        <div className="alerts-header">
          <h3>Price Alerts</h3>
          <span>{activeAlerts} active</span>
        </div>

        <form className="alert-form" onSubmit={submitAlert}>
          <select
            value={alertCondition}
            onChange={(event) => setAlertCondition(event.target.value)}
            aria-label="Alert condition"
          >
            <option value="above">Rises above</option>
            <option value="below">Falls below</option>
          </select>
          <input
            type="number"
            step="0.05"
            min="0"
            inputMode="decimal"
            placeholder="Target price"
            value={alertPrice}
            onChange={(event) => setAlertPrice(event.target.value)}
          />
          <button type="submit">Set alert</button>
        </form>

        {alertError && <div className="alert-error">{alertError}</div>}

        {alerts.length > 0 && (
          <ul className="alert-list">
            {alerts.map((alert) => (
              <li key={alert.id} className={alert.triggered ? "triggered" : ""}>
                <span>
                  {alert.condition === "above" ? "▲ Above" : "▼ Below"} ₹{formatPrice(alert.price)}
                </span>
                <em>{alert.triggered ? "Triggered" : "Watching"}</em>
                <button onClick={() => onRemoveAlert(alert.id)} aria-label="Delete alert">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App                                                                 */
/* ------------------------------------------------------------------ */

function App() {
  const [marketData, setMarketData] = useState({});
  const [connectionStatus, setConnectionStatus] = useState("CONNECTING");
  const [searchText, setSearchText] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [priceDirection, setPriceDirection] = useState({});
  const [selectedStock, setSelectedStock] = useState(null);
  const [priceHistory, setPriceHistory] = useState({});
  const [ipos, setIpos] = useState([]);
  const [ipoStatus, setIpoStatus] = useState("open");
  const [ipoType, setIpoType] = useState("");
  const [ipoLoading, setIpoLoading] = useState(false);
  const [ipoError, setIpoError] = useState("");
  const [ipoReload, setIpoReload] = useState(0);
  const [marketStatus, setMarketStatus] = useState(getMarketStatus);
  const [sortConfig, setSortConfig] = useState({ key: "symbol", direction: "asc" });
  const [toasts, setToasts] = useState([]);
  const [theme, setTheme] = useState(() => readStored("stock-theme", "light"));
  const [watchlist, setWatchlist] = useState(() => readStored("stock-watchlist", []));
  const [alerts, setAlerts] = useState(() => readStored("stock-alerts", []));

  const marketRef = useRef({});
  const pendingRef = useRef({});
  const rafRef = useRef(0);
  const flashTimers = useRef({});
  const watchlistRef = useRef(watchlist);
  const firedAlerts = useRef(new Set());
  const toastId = useRef(0);
  const searchBoxRef = useRef(null);
  const detailRef = useRef(null);

  const marketOpen = marketStatus.status === "OPEN";

  /* ---------- persistence ---------- */

  useEffect(() => {
    watchlistRef.current = watchlist;
    localStorage.setItem("stock-watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    localStorage.setItem("stock-alerts", JSON.stringify(alerts));
  }, [alerts]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("stock-theme", theme);
  }, [theme]);

  /* ---------- toasts ---------- */

  const pushToast = useCallback((message, tone = "info") => {
    const id = ++toastId.current;
    setToasts((previous) => [...previous.slice(-3), { id, message, tone }]);
    setTimeout(() => {
      setToasts((previous) => previous.filter((toast) => toast.id !== id));
    }, 6000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
  }, []);

  /* ---------- websocket with auto-reconnect ---------- */

  useEffect(() => {
    let socket;
    let retry = 0;
    let retryTimer;
    let closedByUs = false;

    // Ticks are queued and applied once per animation frame, so a burst of
    // messages causes one render instead of one render per message.
    const flush = () => {
      rafRef.current = 0;

      const batch = pendingRef.current;
      pendingRef.current = {};
      const keys = Object.keys(batch);
      if (!keys.length) return;

      const previous = marketRef.current;
      const next = { ...previous };
      const directions = {};

      keys.forEach((instrumentKey) => {
        const update = batch[instrumentKey];
        const old = previous[instrumentKey];
        if (old && old.ltp != null && update.ltp != null && old.ltp !== update.ltp) {
          directions[instrumentKey] = update.ltp > old.ltp ? "up" : "down";
        }
        next[instrumentKey] = update;
      });

      marketRef.current = next;
      setMarketData(next);

      const flashed = Object.keys(directions);
      if (flashed.length) {
        setPriceDirection((current) => ({ ...current, ...directions }));
        flashed.forEach((instrumentKey) => {
          clearTimeout(flashTimers.current[instrumentKey]);
          flashTimers.current[instrumentKey] = setTimeout(() => {
            setPriceDirection((current) => {
              if (!(instrumentKey in current)) return current;
              const updated = { ...current };
              delete updated[instrumentKey];
              return updated;
            });
          }, 700);
        });
      }

      setPriceHistory((current) => {
        const updated = { ...current };
        keys.forEach((instrumentKey) => {
          const price = batch[instrumentKey].ltp;
          if (price == null) return;
          const list = updated[instrumentKey] || [];
          if (list.length && list[list.length - 1].price === price) return;
          updated[instrumentKey] = [...list, { time: Date.now(), price }].slice(-120);
        });
        return updated;
      });
    };

    const queueUpdate = (update) => {
      pendingRef.current[update.instrumentKey] = update;
      if (!rafRef.current) rafRef.current = requestAnimationFrame(flush);
    };

    const restoreSubscriptions = () => {
      const keys = watchlistRef.current.map((stock) => stock.instrumentKey);
      if (!keys.length) return;
      postJSON("/api/subscribe", { instrumentKeys: keys }).catch((error) => {
        console.error("Unable to restore subscriptions:", error);
      });
    };

    const connect = () => {
      setConnectionStatus(retry ? "RECONNECTING" : "CONNECTING");
      socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        retry = 0;
        setConnectionStatus("LIVE");
        restoreSubscriptions();
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "market_snapshot") {
            marketRef.current = message.data || {};
            setMarketData(marketRef.current);
            return;
          }

          if (message.type === "market_update" && message.data?.instrumentKey) {
            queueUpdate(message.data);
          }
        } catch (error) {
          console.error("WebSocket message error:", error);
        }
      };

      socket.onerror = () => {
        setConnectionStatus("ERROR");
        socket.close();
      };

      socket.onclose = () => {
        if (closedByUs) return;
        setConnectionStatus("DISCONNECTED");
        const delay = Math.min(1000 * 2 ** retry, 15000);
        retry += 1;
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closedByUs = true;
      clearTimeout(retryTimer);
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      Object.values(flashTimers.current).forEach(clearTimeout);
      socket?.close();
    };
  }, []);

  /* ---------- market clock ---------- */

  useEffect(() => {
    const timer = setInterval(() => setMarketStatus(getMarketStatus()), 1000);
    return () => clearInterval(timer);
  }, []);

  /* ---------- tab title ---------- */

  const niftyLtp = marketData[NIFTY_KEY]?.ltp;
  useEffect(() => {
    document.title =
      niftyLtp != null ? `Nifty ${formatPrice(niftyLtp)} · Live Market` : "Live Stock Market";
  }, [niftyLtp]);

  /* ---------- search ---------- */

  useEffect(() => {
    const query = searchText.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `${API_URL}/api/instruments/search?query=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        const result = await response.json();
        setSearchResults(result.success ? result.data || [] : []);
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error("Instrument search error:", error);
        setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchText]);

  // Close the dropdown when clicking elsewhere.
  useEffect(() => {
    const onPointerDown = (event) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  /* ---------- IPOs ---------- */

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        setIpoLoading(true);
        setIpoError("");

        const params = new URLSearchParams({ status: ipoStatus });
        if (ipoType) params.set("issue_type", ipoType);

        const response = await fetch(`${API_URL}/api/ipos?${params.toString()}`, {
          signal: controller.signal,
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Failed to load IPO data");
        }
        setIpos(result.data || []);
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error("IPO fetch error:", error);
        setIpos([]);
        setIpoError(error.message || "Failed to load IPO data");
      } finally {
        if (!controller.signal.aborted) setIpoLoading(false);
      }
    })();

    return () => controller.abort();
  }, [ipoStatus, ipoType, ipoReload]);

  /* ---------- price alerts ---------- */

  useEffect(() => {
    const hits = alerts.filter(
      (alert) =>
        !alert.triggered &&
        !firedAlerts.current.has(alert.id) &&
        alertHit(alert, marketData[alert.instrumentKey]?.ltp)
    );
    if (!hits.length) return;

    hits.forEach((alert) => {
      firedAlerts.current.add(alert.id);
      const message = `${alert.symbol} ${
        alert.condition === "above" ? "rose above" : "fell below"
      } ₹${formatPrice(alert.price)}`;

      pushToast(message, "alert");
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Price alert", { body: message });
      }
    });

    setAlerts((previous) =>
      previous.map((alert) =>
        firedAlerts.current.has(alert.id) ? { ...alert, triggered: true } : alert
      )
    );
  }, [marketData, alerts, pushToast]);

  function addAlert({ instrumentKey, symbol, condition, price }) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setAlerts((previous) => [
      ...previous,
      { id, instrumentKey, symbol, condition, price, triggered: false },
    ]);

    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
    pushToast(
      `Alert set: ${symbol} ${condition === "above" ? "above" : "below"} ₹${formatPrice(price)}`,
      "info"
    );
  }

  function removeAlert(id) {
    setAlerts((previous) => previous.filter((alert) => alert.id !== id));
  }

  /* ---------- watchlist actions ---------- */

  async function addToWatchlist(stock) {
    if (watchlist.some((item) => item.instrumentKey === stock.instrumentKey)) return;

    try {
      const result = await postJSON("/api/subscribe", {
        instrumentKeys: [stock.instrumentKey],
      });

      if (!result.success) {
        pushToast(result.message || `Could not subscribe to ${stock.symbol}`, "error");
        return;
      }

      setWatchlist((previous) => [
        ...previous,
        {
          symbol: stock.symbol,
          name: stock.name,
          instrumentKey: stock.instrumentKey,
          exchange: stock.exchange,
          isin: stock.isin,
        },
      ]);
      setSearchText("");
      setSearchResults([]);
      setSearchOpen(false);
    } catch (error) {
      console.error("Unable to subscribe:", error);
      pushToast("Unable to reach the server", "error");
    }
  }

  async function removeFromWatchlist(stock) {
    try {
      const result = await postJSON("/api/unsubscribe", {
        instrumentKeys: [stock.instrumentKey],
      });

      if (!result.success) {
        pushToast(result.message || `Could not unsubscribe ${stock.symbol}`, "error");
        return;
      }

      setWatchlist((previous) =>
        previous.filter((item) => item.instrumentKey !== stock.instrumentKey)
      );

      const next = { ...marketRef.current };
      delete next[stock.instrumentKey];
      marketRef.current = next;
      setMarketData(next);

      setPriceHistory((previous) => {
        const updated = { ...previous };
        delete updated[stock.instrumentKey];
        return updated;
      });

      // Alerts on an unsubscribed stock could never fire.
      setAlerts((previous) =>
        previous.filter((alert) => alert.instrumentKey !== stock.instrumentKey)
      );
      setSelectedStock((current) =>
        current?.instrumentKey === stock.instrumentKey ? null : current
      );
    } catch (error) {
      console.error("Unable to unsubscribe:", error);
      pushToast("Unable to reach the server", "error");
    }
  }

  function sortWatchlist(key) {
    setSortConfig((previous) => ({
      key,
      direction: previous.key === key && previous.direction === "asc" ? "desc" : "asc",
    }));
  }

  function sortArrow(key) {
    if (sortConfig.key !== key) return "";
    return sortConfig.direction === "asc" ? " ▲" : " ▼";
  }

  const sortedWatchlist = useMemo(() => {
    return [...watchlist].sort((a, b) => {
      if (sortConfig.key === "symbol") {
        const result = (a.symbol || "").localeCompare(b.symbol || "");
        return sortConfig.direction === "asc" ? result : -result;
      }
      const valueA = Number(marketData[a.instrumentKey]?.[sortConfig.key] ?? 0);
      const valueB = Number(marketData[b.instrumentKey]?.[sortConfig.key] ?? 0);
      return sortConfig.direction === "asc" ? valueA - valueB : valueB - valueA;
    });
  }, [watchlist, marketData, sortConfig]);

  function exportWatchlist() {
    const rows = [
      ["Symbol", "Name", "LTP", "Change", "Change %", "Open", "High", "Low", "Prev Close", "Volume"],
    ];
    sortedWatchlist.forEach((stock) => {
      const d = marketData[stock.instrumentKey] || {};
      rows.push([
        stock.symbol, stock.name, d.ltp, d.change, d.changePercent,
        d.open, d.high, d.low, d.previousClose, d.volume,
      ]);
    });

    const csv = rows
      .map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `watchlist-${istDate(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- derived overview data ---------- */

  const watchlistWithData = useMemo(
    () =>
      watchlist
        .map((stock) => ({ ...stock, data: marketData[stock.instrumentKey] }))
        .filter((stock) => stock.data),
    [watchlist, marketData]
  );

  const topGainers = useMemo(
    () =>
      watchlistWithData
        .filter((stock) => (stock.data.changePercent ?? 0) > 0)
        .sort((a, b) => b.data.changePercent - a.data.changePercent)
        .slice(0, 5),
    [watchlistWithData]
  );

  const topLosers = useMemo(
    () =>
      watchlistWithData
        .filter((stock) => (stock.data.changePercent ?? 0) < 0)
        .sort((a, b) => a.data.changePercent - b.data.changePercent)
        .slice(0, 5),
    [watchlistWithData]
  );

  const breadth = useMemo(() => {
    let adv = 0;
    let dec = 0;
    let flat = 0;
    watchlistWithData.forEach((stock) => {
      const change = Number(stock.data.change ?? 0);
      if (change > 0) adv += 1;
      else if (change < 0) dec += 1;
      else flat += 1;
    });
    return { adv, dec, flat, total: adv + dec + flat };
  }, [watchlistWithData]);

  const alertCounts = useMemo(() => {
    const counts = {};
    alerts.forEach((alert) => {
      if (!alert.triggered) counts[alert.instrumentKey] = (counts[alert.instrumentKey] || 0) + 1;
    });
    return counts;
  }, [alerts]);

  /* ---------- selected stock ---------- */

  const selectedKey = selectedStock?.instrumentKey;
  useEffect(() => {
    if (selectedKey && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedKey]);

  const closeDetail = useCallback(() => setSelectedStock(null), []);

  const showSearchDropdown = searchOpen && searchText.trim().length >= 2;

  /* ---------- render ---------- */

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Live Stock Market</h1>
          <p>NSE real-time market monitoring</p>
        </div>

        <div className="header-right">
          <div className={`market-status ${marketStatus.status.toLowerCase()}`}>
            <span className="market-status-dot" />
            <div>
              <strong>{marketStatus.label}</strong>
              <span>{marketStatus.time} IST</span>
            </div>
          </div>

          <div className="connection">
            <span
              className={
                connectionStatus === "LIVE"
                  ? "status-dot live"
                  : connectionStatus === "CONNECTING" || connectionStatus === "RECONNECTING"
                  ? "status-dot warn"
                  : "status-dot"
              }
            />
            {connectionStatus}
          </div>

          <button
            className="theme-toggle"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title="Toggle theme"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </header>

      <section className="watchlist-section">
        <div className="watchlist-header">
          <div>
            <h2>Watchlist</h2>
            <p>Search NSE stocks and add them to your watchlist</p>
          </div>
          <div className="watchlist-count">{watchlist.length} stocks</div>
        </div>

        <div className="search-container" ref={searchBoxRef}>
          <input
            type="text"
            placeholder="Search stocks..."
            value={searchText}
            onChange={(event) => {
              setSearchText(event.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSearchOpen(false);
            }}
            aria-label="Search stocks"
          />

          {showSearchDropdown && (
            <div className="search-results">
              {searching ? (
                <div className="no-results">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="no-results">No NSE stocks found</div>
              ) : (
                searchResults.map((stock) => {
                  const alreadyAdded = watchlist.some(
                    (item) => item.instrumentKey === stock.instrumentKey
                  );

                  return (
                    <div className="search-result" key={stock.instrumentKey}>
                      <div>
                        <strong>{stock.symbol}</strong>
                        <span>{stock.name}</span>
                      </div>
                      <button disabled={alreadyAdded} onClick={() => addToWatchlist(stock)}>
                        {alreadyAdded ? "Added" : "Add"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </section>

      <section className="market-section">
        <h2>Market Indices</h2>
        <div className="market-grid">
          {INDEXES.map((index) => (
            <MarketCard
              key={index.instrumentKey}
              item={index}
              data={marketData[index.instrumentKey]}
              direction={priceDirection[index.instrumentKey]}
            />
          ))}
        </div>
      </section>

      <section className="overview-section">
        <div className="overview-header">
          <div>
            <h2>Market Overview</h2>
            <p>Based on your live watchlist</p>
          </div>
        </div>

        {breadth.total > 0 && (
          <div className="breadth">
            <div className="breadth-bar">
              <span className="adv" style={{ flex: breadth.adv }} />
              <span className="flat" style={{ flex: breadth.flat }} />
              <span className="dec" style={{ flex: breadth.dec }} />
            </div>
            <div className="breadth-legend">
              <span className="positive">{breadth.adv} advancing</span>
              <span>{breadth.flat} unchanged</span>
              <span className="negative">{breadth.dec} declining</span>
            </div>
          </div>
        )}

        <div className="overview-grid">
          <div className="overview-card">
            <h3>Top Gainers</h3>
            {topGainers.length === 0 ? (
              <div className="overview-empty">
                {watchlistWithData.length ? "No gainers right now" : "Waiting for market data..."}
              </div>
            ) : (
              topGainers.map((stock) => (
                <div className="overview-row" key={stock.instrumentKey}>
                  <div>
                    <strong>{stock.symbol}</strong>
                    <span>{stock.name}</span>
                  </div>
                  <div className="positive">{signedPercent(stock.data.changePercent)}%</div>
                </div>
              ))
            )}
          </div>

          <div className="overview-card">
            <h3>Top Losers</h3>
            {topLosers.length === 0 ? (
              <div className="overview-empty">
                {watchlistWithData.length ? "No losers right now" : "Waiting for market data..."}
              </div>
            ) : (
              topLosers.map((stock) => (
                <div className="overview-row" key={stock.instrumentKey}>
                  <div>
                    <strong>{stock.symbol}</strong>
                    <span>{stock.name}</span>
                  </div>
                  <div className="negative">{signedPercent(stock.data.changePercent)}%</div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="ipo-section">
        <div className="ipo-header">
          <div>
            <span className="section-label">PRIMARY MARKET</span>
            <h2>IPO Centre</h2>
            <p>Live IPO information from Upstox</p>
          </div>

          <div className="ipo-controls">
            <div className="ipo-status-filters">
              {["open", "upcoming", "closed", "listed"].map((status) => (
                <button
                  key={status}
                  className={ipoStatus === status ? "ipo-filter active" : "ipo-filter"}
                  onClick={() => setIpoStatus(status)}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="ipo-type-filters">
              {[
                ["", "All"],
                ["regular", "Mainboard"],
                ["sme", "SME"],
              ].map(([value, label]) => (
                <button
                  key={label}
                  className={ipoType === value ? "ipo-filter active" : "ipo-filter"}
                  onClick={() => setIpoType(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {ipoLoading ? (
          <div className="ipo-message">
            <div className="ipo-spinner"></div>
            <span>Loading IPO data...</span>
          </div>
        ) : ipoError ? (
          <div className="ipo-message">
            <strong>Couldn't load IPOs</strong>
            <span>{ipoError}</span>
            <button className="retry-button" onClick={() => setIpoReload((n) => n + 1)}>
              Retry
            </button>
          </div>
        ) : ipos.length === 0 ? (
          <div className="ipo-message">
            <strong>No IPOs found</strong>
            <span>No IPOs are available for the selected filters.</span>
          </div>
        ) : (
          <div className="ipo-grid">
            {ipos.map((ipo) => (
              <div className="ipo-card" key={ipo.id || ipo.symbol || ipo.name}>
                <div className="ipo-card-header">
                  <div className="ipo-title">
                    <span className="ipo-symbol">{ipo.symbol || "IPO"}</span>
                    <h3>{ipo.name || "Unnamed IPO"}</h3>
                  </div>
                  <span className={`ipo-status ${ipo.status || ""}`}>{ipo.status || "--"}</span>
                </div>

                <div className="ipo-main-info">
                  <div className="ipo-price">
                    <span>PRICE BAND</span>
                    <strong>
                      {ipo.minimum_price != null && ipo.maximum_price != null
                        ? `₹${ipo.minimum_price} - ₹${ipo.maximum_price}`
                        : "--"}
                    </strong>
                  </div>
                  <div className="ipo-price">
                    <span>ISSUE SIZE</span>
                    <strong>{ipo.issue_size != null ? `₹${ipo.issue_size} Cr` : "--"}</strong>
                  </div>
                </div>

                <div className="ipo-details">
                  <div>
                    <span>TYPE</span>
                    <strong>{ipo.issue_type === "sme" ? "SME" : "MAINBOARD"}</strong>
                  </div>
                  <div>
                    <span>INDUSTRY</span>
                    <strong>{ipo.industry || "--"}</strong>
                  </div>
                </div>

                <div className="ipo-dates">
                  <div>
                    <span>OPEN</span>
                    <strong>{ipo.bidding_start_date || "--"}</strong>
                  </div>
                  <div>
                    <span>CLOSE</span>
                    <strong>{ipo.bidding_end_date || "--"}</strong>
                  </div>
                </div>

                {ipo.total_subscription != null && (
                  <div className="ipo-subscription">
                    <span>SUBSCRIPTION</span>
                    <strong>{ipo.total_subscription}×</strong>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="market-section">
        <div className="watchlist-title">
          <div>
            <h2>My Watchlist</h2>
            <p>Live NSE market prices · click a row for chart and alerts</p>
          </div>
          <div className="watchlist-actions">
            <button
              className="ghost-button"
              onClick={exportWatchlist}
              disabled={!watchlist.length}
            >
              Export CSV
            </button>
            <div className="watchlist-count">{watchlist.length} stocks</div>
          </div>
        </div>

        {watchlist.length === 0 ? (
          <div className="empty-watchlist">Search for a stock above and click Add.</div>
        ) : (
          <div className="watchlist-table-wrapper">
            <table className="watchlist-table">
              <thead>
                <tr>
                  {TABLE_COLUMNS.map(([key, label]) => (
                    <th
                      key={key}
                      tabIndex={0}
                      aria-sort={
                        sortConfig.key === key
                          ? sortConfig.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                      onClick={() => sortWatchlist(key)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          sortWatchlist(key);
                        }
                      }}
                    >
                      {label}
                      {sortArrow(key)}
                    </th>
                  ))}
                  <th>Trend</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {sortedWatchlist.map((stock) => {
                  const data = marketData[stock.instrumentKey];
                  const removeButton = (
                    <button
                      className="remove-button"
                      aria-label={`Remove ${stock.symbol}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        removeFromWatchlist(stock);
                      }}
                    >
                      ×
                    </button>
                  );

                  if (!data) {
                    return (
                      <tr key={stock.instrumentKey}>
                        <td>
                          <strong>{stock.symbol}</strong>
                          <span className="stock-name">{stock.name}</span>
                        </td>
                        <td colSpan="8">Waiting for market data...</td>
                        <td>{removeButton}</td>
                      </tr>
                    );
                  }

                  const positive = Number(data.change ?? 0) >= 0;
                  const direction = priceDirection[stock.instrumentKey];
                  const selected = selectedKey === stock.instrumentKey;

                  return (
                    <tr
                      key={stock.instrumentKey}
                      className={selected ? "watchlist-row selected" : "watchlist-row"}
                      tabIndex={0}
                      onClick={() => setSelectedStock(stock)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") setSelectedStock(stock);
                      }}
                    >
                      <td>
                        <strong>
                          {stock.symbol}
                          {alertCounts[stock.instrumentKey] > 0 && (
                            <span
                              className="alert-badge"
                              title={`${alertCounts[stock.instrumentKey]} active alert(s)`}
                            >
                              🔔 {alertCounts[stock.instrumentKey]}
                            </span>
                          )}
                        </strong>
                        <span className="stock-name">{stock.name}</span>
                      </td>

                      <td className={`table-price ${direction || ""}`}>
                        ₹{formatPrice(data.ltp)}
                        {direction === "up" && <span className="table-arrow">▲</span>}
                        {direction === "down" && <span className="table-arrow">▼</span>}
                      </td>

                      <td className={positive ? "positive" : "negative"}>{signed(data.change)}</td>
                      <td className={positive ? "positive" : "negative"}>
                        {signedPercent(data.changePercent)}%
                      </td>
                      <td>₹{formatPrice(data.open)}</td>
                      <td>₹{formatPrice(data.high)}</td>
                      <td>₹{formatPrice(data.low)}</td>
                      <td>{formatVolume(data.volume)}</td>
                      <td>
                        <Sparkline points={priceHistory[stock.instrumentKey]} />
                      </td>
                      <td>{removeButton}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedStock && (
        <section className="stock-detail" ref={detailRef}>
          <StockDetail
            key={selectedStock.instrumentKey}
            stock={selectedStock}
            data={marketData[selectedStock.instrumentKey]}
            marketOpen={marketOpen}
            alerts={alerts.filter((alert) => alert.instrumentKey === selectedStock.instrumentKey)}
            onAddAlert={addAlert}
            onRemoveAlert={removeAlert}
            onClose={closeDetail}
          />
        </section>
      )}

      <footer className="dashboard-footer">
        <span>
          Watchlist: <strong>{watchlist.length}</strong>
        </span>
        <span>
          Alerts: <strong>{alerts.filter((alert) => !alert.triggered).length}</strong>
        </span>
        <span>
          Connection: <strong>{connectionStatus}</strong>
        </span>
        <span>
          Orders: <strong>Disabled</strong>
        </span>
      </footer>

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;