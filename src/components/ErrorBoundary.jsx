import React from "react";

// Koi screen crash ho to poora page safed (white) na ho — saaf message + wapas jaane ka button.
export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { try { console.error("App crash:", error, info && info.componentStack); } catch { /* ignore */ } }
  render() {
    if (!this.state.error) return this.props.children;
    const msg = String((this.state.error && this.state.error.message) || this.state.error);
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "#F7F5F0", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ maxWidth: 380, width: "100%", background: "white", border: "1px solid #E3DECF", borderRadius: 14, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>😕</div>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Kuch gadbad ho gayi</div>
          <div style={{ fontSize: 12.5, color: "#5C5747", lineHeight: 1.5, marginBottom: 12 }}>Ye screen khul nahi paayi. Neeche button se dobara try karein. Phir bhi na chale to ye line support ko bhejein:</div>
          <div style={{ fontSize: 11, color: "#B3261E", background: "#FDECEA", borderRadius: 8, padding: "8px 10px", wordBreak: "break-word", marginBottom: 14, textAlign: "left" }}>{msg}</div>
          <button onClick={() => { window.location.href = window.location.pathname; }} style={{ width: "100%", background: "#1B4332", color: "white", border: "none", borderRadius: 10, padding: "12px 0", fontSize: 13.5, fontWeight: 800, cursor: "pointer" }}>Dobara try karein</button>
        </div>
      </div>
    );
  }
}
