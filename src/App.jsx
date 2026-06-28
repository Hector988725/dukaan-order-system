import React, { useState, useEffect, useCallback } from "react";
import { Store, ShoppingCart, LayoutGrid, Loader2, AlertTriangle } from "lucide-react";
import { fetchStore, fetchProducts, fetchOrders, subscribeToOrders } from "./lib/api";
import CustomerView from "./components/CustomerView";
import DashboardView from "./components/DashboardView";

export default function App() {
  const [view, setView] = useState("customer");
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const storeData = await fetchStore();
      setStore(storeData);
      const [productsData, ordersData] = await Promise.all([
        fetchProducts(storeData.id),
        fetchOrders(storeData.id),
      ]);
      setProducts(productsData);
      setOrders(ordersData);
      setError(null);
    } catch (e) {
      console.error(e);
      setError(e.message || "Kuch gadbad ho gayi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Realtime: jab naya order aaye toh list mein turant add karein
  useEffect(() => {
    if (!store) return;
    const unsubscribe = subscribeToOrders(store.id, (newOrder) => {
      setOrders((prev) => [newOrder, ...prev]);
    });
    return unsubscribe;
  }, [store]);

  const newOrderCount = orders.filter((o) => o.status === "new").length;

  if (loading) {
    return (
      <div style={shellStyle}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "60px 0", color: "#5C5747" }}>
          <Loader2 size={28} className="spin" />
          <div style={{ fontSize: "13px", fontWeight: 600 }}>Dukaan load ho rahi hai...</div>
        </div>
        <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={shellStyle}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "60px 24px", color: "#B3261E", textAlign: "center" }}>
          <AlertTriangle size={28} />
          <div style={{ fontSize: "14px", fontWeight: 700 }}>Connect nahi ho paaya</div>
          <div style={{ fontSize: "12.5px", color: "#5C5747", maxWidth: "320px" }}>{error}</div>
          <div style={{ fontSize: "11.5px", color: "#8B8576", marginTop: "8px" }}>
            Check karein: src/lib/supabase.js mein apni Project URL aur Anon Key sahi se daali hai?
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,700;9..144,800&display=swap');
        .ddemo-btn { transition: transform 0.12s ease; }
        .ddemo-btn:active { transform: scale(0.97); }
        .ddemo-card { transition: box-shadow 0.18s ease; }
        .ddemo-fade-in { animation: ddemoFadeIn 0.3s ease; }
        @keyframes ddemoFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ddemoSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes ddemoPop { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .ddemo-toggle-track { position: relative; display: inline-flex; background: rgba(255,255,255,0.14); border-radius: 999px; padding: 4px; gap: 2px; }
        .ddemo-toggle-btn { position: relative; z-index: 1; padding: 8px 16px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; background: transparent; color: rgba(255,255,255,0.75); display: flex; align-items: center; gap: 6px; transition: color 0.2s; }
        .ddemo-toggle-btn.active { color: #123026; }
        .ddemo-toggle-bg { position: absolute; top: 4px; bottom: 4px; border-radius: 999px; background: #D4A24C; transition: left 0.25s, width 0.25s; z-index: 0; }
      `}</style>

      {/* Top bar */}
      <div style={{ background: "#1B4332", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: 34, height: 34, borderRadius: "9px", background: "#D4A24C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Store size={18} color="#123026" strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ color: "white", fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "15px", lineHeight: 1.1 }}>{store.name}</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "10.5px" }}>{store.address}</div>
          </div>
        </div>

        <div className="ddemo-toggle-track">
          <div className="ddemo-toggle-bg" style={{ left: view === "customer" ? 4 : "calc(50% + 0px)", width: "calc(50% - 4px)" }} />
          <button className={`ddemo-toggle-btn ${view === "customer" ? "active" : ""}`} onClick={() => setView("customer")}>
            <ShoppingCart size={13} /> Grahak (Customer)
          </button>
          <button className={`ddemo-toggle-btn ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}>
            <LayoutGrid size={13} /> Dukaandar Panel
            {newOrderCount > 0 && (
              <span style={{ background: "#B3261E", color: "white", fontSize: "10px", fontWeight: 700, borderRadius: "999px", padding: "1px 6px" }}>{newOrderCount}</span>
            )}
          </button>
        </div>
      </div>

      {view === "customer" ? (
        <CustomerView store={store} products={products} onOrderPlaced={loadAll} />
      ) : (
        <DashboardView store={store} products={products} orders={orders} onRefresh={loadAll} />
      )}
    </div>
  );
}

const shellStyle = {
  fontFamily: "'Inter', system-ui, sans-serif",
  background: "#F7F5F0",
  minHeight: "100vh",
  color: "#1A1A1A",
};
