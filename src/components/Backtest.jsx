
import { useEffect, useState } from "react";
import { getBacktest } from "../api.js";

const DEFAULT_INSTRUMENT = "NSE_EQ|INE002A01018";

function formatNumber(value, digits = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return number.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatPercent(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function MetricCard({ label, value, subtitle, className = "" }) {
  return (
    <article className="metric-card">
      <div className="metric-label">{label}</div>
      <div className={`metric-value ${className}`} style={{ fontSize: 23 }}>
        {value}
      </div>
      {subtitle && <div className="metric-subtitle">{subtitle}</div>}
    </article>
  );
}

export default function Backtest({
  watchlist = [],
  initialInstrumentKey = DEFAULT_INSTRUMENT
}) {
  const [instrumentKey, setInstrumentKey] = useState(
    initialInstrumentKey || DEFAULT_INSTRUMENT
  );
  const [inputKey, setInputKey] = useState(
    initialInstrumentKey || DEFAULT_INSTRUMENT
  );
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    const key = initialInstrumentKey || DEFAULT_INSTRUMENT;
    setInstrumentKey(key);
    setInputKey(key);
  }, [initialInstrumentKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadBacktest() {
      setLoading(true);
      setError("");
      setReport(null);
      setHasRun(false);

      try {
        const response = await getBacktest(instrumentKey);

        if (cancelled) return;

        setReport(response);
        setHasRun(true);
      } catch (err) {
        if (cancelled) return;

        setError(err.message || "Unable to run backtest.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (instrumentKey) {
      loadBacktest();
    }

    return () => {
      cancelled = true;
    };
  }, [instrumentKey]);

  function handleSubmit(event) {
    event.preventDefault();

    const key = inputKey.trim();

    if (!key) {
      setError("Enter a valid Upstox instrument key.");
      return;
    }

    setInstrumentKey(key);
  }

  const result = report?.result || report?.data || report || {};
  const metrics = result?.metrics || result?.summary || result;
  const trades = Array.isArray(result?.trades) ? result.trades : [];
  const assumptions = result?.assumptions || {};
  const period = report?.period || {};

  const totalTrades =
    metrics?.totalTrades ??
    metrics?.tradeCount ??
    trades.length;

  const winRate =
    metrics?.winRate ??
    metrics?.winRatePercent;

  const profitFactor = metrics?.profitFactor;
  const maxDrawdown =
    metrics?.maxDrawdown ??
    metrics?.maximumDrawdown;

  const netReturn =
    metrics?.netReturnPercent ??
    metrics?.totalReturnPercent ??
    metrics?.cumulativeReturnPercent ??
    metrics?.averageNetReturn;

  return (
    <div>
      <div className="section-heading">
        <div>
          <h2>Strategy Backtesting</h2>
          <p>
            Evaluate the historical results of the current rule-based strategy
            against past price candles.
          </p>
        </div>

        <span className="badge">Historical simulation</span>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "end"
          }}
        >
          <div className="form-group" style={{ flex: "1 1 280px", margin: 0 }}>
            <label className="form-label" htmlFor="backtest-instrument">
              Select instrument
            </label>

            <select
              id="backtest-instrument"
              className="form-control"
              value={inputKey}
              onChange={(event) => setInputKey(event.target.value)}
            >
              {watchlist.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.name} — {item.key}
                </option>
              ))}

              {!watchlist.some((item) => item.key === inputKey) && (
                <option value={inputKey}>{inputKey}</option>
              )}
            </select>
          </div>

          <button
            type="submit"
            className="button button-primary"
            disabled={loading}
          >
            {loading ? "Running backtest..." : "Run backtest"}
          </button>
        </form>

        <p className="muted-text" style={{ marginTop: 12, marginBottom: 0 }}>
          The backend currently fetches its configured historical daily-candle
          period automatically. This screen does not place real trades.
        </p>
      </div>

      {loading && (
        <div className="card loading-state">
          Fetching historical candles and simulating strategy entries and exits.
        </div>
      )}

      {error && (
        <div className="card error-state" role="alert">
          <strong>Backtest failed.</strong>
          <p>{error}</p>
          <p className="muted-text">
            Check the instrument key, Upstox historical-data access, candle
            count, and backend logs.
          </p>
        </div>
      )}

      {!loading && hasRun && report && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="flex-between" style={{ flexWrap: "wrap" }}>
              <div>
                <div className="metric-label">Instrument</div>
                <h3 style={{ margin: "7px 0", fontSize: 16 }}>
                  {report.instrumentKey || instrumentKey}
                </h3>
                <div className="muted-text">
                  {period.from || period.fromDate || ""}
                  {period.to || period.toDate
                    ? ` to ${period.to || period.toDate}`
                    : ""}
                </div>
              </div>

              <span className="badge">
                {result?.success === false
                  ? "Incomplete result"
                  : "Simulation completed"}
              </span>
            </div>
          </div>

          <div className="metric-grid">
            <MetricCard
              label="Total Trades"
              value={formatNumber(totalTrades, 0)}
              subtitle="Simulated entries"
            />

            <MetricCard
              label="Win Rate"
              value={
                winRate == null
                  ? "—"
                  : `${formatNumber(winRate)}%`
              }
              subtitle={
                metrics?.wins != null
                  ? `${metrics.wins} winning trades`
                  : "Winning trades as a share of closed trades"
              }
            />

            <MetricCard
              label="Profit Factor"
              value={formatNumber(profitFactor)}
              subtitle="Gross profit ÷ gross loss"
              className={
                Number(profitFactor) > 1
                  ? "positive"
                  : Number(profitFactor) < 1
                  ? "negative"
                  : ""
              }
            />

            <MetricCard
              label="Net Return"
              value={
                netReturn == null
                  ? "—"
                  : formatPercent(netReturn)
              }
              subtitle="Check the metric definition below"
              className={
                Number(netReturn) > 0
                  ? "positive"
                  : Number(netReturn) < 0
                  ? "negative"
                  : ""
              }
            />

            <MetricCard
              label="Max Drawdown"
              value={
                maxDrawdown == null
                  ? "—"
                  : formatPercent(maxDrawdown)
              }
              subtitle="Largest reported drawdown"
              className="negative"
            />

            <MetricCard
              label="Average Net Return"
              value={
                metrics?.averageNetReturn == null
                  ? "—"
                  : formatPercent(metrics.averageNetReturn)
              }
              subtitle="Average per trade, as reported"
            />

            <MetricCard
              label="Winning Trades"
              value={formatNumber(metrics?.wins, 0)}
              subtitle={`Losses: ${formatNumber(metrics?.losses, 0)}`}
              className="positive"
            />

            <MetricCard
              label="Gross Profit"
              value={formatPercent(metrics?.grossProfit)}
              subtitle={`Gross loss: ${formatPercent(metrics?.grossLoss)}`}
            />
          </div>

          <div className="grid-two" style={{ marginBottom: 20 }}>
            <div className="card">
              <h3 className="card-title">Strategy Assumptions</h3>

              {Object.keys(assumptions).length === 0 ? (
                <div className="empty-state">
                  The API did not return strategy assumptions.
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <tbody>
                      {Object.entries(assumptions).map(([key, value]) => (
                        <tr key={key}>
                          <td>{key.replaceAll(/([A-Z])/g, " $1")}</td>
                          <td>
                            {typeof value === "object" && value !== null
                              ? JSON.stringify(value)
                              : String(value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card">
              <h3 className="card-title">Performance Summary</h3>

              <div className="table-wrap">
                <table className="data-table">
                  <tbody>
                    <tr>
                      <td>Closed trades</td>
                      <td>{formatNumber(totalTrades, 0)}</td>
                    </tr>
                    <tr>
                      <td>Breakeven trades</td>
                      <td>{formatNumber(metrics?.breakeven, 0)}</td>
                    </tr>
                    <tr>
                      <td>Win rate</td>
                      <td>
                        {winRate == null
                          ? "—"
                          : `${formatNumber(winRate)}%`}
                      </td>
                    </tr>
                    <tr>
                      <td>Profit factor</td>
                      <td>{formatNumber(profitFactor)}</td>
                    </tr>
                    <tr>
                      <td>Average net return</td>
                      <td>
                        {metrics?.averageNetReturn == null
                          ? "—"
                          : formatPercent(metrics.averageNetReturn)}
                      </td>
                    </tr>
                    <tr>
                      <td>Maximum drawdown</td>
                      <td>
                        {maxDrawdown == null
                          ? "—"
                          : formatPercent(maxDrawdown)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex-between" style={{ marginBottom: 16 }}>
              <h3 className="card-title" style={{ margin: 0 }}>
                Trade History
              </h3>
              <span className="badge">{trades.length} trades</span>
            </div>

            {trades.length === 0 ? (
              <div className="empty-state">
                No trades were generated for this period, or the API returned
                no trade details.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Side</th>
                      <th>Entry Date</th>
                      <th>Exit Date</th>
                      <th>Entry Price</th>
                      <th>Exit Price</th>
                      <th>Stop Loss</th>
                      <th>Target</th>
                      <th>Exit Reason</th>
                      <th>Net Return</th>
                    </tr>
                  </thead>

                  <tbody>
                    {trades.map((trade, index) => {
                      const returnValue =
                        trade.netReturnPercent ??
                        trade.netReturn ??
                        trade.returnPercent;

                      return (
                        <tr key={trade.id || `${trade.entryTime}-${index}`}>
                          <td>{index + 1}</td>
                          <td>
                            <span
                              className={`badge ${
                                String(trade.side).toUpperCase() === "BUY"
                                  ? "success"
                                  : "danger"
                              }`}
                            >
                              {trade.side || trade.signal || "—"}
                            </span>
                          </td>
                          <td>
                            {trade.entryDate ||
                              trade.entryTime ||
                              trade.entryTimestamp ||
                              "—"}
                          </td>
                          <td>
                            {trade.exitDate ||
                              trade.exitTime ||
                              trade.exitTimestamp ||
                              "—"}
                          </td>
                          <td>{formatNumber(trade.entryPrice)}</td>
                          <td>{formatNumber(trade.exitPrice)}</td>
                          <td>{formatNumber(trade.stopLoss)}</td>
                          <td>{formatNumber(trade.target)}</td>
                          <td>{trade.exitReason || trade.reason || "—"}</td>
                          <td
                            className={
                              Number(returnValue) > 0
                                ? "positive"
                                : Number(returnValue) < 0
                                ? "negative"
                                : "neutral"
                            }
                          >
                            {returnValue == null
                              ? "—"
                              : formatPercent(returnValue)}
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
            Backtest results are historical simulations, not forecasts. Real
            execution can differ due to slippage, brokerage, taxes, liquidity,
            and other market conditions. Historical performance does not
            guarantee future results.
          </p>
        </>
      )}
    </div>
  );
}
