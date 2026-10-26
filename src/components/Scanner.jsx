
import { useMemo, useState } from "react";
import { scanStocks } from "../api.js";

function formatNumber(value, digits = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return number.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function getScoreClass(value) {
  const score = Number(value);

  if (!Number.isFinite(score)) return "neutral";
  if (score >= 65) return "positive";
  if (score <= 35) return "negative";

  return "neutral";
}

function SignalBadge({ value }) {
  const signal = String(value || "UNAVAILABLE").toUpperCase();

  let variant = "warning";

  if (
    ["BUY", "BUY_ON_BREAKOUT", "BULLISH", "STRONG_BULLISH"].includes(signal)
  ) {
    variant = "success";
  } else if (
    ["SELL", "SELL_ON_BREAKDOWN", "BEARISH", "STRONG_BEARISH"].includes(signal)
  ) {
    variant = "danger";
  }

  return (
    <span className={`badge ${variant}`}>
      {signal.replaceAll("_", " ")}
    </span>
  );
}

export default function Scanner({ watchlist = [], onAnalyze }) {
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [results, setResults] = useState([]);
  const [unavailable, setUnavailable] = useState([]);
  const [errors, setErrors] = useState([]);
  const [newsWarning, setNewsWarning] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [minimumScore, setMinimumScore] = useState("0");
  const [signalFilter, setSignalFilter] = useState("ALL");

  const instruments = useMemo(() => {
    return watchlist.filter(
      (item) => item?.key && item?.name
    );
  }, [watchlist]);

  function toggleInstrument(key) {
    setSelectedKeys((previous) =>
      previous.includes(key)
        ? previous.filter((item) => item !== key)
        : [...previous, key]
    );
  }

  function selectAll() {
    setSelectedKeys(instruments.slice(0, 20).map((item) => item.key));
  }

  function clearSelection() {
    setSelectedKeys([]);
  }

  async function runScan(keys = selectedKeys) {
    if (!keys.length) {
      setError("Select at least one instrument to scan.");
      return;
    }

    if (keys.length > 20) {
      setError("The scanner supports a maximum of 20 instruments per request.");
      return;
    }

    setLoading(true);
    setError("");
    setNewsWarning("");
    setResults([]);
    setUnavailable([]);
    setErrors([]);

    try {
      const response = await scanStocks(keys);

      setResults(Array.isArray(response.data) ? response.data : []);
      setUnavailable(
        Array.isArray(response.unavailable) ? response.unavailable : []
      );
      setErrors(Array.isArray(response.errors) ? response.errors : []);
      setNewsWarning(response.newsWarning || "");
    } catch (err) {
      setError(err.message || "Unable to scan stocks.");
    } finally {
      setLoading(false);
    }
  }

  const filteredResults = useMemo(() => {
    return results.filter((item) => {
      const score = Number(item.finalScore?.score ?? item.finalScore);
      const threshold = Number(minimumScore) || 0;

      if (Number.isFinite(score) && score < threshold) {
        return false;
      }

      const signal = String(
        item.finalScore?.decision || item.signal?.signal || ""
      ).toUpperCase();

      if (signalFilter !== "ALL" && signal !== signalFilter) {
        return false;
      }

      return true;
    });
  }, [results, minimumScore, signalFilter]);

  return (
    <div>
      <div className="section-heading">
        <div>
          <h2>Stock Scanner</h2>
          <p>
            Analyze and rank stocks from your watchlist using technical,
            pattern, market, and sentiment scores.
          </p>
        </div>

        <span className="badge">{results.length} scanned results</span>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="flex-between" style={{ marginBottom: 14 }}>
          <h3 className="card-title" style={{ margin: 0 }}>
            Select instruments
          </h3>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="button button-secondary"
              onClick={selectAll}
              disabled={instruments.length === 0}
            >
              Select all (max 20)
            </button>

            <button
              type="button"
              className="button button-secondary"
              onClick={clearSelection}
            >
              Clear
            </button>
          </div>
        </div>

        {instruments.length === 0 ? (
          <div className="empty-state">
            Your watchlist is empty. Add stocks in the Watchlist section first.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 10
            }}
          >
            {instruments.map((item) => (
              <label
                key={item.key}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: 12,
                  border: "1px solid #e5e9f1",
                  borderRadius: 9,
                  background: selectedKeys.includes(item.key)
                    ? "#f1f4ff"
                    : "#fff",
                  cursor: "pointer"
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedKeys.includes(item.key)}
                  onChange={() => toggleInstrument(item.key)}
                  disabled={
                    !selectedKeys.includes(item.key) &&
                    selectedKeys.length >= 20
                  }
                  style={{ marginTop: 3 }}
                />

                <span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 700
                    }}
                  >
                    {item.name}
                  </span>
                  <span
                    className="muted-text"
                    style={{ overflowWrap: "anywhere" }}
                  >
                    {item.key}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="flex-between" style={{ marginTop: 18, flexWrap: "wrap" }}>
          <span className="muted-text">
            {selectedKeys.length} selected · Maximum 20 per scan
          </span>

          <button
            type="button"
            className="button button-primary"
            onClick={() => runScan()}
            disabled={loading || selectedKeys.length === 0}
          >
            {loading ? "Scanning stocks..." : "Run stock scan"}
          </button>
        </div>
      </div>

      {error && (
        <div className="card error-state" role="alert" style={{ marginBottom: 20 }}>
          {error}
        </div>
      )}

      {newsWarning && (
        <div className="card muted-text" style={{ marginBottom: 20 }}>
          News warning: {newsWarning}. The scanner may still provide results
          without news sentiment.
        </div>
      )}

      {loading && (
        <div className="card loading-state" style={{ marginBottom: 20 }}>
          Fetching historical data and calculating analysis for selected stocks.
          This may take some time.
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="metric-grid">
            <div className="metric-card">
              <div className="metric-label">Scanned</div>
              <div className="metric-value">{results.length}</div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Displayed</div>
              <div className="metric-value">{filteredResults.length}</div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Unavailable</div>
              <div className="metric-value">{unavailable.length}</div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Highest score</div>
              <div className="metric-value">
                {formatNumber(
                  Math.max(
                    ...results.map((item) =>
                      Number(item.finalScore?.score ?? item.finalScore ?? 0)
                    )
                  ),
                  1
                )}
              </div>
              <div className="metric-subtitle">Out of 100</div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 14
              }}
            >
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="scanner-min-score">
                  Minimum final score
                </label>
                <select
                  id="scanner-min-score"
                  className="form-control"
                  value={minimumScore}
                  onChange={(event) => setMinimumScore(event.target.value)}
                >
                  <option value="0">All scores</option>
                  <option value="40">40 and above</option>
                  <option value="50">50 and above</option>
                  <option value="60">60 and above</option>
                  <option value="70">70 and above</option>
                  <option value="80">80 and above</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="scanner-signal">
                  Decision filter
                </label>
                <select
                  id="scanner-signal"
                  className="form-control"
                  value={signalFilter}
                  onChange={(event) => setSignalFilter(event.target.value)}
                >
                  <option value="ALL">All decisions</option>
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                  <option value="BUY_ON_BREAKOUT">BUY ON BREAKOUT</option>
                  <option value="SELL_ON_BREAKDOWN">SELL ON BREAKDOWN</option>
                  <option value="HOLD">HOLD</option>
                  <option value="NO_TRADE">NO TRADE</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex-between" style={{ marginBottom: 16 }}>
              <h3 className="card-title" style={{ margin: 0 }}>
                Ranked scan results
              </h3>
              <span className="muted-text">
                Ordered by the backend's ranking
              </span>
            </div>

            {filteredResults.length === 0 ? (
              <div className="empty-state">
                No results match your selected filters. Try lowering the score
                threshold or choosing all decisions.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Instrument</th>
                      <th>Price</th>
                      <th>Trend</th>
                      <th>Pattern</th>
                      <th>Technical Score</th>
                      <th>Final Score</th>
                      <th>Decision</th>
                      <th>Sentiment</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredResults.map((item, index) => {
                      const finalScore =
                        item.finalScore?.score ?? item.finalScore;
                      const decision =
                        item.finalScore?.decision ||
                        item.signal?.signal ||
                        "NO_TRADE";

                      return (
                        <tr key={item.instrumentKey || item.key || index}>
                          <td>{index + 1}</td>

                          <td>
                            <div style={{ fontWeight: 700 }}>
                              {item.name || item.instrumentKey || item.key || "Unknown"}
                            </div>
                            {item.instrumentKey && (
                              <div className="muted-text">
                                {item.instrumentKey}
                              </div>
                            )}
                          </td>

                          <td>₹{formatNumber(item.currentPrice)}</td>

                          <td>{item.trend || "—"}</td>

                          <td>{item.pattern || "—"}</td>

                          <td>
                            <span className={getScoreClass(item.technicalScore)}>
                              {formatNumber(item.technicalScore, 1)}
                            </span>
                          </td>

                          <td>
                            <strong className={getScoreClass(finalScore)}>
                              {formatNumber(finalScore, 1)}
                            </strong>
                          </td>

                          <td>
                            <SignalBadge value={decision} />
                          </td>

                          <td>
                            <SignalBadge
                              value={item.sentiment?.label || "NEUTRAL"}
                            />
                          </td>

                          <td>
                            <button
                              type="button"
                              className="button button-secondary"
                              onClick={() =>
                                onAnalyze?.(
                                  item.instrumentKey || item.key
                                )
                              }
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

          {(unavailable.length > 0 || errors.length > 0) && (
            <div className="card" style={{ marginTop: 20 }}>
              <h3 className="card-title">Unavailable instruments and warnings</h3>

              {[...unavailable, ...errors].map((item, index) => (
                <div
                  key={`${item.instrumentKey || item.key || "item"}-${index}`}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid #edf0f5"
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 12 }}>
                    {item.instrumentKey || item.key || "Instrument"}
                  </div>
                  <div className="muted-text">
                    {item.message || item.error || item.reason || "No details provided"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <p className="muted-text" style={{ marginTop: 16 }}>
        Scanner rankings use the backend's current heuristic scoring rules.
        They are not guaranteed forecasts or personalized investment advice.
        The scanner does not execute orders.
      </p>
    </div>
  );
}
