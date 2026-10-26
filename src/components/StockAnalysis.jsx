
import { useEffect, useState } from "react";
import {
  getStockAnalysis,
  getStockNews
} from "../api.js";

const DEFAULT_INSTRUMENT = "NSE_EQ|INE002A01018";

function formatNumber(value, digits = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return number.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString();
}

function scoreClass(score) {
  if (!Number.isFinite(Number(score))) return "neutral";
  if (Number(score) >= 65) return "positive";
  if (Number(score) <= 35) return "negative";
  return "neutral";
}

function SignalBadge({ value }) {
  const signal = String(value || "UNAVAILABLE").toUpperCase();

  let variant = "warning";

  if (["BUY", "BUY_ON_BREAKOUT", "BULLISH"].includes(signal)) {
    variant = "success";
  } else if (["SELL", "SELL_ON_BREAKDOWN", "BEARISH"].includes(signal)) {
    variant = "danger";
  }

  return <span className={`badge ${variant}`}>{signal.replaceAll("_", " ")}</span>;
}

function Indicator({ label, value, description }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ fontSize: 21 }}>
        {value ?? "—"}
      </div>
      {description && (
        <div className="metric-subtitle">{description}</div>
      )}
    </div>
  );
}

function ScoreBar({ label, score }) {
  const numericScore = Number(score);
  const validScore = Number.isFinite(numericScore)
    ? Math.max(0, Math.min(100, numericScore))
    : 0;

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="flex-between" style={{ marginBottom: 7 }}>
        <span className="muted-text">{label}</span>
        <strong style={{ fontSize: 12 }}>
          {Number.isFinite(numericScore) ? `${validScore.toFixed(1)}/100` : "—"}
        </strong>
      </div>

      <div
        style={{
          width: "100%",
          height: 7,
          overflow: "hidden",
          borderRadius: 99,
          background: "#edf0f6"
        }}
      >
        <div
          style={{
            width: `${validScore}%`,
            height: "100%",
            borderRadius: 99,
            background:
              validScore >= 65
                ? "#14845d"
                : validScore <= 35
                ? "#d64545"
                : "#4169e1",
            transition: "width 200ms ease"
          }}
        />
      </div>
    </div>
  );
}

export default function StockAnalysis({
  initialInstrumentKey = DEFAULT_INSTRUMENT,
  quotes = {}
}) {
  const [instrumentKey, setInstrumentKey] = useState(
    initialInstrumentKey || DEFAULT_INSTRUMENT
  );
  const [inputKey, setInputKey] = useState(
    initialInstrumentKey || DEFAULT_INSTRUMENT
  );
  const [analysis, setAnalysis] = useState(null);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newsWarning, setNewsWarning] = useState("");
  const [lastLoaded, setLastLoaded] = useState(null);

  useEffect(() => {
    const key = initialInstrumentKey || DEFAULT_INSTRUMENT;
    setInstrumentKey(key);
    setInputKey(key);
  }, [initialInstrumentKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadAnalysis() {
      setLoading(true);
      setError("");
      setNewsWarning("");

      const [analysisResult, newsResult] = await Promise.allSettled([
        getStockAnalysis(instrumentKey),
        getStockNews(instrumentKey)
      ]);

      if (cancelled) return;

      if (analysisResult.status === "fulfilled") {
        setAnalysis(analysisResult.value);
        setLastLoaded(Date.now());

        if (analysisResult.value.newsWarning) {
          setNewsWarning(analysisResult.value.newsWarning);
        }
      } else {
        setAnalysis(null);
        setError(
          analysisResult.reason?.message ||
          "Unable to load stock analysis."
        );
      }

      if (newsResult.status === "fulfilled") {
        setNews(newsResult.value.data || []);
      } else {
        setNews([]);
        setNewsWarning(
          newsResult.reason?.message ||
          "News is currently unavailable."
        );
      }

      setLoading(false);
    }

    loadAnalysis();

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

  const quote = quotes[instrumentKey] || {};
  const indicators = analysis?.analysis?.indicators || {};
  const patterns = analysis?.patterns || {};
  const signal = analysis?.signal || {};
  const risk = analysis?.risk || {};
  const finalScore = analysis?.finalScore || {};
  const sentiment = analysis?.sentiment || {};

  const patternNames = Array.isArray(patterns.patterns)
    ? patterns.patterns
    : [];

  const componentScores = finalScore.components || {};

  return (
    <div>
      <div className="section-heading">
        <div>
          <h2>Stock Analysis</h2>
          <p>
            Technical indicators, patterns, signal scoring, risk levels, and
            stock-related news.
          </p>
        </div>

        <span className="badge">
          {lastLoaded
            ? `Updated ${new Date(lastLoaded).toLocaleTimeString()}`
            : "Analysis workspace"}
        </span>
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
            <label className="form-label" htmlFor="analysis-instrument">
              Upstox instrument key
            </label>
            <input
              id="analysis-instrument"
              className="form-control"
              value={inputKey}
              onChange={(event) => setInputKey(event.target.value)}
              placeholder="NSE_EQ|..."
              required
            />
          </div>

          <button
            type="submit"
            className="button button-primary"
            disabled={loading}
          >
            {loading ? "Analyzing..." : "Analyze stock"}
          </button>
        </form>
      </div>

      {loading && (
        <div className="card loading-state">
          Loading historical candles, indicators, patterns, and news...
        </div>
      )}

      {error && (
        <div className="card error-state" role="alert">
          {error}
          <p className="muted-text">
            Verify the instrument key, Upstox token, historical-data access,
            and backend logs.
          </p>
        </div>
      )}

      {!loading && analysis && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="flex-between" style={{ flexWrap: "wrap" }}>
              <div>
                <div className="metric-label">Selected instrument</div>
                <h3 style={{ margin: "7px 0", fontSize: 17 }}>
                  {instrumentKey}
                </h3>
                <div className="muted-text">
                  Analysis price: ₹{formatNumber(analysis.currentPrice)}
                  {quote.ltp != null
                    ? ` · Live quote: ₹${formatNumber(quote.ltp)}`
                    : ""}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <SignalBadge value={signal.signal} />
                <SignalBadge value={finalScore.bias} />
              </div>
            </div>
          </div>

          <div className="metric-grid">
            <Indicator
              label="Technical Score"
              value={`${formatNumber(analysis.analysis?.score, 1)}/100`}
              description={analysis.analysis?.trend || "Trend unavailable"}
            />
            <Indicator
              label="Final Score"
              value={`${formatNumber(finalScore.score, 1)}/100`}
              description="Rule-based composite score"
            />
            <Indicator
              label="RSI (14)"
              value={formatNumber(indicators.rsi14, 1)}
              description="Momentum indicator"
            />
            <Indicator
              label="ATR (14)"
              value={formatNumber(indicators.atr14)}
              description={`ATR %: ${formatNumber(indicators.atrPercent)}%`}
            />
          </div>

          <div className="grid-two" style={{ marginBottom: 20 }}>
            <div className="card">
              <h3 className="card-title">Technical Indicators</h3>

              <div className="table-wrap">
                <table className="data-table">
                  <tbody>
                    <tr>
                      <td>EMA 20</td>
                      <td>{formatNumber(indicators.ema20)}</td>
                    </tr>
                    <tr>
                      <td>EMA 50</td>
                      <td>{formatNumber(indicators.ema50)}</td>
                    </tr>
                    <tr>
                      <td>EMA 200</td>
                      <td>{formatNumber(indicators.ema200)}</td>
                    </tr>
                    <tr>
                      <td>MACD</td>
                      <td>{formatNumber(indicators.macd)}</td>
                    </tr>
                    <tr>
                      <td>MACD Signal</td>
                      <td>{formatNumber(indicators.macdSignal)}</td>
                    </tr>
                    <tr>
                      <td>MACD Histogram</td>
                      <td>{formatNumber(indicators.macdHistogram)}</td>
                    </tr>
                    <tr>
                      <td>VWAP</td>
                      <td>{formatNumber(indicators.vwap)}</td>
                    </tr>
                    <tr>
                      <td>Bollinger Upper</td>
                      <td>{formatNumber(indicators.bollinger?.upper)}</td>
                    </tr>
                    <tr>
                      <td>Bollinger Middle</td>
                      <td>{formatNumber(indicators.bollinger?.middle)}</td>
                    </tr>
                    <tr>
                      <td>Bollinger Lower</td>
                      <td>{formatNumber(indicators.bollinger?.lower)}</td>
                    </tr>
                    <tr>
                      <td>Support</td>
                      <td>{formatNumber(indicators.support)}</td>
                    </tr>
                    <tr>
                      <td>Resistance</td>
                      <td>{formatNumber(indicators.resistance)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <h3 className="card-title">Signal & Pattern Analysis</h3>

              <div className="flex-between" style={{ marginBottom: 18 }}>
                <span className="muted-text">Suggested signal</span>
                <SignalBadge value={signal.signal} />
              </div>

              <div className="flex-between" style={{ marginBottom: 18 }}>
                <span className="muted-text">Final decision</span>
                <SignalBadge value={finalScore.decision} />
              </div>

              <div className="flex-between" style={{ marginBottom: 18 }}>
                <span className="muted-text">Signal confidence</span>
                <strong>{formatNumber(signal.confidence, 1)}%</strong>
              </div>

              <div className="flex-between" style={{ marginBottom: 18 }}>
                <span className="muted-text">Pattern</span>
                <strong>{patterns.pattern || "NEUTRAL"}</strong>
              </div>

              <div className="flex-between" style={{ marginBottom: 18 }}>
                <span className="muted-text">Trend</span>
                <strong>{analysis.analysis?.trend || "—"}</strong>
              </div>

              <div className="muted-text" style={{ marginBottom: 8 }}>
                Detected patterns
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {patternNames.length > 0 ? (
                  patternNames.map((name) => (
                    <span className="badge" key={name}>
                      {String(name).replaceAll("_", " ")}
                    </span>
                  ))
                ) : (
                  <span className="muted-text">
                    No additional patterns reported.
                  </span>
                )}
              </div>

              {Array.isArray(analysis.analysis?.reasons) &&
                analysis.analysis.reasons.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div className="muted-text" style={{ marginBottom: 8 }}>
                      Technical notes
                    </div>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: 19,
                        color: "#69758b",
                        fontSize: 12,
                        lineHeight: 1.9
                      }}
                    >
                      {analysis.analysis.reasons.map((reason, index) => (
                        <li key={`${index}-${reason}`}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          </div>

          <div className="grid-two" style={{ marginBottom: 20 }}>
            <div className="card">
              <h3 className="card-title">Final Score Breakdown</h3>

              {Object.entries(componentScores).length > 0 ? (
                Object.entries(componentScores).map(([key, value]) => (
                  <ScoreBar
                    key={key}
                    label={key.replaceAll(/([A-Z])/g, " $1")}
                    score={value}
                  />
                ))
              ) : (
                <div className="empty-state">
                  Score breakdown is not available.
                </div>
              )}

              <div className={`metric-subtitle ${scoreClass(finalScore.score)}`}>
                Overall score: {formatNumber(finalScore.score, 1)}/100
              </div>
            </div>

            <div className="card">
              <h3 className="card-title">Risk Setup</h3>

              <div className="flex-between" style={{ marginBottom: 15 }}>
                <span className="muted-text">Setup status</span>
                <SignalBadge value={risk.status} />
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <tbody>
                    <tr>
                      <td>Entry reference</td>
                      <td>₹{formatNumber(risk.entry)}</td>
                    </tr>
                    <tr>
                      <td>Stop loss</td>
                      <td className="negative">₹{formatNumber(risk.stopLoss)}</td>
                    </tr>
                    <tr>
                      <td>Target 1</td>
                      <td className="positive">₹{formatNumber(risk.target1)}</td>
                    </tr>
                    <tr>
                      <td>Target 2</td>
                      <td className="positive">₹{formatNumber(risk.target2)}</td>
                    </tr>
                    <tr>
                      <td>Risk/reward 1</td>
                      <td>{formatNumber(risk.riskReward1)}</td>
                    </tr>
                    <tr>
                      <td>Risk/reward 2</td>
                      <td>{formatNumber(risk.riskReward2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {risk.message && (
                <p className="muted-text" style={{ marginTop: 12 }}>
                  {risk.message}
                </p>
              )}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <h3 className="card-title">News Sentiment</h3>

            <div className="flex-between" style={{ marginBottom: 14 }}>
              <span className="muted-text">Sentiment</span>
              <SignalBadge value={sentiment.label || "NEUTRAL"} />
            </div>

            <div className="flex-between" style={{ marginBottom: 14 }}>
              <span className="muted-text">Sentiment score</span>
              <strong>{formatNumber(sentiment.score, 1)}</strong>
            </div>

            <div className="flex-between">
              <span className="muted-text">Articles analyzed</span>
              <strong>{sentiment.articleCount ?? news.length}</strong>
            </div>

            {newsWarning && (
              <p className="muted-text" style={{ marginTop: 12 }}>
                News warning: {newsWarning}
              </p>
            )}
          </div>

          <div className="card">
            <h3 className="card-title">Recent Stock News</h3>

            {news.length === 0 ? (
              <div className="empty-state">
                No news articles are available for this instrument right now.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 15 }}>
                {news.map((article, index) => {
                  const title =
                    article.headline ||
                    article.title ||
                    article.name ||
                    "Untitled news article";

                  const summary =
                    article.summary ||
                    article.description ||
                    "";

                  const articleUrl =
                    article.url ||
                    article.link ||
                    article.web_url ||
                    "";

                  return (
                    <article
                      key={article.id || articleUrl || `${title}-${index}`}
                      style={{
                        paddingBottom: 15,
                        borderBottom:
                          index === news.length - 1
                            ? "none"
                            : "1px solid #edf0f5"
                      }}
                    >
                      <div style={{ fontWeight: 700, lineHeight: 1.6 }}>
                        {articleUrl ? (
                          <a
                            href={articleUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {title}
                          </a>
                        ) : (
                          title
                        )}
                      </div>

                      {summary && (
                        <p className="muted-text" style={{ margin: "7px 0" }}>
                          {summary}
                        </p>
                      )}

                      <div className="muted-text">
                        {formatDate(
                          article.published_at ||
                          article.publish_time ||
                          article.created_at
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <p className="muted-text" style={{ marginTop: 16 }}>
            Scores, signals, and risk levels are algorithmic estimates based on
            available historical data and rule-based models. They are not
            guaranteed outcomes or personalized investment advice. No orders
            are placed by this dashboard.
          </p>
        </>
      )}
    </div>
  );
}
