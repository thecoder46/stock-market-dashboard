import { useState } from "react";

const API_URL = "https://stock-market-api1.onrender.com";

const DEFAULT_STOCKS = [
  "NSE_EQ|INE002A01018",
  "NSE_EQ|INE009A01021",
  "NSE_EQ|INE040A01034"
];

function formatPrice(value) {
  return Number.isFinite(value)
    ? `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
    : "—";
}

function getDecisionColor(decision) {
  if (decision?.includes("BUY")) return "#16803c";
  if (decision?.includes("SELL")) return "#c62828";
  return "#777";
}

export default function Scanner() {
  const [instrumentKeys, setInstrumentKeys] = useState(
    DEFAULT_STOCKS.join("\n")
  );
  const [results, setResults] = useState([]);
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runScanner() {
    const keys = [...new Set(
      instrumentKeys.split(/\n|,/).map((key) => key.trim()).filter(Boolean)
    )];

    if (!keys.length) {
      setError("Enter at least one instrument key.");
      return;
    }

    if (keys.length > 20) {
      setError("Enter no more than 20 stocks per scan.");
      return;
    }

    setLoading(true);
    setError("");
    setErrors([]);
    setResults([]);

    try {
      const response = await fetch(`${API_URL}/api/scanner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instrumentKeys: keys })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Scanner request failed.");
      }

      setResults(data.data || []);
      setErrors(data.errors || []);
    } catch (err) {
      setError(err.message || "Unable to reach the scanner.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="scanner-page">
      <h2>AI Stock Scanner</h2>
      <p>
        Rank stocks using technical indicators, chart patterns,
        news sentiment and market context.
      </p>

      <label htmlFor="scanner-keys">Instrument keys (one per line)</label>
      <textarea
        id="scanner-keys"
        value={instrumentKeys}
        onChange={(event) => setInstrumentKeys(event.target.value)}
        rows={5}
        spellCheck={false}
      />

      <button onClick={runScanner} disabled={loading}>
        {loading ? "Scanning stocks..." : "Run Scanner"}
      </button>

      {error && <p role="alert">{error}</p>}

      {results.length > 0 && (
        <>
          <h3>Ranked results</h3>
          <div className="scanner-table-wrap">
            <table className="scanner-table">
              <thead>
                <tr>
                  <th>Stock key</th>
                  <th>Price</th>
                  <th>Final score</th>
                  <th>Bias</th>
                  <th>Decision</th>
                  <th>Trend</th>
                  <th>News</th>
                  <th>Risk setup</th>
                </tr>
              </thead>
              <tbody>
                {results.map((stock) => (
                  <tr key={stock.instrumentKey}>
                    <td>{stock.instrumentKey}</td>
                    <td>{formatPrice(stock.currentPrice)}</td>
                    <td>
                      {stock.finalScore?.score ?? "—"}/100
                    </td>
                    <td>{stock.finalScore?.bias ?? "—"}</td>
                    <td style={{
                      color: getDecisionColor(stock.finalScore?.decision),
                      fontWeight: 600
                    }}>
                      {stock.finalScore?.decision ?? stock.signal ?? "—"}
                    </td>
                    <td>{stock.trend ?? "—"}</td>
                    <td>
                      {stock.sentiment?.sentiment ?? "Unavailable"}
                      {" "}
                      ({stock.sentiment?.articleCount ?? 0})
                    </td>
                    <td>
                      {stock.risk?.setup
                        ? `${stock.risk.setup.direction}: ${stock.risk.setup.trigger}`
                        : "No setup"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {errors.length > 0 && (
        <>
          <h3>Stocks not analyzed</h3>
          <ul>
            {errors.map((item) => (
              <li key={item.instrumentKey}>
                {item.instrumentKey}: {item.reason}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="scanner-disclaimer">
        Scores are analytical estimates, not guaranteed predictions.
        This scanner does not place orders.
      </p>
    </section>
  );
}