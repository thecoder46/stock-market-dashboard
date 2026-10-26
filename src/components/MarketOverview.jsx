
import { useMemo } from "react";

function formatPrice(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return number.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatPercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function getChangeClass(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number === 0) return "neutral";
  return number > 0 ? "positive" : "negative";
}

function getMarketBias(context) {
  if (!context) return "WAITING FOR DATA";

  const bias = String(context.bias || "NEUTRAL").toUpperCase();

  if (bias === "BULLISH") return "BULLISH";
  if (bias === "BEARISH") return "BEARISH";

  return "NEUTRAL";
}

function MetricCard({ label, quote, subtitle }) {
  const changePercent = quote?.changePercent;
  const biasClass = getChangeClass(changePercent);

  return (
    <article className="metric-card">
      <div className="flex-between">
        <span className="metric-label">{label}</span>
        <span className={`badge ${biasClass === "positive" ? "success" : biasClass === "negative" ? "danger" : ""}`}>
          {formatPercent(changePercent)}
        </span>
      </div>

      <div className="metric-value">
        {formatPrice(quote?.ltp)}
      </div>

      <div className={`metric-subtitle ${biasClass}`}>
        {quote?.change != null
          ? `${Number(quote.change) > 0 ? "+" : ""}${formatPrice(quote.change)}`
          : "Change unavailable"}
        {subtitle ? ` · ${subtitle}` : ""}
      </div>
    </article>
  );
}

export default function MarketOverview({
  quotes = {},
  marketContext,
  lastUpdated,
  onOpenAnalysis
}) {
  const indices = useMemo(() => {
    return [
      {
        label: "NIFTY 50",
        key: "NSE_INDEX|Nifty 50",
        subtitle: "Benchmark index"
      },
      {
        label: "BANK NIFTY",
        key: "NSE_INDEX|Nifty Bank",
        subtitle: "Banking index"
      },
      {
        label: "INDIA VIX",
        key: "NSE_INDEX|India VIX",
        subtitle: "Volatility index"
      }
    ];
  }, []);

  const quoteRows = useMemo(
    () => Object.values(quotes).filter((quote) => quote?.instrumentKey),
    [quotes]
  );

  const marketBias = getMarketBias(marketContext);
  const biasClass =
    marketBias === "BULLISH"
      ? "success"
      : marketBias === "BEARISH"
      ? "danger"
      : "warning";

  return (
    <div className="market-overview">
      <div className="section-heading">
        <div>
          <h2>Market Overview</h2>
          <p>
            Live market prices, index movements, and overall market context.
          </p>
        </div>

        <span className="badge">
          {lastUpdated
            ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}`
            : "Waiting for quotes"}
        </span>
      </div>

      <div className="metric-grid">
        {indices.map((item) => (
          <MetricCard
            key={item.key}
            label={item.label}
            quote={quotes[item.key]}
            subtitle={item.subtitle}
          />
        ))}
        <article className="metric-card">
          <div className="metric-label">Market Sentiment</div>
          <div className="metric-value" style={{ fontSize: 21 }}>
            {marketBias}
          </div>
          <div className="metric-subtitle">
            {marketContext?.score != null
              ? `Heuristic score: ${marketContext.score}/100`
              : "Waiting for market context"}
          </div>
          <div style={{ marginTop: 10 }}>
            <span className={`badge ${biasClass}`}>
              {marketContext?.score != null
                ? `${marketContext.score} / 100`
                : "Not available"}
            </span>
          </div>
        </article>
      </div>

      <div className="card">
        <div className="flex-between" style={{ marginBottom: 16 }}>
          <div>
            <h3 className="card-title" style={{ marginBottom: 5 }}>
              Live Market Watch
            </h3>
            <p className="muted-text" style={{ margin: 0 }}>
              Instruments currently present in the live quote feed.
            </p>
          </div>
          <span className="badge">{quoteRows.length} instruments</span>
        </div>

        {quoteRows.length === 0 ? (
          <div className="empty-state">
            No live quotes received yet. Check the Upstox connection, market
            hours, and instrument subscriptions.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Last Price</th>
                  <th>Change</th>
                  <th>Change %</th>
                  <th>Open</th>
                  <th>High</th>
                  <th>Low</th>
                  <th>Volume</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {quoteRows.map((quote) => {
                  const key = quote.instrumentKey;
                  const label =
                    indices.find((item) => item.key === key)?.label || key;

                  return (
                    <tr key={key}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{label}</div>
                        <div className="muted-text">{key}</div>
                      </td>
                      <td style={{ fontWeight: 750 }}>
                        {formatPrice(quote.ltp)}
                      </td>
                      <td className={getChangeClass(quote.change)}>
                        {quote.change != null
                          ? `${Number(quote.change) > 0 ? "+" : ""}${formatPrice(quote.change)}`
                          : "—"}
                      </td>
                      <td className={getChangeClass(quote.changePercent)}>
                        {formatPercent(quote.changePercent)}
                      </td>
                      <td>{formatPrice(quote.open)}</td>
                      <td>{formatPrice(quote.high)}</td>
                      <td>{formatPrice(quote.low)}</td>
                      <td>
                        {quote.volume != null
                          ? Number(quote.volume).toLocaleString("en-IN")
                          : "—"}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => onOpenAnalysis?.(key)}
                        >
                          Analyze
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="muted-text" style={{ marginTop: 16 }}>
        Market sentiment is a rule-based indicator derived from available index
        movements and India VIX. It is not a prediction or a recommendation to
        buy or sell securities.
      </p>
    </div>
  );
}
