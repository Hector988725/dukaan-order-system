import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import BrandSplash from "./components/BrandSplash.jsx";
import PoweredBy from "./components/PoweredBy.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PoweredBy variant="header" />
    <ErrorBoundary><App /></ErrorBoundary>
    <PoweredBy variant="footer" links />
    <BrandSplash letter="D" name="Dukaan Order System" />
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
