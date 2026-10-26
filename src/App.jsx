
import { useCallback, useEffect, useState } from "react";
import {
  getQuotes,
  getMarketContext,
  getSubscriptions,
  subscribeInstruments,
  WS_URL
} from "./api.js";

import MarketOverview from "./components/MarketOverview.jsx";
import Watchlist from "./components/Watchlist.jsx";
import StockAnalysis from "./components/StockAnalysis.jsx";
import Scanner from "./components/Scanner.jsx";
import Backtest from "./components/Backtest.jsx";
import IpoCentre from "./components/IpoCentre.jsx";

const DEFAULT_WATCHLIST = [
  {
    key: "NSE_INDEX|Nifty 50",
    name: "NIFTY 50",
    category: "Index"
  },
  {
    key: "NSE_INDEX|Nifty Bank",
    name: "BANK NIFTY",
    category: "Index"
  },
  {
    key: "NSE_INDEX|India VIX",
    name: "INDIA VIX",
    category: "Volatility"
  },
  {
    key: "NSE_EQ|INE002A01018",
    name: "Reliance Industries",
    category: "Equity"
  },
  {
    key: "NSE_EQ|INE009A01021",
    name: "Infosys",
    category: "Equity"
  },
  {
    key: "NSE_EQ|INE040A01034",
    name: "HDFC Bank",
    category: "Equity"
  }
];

const NAV_ITEMS = [
  { id: "overview", label: "Market Overview", icon: "◫" },
  { id: "watchlist", label: "Watchlist", icon: "☆" },
  { id: "analysis", label: "Stock Analysis", icon: "⌁" },
  { id: "scanner", label: "Stock Scanner", icon: "⌕" },
  { id: "backtest", label: "Backtesting", icon: "▥" },
  { id: "ipos", label: "IPO Centre", icon: "▤" }
];

function App() {
  const [activePage, setActivePage] = useState("overview");
  const [quotes, setQuotes] = useState({});
  const [marketContext, setMarketContext] = useState(null);
  const [watchlist, setWatchlist] = useState(DEFAULT_WATCHLIST);
  const [selectedInstrument, setSelectedInstrument] = useState(
    "NSE_EQ|INE002A01018"
  );
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const refreshMarketData = useCallback(async () => {
    try {
      const [quoteResult, contextResult] = await Promise.allSettled([
        getQuotes(),
        getMarketContext()
      ]);

      if (quoteResult.status === "fulfilled") {
        setQuotes(quoteResult.value.data || {});
        setLastUpdated(Date.now());
        setErrorMessage("");
      } else {
        setErrorMessage(quoteResult.reason?.message || "Unable to load quotes");
      }

      if (contextResult.status === "fulfilled") {
        setMarketContext(contextResult.value);
      }
    } catch (error) {
      setErrorMessage(error.message || "Unable to refresh market data");
    }
  }, []);

  // Load initial data and keep a fallback refresh for the live feed.
  useEffect(() => {
    refreshMarketData();

    const intervalId = window.setInterval(refreshMarketData, 15000);

    return () => window.clearInterval(intervalId);
  }, [refreshMarketData]);

  // Subscribe the default indices and equities.
  useEffect(() => {
    subscribeInstruments(watchlist.map((item) => item.key)).catch((error) => {
      console.warn("Subscription request failed:", error.message);
    });

    getSubscriptions()
      .then((result) => {
        if (result.connected) {
          setConnectionStatus("connected");
        }
      })
      .catch(() => {
        // The WebSocket connection below determines live status.
      });
  }, [watchlist]);

  // Live browser connection for quote updates.
  useEffect(() => {
    let socket;
    let reconnectTimer;
    let disposed = false;
    let reconnectDelay = 1000;

    function connect() {
      if (disposed) return;

      try {
        socket = new WebSocket(WS_URL);
      } catch {
        setConnectionStatus("disconnected");
        return;
      }

      socket.onopen = () => {
        reconnectDelay = 1000;
        setConnectionStatus("connected");
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "market_snapshot") {
            setQuotes((previous) => ({
              ...previous,
              ...(message.data || {})
            }));
            setLastUpdated(Date.now());
          }

          if (message.type === "market_update" && message.data?.instrumentKey) {
            const update = message.data;

            setQuotes((previous) => ({
              ...previous,
              [update.instrumentKey]: {
                ...previous[update.instrumentKey],
                ...update
              }
            }));

            setLastUpdated(Date.now());
          }
        } catch (error) {
          console.error("Unable to process market WebSocket message:", error);
        }
      };

      socket.onerror = () => {
        setConnectionStatus("disconnected");
      };

      socket.onclose = () => {
        if (disposed) return;

        setConnectionStatus("reconnecting");

        reconnectTimer = window.setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, 15000);
          connect();
        }, reconnectDelay);
      };
    }

    connect();

    return () => {
      disposed = true;
      window.clearTimeout(reconnectTimer);

      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, []);

  const addToWatchlist = useCallback((instrument) => {
    const key = instrument?.key?.trim();
    const name = instrument?.name?.trim();

    if (!key || !name) return;

    setWatchlist((previous) => {
      if (previous.some((item) => item.key === key)) {
        return previous;
      }

      return [
        ...previous,
        {
          key,
          name,
          category: instrument.category || "Equity"
        }
      ];
    });
  }, []);

  const removeFromWatchlist = useCallback((instrumentKey) => {
    setWatchlist((previous) =>
      previous.filter((item) => item.key !== instrumentKey)
    );
  }, []);

  const renderPage = () => {
    switch (activePage) {
      case "overview":
        return (
          <MarketOverview
            quotes={quotes}
            marketContext={marketContext}
            lastUpdated={lastUpdated}
            onOpenAnalysis={(key) => {
              setSelectedInstrument(key);
              setActivePage("analysis");
            }}
          />
        );

      case "watchlist":
        return (
          <Watchlist
            quotes={quotes}
            watchlist={watchlist}
            onAdd={addToWatchlist}
            onRemove={removeFromWatchlist}
            onAnalyze={(key) => {
              setSelectedInstrument(key);
              setActivePage("analysis");
            }}
          />
        );

      case "analysis":
        return (
          <StockAnalysis
            initialInstrumentKey={selectedInstrument}
            quotes={quotes}
          />
        );

      case "scanner":
        return (
          <Scanner
            watchlist={watchlist}
            onAnalyze={(key) => {
              setSelectedInstrument(key);
              setActivePage("analysis");
            }}
          />
        );

      case "backtest":
        return (
          <Backtest
            watchlist={watchlist}
            initialInstrumentKey={selectedInstrument}
          />
        );

      case "ipos":
        return <IpoCentre />;

      default:
        return null;
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <div className="brand-name">MarketPulse</div>
            <div className="brand-caption">STOCK INTELLIGENCE</div>
          </div>
        </div>

        <div className="sidebar-section-label">WORKSPACE</div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`nav-item ${
                activePage === item.id ? "active" : ""
              }`}
              onClick={() => setActivePage(item.id)}
              aria-current={activePage === item.id ? "page" : undefined}
            >
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-status">
            <span
              className={`status-dot ${
                connectionStatus === "connected" ? "online" : ""
              }`}
            />
            <div>
              <div className="sidebar-status-title">
                {connectionStatus === "connected"
                  ? "Live feed connected"
                  : connectionStatus === "reconnecting"
                  ? "Reconnecting..."
                  : connectionStatus === "connecting"
                  ? "Connecting..."
                  : "Feed disconnected"}
              </div>
              <div className="sidebar-status-subtitle">
                Upstox market data
              </div>
            </div>
          </div>

          <div className="sidebar-disclaimer">
            Analysis is informational, not investment advice. No orders are
            executed by this dashboard.
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-title">
            <span className="topbar-eyebrow">MARKET WORKSPACE</span>
            <h1>
              {NAV_ITEMS.find((item) => item.id === activePage)?.label ||
                "Dashboard"}
            </h1>
          </div>

          <div className="topbar-right">
            <div className="market-status">
              <span
                className={`status-dot ${
                  connectionStatus === "connected" ? "online" : ""
                }`}
              />
              <span>
                {connectionStatus === "connected" ? "LIVE" : "OFFLINE"}
              </span>
            </div>

            <button
              type="button"
              className="refresh-button"
              onClick={refreshMarketData}
              title="Refresh market data"
            >
              ↻ <span>Refresh</span>
            </button>
          </div>
        </header>

        {errorMessage && (
          <div className="app-error" role="alert">
            <strong>Market data warning:</strong> {errorMessage}
            <button
              type="button"
              onClick={() => setErrorMessage("")}
              aria-label="Dismiss warning"
            >
              ×
            </button>
          </div>
        )}

        <section className="page-content" key={activePage}>
          {renderPage()}
        </section>

        <footer className="app-footer">
          <span>MarketPulse · Stock Market Dashboard</span>
          <span>
            {lastUpdated
              ? `Last data update: ${new Date(lastUpdated).toLocaleTimeString()}`
              : "Waiting for market data"}
          </span>
        </footer>
      </main>
    </div>
  );
}

export default App;
