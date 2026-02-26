import { useState, useMemo, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";

// Antoine equation constants (log10(P/mmHg) = A - B/(C+T), T in °C)
const PAH_DATA = {
  "Naphthalene":                    { A: 7.01065, B: 1733.71, C: 202.700, Tm: 80,  Tb: 218, MW: 128.2 },
  "Acenaphthylene":                 { A: 7.0685,  B: 1887.0,  C: 196.0,   Tm: 92,  Tb: 280, MW: 152.2 },
  "9H-Fluorene":                    { A: 7.0200,  B: 1975.0,  C: 196.0,   Tm: 116, Tb: 295, MW: 166.2 },
  "Phenanthrene":                   { A: 7.0600,  B: 2100.0,  C: 196.0,   Tm: 101, Tb: 340, MW: 178.2 },
  "Anthracene":                     { A: 6.9800,  B: 2180.0,  C: 185.0,   Tm: 216, Tb: 342, MW: 178.2 },
  "4H-Cyclopenta[def]phenanthrene": { A: 7.050,   B: 2250.0,  C: 190.0,   Tm: 174, Tb: 360, MW: 190.2 },
  "Pyrene":                         { A: 7.0150,  B: 2320.0,  C: 190.0,   Tm: 150, Tb: 393, MW: 202.3 },
  "Fluoranthene":                   { A: 7.0300,  B: 2300.0,  C: 188.0,   Tm: 111, Tb: 384, MW: 202.3 },
  "beta-Pyrene":                    { A: 7.0400,  B: 2400.0,  C: 185.0,   Tm: 181, Tb: 404, MW: 202.3 },
  "2-methyl-Fluoranthene":          { A: 7.020,   B: 2350.0,  C: 187.0,   Tm: 120, Tb: 395, MW: 216.3 },
  "Cyclopenta[cd]pyrene":           { A: 7.020,   B: 2420.0,  C: 185.0,   Tm: 170, Tb: 420, MW: 226.3 },
  "Cyclopenta[cd]pyrene isomer":    { A: 7.010,   B: 2440.0,  C: 184.0,   Tm: 175, Tb: 425, MW: 226.3 },
  "Benzo[c]phenanthrene":           { A: 6.9900,  B: 2450.0,  C: 183.0,   Tm: 68,  Tb: 425, MW: 228.3 },
  "Benzo[ghi]perylene":             { A: 6.9700,  B: 2700.0,  C: 178.0,   Tm: 278, Tb: 500, MW: 276.3 },
};

const mmhgTo = {
  mmHg: (v) => v,
  Torr: (v) => v,
  Pa:   (v) => v * 133.322,
  atm:  (v) => v / 760,
  bar:  (v) => v * 0.00133322,
};

const COLORS = [
  "#00f5d4","#fee440","#f15bb5","#9b5de5","#00bbf9",
  "#fb5607","#8ecae6","#a8dadc","#e9c46a","#f4a261",
  "#52b788","#2a9d8f","#e76f51","#ffd166",
];

function antoineVP(A, B, C, T) {
  return Math.pow(10, A - B / (C + T));
}

function boilingPoint(A, B, C, P_mmhg) {
  const val = A - Math.log10(P_mmhg);
  if (val <= 0) return null;
  return B / val - C;
}

const CustomTooltip = ({ active, payload, label, pUnit }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(8,11,20,0.97)", border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 8, padding: "10px 14px",
      fontFamily: "'Courier Prime', monospace", fontSize: 12, maxWidth: 260,
    }}>
      <p style={{ color: "#aaa", margin: "0 0 6px" }}>T = {label}°C</p>
      {payload.slice(0, 8).map((p, i) => (
        <p key={i} style={{ color: p.color, margin: "2px 0" }}>
          {p.name}: {p.value < 0.001 ? p.value.toExponential(2) : p.value.toFixed(4)} {pUnit}
        </p>
      ))}
    </div>
  );
};

const Panel = ({ children, style }) => (
  <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 14, ...style }}>
    {children}
  </div>
);

const Label = ({ children }) => (
  <div style={{ fontSize: 10, color: "#777", textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 6, fontFamily: "'Space Mono', monospace" }}>
    {children}
  </div>
);

const ValBadge = ({ children }) => (
  <div style={{ fontSize: 20, fontWeight: 700, color: "#00f5d4", fontFamily: "'Space Mono', monospace", marginBottom: 4 }}>
    {children}
  </div>
);

// Inline editable number — shows as dashed text, becomes input on click
function BoundInput({ value, onChange, color = "#555" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    const n = parseFloat(draft);
    if (!isNaN(n)) onChange(n);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        style={{
          width: 72, background: "rgba(255,255,255,0.08)", border: "1px solid #00f5d4",
          borderRadius: 4, color: "#00f5d4", fontFamily: "'Space Mono', monospace",
          fontSize: 11, padding: "2px 5px", textAlign: "center",
        }}
      />
    );
  }

  return (
    <span
      title="Click to edit"
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      style={{
        color, fontSize: 11, fontFamily: "'Space Mono', monospace",
        cursor: "text", borderBottom: `1px dashed ${color}`,
        paddingBottom: 1, userSelect: "none",
      }}
    >
      {value}
    </span>
  );
}

// Slider with editable min/max endpoints underneath
function EditableSlider({ label, badge, value, onChange, min, max, step, onMinChange, onMaxChange, accentColor = "#00f5d4" }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <Label>{label}</Label>
        <ValBadge>{badge}</ValBadge>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        style={{ width: "100%", accentColor }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 5 }}>
        <BoundInput value={min} onChange={onMinChange} color="#556" />
        <span style={{ fontSize: 9, color: "#383838", letterSpacing: "0.5px", fontFamily: "'Space Mono',monospace" }}>
          CLICK TO EDIT BOUNDS
        </span>
        <BoundInput value={max} onChange={onMaxChange} color="#556" />
      </div>
    </div>
  );
}

export default function App() {
  const pahNames = Object.keys(PAH_DATA);

  const [selected, setSelected] = useState(
    new Set(["Naphthalene", "Phenanthrene", "Pyrene", "Fluoranthene", "Benzo[ghi]perylene"])
  );

  // Temperature slider state
  const [tMin, setTMin] = useState(-80);
  const [tMax, setTMax] = useState(600);
  const [tempC, setTempC] = useState(150);

  // Pressure reference slider state (values in Torr/mmHg — same thing)
  const [pRefMin, setPRefMin] = useState(0.05);
  const [pRefMax, setPRefMax] = useState(100);
  const [pressureRef, setPressureRef] = useState(10);

  // Pressure Y-axis bounds (in Torr)
  const [pAxisMin, setPAxisMin] = useState(0.05);
  const [pAxisMax, setPAxisMax] = useState(null); // null = auto

  const [pUnit, setPUnit] = useState("Torr");
  const [logScale, setLogScale] = useState(true);
  const [showTable, setShowTable] = useState(true);
  const [mobileTab, setMobileTab] = useState("chart");

  const togglePAH = useCallback((name) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }, []);

  // Bound change handlers — clamp slider value to stay in range
  const handleTMin = (v) => { const c = Math.min(v, tMax - 1); setTMin(c); if (tempC < c) setTempC(c); };
  const handleTMax = (v) => { const c = Math.max(v, tMin + 1); setTMax(c); if (tempC > c) setTempC(c); };
  const handlePRefMin = (v) => { const c = Math.max(0.001, Math.min(v, pRefMax - 0.001)); setPRefMin(c); if (pressureRef < c) setPressureRef(c); };
  const handlePRefMax = (v) => { const c = Math.max(pRefMin + 0.001, v); setPRefMax(c); if (pressureRef > c) setPressureRef(c); };

  const chartData = useMemo(() => {
    const range = tMax - tMin;
    const step = range > 200 ? 5 : range > 50 ? 2 : 1;
    const points = [];
    for (let T = tMin; T <= tMax; T += step) {
      const pt = { T };
      pahNames.forEach(name => {
        if (!selected.has(name)) return;
        const { A, B, C } = PAH_DATA[name];
        pt[name] = mmhgTo[pUnit](antoineVP(A, B, C, T));
      });
      points.push(pt);
    }
    return points;
  }, [selected, pUnit, tMin, tMax]);

  const tableData = useMemo(() => {
    return pahNames.filter(n => selected.has(n)).map((name) => {
      const { A, B, C } = PAH_DATA[name];
      const vp = mmhgTo[pUnit](antoineVP(A, B, C, tempC));
      const bp = boilingPoint(A, B, C, pressureRef);
      return { name, vp, bp, color: COLORS[pahNames.indexOf(name) % COLORS.length] };
    });
  }, [selected, tempC, pressureRef, pUnit]);

  const refLineValue = mmhgTo[pUnit](pressureRef);

  const yDomain = useMemo(() => {
    const lo = mmhgTo[pUnit](pAxisMin);
    const hi = pAxisMax !== null ? mmhgTo[pUnit](pAxisMax) : "auto";
    return [lo, hi];
  }, [pAxisMin, pAxisMax, pUnit]);

  // ── Panels ────────────────────────────────────────────────────────────────

  const CompoundPanel = () => (
    <Panel>
      <Label>Select Compounds</Label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {pahNames.map((name, i) => {
          const active = selected.has(name);
          const color = COLORS[i % COLORS.length];
          return (
            <button key={name} onClick={() => togglePAH(name)} style={{
              border: `1.5px solid ${color}`, borderRadius: 5, padding: "5px 10px",
              fontSize: 11, fontFamily: "'Courier Prime', monospace",
              background: active ? color : "transparent", color: active ? "#111" : color,
              cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
            }}>
              {name}
            </button>
          );
        })}
      </div>
    </Panel>
  );

  const SettingsPanel = () => (
    <>
      <Panel style={{ marginBottom: 12 }}>
        <Label>Pressure Units</Label>
        <select value={pUnit} onChange={e => setPUnit(e.target.value)} style={{
          background: "#111", color: "#00f5d4", border: "1px solid #333", borderRadius: 5,
          padding: "6px 10px", width: "100%", fontFamily: "'Courier Prime', monospace",
          fontSize: 13, marginBottom: 14,
        }}>
          {["Torr","mmHg","Pa","atm","bar"].map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        <Label>Y-Axis Scale</Label>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {["log", "linear"].map(s => (
            <button key={s} onClick={() => setLogScale(s === "log")} style={{
              flex: 1,
              background: (s === "log") === logScale ? "#00f5d4" : "transparent",
              color: (s === "log") === logScale ? "#111" : "#00f5d4",
              border: "1px solid #00f5d4", borderRadius: 5, padding: "6px 0",
              cursor: "pointer", fontSize: 12, fontFamily: "'Courier Prime', monospace",
            }}>{s}</button>
          ))}
        </div>

        <Label>Pressure Axis Bounds ({pUnit})</Label>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: "#555", marginBottom: 4, fontFamily: "'Space Mono',monospace", letterSpacing: "0.5px" }}>MIN</div>
            <BoundInput
              value={Number(pAxisMin.toPrecision(3))}
              onChange={v => setPAxisMin(Math.max(0.0001, v))}
              color="#fee440"
            />
          </div>
          <span style={{ color: "#333", fontSize: 16, paddingBottom: 2 }}>→</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: "#555", marginBottom: 4, fontFamily: "'Space Mono',monospace", letterSpacing: "0.5px" }}>MAX (auto if blank)</div>
            <BoundInput
              value={pAxisMax !== null ? Number(pAxisMax.toPrecision(3)) : "auto"}
              onChange={v => setPAxisMax(isNaN(v) ? null : v)}
              color="#fee440"
            />
          </div>
        </div>
      </Panel>

      <Panel>
        <EditableSlider
          label={`Reference Pressure (${pUnit})`}
          badge={<span>{pressureRef.toFixed(2)} <span style={{ fontSize: 13, color: "#666" }}>{pUnit}</span></span>}
          value={pressureRef}
          onChange={v => setPressureRef(Math.max(pRefMin, Math.min(v, pRefMax)))}
          min={pRefMin}
          max={pRefMax}
          step={Math.max(0.001, (pRefMax - pRefMin) / 2000)}
          onMinChange={handlePRefMin}
          onMaxChange={handlePRefMax}
          accentColor="#fee440"
        />
      </Panel>
    </>
  );

  const ChartPanel = () => (
    <>
      <Panel style={{ marginBottom: 12 }}>
        <EditableSlider
          label="Cursor Temperature"
          badge={<span>{tempC}°C</span>}
          value={tempC}
          onChange={v => setTempC(Math.max(tMin, Math.min(v, tMax)))}
          min={tMin}
          max={tMax}
          step={1}
          onMinChange={handleTMin}
          onMaxChange={handleTMax}
          accentColor="#00f5d4"
        />
      </Panel>

      <Panel style={{ padding: "14px 4px 10px 0", marginBottom: 12 }}>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 6, right: 18, left: 8, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="T" stroke="#444" tick={{ fill: "#666", fontSize: 10 }}
              label={{ value: "Temperature (°C)", position: "insideBottom", offset: -10, fill: "#555", fontSize: 11 }} />
            <YAxis stroke="#444" tick={{ fill: "#666", fontSize: 9 }}
              scale={logScale ? "log" : "linear"}
              domain={yDomain}
              allowDataOverflow={true}
              label={{ value: `Vapor Pressure (${pUnit})`, angle: -90, position: "insideLeft", fill: "#555", fontSize: 11 }} />
            <Tooltip content={<CustomTooltip pUnit={pUnit} />} />
            <ReferenceLine x={tempC} stroke="#00f5d4" strokeDasharray="4 4" strokeWidth={1.5} />
            <ReferenceLine y={refLineValue} stroke="#fee440" strokeDasharray="4 4" strokeWidth={1.2} />
            {pahNames.map((name, i) => {
              if (!selected.has(name)) return null;
              return (
                <Line key={name} type="monotone" dataKey={name}
                  stroke={COLORS[i % COLORS.length]}
                  dot={false} strokeWidth={2} activeDot={{ r: 4 }} />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginTop: 6, fontSize: 10, color: "#555", paddingLeft: 8 }}>
          <span style={{ color: "#00f5d4" }}>── T = {tempC}°C</span>
          <span style={{ color: "#fee440" }}>── P_ref = {pressureRef.toFixed(2)} {pUnit}</span>
        </div>
      </Panel>

      <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 11, color: "#aaa" }}>
            T={tempC}°C &nbsp;|&nbsp; P={pressureRef.toFixed(2)} {pUnit}
          </span>
          <button onClick={() => setShowTable(t => !t)} style={{
            background: "transparent", border: "1px solid #333", color: "#666",
            borderRadius: 4, padding: "2px 10px", cursor: "pointer", fontSize: 11,
            fontFamily: "'Courier Prime', monospace",
          }}>
            {showTable ? "hide" : "show"}
          </button>
        </div>
        {showTable && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.05)" }}>
                  {["Compound", `VP (${pUnit})`, "BP (°C)", "Phase"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: h === "Compound" ? "left" : "right", color: "#666", fontWeight: "normal", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.map(({ name, vp, bp, color }) => {
                  const aboveBP = bp !== null && tempC >= bp;
                  return (
                    <tr key={name} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "7px 12px", color, whiteSpace: "nowrap" }}>● {name}</td>
                      <td style={{ padding: "7px 12px", textAlign: "right", color: "#ccc", fontFamily: "'Space Mono',monospace", fontSize: 10 }}>
                        {vp < 0.0001 ? vp.toExponential(3) : vp < 1 ? vp.toFixed(5) : vp.toFixed(3)}
                      </td>
                      <td style={{ padding: "7px 12px", textAlign: "right", color: "#ccc", fontFamily: "'Space Mono',monospace", fontSize: 10 }}>
                        {bp !== null ? bp.toFixed(1) : "—"}
                      </td>
                      <td style={{ padding: "7px 12px", textAlign: "right", color: aboveBP ? "#f15bb5" : "#555", fontSize: 10 }}>
                        {aboveBP ? "vapor ↑" : "liquid"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; }
        input[type=range] { cursor: pointer; width: 100%; }
        select, button { cursor: pointer; }

        .layout {
          display: grid; grid-template-columns: 280px 1fr;
          gap: 20px; padding: 24px; min-height: 100vh;
          max-width: 1400px; margin: 0 auto;
        }
        .sidebar { display: flex; flex-direction: column; gap: 12px; }
        .main-content { display: flex; flex-direction: column; gap: 0; }
        .mobile-nav { display: none; }

        @media (max-width: 700px) {
          .layout { display: none; }
          .mobile-wrapper { display: flex; flex-direction: column; min-height: 100vh; background: #080b14; }
          .mobile-header { padding: 16px 16px 12px; border-bottom: 1px solid rgba(255,255,255,0.07); }
          .mobile-scroll { flex: 1; overflow-y: auto; padding: 14px 14px 80px; display: flex; flex-direction: column; gap: 12px; }
          .mobile-nav {
            display: flex; position: fixed; bottom: 0; left: 0; right: 0;
            background: rgba(8,11,20,0.97); border-top: 1px solid rgba(255,255,255,0.1);
            z-index: 100; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
          }
          .mobile-nav button {
            flex: 1; padding: 12px 4px 16px; background: transparent; border: none;
            color: #555; font-size: 10px; font-family: 'Space Mono', monospace;
            text-transform: uppercase; letter-spacing: 0.5px; transition: color 0.15s;
            display: flex; flex-direction: column; align-items: center; gap: 3px;
          }
          .mobile-nav button.active { color: #00f5d4; }
          .mobile-nav button span.icon { font-size: 18px; }
        }

        @media (min-width: 701px) { .mobile-wrapper { display: none !important; } }
      `}</style>

      {/* DESKTOP */}
      <div className="layout">
        <div style={{ gridColumn: "1 / -1", borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: 16, marginBottom: 4 }}>
          <h1 style={{ fontFamily: "'Space Mono', monospace", fontSize: 20, margin: 0, color: "#00f5d4", letterSpacing: 2 }}>
            PAH VAPOR PRESSURE EXPLORER
          </h1>
          <p style={{ margin: "5px 0 0", fontSize: 11, color: "#555" }}>
            Antoine Equation &nbsp;|&nbsp; log₁₀(P/mmHg) = A − B/(C + T°C)
            &nbsp;·&nbsp;
            <span style={{ color: "#383838" }}>click dashed numbers under sliders to edit scale bounds</span>
          </p>
        </div>
        <div className="sidebar"><CompoundPanel /><SettingsPanel /></div>
        <div className="main-content"><ChartPanel /></div>
      </div>

      {/* MOBILE */}
      <div className="mobile-wrapper">
        <div className="mobile-header">
          <h1 style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, color: "#00f5d4", letterSpacing: 1 }}>PAH VAPOR PRESSURE</h1>
          <p style={{ fontSize: 10, color: "#555", marginTop: 2 }}>Tap dashed numbers to edit scale bounds</p>
        </div>
        <div className="mobile-scroll">
          {mobileTab === "chart"     && <ChartPanel />}
          {mobileTab === "compounds" && <CompoundPanel />}
          {mobileTab === "settings"  && <SettingsPanel />}
        </div>
        <nav className="mobile-nav">
          {[
            { id: "chart", icon: "📈", label: "Chart" },
            { id: "compounds", icon: "🧪", label: "Compounds" },
            { id: "settings", icon: "⚙️", label: "Settings" },
          ].map(({ id, icon, label }) => (
            <button key={id} className={mobileTab === id ? "active" : ""} onClick={() => setMobileTab(id)}>
              <span className="icon">{icon}</span>{label}
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
