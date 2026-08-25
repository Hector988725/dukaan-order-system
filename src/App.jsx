import React, { useState, useEffect, useCallback } from "react";
import { Store, ShoppingCart, LayoutGrid, Loader2, AlertTriangle, ShieldCheck, LogOut } from "lucide-react";
import { getSlugFromUrl, isSupabaseConfigured } from "./lib/supabase";
import {
  fetchStoreBySlug, fetchStoreByUserId, fetchProducts, fetchOrders,
  subscribeToOrders, onAuthChange, signOut,
} from "./lib/api";
import CustomerView from "./components/CustomerView";
import DashboardView from "./components/DashboardView";
import AdminPanel from "./components/AdminPanel";
import { AuthGate, StoreDetailsForm } from "./components/AuthGate";
import RazorpaySubscription from "./components/RazorpaySubscription";

export default function App() {
  // Deployment mein VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY set nahi hain —
  // pehle ye poori app ko blank white page bana ke crash kar deta tha. Ab
  // existing ErrorScreen component reuse karke ek clear, samajh aane wala
  // message dikhate hain.
  if (!isSupabaseConfigured) {
    return (
      <div style={shellStyle}>
        <GlobalStyles />
        <ErrorScreen message="Supabase configuration missing hai. Vercel Project Settings → Environment Variables mein VITE_SUPABASE_URL aur VITE_SUPABASE_ANON_KEY daalkar dobara deploy karein." />
      </div>
    );
  }

  const slug = getSlugFromUrl();

  // Agar URL mein koi store slug hai (jaise /sharma-kirana), toh seedha customer storefront dikhao
  if (slug) {
    return <CustomerStorefrontPage slug={slug} />;
  }

  // Warna yeh homepage hai - dukaandar ka login/signup/admin area
  return <OwnerArea />;
}

// ============================================================
// CUSTOMER-FACING STOREFRONT (public, koi login nahi chahiye)
// ============================================================
function CustomerStorefrontPage({ slug }) {
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const storeData = await fetchStoreBySlug(slug);
      setStore(storeData);
      const productsData = await fetchProducts(storeData.id);
      setProducts(productsData);
      setError(null);
    } catch (e) {
      setError("Yeh dukaan nahi mili. Link check karein.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingScreen text="Dukaan load ho rahi hai..." />;
  if (error || !store) return <ErrorScreen message={error || "Dukaan nahi mili."} />;

  // Subscription check - inactive store
  if (store.is_active === false) {
    return (
      <div style={shellStyle}>
        <GlobalStyles />
        <div style={{ background: "#1B4332", padding: "14px 24px", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: 34, height: 34, borderRadius: "9px", background: "#D4A24C", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Store size={18} color="#123026" />
          </div>
          <div style={{ color: "white", fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "15px" }}>{store.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "60px 24px", textAlign: "center" }}>
          <div style={{ fontSize: "40px" }}>🔒</div>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "18px", color: "#1A1A1A" }}>Yeh dukaan abhi available nahi hai</div>
          <div style={{ fontSize: "13px", color: "#8B8576", maxWidth: "300px" }}>Is dukaan ka subscription khatam ho gaya hai. Dukaandar se sampark karein.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <GlobalStyles />
      <StoreHeader store={store} />
      {store.timings && (
        <div style={{ background: "#EFE9D8", padding: "6px 24px", textAlign: "center", fontSize: "11.5px", color: "#5C5747", fontWeight: 600 }}>
          🕒 {store.timings}
        </div>
      )}
      <CustomerView store={store} products={products} onOrderPlaced={() => load(true)} />
    </div>
  );
}

// ============================================================
// OWNER AREA (homepage) - login/signup, then dashboard/admin
// ============================================================
function OwnerArea() {
  const [user, setUser] = useState(undefined); // undefined = checking, null = not logged in
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [view, setView] = useState("dashboard");
  const [loadingStore, setLoadingStore] = useState(false);
  const authSettledRef = React.useRef(false);

  useEffect(() => {
    // onAuthChange fire hota hai turant (current session ke saath) jab subscribe hota hai,
    // isliye sirf isी pe rely karte hain - yeh getCurrentUser() se zyada reliable hai
    // kyunki yeh login/logout ke baad bhi turant fire hota hai, koi race condition nahi.
    const unsubscribe = onAuthChange((u) => {
      authSettledRef.current = true;
      setUser(u);
    });
    return unsubscribe;
  }, []);

  const loadStoreData = useCallback(async (silent = false) => {
    if (!user) return;
    try {
      if (!silent) setLoadingStore(true);
      const storeData = await fetchStoreByUserId(user.id);
      setStore(storeData);
      if (storeData) {
        const [productsData, ordersData] = await Promise.all([
          fetchProducts(storeData.id),
          fetchOrders(storeData.id),
        ]);
        setProducts(productsData);
        setOrders(ordersData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoadingStore(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadStoreData();
  }, [user, loadStoreData]);

  useEffect(() => {
    if (!store) return;
    const unsubscribe = subscribeToOrders(store.id, (newOrder) => {
      setOrders((prev) => [newOrder, ...prev]);
    });
    return unsubscribe;
  }, [store]);

  if (user === undefined) return <LoadingScreen text="Check ho raha hai..." />;

  if (!user) {
    return (
      <div style={shellStyle}>
        <GlobalStyles />
        <AuthGate onAuthed={(u) => setUser(u)} />
      </div>
    );
  }

  if (loadingStore) return <LoadingScreen text="Dukaan load ho rahi hai..." />;

  // User logged in hai but uski koi store nahi hai abhi
  if (!store) {
    return (
      <div style={shellStyle}>
        <GlobalStyles />
        <div style={{ maxWidth: "380px", margin: "60px auto", padding: "0 18px" }}>
          <div style={{ textAlign: "center", marginBottom: "18px" }}>
            <div style={{ width: 50, height: 50, borderRadius: "12px", background: "#D4A24C", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
              <Store size={24} color="#123026" />
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "17px" }}>Aapki Koi Dukaan Nahi Hai Abhi</div>
            <div style={{ fontSize: "12.5px", color: "#8B8576", marginTop: "4px" }}>Neeche details bharkar apni dukaan banayein</div>
          </div>
          <StoreDetailsForm user={user} onDone={() => loadStoreData()} />
        </div>
      </div>
    );
  }

  // Subscription expire ho gayi ya inactive hai - payment page dikhao
  const isSubscriptionActive = store.is_active !== false &&
    store.subscription_expires_at &&
    new Date(store.subscription_expires_at) > new Date();

  if (!isSubscriptionActive) {
    return (
      <div style={shellStyle}>
        <GlobalStyles />
        <div style={{ background: "#1B4332", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: 34, height: 34, borderRadius: "9px", background: "#D4A24C", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Store size={18} color="#123026" />
            </div>
            <div style={{ color: "white", fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "15px" }}>{store.name}</div>
          </div>
          <button onClick={signOut} style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "8px", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white" }}>
            <LogOut size={15} />
          </button>
        </div>
        {store.subscription_expires_at && new Date(store.subscription_expires_at) < new Date() && (
          <div style={{ background: "#FDECEA", padding: "10px 18px", textAlign: "center", fontSize: "12.5px", color: "#B3261E", fontWeight: 600 }}>
            ⚠️ Aapki subscription expire ho gayi hai — neeche renew karein
          </div>
        )}
        <RazorpaySubscription
          store={store}
          user={user}
          onSuccess={() => loadStoreData()}
        />
      </div>
    );
  }

  const newOrderCount = orders.filter((o) => o.status === "new").length;
  const silentRefresh = () => loadStoreData(true);

  return (
    <div style={shellStyle}>
      <GlobalStyles />
      <div style={{ background: "#1B4332", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <StoreHeaderBrand store={store} />

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="ddemo-toggle-track">
            <div className="ddemo-toggle-bg" style={{ left: `calc(${["dashboard", "admin"].indexOf(view)} * 50% + 4px)`, width: "calc(50% - 4px)" }} />
            <button className={`ddemo-toggle-btn ${view === "dashboard" ? "active" : ""}`} onClick={() => setView("dashboard")}>
              <LayoutGrid size={13} /> Orders
              {newOrderCount > 0 && <span style={{ background: "#B3261E", color: "white", fontSize: "10px", fontWeight: 700, borderRadius: "999px", padding: "1px 6px" }}>{newOrderCount}</span>}
            </button>
            <button className={`ddemo-toggle-btn ${view === "admin" ? "active" : ""}`} onClick={() => setView("admin")}>
              <ShieldCheck size={13} /> Admin
            </button>
          </div>
          <button onClick={signOut} title="Logout" style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "8px", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "white" }}>
            <LogOut size={15} />
          </button>
        </div>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "10px 18px 0" }}>
        <a href={`/${store.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: "12px", color: "#1B4332", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "5px" }}>
          🔗 Aapki dukaan ka link: <b>/{store.slug}</b> — customer ko bhejne ke liye yahan click karein
        </a>
      </div>

      {view === "dashboard" && <DashboardView store={store} products={products} orders={orders} onRefresh={silentRefresh} />}
      {view === "admin" && <AdminPanel store={store} products={products} onRefresh={silentRefresh} />}
    </div>
  );
}

// ============================================================
// SHARED UI PIECES
// ============================================================
function StoreHeader({ store }) {
  return (
    <div style={{ background: "#1B4332", padding: "14px 24px", display: "flex", alignItems: "center", gap: "10px" }}>
      <StoreHeaderBrand store={store} />
    </div>
  );
}

function StoreHeaderBrand({ store }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div style={{ width: 34, height: 34, borderRadius: "9px", background: store.logo_url ? "white" : "#D4A24C", border: store.logo_url ? "1px solid rgba(255,255,255,0.3)" : "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
        {store.logo_url ? <img src={store.logo_url} alt={store.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Store size={18} color="#123026" strokeWidth={2.4} />}
      </div>
      <div>
        <div style={{ color: "white", fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "15px", lineHeight: 1.1 }}>{store.name}</div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "10.5px" }}>{store.tagline || store.address}</div>
      </div>
    </div>
  );
}

function LoadingScreen({ text }) {
  return (
    <div style={shellStyle}>
      <GlobalStyles />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "60px 0", color: "#5C5747" }}>
        <Loader2 size={28} className="spin" />
        <div style={{ fontSize: "13px", fontWeight: 600 }}>{text}</div>
      </div>
    </div>
  );
}

function ErrorScreen({ message }) {
  return (
    <div style={shellStyle}>
      <GlobalStyles />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", padding: "60px 24px", color: "#B3261E", textAlign: "center" }}>
        <AlertTriangle size={28} />
        <div style={{ fontSize: "14px", fontWeight: 700 }}>{message}</div>
      </div>
    </div>
  );
}

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,500;9..144,700;9..144,800&display=swap');
      .ddemo-btn { transition: transform 0.12s ease, filter 0.12s ease; }
      .ddemo-btn:active { transform: scale(0.97); }
      .ddemo-btn:hover { filter: brightness(1.04); }
      .ddemo-card { transition: box-shadow 0.18s ease, transform 0.18s ease; box-shadow: 0 1px 2px rgba(26,26,26,0.04); }
      .ddemo-card:hover { box-shadow: 0 6px 18px -8px rgba(26,26,26,0.18); }
      .ddemo-stepper-btn { transition: background 0.15s ease, transform 0.1s ease; }
      .ddemo-stepper-btn:hover { background: #F0EEE6; }
      .ddemo-stepper-btn:active { transform: scale(0.92); }
      .ddemo-spin { animation: ddemoSpin 0.8s linear infinite; }
      @keyframes ddemoSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      .ddemo-fade-in { animation: ddemoFadeIn 0.3s ease; }
      .spin { animation: spin 1s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes ddemoFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes ddemoSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      @keyframes ddemoPop { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      .ddemo-toggle-track { position: relative; display: inline-flex; background: rgba(255,255,255,0.14); border-radius: 999px; padding: 4px; gap: 2px; }
      .ddemo-toggle-btn { position: relative; z-index: 1; padding: 8px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 600; cursor: pointer; border: none; background: transparent; color: rgba(255,255,255,0.75); display: flex; align-items: center; gap: 6px; transition: color 0.2s; white-space: nowrap; }
      .ddemo-toggle-btn.active { color: #123026; }
      .ddemo-toggle-bg { position: absolute; top: 4px; bottom: 4px; border-radius: 999px; background: #D4A24C; transition: left 0.25s, width 0.25s; z-index: 0; }
    `}</style>
  );
}

const shellStyle = {
  fontFamily: "'Inter', system-ui, sans-serif",
  background: "#F7F5F0",
  minHeight: "100vh",
  color: "#1A1A1A",
};
