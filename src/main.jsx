import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import BrandSplash from "./components/BrandSplash.jsx";
import MascotGuide from "./components/MascotGuide.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
    <BrandSplash letter="D" name="Dukaan Order System" />
    <MascotGuide name="Dukaan Saathi" brand="Dukaan" accent="#F28A1E" weatherApi="https://verilo.officialhector365.workers.dev" />
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
