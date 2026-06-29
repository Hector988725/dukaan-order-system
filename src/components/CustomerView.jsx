import React, { useState } from "react";
import { Search, ChevronRight, X, Check, MessageCircle, Plus, Minus, Trash2 } from "lucide-react";
import { createOrder } from "../lib/api";

export default function CustomerView({ store, products, onOrderPlaced }) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState({}); // variantId -> qty
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(null);
  const [variantPicker, setVariantPicker] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const categories = ["All", ...Array.from(new Set(products.map((p) => p.category)))];
  const filtered = products.filter(
    (p) => (activeCategory === "All" || p.category === activeCategory) && p.name.toLowerCase().includes(search.toLowerCase())
  );

  // Flat lookup: variantId -> { product, variant }
  const variantIndex = {};
  products.forEach((p) => p.variants.forEach((v) => { variantIndex[v.id] = { product: p, variant: v }; }));

  const cartItems = Object.entries(cart)
    .map(([variantId, qty]) => {
      const entry = variantIndex[variantId];
      if (!entry) return null;
      return { ...entry.variant, productId: entry.product.id, productName: entry.product.name, emoji: entry.product.emoji, qty };
    })
    .filter(Boolean);

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
      const payload = {
        store_id: store.id,
        order_number: orderNumber,
        customer_name: form.name,
        customer_phone: form.phone,
        address: form.address,
        landmark: form.landmark || null,
        pincode: form.pincode,
        payment_method: form.payment,
        items: cartItems.map((it) => ({ name: it.productName, variant: it.label, qty: it.qty, unit: it.unit, price: it.price })),
        total: cartTotal,
        status: "new",
      };
      const saved = await createOrder(payload);
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
              <div style={{ fontSize: "30px", lineHeight: 1 }}>{p.emoji}</div>
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
                  <button onClick={() => addToCart(onlyVariant.id)} className="ddemo-btn" style={btnOutline}>+ Add</button>
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
        <button onClick={() => setCartOpen(true)} className="ddemo-btn" style={floatingCartStyle}>
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
          onCheckout={() => setCheckoutOpen(true)}
        />
      )}

      {checkoutOpen && (
        <CheckoutModal cartTotal={cartTotal} submitting={submitting} onClose={() => setCheckoutOpen(false)} onSubmit={placeOrder} />
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
      <button onClick={onDec} className="ddemo-btn" style={stepperBtn}><Minus size={13} /></button>
      <span style={{ color: "white", fontWeight: 700, fontSize: "13px" }}>{qty}</span>
      <button onClick={onInc} className="ddemo-btn" style={stepperBtn}><Plus size={13} /></button>
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
                  <button onClick={() => addToCart(v.id)} className="ddemo-btn" style={{ ...btnOutline, padding: "7px 16px" }}>+ Add</button>
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
                <span style={{ fontSize: "22px" }}>{it.emoji}</span>
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

function CheckoutModal({ cartTotal, submitting, onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [pincode, setPincode] = useState("");
  const [payment, setPayment] = useState("COD");
  const valid = name.trim() && phone.trim().length >= 10 && address.trim() && pincode.trim().length === 6;

  return (
    <div style={{ ...overlayBottomStyle, alignItems: "center" }}>
      <div style={{ background: "white", borderRadius: "14px", width: "100%", maxWidth: "360px", maxHeight: "90vh", overflowY: "auto", padding: "22px", margin: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ fontWeight: 700, fontSize: "16px", fontFamily: "'Fraunces', serif" }}>Delivery Details</div>
          <button onClick={onClose} style={closeBtnStyle}><X size={18} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <Field label="Aapka Naam" value={name} onChange={setName} placeholder="jaise Ramesh Yadav" />
          <Field label="Mobile Number" value={phone} onChange={setPhone} placeholder="10 digit number" type="tel" />
          <Field label="Ghar/Gali ka Pata" value={address} onChange={setAddress} placeholder="Makaan number, gali, mohalla" textarea />
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ flex: 1.4 }}><Field label="Landmark (optional)" value={landmark} onChange={setLandmark} placeholder="jaise Shiv Mandir ke paas" /></div>
            <div style={{ flex: 1 }}><Field label="Pin Code" value={pincode} onChange={(v) => setPincode(v.replace(/\D/g, "").slice(0, 6))} placeholder="471606" type="tel" /></div>
          </div>

          <div style={{ fontSize: "12px", fontWeight: 600, color: "#5C5747", marginTop: "4px" }}>Payment Method</div>
          <div style={{ display: "flex", gap: "8px" }}>
            {["COD", "UPI"].map((p) => (
              <button key={p} onClick={() => setPayment(p)} style={{ flex: 1, padding: "9px 0", borderRadius: "8px", border: payment === p ? "1.5px solid #1B4332" : "1px solid #E3DECF", background: payment === p ? "#E7F0EA" : "white", color: payment === p ? "#1B4332" : "#5C5747", fontWeight: 700, fontSize: "12.5px", cursor: "pointer" }}>
                {p === "COD" ? "Cash on Delivery" : "UPI se Pay"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid #E3DECF", marginTop: "6px", fontWeight: 700, fontSize: "14px" }}>
            <span>Total Payable</span><span>₹{cartTotal}</span>
          </div>

          <button
            disabled={!valid || submitting}
            onClick={() => onSubmit({ name, phone, address, landmark, pincode, payment: payment === "COD" ? "COD" : "UPI Paid" })}
            className="ddemo-btn"
            style={{ width: "100%", background: valid && !submitting ? "#1B4332" : "#D8D2BF", color: "white", fontWeight: 800, fontSize: "14px", border: "none", borderRadius: "10px", padding: "13px 0", cursor: valid && !submitting ? "pointer" : "not-allowed" }}
          >
            {submitting ? "Order ja raha hai..." : "Confirm Order"}
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
