import React, { useState } from "react";

export default function App() {
  const [symbol, setSymbol] = useState("AAPL");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function fetchMetrics() {
    setLoading(true);
    setErr("");
    setData(null);
    try {
      const res = await fetch(`/api/metrics?symbol=${encodeURIComponent(symbol.trim())}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      setData(json);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu",
      minHeight: "100vh",
      background: "linear-gradient(180deg,#0f172a,#0b1022)",
      color: "#e5e7eb",
      padding: "24px"
    }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>📈 Momentum & “Value Buy” Ratios</h1>
          <p style={{ opacity: 0.8, marginTop: 6 }}>
            Today vs average close & volume for the last 10/20/30 trading days.
          </p>
        </header>

        <section style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 12,
          marginBottom: 16
        }}>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="Ticker (e.g., NVDA)"
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #334155",
              background: "#0b1224",
              color: "white",
              outline: "none"
            }}
            onKeyDown={(e) => e.key === "Enter" && fetchMetrics()}
          />
          <button
            onClick={fetchMetrics}
            disabled={loading}
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              background: loading ? "#475569" : "#22c55e",
              border: "none",
              cursor: loading ? "default" : "pointer",
              color: "#0b1022",
              fontWeight: 700
            }}>
            {loading ? "Loading..." : "Fetch"}
          </button>
        </section>

        {err && (
          <div style={{
            background: "#7f1d1d",
            border: "1px solid #fecaca",
            color: "#fee2e2",
            padding: 12,
            borderRadius: 12,
            marginBottom: 16
          }}>{err}</div>
        )}

        {data && (
          <div style={{
            background: "rgba(2,6,23,0.6)",
            border: "1px solid #334155",
            borderRadius: 16,
            padding: 16
          }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 220px" }}>
                <div style={{ opacity: 0.7, fontSize: 12 }}>Symbol</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{data.symbol}</div>
              </div>
              <div style={{ flex: "1 1 220px" }}>
                <div style={{ opacity: 0.7, fontSize: 12 }}>Today Price</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>${Number(data.todayPrice).toFixed(2)}</div>
              </div>
              <div style={{ flex: "1 1 220px" }}>
                <div style={{ opacity: 0.7, fontSize: 12 }}>Today Volume</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{data.todayVolume.toLocaleString()}</div>
              </div>
              <div style={{ flex: "1 1 220px" }}>
                <div style={{ opacity: 0.7, fontSize: 12 }}>Last Updated</div>
                <div style={{ fontSize: 16 }}>{new Date(data.lastUpdated).toLocaleString()}</div>
              </div>
            </div>

            <div style={{ overflowX: "auto", marginTop: 16 }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Window</th>
                    <th style={thStyle}>Avg Close</th>
                    <th style={thStyle}>Avg Volume</th>
                    <th style={thStyle}>Price Ratio</th>
                    <th style={thStyle}>Volume Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {data.metrics.map((m) => (
                    <tr key={m.window}>
                      <td style={tdStyle}>{m.window}d</td>
                      <td style={tdStyle}>${m.avgClose.toFixed(4)}</td>
                      <td style={tdStyle}>{m.avgVolume.toLocaleString()}</td>
                      <td style={ratioStyle(m.priceRatio)}>{m.priceRatio.toFixed(4)}</td>
                      <td style={ratioStyle(m.volumeRatio)}>{m.volumeRatio.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ opacity: 0.7, fontSize: 12, marginTop: 12 }}>
              Ratios &gt; 1.0 mean today is above its {`N`}-day average; &lt; 1.0 means below.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "10px 12px",
  background: "#111827",
  position: "sticky",
  top: 0,
  fontWeight: 700,
  borderBottom: "1px solid #334155",
};

const tdStyle = {
  padding: "10px 12px",
  borderBottom: "1px solid #334155",
};

function ratioStyle(val) {
  let bg = "transparent";
  if (val > 1.05) bg = "rgba(34,197,94,0.15)";
  else if (val < 0.95) bg = "rgba(239,68,68,0.15)";
  return { ...tdStyle, background: bg, fontWeight: 600 };
}

