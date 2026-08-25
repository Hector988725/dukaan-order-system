import React, { useState, useEffect, useMemo } from "react";
import { Search, ChevronRight, X, Check, MessageCircle, Plus, Minus, Trash2 } from "lucide-react";
import { createOrder } from "../lib/api";

const PENDING_UPI_KEY = "dukaan_pending_upi_checkout";

export default function CustomerView({ store, products, onOrderPlaced }) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState({}); // variantId -> qty
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(null);
  const [variantPicker, setVariantPicker] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resumeCheckout, setResumeCheckout] = useState(null);

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
        return { ...entry.variant, productId: entry.product.id, productName: entry.product.name, emoji: entry.product.emoji, image_url: entry.product.image_url || null, qty };
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
      const payload = {
        store_id: store.id,
        order_number: orderNumber,
        customer_name: form.name,
        customer_phone: form.phone,
        address: form.address,
        landmark: form.landmark || null,
        pincode: form.pincode,
        payment_method: isUpi ? "UPI" : "COD",
        // Payment Status: COD ka matlab paisa delivery ke time milega (kabhi
        // pending nahi hota). UPI ka matlab customer ne pay kiya dawa kiya
        // hai lekin dukaandar ne apne UPI app mein verify nahi kiya — isliye
        // "Pending Verification". Order Status hamesha "New" se shuru hota
        // hai, chahe payment COD ho ya UPI.
        payment_status: isUpi ? "Pending Verification" : "Cash on Delivery",
        status: "New",
        items: cartItems.map((it) => ({ name: it.productName, variant: it.label, qty: it.qty, unit: it.unit, price: it.price })),
        total: cartTotal,
      };
      const saved = await createOrder(payload);
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
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", padding: "14px 0 6px" }}>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="ddemo-btn"
              style={{
                whiteSpace: "nowrap", padding: "7px 14px", borderRadius: "999px", fontSize: "12.5px", fontWeight: 600,
                border: cat === activeCategory ? "1px solid #1B4332" : "1px solid #E3DECF",
                background: cat === activeCategory ? "#1B4332" : "white",
                color: cat === activeCategory ? "white" : "#5C5747",
                cursor: "pointer", flexShrink: 0,
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      <div style={{ padding: "8px 18px 90px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px" }}>
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 0", color: "#8B8576", fontSize: "13px" }}>
            Koi product nahi mila.
          </div>
        )}
        {filtered.map((p) => {
          const totalStock = p.variants.reduce((s, v) => s + v.stock, 0);
          const outOfStock = totalStock <= 0;
          const prices = p.variants.map((v) => v.price);
          const minPrice = Math.min(...prices), maxPrice = Math.max(...prices);
          const singleVariant = p.variants.length === 1;
          const onlyVariant = singleVariant ? p.variants[0] : null;
          const qtyInCart = singleVariant ? cart[onlyVariant.id] || 0 : 0;

          return (
            <div key={p.id} className="ddemo-card ddemo-fade-in" style={{ background: "white", border: "1px solid #E3DECF", borderRadius: "13px", padding: "13px", display: "flex", flexDirection: "column", gap: "8px", opacity: outOfStock ? 0.6 : 1 }}>
              {p.image_url
                ? <img src={p.image_url} alt={p.name} style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "8px" }} />
                : <div style={{ fontSize: "30px", lineHeight: 1 }}>{p.emoji || "📦"}</div>
              }
              <div>
                <div style={{ fontWeight: 600, fontSize: "13px", lineHeight: 1.3 }}>{p.name}</div>
                <div style={{ fontSize: "11.5px", color: "#8B8576", marginTop: "2px" }}>
                  {singleVariant ? `₹${onlyVariant.price} / ${onlyVariant.unit}` : minPrice === maxPrice ? `₹${minPrice}` : `₹${minPrice}–${maxPrice}`}
                  {!singleVariant && <span style={{ color: "#A89F87" }}> · {p.variants.length} options</span>}
                </div>
              </div>

              {outOfStock ? (
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#B3261E", background: "#FDECEA", borderRadius: "7px", padding: "6px 0", textAlign: "center" }}>
                  Stock Khatam
                </div>
              ) : singleVariant ? (
                qtyInCart === 0 ? (
                  <button onClick={() => addToCart(onlyVariant.id)} className="ddemo-btn ddemo-add-btn" style={btnOutline}>+ Add</button>
                ) : (
                  <QtyStepper qty={qtyInCart} onInc={() => addToCart(onlyVariant.id)} onDec={() => decFromCart(onlyVariant.id)} />
                )
              ) : (
                <button onClick={() => setVariantPicker(p)} className="ddemo-btn" style={{ ...btnOutline, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}>
                  Option Chunein <ChevronRight size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {variantPicker && (
        <VariantPickerModal product={variantPicker} cart={cart} addToCart={addToCart} decFromCart={decFromCart} onClose={() => setVariantPicker(null)} />
      )}

      {cartCount > 0 && !cartOpen && (
        <button key={cartCount} onClick={() => setCartOpen(true)} className="ddemo-btn ddemo-cart-bump" style={floatingCartStyle}>
          <span style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "13.5px" }}>
            🛒 {cartCount} item{cartCount > 1 ? "s" : ""}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "13.5px" }}>
            ₹{cartTotal} <ChevronRight size={15} />
          </span>
        </button>
      )}

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
        <OrderConfirmedModal order={orderPlaced} storeName={store.name} whatsapp={store.whatsapp_number} onClose={() => setOrderPlaced(null)} />
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

function VariantPickerModal({ product, cart, addToCart, decFromCart, onClose }) {
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
            return (
              <div key={v.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #E3DECF", opacity: out ? 0.5 : 1 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "13px" }}>{v.label}</div>
                  <div style={{ fontSize: "11.5px", color: "#8B8576", marginTop: "2px" }}>₹{v.price} / {v.unit}{out && " · Stock Khatam"}</div>
                </div>
                {out ? (
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#B3261E" }}>Out of Stock</span>
                ) : qty === 0 ? (
                  <button onClick={() => addToCart(v.id)} className="ddemo-btn ddemo-add-btn" style={{ ...btnOutline, padding: "7px 16px" }}>+ Add</button>
                ) : (
                  <QtyStepper qty={qty} onInc={() => addToCart(v.id)} onDec={() => decFromCart(v.id)} />
                )}
              </div>
            );
          })}
        </div>
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
                  : <span style={{ fontSize: "22px" }}>{it.emoji || "📦"}</span>
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
  const [name, setName] = useState(resumeData?.name || "");
  const [phone, setPhone] = useState(resumeData?.phone || "");
  const [address, setAddress] = useState(resumeData?.address || "");
  const [landmark, setLandmark] = useState(resumeData?.landmark || "");
  const [pincode, setPincode] = useState(resumeData?.pincode || "");
  const [payment, setPayment] = useState(resumeData?.payment || "COD");
  // UPI confirmation gate: jab tak customer "UPI se Pay Karein" par tap na
  // kare, "Maine Payment Kar Diya" button disabled rehta hai — isse galti
  // se, bina actually pay kiye, order confirm hone se bachta hai. Agar hum
  // sessionStorage se resume ho rahe hain (resumeData maujood hai), matlab
  // customer pehle hi UPI app khol chuka tha, isliye gate already khula
  // rakhte hain.
  const [upiOpened, setUpiOpened] = useState(!!resumeData);
  const valid = name.trim() && phone.trim().length >= 10 && address.trim() && pincode.trim().length === 6;

  const upiId = store?.upi_id || "";
  const upiLink = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(store.name)}&am=${cartTotal}&cu=INR&tn=${encodeURIComponent("Order - " + store.name)}`
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
        form: { name, phone, address, landmark, pincode, payment: "UPI" },
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
          form: { name, phone, address, landmark, pincode, payment: "UPI" },
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
          <Field label="Aapka Naam" value={name} onChange={setName} placeholder="jaise Ramesh Yadav" />
          <Field label="Mobile Number" value={phone} onChange={setPhone} placeholder="10 digit number" type="tel" />
          <Field label="Ghar/Gali ka Pata" value={address} onChange={setAddress} placeholder="Makaan number, gali, mohalla" textarea />
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ flex: 1.4 }}><Field label="Landmark (optional)" value={landmark} onChange={setLandmark} placeholder="jaise Shiv Mandir ke paas" /></div>
            <div style={{ flex: 1 }}><Field label="Pin Code" value={pincode} onChange={(v) => setPincode(v.replace(/\D/g, "").slice(0, 6))} placeholder="471606" type="tel" /></div>
          </div>

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
                  <button key={p} onClick={() => { setPayment(p); setUpiOpened(false); }} style={{ flex: 1, padding: "9px 0", borderRadius: "8px", border: payment === p ? "1.5px solid #1B4332" : "1px solid #E3DECF", background: payment === p ? "#E7F0EA" : "white", color: payment === p ? "#1B4332" : "#5C5747", fontWeight: 700, fontSize: "12.5px", cursor: "pointer" }}>
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
                        style={{ display: "block", marginTop: "10px", background: "#1B4332", color: "white", fontWeight: 700, fontSize: "12.5px", borderRadius: "8px", padding: "10px 0", textDecoration: "none" }}
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

          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid #E3DECF", marginTop: "6px", fontWeight: 700, fontSize: "14px" }}>
            <span>Total Payable</span><span>₹{cartTotal}</span>
          </div>

          <button
            disabled={!valid || submitting || (payment === "UPI" && (!upiId || !upiOpened))}
            onClick={() => onSubmit({ name, phone, address, landmark, pincode, payment })}
            className="ddemo-btn"
            style={{ width: "100%", background: valid && !submitting && (payment !== "UPI" || upiOpened) ? "#1B4332" : "#D8D2BF", color: "white", fontWeight: 800, fontSize: "14px", border: "none", borderRadius: "10px", padding: "13px 0", cursor: valid && !submitting && (payment !== "UPI" || upiOpened) ? "pointer" : "not-allowed" }}
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

function OrderConfirmedModal({ order, storeName, whatsapp, onClose }) {
  const waText = encodeURIComponent(`Namaste! Maine order ${order.order_number} place kiya hai (₹${order.total}). Kripya confirm karein.`);
  return (
    <div style={{ ...overlayBottomStyle, alignItems: "center" }}>
      <div style={{ background: "white", borderRadius: "14px", width: "100%", maxWidth: "340px", padding: "26px 22px", textAlign: "center", margin: "20px" }}>
        <div style={{ width: 54, height: 54, borderRadius: "50%", background: "#E7F0EA", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <Check size={26} color="#1B4332" strokeWidth={3} />
        </div>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: "17px", marginBottom: "6px" }}>Order Place Ho Gaya!</div>
        <div style={{ fontSize: "12.5px", color: "#5C5747", marginBottom: "16px" }}>Order ID: <b>{order.order_number}</b></div>

        <a href={`https://wa.me/${whatsapp}?text=${waText}`} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "10px", textAlign: "left", marginBottom: "14px", background: "#F7F5F0", borderRadius: "10px", padding: "12px", textDecoration: "none" }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <MessageCircle size={16} color="white" />
          </div>
          <div style={{ fontSize: "11.5px", color: "#3A3729", lineHeight: 1.4 }}>
            <b>{storeName}</b> ko WhatsApp pe order ki confirmation bhejein — tap karein.
          </div>
        </a>

        <button onClick={onClose} className="ddemo-btn" style={{ width: "100%", background: "#1B4332", color: "white", fontWeight: 700, fontSize: "13.5px", border: "none", borderRadius: "9px", padding: "11px 0", cursor: "pointer" }}>
          Theek Hai
        </button>
      </div>
    </div>
  );
}

// ---------- Shared inline styles ----------
const btnOutline = { border: "1px solid #1B4332", background: "white", color: "#1B4332", fontWeight: 700, fontSize: "12.5px", borderRadius: "8px", padding: "7px 0", cursor: "pointer", width: "100%" };
const stepperBtn = { width: 26, height: 26, borderRadius: "6px", border: "none", background: "rgba(255,255,255,0.15)", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
const floatingCartStyle = { position: "fixed", bottom: "16px", left: "18px", right: "18px", maxWidth: "500px", margin: "0 auto", background: "#1B4332", color: "white", borderRadius: "12px", padding: "13px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", border: "none", cursor: "pointer", boxShadow: "0 8px 20px rgba(27,67,50,0.35)" };
const overlayBottomStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 };
const drawerHeaderStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid #E3DECF" };
const closeBtnStyle = { border: "none", background: "transparent", cursor: "pointer", color: "#5C5747" };
const inputStyle = { width: "100%", border: "1px solid #E3DECF", borderRadius: "8px", padding: "9px 11px", fontSize: "13px", fontFamily: "inherit", outline: "none" };
