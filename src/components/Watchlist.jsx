
import { useState } from "react";

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

function changeClass(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number === 0) return "neutral";

  return number > 0 ? "positive" : "negative";
}

export default function Watchlist({
  quotes = {},
  watchlist = [],
  onAdd,
  onRemove,
  onAnalyze
}) {
  const [instrumentKey, setInstrumentKey] = useState("");
  const [instrumentName, setInstrumentName] = useState("");
  const [category, setCategory] = useState("Equity");
  const [formError, setFormError] = useState("");

  function handleAdd(event) {
    event.preventDefault();

    const key = instrumentKey.trim();
    const name = instrumentName.trim();

    if (!key || !name) {
      setFormError("Enter both the instrument key and stock name.");
      return;
    }

    if (watchlist.some((item) => item.key === key)) {
      setFormError("This instrument is already in your watchlist.");
      return;
    }

    onAdd?.({ key, name, category });

    setInstrumentKey("");
    setInstrumentName("");
    setCategory("Equity");
    setFormError("");
  }

  return (
    <div>
      <div className="section-heading">
        <div>
          <h2>My Watchlist</h2>
          <p>
            Track selected instruments and open their technical analysis.
          </p>
        </div>

        <span className="badge">{watchlist.length} instruments</span>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="card-title">Add an instrument</h3>

        <form onSubmit={handleAdd}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 14,
              alignItems: "end"
            }}
          >
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="instrument-name">
                Stock or index name
              </label>
              <input
                id="instrument-name"
                className="form-control"
                value={instrumentName}
                onChange={(event) => setInstrumentName(event.target.value)}
                placeholder="e.g. TCS"
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="instrument-key">
                Upstox instrument key
              </label>
              <input
                id="instrument-key"
                className="form-control"
                value={instrumentKey}
                onChange={(event) => setInstrumentKey(event.target.value)}
                placeholder="NSE_EQ|..."
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="instrument-category">
                Category
              </label>
              <select
                id="instrument-category"
                className="form-control"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="Equity">Equity</option>
                <option value="Index">Index</option>
                <option value="ETF">ETF</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <button type="submit" className="button button-primary">
              + Add to watchlist
            </button>
          </div>

          {formError && (
            <p className="error-state" style={{ padding: "10px 0 0" }}>
              {formError}
            </p>
          )}
        </form>

        <p className="muted-text" style={{ marginTop: 13, marginBottom: 0 }}>
          Use the exact instrument key provided by Upstox. Adding an instrument
          to this watchlist also requests a live market-data subscription.
        </p>
      </div>

      <div className="card">
        <div className="flex-between" style={{ marginBottom: 16 }}>
          <h3 className="card-title" style={{ margin: 0 }}>
            Tracked instruments
          </h3>
          <span className="muted-text">Live feed when available</span>
        </div>

        {watchlist.length === 0 ? (
          <div className="empty-state">
            Your watchlist is empty. Add an instrument above to get started.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Category</th>
                  <th>Last Price</th>
                  <th>Change</th>
                  <th>Change %</th>
                  <th>Feed Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {watchlist.map((item) => {
                  const quote = quotes[item.key];
                  const hasPrice =
                    quote && Number.isFinite(Number(quote.ltp));

                  return (
                    <tr key={item.key}>
                      <td>
                        <div style={{ fontWeight: 750 }}>{item.name}</div>
                        <div className="muted-text">{item.key}</div>
                      </td>

                      <td>{item.category || "Equity"}</td>

                      <td style={{ fontWeight: 750 }}>
                        {formatPrice(quote?.ltp)}
                      </td>

                      <td className={changeClass(quote?.change)}>
                        {quote?.change != null
                          ? `${Number(quote.change) > 0 ? "+" : ""}${formatPrice(quote.change)}`
                          : "—"}
                      </td>

                      <td className={changeClass(quote?.changePercent)}>
                        {formatPercent(quote?.changePercent)}
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            hasPrice ? "success" : "warning"
                          }`}
                        >
                          {hasPrice ? "Data received" : "Waiting for data"}
                        </span>
                      </td>

                      <td>
                        <div
                          style={{
                            display: "flex",
                            gap: 7,
                            flexWrap: "wrap"
                          }}
                        >
                          <button
                            type="button"
                            className="button button-primary"
                            onClick={() => onAnalyze?.(item.key)}
                          >
                            Analyze
                          </button>

                          <button
                            type="button"
                            className="button button-danger"
                            onClick={() => onRemove?.(item.key)}
                            aria-label={`Remove ${item.name}`}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
