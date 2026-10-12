// Sabse pehle: "App install karein" ka event yahin pakad lete hain (React/lazy screens se pehle).
import "./lib/installApp";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// PWA: "Add to Home Screen" ke liye service worker register karte hain.
// Page pehle hi load ho chuka ho to turant, warna load par — taaki install
// popup (beforeinstallprompt) jaldi mil sake.
if ("serviceWorker" in navigator) {
  const reg = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
  if (document.readyState === "complete") reg();
  else window.addEventListener("load", reg);
}
