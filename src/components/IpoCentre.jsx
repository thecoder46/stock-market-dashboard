
import { useCallback, useEffect, useState } from "react";
import { getIPOs } from "../api.js";

const IPO_STATUSES = [
  { value: "open", label: "Open IPOs" },
  { value: "upcoming", label: "Upcoming IPOs" },
  { value: "closed", label: "Closed IPOs" },
  { value: "listed", label: "Listed IPOs" }
];

function formatAmount(value) {
  if (value == null || value === "") return "—";

  const number = Number(value);

  if (!Number.isFinite(number)) return String(value);

  return `₹${number.toLocaleString("en-IN", {
    maximumFractionDigits: 2
  })}`;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function displayValue(...values) {
  const value = values.find(
    (item) => item !== undefined && item !== null && item !== ""
  );

  return value ?? "—";
}

function getIssueType(ipo) {
  return String(
    ipo.issue_type ||
    ipo.issueType ||
    ipo.type ||
    ""
  ).toLowerCase();
}

function getPriceRange(ipo) {
  const low = displayValue(
    ipo.min_price,
    ipo.minPrice,
    ipo.floor_price,
    ipo.floorPrice
  );

  const high = displayValue(
    ipo.max_price,
    ipo.maxPrice,
    ipo.cap_price,
    ipo.capPrice
  );

  if (low === "—" && high === "—") {
    return displayValue(ipo.price_band, ipo.priceBand);
  }

  if (low === high) {
    return formatAmount(low);
  }

  return `${low === "—" ? "" : formatAmount(low)} – ${
    high === "—" ? "" : formatAmount(high)
  }`;
}

function IpoCard({ ipo }) {
  const name = displayValue(
    ipo.name,
    ipo.company_name,
    ipo.companyName,
    ipo.issuer_name,
    ipo.symbol
  );

  const issueType = displayValue(
    ipo.issue_type,
    ipo.issueType,
    ipo.type
  );

  const openDate = displayValue(
    ipo.start_date,
    ipo.startDate,
    ipo.open_date,
    ipo.openDate
  );

  const closeDate = displayValue(
    ipo.end_date,
    ipo.endDate,
    ipo.close_date,
    ipo.closeDate
  );

  const listingDate = displayValue(
    ipo.listing_date,
    ipo.listingDate
  );

  const lotSize = displayValue(
    ipo.lot_size,
    ipo.lotSize
  );

  const issueSize = displayValue(
    ipo.issue_size,
    ipo.issueSize,
    ipo.total_issue_size
  );

  const status = displayValue(ipo.status, "IPO");

  return (
    <article className="card">
      <div className="flex-between" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.5,
              overflowWrap: "anywhere"
            }}
          >
            {name}
          </h3>

          <p className="muted-text" style={{ margin: "5px 0 0" }}>
            {displayValue(ipo.symbol, ipo.isin)}
          </p>
        </div>

        <span className="badge">{String(status).toUpperCase()}</span>
      </div>

      <div
        style={{
          marginTop: 18,
          padding: 14,
          borderRadius: 9,
          background: "#f7f8fc"
        }}
      >
        <div className="metric-label">Price band</div>
        <div className="metric-value" style={{ fontSize: 20 }}>
          {getPriceRange(ipo)}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 17,
          marginTop: 18
        }}
      >
        <div>
          <div className="metric-label">Issue type</div>
          <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700 }}>
            {String(issueType)}
          </div>
        </div>

        <div>
          <div className="metric-label">Lot size</div>
          <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700 }}>
            {lotSize}
          </div>
        </div>

        <div>
          <div className="metric-label">Opens</div>
          <div style={{ marginTop: 6, fontSize: 12, fontWeight: 650 }}>
            {openDate === "—" ? "—" : formatDate(openDate)}
          </div>
        </div>

        <div>
          <div className="metric-label">Closes</div>
          <div style={{ marginTop: 6, fontSize: 12, fontWeight: 650 }}>
            {closeDate === "—" ? "—" : formatDate(closeDate)}
          </div>
        </div>

        <div>
          <div className="metric-label">Issue size</div>
          <div style={{ marginTop: 6, fontSize: 12, fontWeight: 650 }}>
            {issueSize === "—" ? "—" : formatAmount(issueSize)}
          </div>
        </div>

        <div>
          <div className="metric-label">Listing date</div>
          <div style={{ marginTop: 6, fontSize: 12, fontWeight: 650 }}>
            {listingDate === "—" ? "—" : formatDate(listingDate)}
          </div>
        </div>
      </div>

      {ipo.description && (
        <p className="muted-text" style={{ marginTop: 16 }}>
          {ipo.description}
        </p>
      )}
    </article>
  );
}

export default function IpoCentre() {
  const [status, setStatus] = useState("open");
  const [issueType, setIssueType] = useState("");
  const [ipos, setIpos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState("");

  const loadIPOs = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getIPOs(status, issueType);

      if (!response.success) {
        throw new Error(response.message || "Unable to fetch IPOs.");
      }

      const records = Array.isArray(response.data)
        ? response.data
        : [];

      setIpos(records);
      setLastUpdated(Date.now());
    } catch (err) {
      setIpos([]);
      setError(err.message || "Unable to load IPO information.");
    } finally {
      setLoading(false);
    }
  }, [status, issueType]);

  useEffect(() => {
    loadIPOs();
  }, [loadIPOs]);

  const filteredIPOs = ipos.filter((ipo) => {
    const query = search.trim().toLowerCase();

    const name = String(
      ipo.name ||
      ipo.company_name ||
      ipo.companyName ||
      ipo.issuer_name ||
      ipo.symbol ||
      ""
    ).toLowerCase();

    const symbol = String(ipo.symbol || "").toLowerCase();

    return !query || name.includes(query) || symbol.includes(query);
  });

  return (
    <div>
      <div className="section-heading">
        <div>
          <h2>IPO Centre</h2>
          <p>
            Browse IPO listings and filter by status, issue type, or company.
          </p>
        </div>

        <button
          type="button"
          className="button button-secondary"
          onClick={loadIPOs}
          disabled={loading}
        >
          {loading ? "Loading..." : "↻ Refresh IPOs"}
        </button>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-label">Selected category</div>
          <div className="metric-value" style={{ fontSize: 20 }}>
            {IPO_STATUSES.find((item) => item.value === status)?.label}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Results received</div>
          <div className="metric-value">{ipos.length}</div>
          <div className="metric-subtitle">From the Upstox API</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Matching results</div>
          <div className="metric-value">{filteredIPOs.length}</div>
          <div className="metric-subtitle">After local search filtering</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Last refreshed</div>
          <div className="metric-value" style={{ fontSize: 17 }}>
            {lastUpdated
              ? new Date(lastUpdated).toLocaleTimeString()
              : "—"}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 14
          }}
        >
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="ipo-status">
              IPO status
            </label>
            <select
              id="ipo-status"
              className="form-control"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {IPO_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="ipo-type">
              Issue type
            </label>
            <select
              id="ipo-type"
              className="form-control"
              value={issueType}
              onChange={(event) => setIssueType(event.target.value)}
            >
              <option value="">All issue types</option>
              <option value="mainboard">Mainboard</option>
              <option value="sme">SME</option>
            </select>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="ipo-search">
              Search company
            </label>
            <input
              id="ipo-search"
              className="form-control"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Enter company or symbol"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="card error-state" role="alert" style={{ marginBottom: 20 }}>
          <strong>Unable to load IPOs.</strong>
          <p>{error}</p>
          <p className="muted-text">
            Check your Upstox access token, API permissions, and backend logs.
          </p>
        </div>
      )}

      {loading ? (
        <div className="card loading-state">
          Fetching IPO listings...
        </div>
      ) : filteredIPOs.length === 0 ? (
        <div className="card empty-state">
          No IPO records match the selected filters. The upstream API may
          return no data for this status or issue type.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18
          }}
        >
          {filteredIPOs.map((ipo, index) => (
            <IpoCard
              key={
                ipo.id ||
                ipo.symbol ||
                ipo.isin ||
                `${ipo.name || ipo.company_name || "ipo"}-${index}`
              }
              ipo={ipo}
            />
          ))}
        </div>
      )}

      <p className="muted-text" style={{ marginTop: 18 }}>
        IPO details are displayed from the upstream API response. Verify dates,
        price bands, lot sizes, and issue details from official exchange or
        issuer documents before making an investment decision.
      </p>
    </div>
  );
}
