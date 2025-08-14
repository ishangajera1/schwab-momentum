import React, { useState } from "react";

export default function App() {
  const [symbol, setSymbol] = useState("AAPL");
  const [data, setData] = useState(null);

  const fetchData = async () => {
    const res = await fetch(`/api/metrics?symbol=${symbol}`);
    setData(await res.json());
  };

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h2>Stock Momentum</h2>
      <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} />
      <button onClick={fetchData}>Fetch</button>
      {data && (
        <table border="1" cellPadding="6">
          <thead>
            <tr><th>Days</th><th>Avg Close</th><th>Avg Vol</th><th>Price Ratio</th><th>Vol Ratio</th></tr>
          </thead>
          <tbody>
            {data.metrics.map(m => (
              <tr key={m.days}>
                <td>{m.days}</td>
                <td>{m.avgClose.toFixed(2)}</td>
                <td>{m.avgVol.toLocaleString()}</td>
                <td>{m.priceRatio.toFixed(3)}</td>
                <td>{m.volumeRatio.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
