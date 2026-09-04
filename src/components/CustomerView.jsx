import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, ChevronRight, X, Check, MessageCircle, Plus, Minus, Trash2, Loader2, Star, LayoutGrid } from "lucide-react";
import { createOrder, fetchCustomerByPhone, upsertCustomerDetails } from "../lib/api";
import { getTheme, getShoppingMode, getDiscountInfo, getVariantPricing } from "../lib/theme";
import { OrderTrackingModal } from "./OrderTracking";

const PENDING_UPI_KEY = "dukaan_pending_upi_checkout";

// Delivery charge sirf Home Delivery par lagta hai, Pickup par kabhi
// nahi. Agar dukaandar ne "free delivery above ₹X" set kiya hai aur
// cart usse zyada hai, to fee 0 ho jaati hai.
function computeDeliveryFee(store, orderType, cartTotal) {
  if (orderType === "Pickup") return 0;
  const fee = Number(store.delivery_fee) || 0;
  if (fee <= 0) return 0;
  if (store.free_delivery_above != null && cartTotal >= Number(store.free_delivery_above)) return 0;
  return fee;
}

export default function CustomerView({ store, products, onOrderPlaced }) {
  const theme = getTheme(store.business_type);
  const isGalleryMode = getShoppingMode(store.business_type) === "gallery";
  const [detailProduct, setDetailProduct] = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState({}); // variantId -> qty
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(null);
  const [variantPicker, setVariantPicker] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resumeCheckout, setResumeCheckout] = useState(null);
  const [flyingItems, setFlyingItems] = useState([]);
  const cartButtonRef = useRef(null);

  // UPI app khulne ke baad browser page reload/unload kar sakta hai, jisse
  // saara React state (cart, checkoutOpen, form) reset ho jaata hai. Isliye
  // agar pending UPI checkout mila (same store ke liye), to checkout modal
  // ko seedha "Confirm" step par wapas khol dete hain.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(PENDING_UPI_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.storeId === store.id) {
          setCart(data.cart || {});
          setResumeCheckout(data.form);
          setCartOpen(false);
          setCheckoutOpen(true);
        } else {
          sessionStorage.removeItem(PENDING_UPI_KEY);
        }
      }
    } catch {
      sessionStorage.removeItem(PENDING_UPI_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kai mobile browsers par upi:// link tap karne se page reload NAHI hota —
  // browser bas tab ko background mein bhej deta hai aur UPI app se wapas
  // aane par "visibilitychange" fire hota hai (page reload wale case ko
  // upar wala useEffect already handle karta hai). Isliye yahan bhi wahi
  // pending-UPI-checkout check karte hain, taaki dono cases (reload ho ya na
  // ho) mein customer seedha confirmation mode mein wapas aaye — cart ya
  // product list par nahi.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      try {
        const saved = sessionStorage.getItem(PENDING_UPI_KEY);
        if (!saved) return;
        const data = JSON.parse(saved);
        if (data.storeId !== store.id) return;
        setResumeCheckout(data.form);
        setCartOpen(false);
        setCheckoutOpen(true);
      } catch {}
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.id]);

  const categories = ["All", ...Array.from(new Set(products.map((p) => p.category)))];
  const filtered = products.filter(
    (p) => (activeCategory === "All" || p.category === activeCategory) && p.name.toLowerCase().includes(search.toLowerCase())
  );

  // Flat lookup: variantId -> { product, variant }
  // useMemo lagaya hai taaki bade catalog/cart (20-100+ items) ke saath
  // search typing ya category switch karne par har render pe recompute na
  // ho — sirf products ya cart actually badalne par hi dobara banega.
  // (Pehle ye har render pe forEach chalata tha, jo bade grocery store ke
  // liye budget phones par typing lag kar sakta tha.)
  const variantIndex = useMemo(() => {
    const idx = {};
    products.forEach((p) => p.variants.forEach((v) => { idx[v.id] = { product: p, variant: v }; }));
    return idx;
  }, [products]);

  const cartItems = useMemo(() => {
    return Object.entries(cart)
      .map(([variantId, qty]) => {
        const entry = variantIndex[variantId];
        if (!entry) return null;
        // getVariantPricing() yahan bhi use karte hain — isliye agar
        // koi Limited-Time Offer abhi active hai (ya expire ho chuka
        // hai), cart/checkout ka total hamesha wahi price use karega jo
        // customer ko display mein dikha tha, kabhi mismatch nahi hoga.
        const pricing = getVariantPricing(entry.variant);
        return {
          ...entry.variant, price: pricing.effectivePrice, isLimitedTimeOffer: pricing.isLimitedTimeOffer,
          productId: entry.product.id, productName: entry.product.name, emoji: entry.product.emoji, image_url: entry.product.image_url || null, qty,
        };
      })
      .filter(Boolean);
  }, [cart, variantIndex]);

  const cartTotal = cartItems.reduce((sum, it) => sum + it.price * it.qty, 0);
  const cartCount = cartItems.reduce((sum, it) => sum + it.qty, 0);

  const addToCart = (variantId) => {
    const entry = variantIndex[variantId];
    if (!entry || entry.variant.stock <= 0) return;
    setCart((c) => ({ ...c, [variantId]: (c[variantId] || 0) + 1 }));
  };

  // "Trolley mein saaman daalne" wala physical feel — jis button se "+ Add"
  // dabaya, us jagah se ek chhota clone udkar cart tak jaata hai. Agar
  // yeh pehla item hai (floating cart abhi tak screen par nahi hai, kyunki
  // state update async hai), toh fallback position (screen ke neeche
  // center) use karte hain — cart bar wahi ban raha hoga.
  const triggerFlyToCart = (sourceEl, imageUrl, emoji) => {
    if (!sourceEl) return;
    const startRect = sourceEl.getBoundingClientRect();
    const endRect = cartButtonRef.current?.getBoundingClientRect();
    const startX = startRect.left + startRect.width / 2 - 22;
    const startY = startRect.top + startRect.height / 2 - 22;
    const endX = endRect ? endRect.left + 30 - 22 : window.innerWidth / 2 - 22;
    const endY = endRect ? endRect.top + endRect.height / 2 - 22 : window.innerHeight - 50;
    const id = Date.now() + Math.random();
    setFlyingItems((items) => [...items, { id, startX, startY, endX, endY, imageUrl, emoji }]);
    setTimeout(() => setFlyingItems((items) => items.filter((it) => it.id !== id)), 600);
  };

  const decFromCart = (variantId) => {
    setCart((c) => {
      const newQty = (c[variantId] || 0) - 1;
      const copy = { ...c };
      if (newQty <= 0) delete copy[variantId];
      else copy[variantId] = newQty;
      return copy;
    });
  };
  const removeFromCart = (variantId) => {
    setCart((c) => {
      const copy = { ...c };
      delete copy[variantId];
      return copy;
    });
  };

  const placeOrder = async (form) => {
    setSubmitting(true);
    try {
      const orderNumber = "ORD" + Math.floor(1000 + Math.random() * 9000);
      const isUpi = form.payment === "UPI";
      const deliveryFee = computeDeliveryFee(store, form.orderType, cartTotal);
      const payload = {
        store_id: store.id,
        order_number: orderNumber,
        customer_name: form.name,
        customer_phone: form.phone,
        address: form.orderType === "Pickup" ? (form.address || null) : form.address,
        landmark: form.landmark || null,
        pincode: form.orderType === "Pickup" ? (form.pincode || null) : form.pincode,
        order_type: form.orderType || "Delivery",
        delivery_fee: deliveryFee,
        payment_method: isUpi ? "UPI" : "COD",
        // Payment Status: COD ka matlab paisa delivery ke time milega (kabhi
        // pending nahi hota). UPI ka matlab customer ne pay kiya dawa kiya
        // hai lekin dukaandar ne apne UPI app mein verify nahi kiya — isliye
        // "Pending Verification". Order Status hamesha "New" se shuru hota
        // hai, chahe payment COD ho ya UPI.
        payment_status: isUpi ? "Pending Verification" : "Cash on Delivery",
        status: "New",
        items: cartItems.map((it) => ({ variant_id: it.id, name: it.productName, variant: it.label, qty: it.qty, unit: it.unit, price: it.price })),
        total: cartTotal + deliveryFee,
      };
      const saved = await createOrder(payload);
      // Order safal hua — customer ki details save/update karte hain taaki
      // agli baar isi phone number se order karne par khud-ba-khud bhar jaayein.
      // Yeh best-effort hai: agar kisi wajah se fail bhi ho jaaye, order place
      // ho chuka hai, isliye customer ko koi error nahi dikhate.
      //
      // BUG FIX: Pickup order mein address/pincode fields customer se
      // maange hi nahi jaate (khaali rehte hain) — pehle yeh khaali values
      // seedha save ho jaati thi, jisse agar customer ne pehle kabhi
      // Delivery order kiya ho (address already saved), toh Pickup order
      // karte hi uska saved address blank se overwrite ho jaata tha. Ab
      // Pickup order ke waqt address/landmark/pincode ko bilkul touch
      // nahi karte — jo pehle se saved hai wahi surakshit rehta hai.
      try {
        const isPickupOrder = form.orderType === "Pickup";
        await upsertCustomerDetails(store.id, {
          phone: form.phone,
          name: form.name,
          address: isPickupOrder ? undefined : form.address,
          landmark: isPickupOrder ? undefined : form.landmark,
          pincode: isPickupOrder ? undefined : form.pincode,
        });
      } catch (saveErr) {
        console.warn("Customer details save nahi ho payi:", saveErr);
      }
      sessionStorage.removeItem(PENDING_UPI_KEY);
      setOrderPlaced(saved);
      setCart({});
      setCheckoutOpen(false);
      setCartOpen(false);
      onOrderPlaced?.();
    } catch (e) {
      alert("Order save nahi ho paaya: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: "relative", maxWidth: "900px", margin: "0 auto" }}>
      {/* Zepto/Blinkit-style micro-animations: floating cart "bump" jab item
          add/remove ho, aur add-button ka press-feedback. key={cartCount} par
          floating cart button ko niche remount kiya gaya hai jisse animation
          har baar count badalne par replay ho jaaye. */}
      <style>{`
        @keyframes ddemoCartBump {
          0% { transform: scale(1); }
          35% { transform: scale(1.06); }
          100% { transform: scale(1); }
        }
        .ddemo-cart-bump { animation: ddemoCartBump 0.28s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .ddemo-add-btn { transition: transform 0.12s ease; }
        .ddemo-add-btn:active { transform: scale(0.92); }
        /* "Trolley mein daala" — item click-point se udkar cart tak jaata
           hai, ghumte-ghumte chhota hokar fade ho jaata hai (asli cheez
           uthakar trolley mein daalne jaisa physical feel). */
        @keyframes ddemoFlyToCart {
          0% { transform: translate(var(--x1), var(--y1)) scale(1) rotate(0deg); opacity: 1; }
          65% { opacity: 1; }
          100% { transform: translate(var(--x2), var(--y2)) scale(0.25) rotate(25deg); opacity: 0; }
        }
        .ddemo-fly-item {
          position: fixed; top: 0; left: 0; width: 44px; height: 44px; border-radius: 10px;
          overflow: hidden; z-index: 200; pointer-events: none; box-shadow: 0 4px 14px rgba(0,0,0,0.25);
          animation: ddemoFlyToCart 0.55s cubic-bezier(0.3, 0, 0.6, 1) forwards;
        }
      `}</style>
      {/* Search + categories */}
      <div style={{ padding: "16px 18px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "white", border: "1px solid #E3DECF", borderRadius: "11px", padding: "10px 14px" }}>
          <Search size={16} color="#8B8576" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Saaman khojein..."
            style={{ border: "none", outline: "none", fontSize: "13.5px", width: "100%", background: "transparent", fontFamily: "inherit" }}
          />
        </div>
        {/* Category chips — Google Images ke "Gehu / Flour / Aashirwad" jaisa:
            har chip ka apna gol thumbnail (product photo ya emoji) + naam
            neeche, sirf plain text pill nahi. */}
        <div style={{ display: "flex", gap: "10px", overflowX: "auto", padding: "14px 2px 6px" }}>
          {categories.map((cat) => {
            const active = cat === activeCategory;
            const rep = cat === "All" ? null : products.find((p) => p.category === cat);
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="ddemo-btn"
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "5px",
                  padding: "7px 10px 8px", borderRadius: "14px", flexShrink: 0, cursor: "pointer",
                  border: active ? `1.5px solid ${theme.primary}` : "1px solid #E3DECF",
                  background: active ? "#F3ECDC" : "white",
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: rep?.image_url ? undefined : "linear-gradient(135deg, #F3ECDC 0%, #E9DFC0 100%)",
                  border: active ? `2px solid ${theme.accent}` : "1px solid #E3DECF",
                }}>
                  {cat === "All"
                    ? <LayoutGrid size={18} color={theme.primary} />
                    : rep?.image_url
                      ? <img src={rep.image_url} alt={cat} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: "20px" }}>{rep?.emoji || "🛒"}</span>
                  }
                </div>
                <span style={{ fontSize: "11px", fontWeight: active ? 700 : 600, color: active ? theme.primary : "#5C5747", whiteSpace: "nowrap" }}>{cat}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Product grid — masonry-style: photo apna natural aspect ratio leta hai
          (chhota/bada), aur "Featured" products bade/taller dikhte hain.
          Ismein purana bug repeat nahi ho raha: photo + no-photo dono states
          ab bhi ek jaisi "photo tile" design follow karte hain (gradient +
          bada emoji), sirf height/aspect deliberately alag hai taaki grid
          Pinterest jaisa saaf-sundar dikhe. */}
      <div className="ddemo-masonry" style={{ padding: "8px 18px 90px" }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#8B8576", fontSize: "13px" }}>
            Koi product nahi mila.
          </div>
        )}
        {filtered.map((p, idx) => {
          const totalStock = p.variants.reduce((s, v) => s + v.stock, 0);
          const outOfStock = totalStock <= 0;
          const prices = p.variants.map((v) => v.price);
          const minPrice = Math.min(...prices), maxPrice = Math.max(...prices);
          const singleVariant = p.variants.length === 1;
          const onlyVariant = singleVariant ? p.variants[0] : null;
          const pricing = singleVariant ? getVariantPricing(onlyVariant) : null;
          const qtyInCart = singleVariant ? cart[onlyVariant.id] || 0 : 0;

          // Photo hai to natural aspect-ratio leta hai (masonry variety khud
          // ban jaati hai). Photo nahi hai to fallback tile ki height product
          // index ke hisaab se 3 tiers mein deterministically vary hoti hai
          // (taaki saare no-photo products ek jaisi boring height ke na dikhein).
          const fallbackTiers = [120, 165, 145];
          const fallbackHeight = fallbackTiers[idx % fallbackTiers.length];
          const imageBoxStyle = p.image_url
            ? { width: "100%", display: "block" }
            : { width: "100%", height: p.featured ? 210 : fallbackHeight, display: "flex", alignItems: "center", justifyContent: "center" };

          return (
            <div
              key={p.id}
              className="ddemo-card ddemo-fade-in ddemo-masonry-item"
              style={{ position: "relative", background: "white", border: "1px solid #E3DECF", borderRadius: "13px", padding: "0 0 13px", opacity: outOfStock ? 0.6 : 1, overflow: "hidden", cursor: isGalleryMode ? "pointer" : "default" }}
              onClick={isGalleryMode ? () => setDetailProduct(p) : undefined}
            >
              {p.featured && (
                <div style={{ position: "absolute", top: "8px", left: "8px", zIndex: 1, display: "flex", alignItems: "center", gap: "3px", background: theme.accent, color: "#123026", fontSize: "10px", fontWeight: 800, padding: "3px 8px", borderRadius: "999px" }}>
                  <Star size={10} fill="#123026" /> Featured
                </div>
              )}
              <div style={{
                ...imageBoxStyle,
                background: p.image_url ? undefined : "linear-gradient(135deg, #F3ECDC 0%, #E9DFC0 100%)",
              }}>
                {p.image_url
                  ? <img src={p.image_url} alt={p.name} style={{ width: "100%", height: p.featured ? "260px" : "auto", objectFit: "cover", display: "block" }} />
                  : <span style={{ fontSize: p.featured ? "60px" : "42px", lineHeight: 1 }}>{p.emoji || "📦"}</span>
                }
              </div>
              <div style={{ padding: "8px 13px 0", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "13px", lineHeight: 1.3 }}>{p.name}</div>
                {singleVariant && pricing?.strikePrice ? (
                  <div>
                    {pricing.isLimitedTimeOffer && (
                      <div style={{ fontSize: "9.5px", fontWeight: 800, color: "#B3261E", marginBottom: "2px" }}>🔥 Limited Time Deal</div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "11px", color: "#A89F87", textDecoration: "line-through" }}>₹{pricing.strikePrice}</span>
                      <span style={{ fontSize: "12.5px", fontWeight: 700, color: "#1A1A1A" }}>₹{pricing.effectivePrice}</span>
                      <span style={{ fontSize: "10px", fontWeight: 800, color: "#178C42", background: "#E7F5EA", padding: "1px 6px", borderRadius: "5px" }}>{pricing.pct}% OFF</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: "11.5px", color: "#8B8576", marginTop: "2px" }}>
                    {singleVariant ? `₹${onlyVariant.price} / ${onlyVariant.unit}` : minPrice === maxPrice ? `₹${minPrice}` : `₹${minPrice}–${maxPrice}`}
                    {!singleVariant && <span style={{ color: "#A89F87" }}> · {p.variants.length} options</span>}
                  </div>
                )}
              </div>

              {isGalleryMode ? (
                // Gallery-mode (Kapde/Footwear/Mobile jaise types) mein
                // seedha grid se Add nahi hota — pehle photo/description/
                // size dekhna zaroori hai, isliye poora card hi "Dekhein"
                // ka kaam karta hai (onClick upar poore card pe hai).
                outOfStock ? (
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#B3261E", background: "#FDECEA", borderRadius: "7px", padding: "6px 0", textAlign: "center" }}>
                    Stock Khatam
                  </div>
                ) : (
                  <div style={{ fontSize: "11.5px", fontWeight: 700, color: theme.primary, display: "flex", alignItems: "center", gap: "4px" }}>
                    Dekhein <ChevronRight size={13} />
                  </div>
                )
              ) : outOfStock ? (
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#B3261E", background: "#FDECEA", borderRadius: "7px", padding: "6px 0", textAlign: "center" }}>
                  Stock Khatam
                </div>
              ) : singleVariant ? (
                qtyInCart === 0 ? (
                  <button onClick={(e) => { addToCart(onlyVariant.id); triggerFlyToCart(e.currentTarget, p.image_url, p.emoji); }} className="ddemo-btn ddemo-add-btn" style={btnOutline(theme)}>+ Add</button>
                ) : (
                  <QtyStepper qty={qtyInCart} onInc={() => addToCart(onlyVariant.id)} onDec={() => decFromCart(onlyVariant.id)} />
                )
              ) : (
                <button onClick={() => setVariantPicker(p)} className="ddemo-btn" style={{ ...btnOutline(theme), display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}>
                  Option Chunein <ChevronRight size={13} />
                </button>
              )}
              </div>
            </div>
          );
        })}
      </div>

      {variantPicker && (
        <VariantPickerModal product={variantPicker} cart={cart} addToCart={addToCart} decFromCart={decFromCart} theme={theme} onClose={() => setVariantPicker(null)} triggerFlyToCart={triggerFlyToCart} cartCount={cartCount} cartTotal={cartTotal} onGoToCart={() => { setVariantPicker(null); setDetailProduct(null); setCartOpen(true); }} />
      )}

      {detailProduct && (
        <ProductDetailModal product={detailProduct} cart={cart} addToCart={addToCart} decFromCart={decFromCart} theme={theme} onClose={() => setDetailProduct(null)} triggerFlyToCart={triggerFlyToCart} cartCount={cartCount} cartTotal={cartTotal} onGoToCart={() => { setDetailProduct(null); setVariantPicker(null); setCartOpen(true); }} />
      )}

      {cartCount > 0 && !cartOpen && (
        <button key={cartCount} ref={cartButtonRef} onClick={() => setCartOpen(true)} className="ddemo-btn ddemo-cart-bump" style={floatingCartStyle(theme)}>
          <span style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "13.5px" }}>
            {/* Trolley preview — jo items abhi "trolley" mein hain unki
                chhoti thumbnails (max 3), jaisa mall trolley mein saaman
                dikhta hai upar se jhaankte hue. */}
            <span style={{ display: "flex", alignItems: "center" }}>
              {cartItems.slice(0, 3).map((it, i) => (
                <span key={it.id} style={{
                  width: 22, height: 22, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
                  border: "1.5px solid white", marginLeft: i === 0 ? 0 : -8, background: "white",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px",
                }}>
                  {it.image_url ? <img src={it.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (it.emoji || "📦")}
                </span>
              ))}
            </span>
            🛒 {cartCount} item{cartCount > 1 ? "s" : ""}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "13.5px" }}>
            ₹{cartTotal} <ChevronRight size={15} />
          </span>
        </button>
      )}

      {/* "Trolley mein daala" animation layer — poore page ke upar fixed,
          click se nahi rukta (pointerEvents none) */}
      {flyingItems.map((item) => (
        <div
          key={item.id}
          className="ddemo-fly-item"
          style={{ "--x1": `${item.startX}px`, "--y1": `${item.startY}px`, "--x2": `${item.endX}px`, "--y2": `${item.endY}px` }}
        >
          {item.imageUrl
            ? <img src={item.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: "22px", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", background: "white" }}>{item.emoji || "📦"}</span>
          }
        </div>
      ))}

      {cartOpen && (
        <CartDrawer
          cartItems={cartItems}
          cartTotal={cartTotal}
          onClose={() => setCartOpen(false)}
          onRemove={removeFromCart}
          onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }}
        />
      )}

      {checkoutOpen && (
        <CheckoutModal store={store} cartTotal={cartTotal} submitting={submitting} resumeData={resumeCheckout} cart={cart} onClose={() => { setCheckoutOpen(false); sessionStorage.removeItem(PENDING_UPI_KEY); }} onSubmit={placeOrder} />
      )}

      {orderPlaced && (
        <OrderConfirmedModal order={orderPlaced} storeName={store.name} whatsapp={store.whatsapp_number} theme={theme} store={store} onClose={() => setOrderPlaced(null)} />
      )}
    </div>
  );
}

function QtyStepper({ qty, onInc, onDec }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1B4332", borderRadius: "8px", padding: "4px" }}>
      <button onClick={onDec} className="ddemo-btn ddemo-add-btn" style={stepperBtn}><Minus size={13} /></button>
      <span style={{ color: "white", fontWeight: 700, fontSize: "13px" }}>{qty}</span>
      <button onClick={onInc} className="ddemo-btn ddemo-add-btn" style={stepperBtn}><Plus size={13} /></button>
    </div>
  );
}

// Gallery-mode products (Kapde/Footwear/Mobile) ke liye — Amazon/Flipkart
// jaisa detail-screen: photo carousel, description, phir size/variant
// choose karke Add. Quick-mode products isse kabhi nahi khulte.
function ProductDetailModal({ product, cart, addToCart, decFromCart, theme, onClose, triggerFlyToCart, cartCount, cartTotal, onGoToCart }) {
  const [activePhoto, setActivePhoto] = useState(0);
  const photos = product.image_urls && product.image_urls.length > 0
    ? product.image_urls
    : (product.image_url ? [product.image_url] : []);

  return (
    <div style={{ ...overlayBottomStyle, alignItems: "flex-end" }}>
      <div style={{ background: "white", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: "480px", maxHeight: "88vh", margin: "0 auto", display: "flex", flexDirection: "column" }}>
        <div style={{ overflowY: "auto", flex: 1 }}>
        <div style={{ position: "relative", background: "#F3ECDC" }}>
          {photos.length > 0 ? (
            // objectFit "contain" — poori photo dikhti hai (letterbox ho
            // sakta hai upar-neeche khaali jagah), "cover" ki tarah katti
            // nahi. Product-detail view mein customer ko poora product
            // dekhna chahiye, jaisa Amazon/Flipkart product pages karte hain.
            <img src={photos[activePhoto]} alt={product.name} style={{ width: "100%", height: "280px", objectFit: "contain", display: "block" }} />
          ) : (
            <div style={{ width: "100%", height: "220px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "64px" }}>{product.emoji || "📦"}</span>
            </div>
          )}
          {photos.length > 1 && (
            <div style={{ position: "absolute", bottom: "10px", left: 0, right: 0, display: "flex", justifyContent: "center", gap: "6px" }}>
              {photos.map((_, i) => (
                <button key={i} onClick={() => setActivePhoto(i)} style={{ width: i === activePhoto ? 16 : 6, height: 6, borderRadius: "999px", border: "none", padding: 0, cursor: "pointer", background: i === activePhoto ? "white" : "rgba(255,255,255,0.55)", transition: "width 0.2s ease" }} />
              ))}
            </div>
          )}
          <button onClick={onClose} style={{ position: "absolute", top: "10px", right: "10px", width: 30, height: 30, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={16} />
          </button>
          {photos.length > 1 && (
            <div style={{ position: "absolute", top: "10px", left: "10px", background: "rgba(0,0,0,0.5)", color: "white", fontSize: "10.5px", fontWeight: 700, padding: "3px 8px", borderRadius: "999px" }}>
              {activePhoto + 1}/{photos.length}
            </div>
          )}
          {/* Thumbnail strip — tap karke photo switch karein */}
          {photos.length > 1 && (
            <div style={{ display: "flex", gap: "6px", padding: "8px 12px", overflowX: "auto", background: "white" }}>
              {photos.map((url, i) => (
                <button key={i} onClick={() => setActivePhoto(i)} style={{ padding: 0, border: i === activePhoto ? `2px solid ${theme.primary}` : "1px solid #E3DECF", borderRadius: "7px", overflow: "hidden", width: 44, height: 44, flexShrink: 0, cursor: "pointer" }}>
                  <img src={url} alt={`thumb-${i}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "16px" }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "18px" }}>{product.name}</div>
          {product.description && (
            <div style={{ fontSize: "12.5px", color: "#5C5747", marginTop: "8px", lineHeight: 1.55 }}>{product.description}</div>
          )}

          <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {product.variants.map((v) => {
              const qty = cart[v.id] || 0;
              const out = v.stock <= 0;
              const vPricing = getVariantPricing(v);
              return (
                <div key={v.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "11px 13px", border: "1px solid #E3DECF", borderRadius: "10px" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13.5px" }}>{v.label}</div>
                    {vPricing.strikePrice ? (
                      <div>
                        {vPricing.isLimitedTimeOffer && <div style={{ fontSize: "9px", fontWeight: 800, color: "#B3261E" }}>🔥 Limited Time Deal</div>}
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "1px" }}>
                          <span style={{ fontSize: "10.5px", color: "#A89F87", textDecoration: "line-through" }}>₹{vPricing.strikePrice}</span>
                          <span style={{ fontSize: "11.5px", fontWeight: 700 }}>₹{vPricing.effectivePrice}</span>
                          <span style={{ fontSize: "9.5px", fontWeight: 800, color: "#178C42", background: "#E7F5EA", padding: "1px 5px", borderRadius: "5px" }}>{vPricing.pct}% OFF</span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: "11.5px", color: "#8B8576" }}>₹{v.price} / {v.unit}</div>
                    )}
                  </div>
                  {out ? (
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#B3261E" }}>Stock Khatam</span>
                  ) : qty === 0 ? (
                    <button onClick={(e) => { addToCart(v.id); triggerFlyToCart(e.currentTarget, product.image_urls?.[0] || product.image_url, product.emoji); }} className="ddemo-btn ddemo-add-btn" style={{ ...btnOutline(theme), width: "auto", padding: "7px 18px" }}>+ Add</button>
                  ) : (
                    <QtyStepper qty={qty} onInc={() => addToCart(v.id)} onDec={() => decFromCart(v.id)} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        </div>

        {/* Sticky "aage badhein" CTA — jaise hi kuch cart mein aata hai,
            yeh turant dikhta hai taaki customer ko sirf "✕" (band karo)
            hi rasta na lage. Modal band karke seedha Cart drawer khol deta
            hai — ek hi tap mein checkout ki taraf aage badh jaate hain. */}
        {cartCount > 0 && (
          <button onClick={onGoToCart} className="ddemo-btn" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: theme.primary, color: "white", border: "none", padding: "14px 18px", fontSize: "13.5px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
            <span>🛒 Cart mein {cartCount} item{cartCount > 1 ? "s" : ""}</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>₹{cartTotal} — Aage Badhein <ChevronRight size={15} /></span>
          </button>
        )}
      </div>
    </div>
  );
}

function VariantPickerModal({ product, cart, addToCart, decFromCart, theme, onClose, triggerFlyToCart, cartCount, cartTotal, onGoToCart }) {
  return (
    <div style={overlayBottomStyle}>
      <div style={{ background: "white", width: "100%", maxWidth: "480px", borderRadius: "16px 16px 0 0", maxHeight: "75%", display: "flex", flexDirection: "column", animation: "ddemoSlideUp 0.25s ease" }}>
        <div style={drawerHeaderStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "24px" }}>{product.emoji}</span>
            <div style={{ fontWeight: 700, fontSize: "15px", fontFamily: "'Fraunces', serif" }}>{product.name}</div>
          </div>
          <button onClick={onClose} style={closeBtnStyle}><X size={20} /></button>
        </div>
        <div style={{ overflowY: "auto", padding: "8px 18px 20px" }}>
          {product.variants.map((v) => {
            const qty = cart[v.id] || 0;
            const out = v.stock <= 0;
            const vPricing = getVariantPricing(v);
            return (
              <div key={v.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #E3DECF", opacity: out ? 0.5 : 1 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "13px" }}>{v.label}</div>
                  {vPricing.strikePrice ? (
                    <div>
                      {vPricing.isLimitedTimeOffer && <div style={{ fontSize: "9px", fontWeight: 800, color: "#B3261E" }}>🔥 Limited Time Deal</div>}
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "1px" }}>
                        <span style={{ fontSize: "10.5px", color: "#A89F87", textDecoration: "line-through" }}>₹{vPricing.strikePrice}</span>
                        <span style={{ fontSize: "11.5px", fontWeight: 700 }}>₹{vPricing.effectivePrice}</span>
                        <span style={{ fontSize: "9.5px", fontWeight: 800, color: "#178C42", background: "#E7F5EA", padding: "1px 5px", borderRadius: "5px" }}>{vPricing.pct}% OFF</span>
                        {out && <span style={{ fontSize: "10.5px", color: "#B3261E" }}>· Stock Khatam</span>}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "11.5px", color: "#8B8576", marginTop: "2px" }}>₹{v.price} / {v.unit}{out && " · Stock Khatam"}</div>
                  )}
                </div>
                {out ? (
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#B3261E" }}>Out of Stock</span>
                ) : qty === 0 ? (
                  <button onClick={(e) => { addToCart(v.id); triggerFlyToCart(e.currentTarget, product.image_url, product.emoji); }} className="ddemo-btn ddemo-add-btn" style={{ ...btnOutline(theme), padding: "7px 16px" }}>+ Add</button>
                ) : (
                  <QtyStepper qty={qty} onInc={() => addToCart(v.id)} onDec={() => decFromCart(v.id)} />
                )}
              </div>
            );
          })}
        </div>
        {cartCount > 0 && (
          <button onClick={onGoToCart} className="ddemo-btn" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: theme.primary, color: "white", border: "none", padding: "14px 18px", fontSize: "13.5px", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
            <span>🛒 Cart mein {cartCount} item{cartCount > 1 ? "s" : ""}</span>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>₹{cartTotal} — Aage Badhein <ChevronRight size={15} /></span>
          </button>
        )}
      </div>
    </div>
  );
}

function CartDrawer({ cartItems, cartTotal, onClose, onRemove, onCheckout }) {
  return (
    <div style={overlayBottomStyle}>
      <div style={{ background: "#F7F5F0", width: "100%", maxWidth: "480px", borderRadius: "16px 16px 0 0", maxHeight: "85%", display: "flex", flexDirection: "column", animation: "ddemoSlideUp 0.25s ease" }}>
        <div style={{ ...drawerHeaderStyle, borderBottom: "1px solid #E3DECF" }}>
          <div style={{ fontWeight: 700, fontSize: "15px", fontFamily: "'Fraunces', serif" }}>Aapka Cart</div>
          <button onClick={onClose} style={closeBtnStyle}><X size={20} /></button>
        </div>
        <div style={{ overflowY: "auto", padding: "10px 18px", flex: 1 }}>
          {cartItems.map((it) => (
            <div key={it.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #E3DECF" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {it.image_url
                  ? <img src={it.image_url} alt={it.productName} style={{ width: 36, height: 36, objectFit: "cover", borderRadius: "7px", flexShrink: 0 }} />
                  : <span style={{ width: 36, height: 36, borderRadius: "7px", background: "linear-gradient(135deg, #F3ECDC 0%, #E9DFC0 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>{it.emoji || "📦"}</span>
                }
                <div>
                  <div style={{ fontWeight: 600, fontSize: "13px" }}>{it.productName}</div>
                  <div style={{ fontSize: "11.5px", color: "#8B8576" }}>{it.label} · {it.qty} {it.unit} × ₹{it.price}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontWeight: 700, fontSize: "13px" }}>₹{it.qty * it.price}</span>
                <button onClick={() => onRemove(it.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#B3261E" }}><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: "16px 18px", borderTop: "1px solid #E3DECF", background: "white" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "14px", fontWeight: 700 }}>
            <span>Total</span><span>₹{cartTotal}</span>
          </div>
          <button onClick={onCheckout} className="ddemo-btn" style={{ width: "100%", background: "#D4A24C", color: "#123026", fontWeight: 800, fontSize: "14px", border: "none", borderRadius: "10px", padding: "13px 0", cursor: "pointer" }}>
            Order Place Karein
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckoutModal({ store, cartTotal, submitting, resumeData, cart, onClose, onSubmit }) {
  const theme = getTheme(store.business_type);
  const [orderType, setOrderType] = useState(resumeData?.orderType || "Delivery");
  const [name, setName] = useState(resumeData?.name || "");
  const [phone, setPhone] = useState(resumeData?.phone || "");
  const [address, setAddress] = useState(resumeData?.address || "");
  const [landmark, setLandmark] = useState(resumeData?.landmark || "");
  const [pincode, setPincode] = useState(resumeData?.pincode || "");
  const [payment, setPayment] = useState(resumeData?.payment || "COD");
  // Delivery Home Delivery par hi lagta hai, Pickup badalte hi turant 0
  // ho jaata hai — customer ko live pata chalta hai kya charge lagega.
  const deliveryFee = computeDeliveryFee(store, orderType, cartTotal);
  const grandTotal = cartTotal + deliveryFee;
  // Guest checkout: koi login/password nahi. Phone number 10 digit poora
  // hote hi is store ke liye pehle se saved details (agar hain) dhoondh
  // ke auto-fill kar dete hain. Customer chahe to inhe edit kar sakta hai.
  const [lookupStatus, setLookupStatus] = useState(null); // null | "checking" | "found" | "new"
  const lookedUpPhoneRef = useRef(resumeData?.phone || null);

  useEffect(() => {
    // UPI resume flow mein details already bharri hui hain isi checkout ke
    // liye — dobara lookup karke overwrite nahi karte.
    if (resumeData) return;
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      setLookupStatus(null);
      return;
    }
    if (lookedUpPhoneRef.current === digits) return; // isi number ke liye already check ho chuka
    let cancelled = false;
    setLookupStatus("checking");
    fetchCustomerByPhone(store.id, digits)
      .then((customer) => {
        if (cancelled) return;
        lookedUpPhoneRef.current = digits;
        if (customer) {
          setName(customer.name || "");
          setAddress(customer.address || "");
          setLandmark(customer.landmark || "");
          setPincode(customer.pincode || "");
          setLookupStatus("found");
        } else {
          setLookupStatus("new");
        }
      })
      .catch(() => { if (!cancelled) setLookupStatus(null); });
    return () => { cancelled = true; };
  }, [phone, resumeData, store.id]);
  // UPI confirmation gate: jab tak customer "UPI se Pay Karein" par tap na
  // kare, "Maine Payment Kar Diya" button disabled rehta hai — isse galti
  // se, bina actually pay kiye, order confirm hone se bachta hai. Agar hum
  // sessionStorage se resume ho rahe hain (resumeData maujood hai), matlab
  // customer pehle hi UPI app khol chuka tha, isliye gate already khula
  // rakhte hain.
  const [upiOpened, setUpiOpened] = useState(!!resumeData);
  const isDeliveryType = orderType === "Delivery";
  const valid = name.trim() && phone.trim().length >= 10 && (!isDeliveryType || (address.trim() && pincode.trim().length === 6));

  const upiId = store?.upi_id || "";
  const upiLink = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(store.name)}&am=${grandTotal}&cu=INR&tn=${encodeURIComponent("Order - " + store.name)}`
    : "";
  const qrImageUrl = upiLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiLink)}`
    : "";

  // UPI app khulne se pehle current form + cart ko sessionStorage mein save
  // karte hain, taaki agar browser page reload/unload kare (jo custom
  // "upi://" scheme navigate karne par aksar hota hai), to wapas aane par
  // yehi "Maine Payment Kar Diya" step turant dikh sake — bina customer ko
  // dobara form bharna pade.
  const handleUpiAppOpen = () => {
    // Customer ne "UPI se Pay Karein" dabaya — gate turant khol dete hain
    // (chahe sessionStorage save kisi wajah se fail ho jaaye), taaki
    // "Maine Payment Kar Diya" button turant enable ho jaaye.
    setUpiOpened(true);
    try {
      sessionStorage.setItem(PENDING_UPI_KEY, JSON.stringify({
        storeId: store.id,
        cart,
        form: { orderType, name, phone, address, landmark, pincode, payment: "UPI" },
      }));
    } catch {}
  };

  // Kai customer humara "UPI se Pay Karein" link tap karne ke bajaye QR ko
  // kisi doosre phone/camera se seedha scan kar lete hain — is case mein
  // upar wala handleUpiAppOpen kabhi trigger nahi hota. Isliye agar QR abhi
  // dikh raha hai (payment attempt ho chuka maana ja sakta hai) aur customer
  // top wala "X" dabaye, to hum modal ko poori tarah band nahi karte —
  // seedha confirmation mode mein switch kar dete hain (QR hide, sirf
  // enabled "Maine Payment Kar Diya" button). Dobara "X" dabane par hi
  // modal asal mein band hoga.
  const handleCloseClick = () => {
    if (payment === "UPI" && upiId && !upiOpened) {
      setUpiOpened(true);
      try {
        sessionStorage.setItem(PENDING_UPI_KEY, JSON.stringify({
          storeId: store.id,
          cart,
          form: { orderType, name, phone, address, landmark, pincode, payment: "UPI" },
        }));
      } catch {}
      return;
    }
    onClose();
  };

  return (
    <div style={{ ...overlayBottomStyle, alignItems: "center" }}>
      <div style={{ background: "white", borderRadius: "14px", width: "100%", maxWidth: "360px", maxHeight: "90vh", overflowY: "auto", padding: "22px", margin: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ fontWeight: 700, fontSize: "16px", fontFamily: "'Fraunces', serif" }}>Delivery Details</div>
          <button onClick={handleCloseClick} style={closeBtnStyle}><X size={18} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Order Type — Pickup ya Delivery. Yeh sabse pehle poochte hain
              kyunki isी se decide hota hai neeche address zaroori hai ya nahi. */}
          <div>
            <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#5C5747", marginBottom: "6px" }}>Order Kaise Chahiye?</div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setOrderType("Delivery")} style={{ flex: 1, padding: "10px 0", borderRadius: "9px", border: orderType === "Delivery" ? `1.5px solid ${theme.primary}` : "1px solid #E3DECF", background: orderType === "Delivery" ? "#E7F0EA" : "white", color: orderType === "Delivery" ? theme.primary : "#5C5747", fontWeight: 700, fontSize: "12.5px", cursor: "pointer" }}>
                🛵 Home Delivery
              </button>
              <button onClick={() => setOrderType("Pickup")} style={{ flex: 1, padding: "10px 0", borderRadius: "9px", border: orderType === "Pickup" ? `1.5px solid ${theme.primary}` : "1px solid #E3DECF", background: orderType === "Pickup" ? "#E7F0EA" : "white", color: orderType === "Pickup" ? theme.primary : "#5C5747", fontWeight: 700, fontSize: "12.5px", cursor: "pointer" }}>
                🏪 Dukaan se Khud Lena Hai
              </button>
            </div>
          </div>

          <Field label="Mobile Number" value={phone} onChange={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))} placeholder="10 digit number" type="tel" />
          {lookupStatus === "checking" && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "#8B8576", marginTop: "-4px" }}>
              <Loader2 size={12} className="ddemo-spin" /> Details check ho rahi hain...
            </div>
          )}
          {lookupStatus === "found" && (
            <div style={{ fontSize: "11.5px", color: "#1B4332", fontWeight: 600, marginTop: "-4px" }}>
              ✓ Aapki pichli details mil gayi — zaroorat ho to edit kar lein
            </div>
          )}
          <Field label="Aapka Naam" value={name} onChange={setName} placeholder="jaise Ramesh Yadav" />
          {isDeliveryType && (
            <>
              <Field label="Ghar/Gali ka Pata" value={address} onChange={setAddress} placeholder="Makaan number, gali, mohalla" textarea />
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ flex: 1.4 }}><Field label="Landmark (optional)" value={landmark} onChange={setLandmark} placeholder="jaise Shiv Mandir ke paas" /></div>
                <div style={{ flex: 1 }}><Field label="Pin Code" value={pincode} onChange={(v) => setPincode(v.replace(/\D/g, "").slice(0, 6))} placeholder="471606" type="tel" /></div>
              </div>
            </>
          )}
          {!isDeliveryType && (
            <div style={{ background: "#F7F5F0", borderRadius: "9px", padding: "10px 12px", fontSize: "11.5px", color: "#5C5747" }}>
              🏪 Aap dukaan pe jaakar apna order khud le jaayenge — koi address ki zaroorat nahi.
            </div>
          )}

          {payment === "UPI" && upiOpened ? (
            // Confirmation mode: customer "UPI se Pay Karein" pe tap kar chuka hai
            // (ya UPI app se wapas resume hua hai) — ab QR/payment-selector dobara
            // nahi dikhate, sirf confirmation message aur enabled button.
            <div style={{ background: "#E7F0EA", borderRadius: "10px", padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#1B4332" }}>✓ UPI app khol diya gaya hai</div>
              <div style={{ fontSize: "11.5px", color: "#5C5747", marginTop: "4px", lineHeight: 1.5 }}>
                Payment complete karne ke baad neeche "Maine Payment Kar Diya" dabayein — dukaandar payment verify karke order confirm karega.
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#5C5747", marginTop: "4px" }}>Payment Method</div>
              <div style={{ display: "flex", gap: "8px" }}>
                {["COD", "UPI"].map((p) => (
                  <button key={p} onClick={() => { setPayment(p); setUpiOpened(false); }} style={{ flex: 1, padding: "9px 0", borderRadius: "8px", border: payment === p ? `1.5px solid ${theme.primary}` : "1px solid #E3DECF", background: payment === p ? "#E7F0EA" : "white", color: payment === p ? theme.primary : "#5C5747", fontWeight: 700, fontSize: "12.5px", cursor: "pointer" }}>
                    {p === "COD" ? "Cash on Delivery" : "UPI se Pay"}
                  </button>
                ))}
              </div>

              {payment === "UPI" && (
                <div style={{ background: "#F7F5F0", borderRadius: "10px", padding: "14px", textAlign: "center" }}>
                  {qrImageUrl ? (
                    <>
                      <img src={qrImageUrl} alt="UPI QR Code" style={{ width: 140, height: 140, margin: "0 auto 8px", borderRadius: "8px" }} />
                      <div style={{ fontSize: "12px", color: "#5C5747" }}>Scan karein ya UPI ID pe bhejein:</div>
                      <div style={{ fontWeight: 700, fontSize: "13px", color: "#1B4332", marginTop: "2px" }}>{upiId}</div>

                      {/* Mobile par tap karne se seedha GPay/PhonePe/Paytm/BHIM khulega — payment seedha
                          dukaandar ki UPI ID par jaayega, koi Razorpay/third-party account involve nahi hai */}
                      <a
                        href={upiLink}
                        onClick={handleUpiAppOpen}
                        style={{ display: "block", marginTop: "10px", background: theme.primary, color: "white", fontWeight: 700, fontSize: "12.5px", borderRadius: "8px", padding: "10px 0", textDecoration: "none" }}
                      >
                        UPI se Pay Karein
                      </a>
                    </>
                  ) : (
                    <div style={{ fontSize: "12px", color: "#B3261E" }}>Dukaan ne abhi UPI ID set nahi ki hai. Kripya COD chunein.</div>
                  )}
                  <div style={{ fontSize: "11px", color: "#8B8576", marginTop: "8px", lineHeight: 1.5 }}>
                    Payment karne ke baad wapas is page par aakar "Maine Payment Kar Diya" dabayein — dukaandar payment verify karke order confirm karega.
                  </div>
                </div>
              )}
            </>
          )}

          <div style={{ padding: "10px 0 0", borderTop: "1px solid #E3DECF", marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", color: "#5C5747" }}>
              <span>Items Total</span><span>₹{cartTotal}</span>
            </div>
            {orderType === "Delivery" && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", color: deliveryFee === 0 ? "#1B4332" : "#5C5747" }}>
                <span>Delivery Charge</span>
                <span>{deliveryFee === 0 ? "FREE" : `₹${deliveryFee}`}</span>
              </div>
            )}
            {orderType === "Delivery" && deliveryFee > 0 && store.free_delivery_above != null && (
              <div style={{ fontSize: "11px", color: "#9A6B00", fontWeight: 600 }}>
                🎉 ₹{(Number(store.free_delivery_above) - cartTotal).toFixed(0)} aur order karein, delivery FREE ho jaayegi!
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "14px", marginTop: "4px" }}>
              <span>Total Payable</span><span>₹{grandTotal}</span>
            </div>
          </div>

          <button
            disabled={!valid || submitting || (payment === "UPI" && (!upiId || !upiOpened))}
            onClick={() => onSubmit({ orderType, name, phone, address, landmark, pincode, payment })}
            className="ddemo-btn"
            style={{ width: "100%", background: valid && !submitting && (payment !== "UPI" || upiOpened) ? theme.primary : "#D8D2BF", color: "white", fontWeight: 800, fontSize: "14px", border: "none", borderRadius: "10px", padding: "13px 0", cursor: valid && !submitting && (payment !== "UPI" || upiOpened) ? "pointer" : "not-allowed" }}
          >
            {submitting ? "Order ja raha hai..." : payment === "UPI" ? "Maine Payment Kar Diya" : "Order Place Karein"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", textarea }) {
  return (
    <div>
      <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#5C5747", marginBottom: "4px" }}>{label}</div>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} style={inputStyle} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} style={inputStyle} />
      )}
    </div>
  );
}

function OrderConfirmedModal({ order, storeName, whatsapp, theme, onClose, store }) {
  const waText = encodeURIComponent(`Namaste! Maine order ${order.order_number} place kiya hai (₹${order.total}). Kripya confirm karein.`);
  const [showTracking, setShowTracking] = useState(false);
  // Confetti particles ka ek fixed set — random hone ki zaroorat nahi,
  // yeh sirf ek baar (order place hote hi) chalta hai, isliye deterministic
  // hone se render predictable rehta hai.
  const confettiColors = [theme?.accent || "#D4A24C", "#1B4332", "#E0A93A", "#8B2635", theme?.primary || "#1B4332"];
  const confetti = Array.from({ length: 14 }, (_, i) => ({
    angle: (360 / 14) * i,
    delay: (i % 4) * 0.05,
    color: confettiColors[i % confettiColors.length],
  }));

  return (
    <div style={{ ...overlayBottomStyle, alignItems: "center" }}>
      <div style={{ background: "white", borderRadius: "14px", width: "100%", maxWidth: "340px", padding: "26px 22px", textAlign: "center", margin: "20px" }}>
        <div style={{ position: "relative", width: 54, height: 54, margin: "0 auto 14px" }}>
          {/* Confetti — chhote rangeen tukde center se bahar ki taraf udte hain */}
          {confetti.map((c, i) => (
            <span
              key={i}
              className="ddemo-confetti-piece"
              style={{
                "--angle": `${c.angle}deg`,
                "--delay": `${c.delay}s`,
                background: c.color,
              }}
            />
          ))}
          {/* Checkmark circle — draw-in animation ke saath */}
          <div style={{ width: 54, height: 54, borderRadius: "50%", background: "#E7F0EA", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", zIndex: 1 }}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <path d="M5 13.5L10.5 19L21 7" stroke={theme?.primary || "#1B4332"} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="ddemo-checkmark-path" />
            </svg>
          </div>
        </div>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "17px", marginBottom: "6px" }}>Order Place Ho Gaya!</div>
        <div style={{ fontSize: "12.5px", color: "#5C5747", marginBottom: "16px" }}>Order ID: <b>{order.order_number}</b></div>

        <a href={`https://wa.me/${whatsapp}?text=${waText}`} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "10px", textAlign: "left", marginBottom: "10px", background: "#F7F5F0", borderRadius: "10px", padding: "12px", textDecoration: "none" }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <MessageCircle size={16} color="white" />
          </div>
          <div style={{ fontSize: "11.5px", color: "#3A3729", lineHeight: 1.4 }}>
            <b>{storeName}</b> ko WhatsApp pe order ki confirmation bhejein — tap karein.
          </div>
        </a>

        {store && (
          <button onClick={() => setShowTracking(true)} className="ddemo-btn" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "white", border: `1.5px solid ${theme?.primary || "#1B4332"}`, color: theme?.primary || "#1B4332", fontWeight: 700, fontSize: "12.5px", borderRadius: "9px", padding: "10px 0", cursor: "pointer", marginBottom: "10px" }}>
            📦 Apna Order Track Karein
          </button>
        )}

        <button onClick={onClose} className="ddemo-btn" style={{ width: "100%", background: theme?.primary || "#1B4332", color: "white", fontWeight: 700, fontSize: "13.5px", border: "none", borderRadius: "9px", padding: "11px 0", cursor: "pointer" }}>
          Theek Hai
        </button>
      </div>

      {showTracking && store && (
        <OrderTrackingModal store={store} initialOrderNumber={order.order_number} onClose={() => setShowTracking(false)} />
      )}
    </div>
  );
}

// ---------- Shared inline styles ----------
const btnOutline = (theme) => ({ border: `1px solid ${theme.primary}`, background: "white", color: theme.primary, fontWeight: 700, fontSize: "12.5px", borderRadius: "8px", padding: "7px 0", cursor: "pointer", width: "100%" });
const stepperBtn = { width: 26, height: 26, borderRadius: "6px", border: "none", background: "rgba(255,255,255,0.15)", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
const floatingCartStyle = (theme) => ({ position: "fixed", bottom: "16px", left: "18px", right: "18px", maxWidth: "500px", margin: "0 auto", background: theme.primary, color: "white", borderRadius: "12px", padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", border: "none", cursor: "pointer", boxShadow: "0 8px 20px rgba(0,0,0,0.3)" });
const overlayBottomStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 };
const drawerHeaderStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid #E3DECF" };
const closeBtnStyle = { border: "none", background: "transparent", cursor: "pointer", color: "#5C5747" };
const inputStyle = { width: "100%", border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 11px", fontSize: "13px", fontFamily: "inherit", outline: "none" };
