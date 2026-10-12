// ============================================================
// Customer storefront ki bhasha (English / हिन्दी).
// - Sirf customer wali screens (storefront, cart, checkout, order confirm,
//   track order) ke liye. Dukaandar/staff/admin ka dashboard isse nahi badalta.
// - Choice customer ke apne phone mein yaad rehti hai (localStorage), koi
//   server/account nahi chahiye.
// - t("English text") — Hindi na mile to English hi dikhta hai, isliye koi
//   screen kabhi khaali/toota nahi dikhegi.
// ============================================================
import { useSyncExternalStore } from "react";

const KEY = "dukaan_lang";
const listeners = new Set();

function read() {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "hi" || v === "en") return v;
  } catch { /* private mode */ }
  return "en";
}
let current = read();

export function getLang() { return current; }
export function setLang(l) {
  current = l === "hi" ? "hi" : "en";
  try { localStorage.setItem(KEY, current); } catch { /* ignore */ }
  listeners.forEach((f) => f());
}
function subscribe(f) { listeners.add(f); return () => listeners.delete(f); }

export const HI = {
  // storefront
  "Search products...": "सामान खोजें...",
  "🔥 Combo Deals": "🔥 कॉम्बो ऑफ़र",
  "No products found.": "कोई सामान नहीं मिला।",
  "Get Directions": "रास्ता देखें",
  "FOLLOW US": "हमें फॉलो करें",
  "Find us on Google": "Google पर हमें खोजें",
  "All": "सभी",
  "Featured": "ख़ास",
  "Sold Out": "ख़त्म हो गया",
  "Out of Stock": "स्टॉक में नहीं",
  "Currently Unavailable": "अभी उपलब्ध नहीं",
  "Add": "जोड़ें",
  "+ Add": "+ जोड़ें",
  "Buy": "ख़रीदें",
  "View": "देखें",
  "Choose Option": "विकल्प चुनें",
  "Book Now": "अभी बुक करें",
  "options": "विकल्प",
  "% OFF": "% छूट",
  "🔥 Limited-Time Offer": "🔥 सीमित समय का ऑफ़र",
  "🔥 Limited Time Deal": "🔥 सीमित समय का ऑफ़र",
  "Offer ends:": "ऑफ़र समाप्त:",
  "Ends in:": "समाप्त होने में:",
  "📦 Buy More, Save More": "📦 ज़्यादा लो, ज़्यादा बचाओ",
  "Save": "बचत",
  "Age:": "उम्र:",
  "item": "आइटम",
  "items": "आइटम",
  "in Cart": "कार्ट में",
  "Proceed": "आगे बढ़ें",
  // cart
  "Your Cart": "आपका कार्ट",
  "Combo": "कॉम्बो",
  "Deal applied: saved": "ऑफ़र लगा: बचत",
  "GST included in total": "GST कुल में शामिल है",
  "Total": "कुल",
  "Place Order": "ऑर्डर करें",
  // checkout
  "Delivery Details": "डिलीवरी की जानकारी",
  "How would you like your order?": "आप ऑर्डर कैसे लेना चाहेंगे?",
  "🛵 Home Delivery": "🛵 घर पर डिलीवरी",
  "🏪 Store Pickup": "🏪 दुकान से ले जाऊँगा",
  "🍽️ Dine In": "🍽️ यहीं बैठकर खाना",
  "Mobile Number": "मोबाइल नंबर",
  "10 digit number": "10 अंकों का नंबर",
  "Checking details...": "जानकारी देख रहे हैं...",
  "✓ Found your previous details — edit if needed": "✓ आपकी पिछली जानकारी मिल गई — ज़रूरत हो तो बदलें",
  "Your Name": "आपका नाम",
  "e.g. Ramesh Yadav": "जैसे रमेश यादव",
  "Your State (for GST)": "आपका राज्य (GST के लिए)",
  "Select state": "राज्य चुनें",
  "Table Number (optional)": "टेबल नंबर (वैकल्पिक)",
  "e.g. Table 5": "जैसे टेबल 5",
  "House/Street Address": "घर/गली का पता",
  "House number, street, area": "मकान नंबर, गली, इलाका",
  "Landmark (optional)": "पास की पहचान (वैकल्पिक)",
  "e.g. near Shiv Mandir": "जैसे शिव मंदिर के पास",
  "Pin Code": "पिन कोड",
  "🏪 You'll pick up your order from the store yourself — no address needed.": "🏪 आप अपना ऑर्डर दुकान से खुद ले जाएँगे — पता देने की ज़रूरत नहीं।",
  "🍽️ You're ordering to eat at the restaurant — no delivery needed.": "🍽️ आप रेस्टोरेंट में बैठकर खाने के लिए ऑर्डर कर रहे हैं — डिलीवरी की ज़रूरत नहीं।",
  "Payment Method": "भुगतान का तरीका",
  "Cash on Delivery": "डिलीवरी पर नकद",
  "Pay via UPI": "UPI से भुगतान",
  "UPI QR Code": "UPI QR कोड",
  "Scan or send to this UPI ID:": "स्कैन करें या इस UPI ID पर भेजें:",
  "Store hasn't set up a UPI ID yet. Please choose Cash on Delivery.": "दुकान ने अभी UPI ID नहीं जोड़ी है। कृपया डिलीवरी पर नकद चुनें।",
  "After paying, come back to this page and tap \"I've Paid\" — the shopkeeper will verify and confirm your order.": "भुगतान के बाद इस पेज पर लौटें और \"मैंने भुगतान कर दिया\" दबाएँ — दुकानदार जाँचकर आपका ऑर्डर पक्का करेंगे।",
  "After completing the payment, tap \"I've Paid\" below — the shopkeeper will verify and confirm your order.": "भुगतान पूरा होने के बाद नीचे \"मैंने भुगतान कर दिया\" दबाएँ — दुकानदार जाँचकर आपका ऑर्डर पक्का करेंगे।",
  "✓ UPI app opened": "✓ UPI ऐप खुल गया",
  "I've Paid": "मैंने भुगतान कर दिया",
  "Placing order...": "ऑर्डर हो रहा है...",
  "Subtotal": "उप-योग",
  "Discount": "छूट",
  "Taxable Amount": "कर योग्य राशि",
  "CGST": "CGST",
  "SGST": "SGST",
  "IGST": "IGST",
  "Items Total": "सामान का योग",
  "Delivery Charge": "डिलीवरी चार्ज",
  "FREE": "मुफ़्त",
  "Total Payable": "कुल देय",
  "🎉 Order ₹": "🎉 और ₹",
  "more to get FREE delivery!": "का ऑर्डर करें और डिलीवरी मुफ़्त पाएँ!",
  "Order could not be saved: ": "ऑर्डर सेव नहीं हो सका: ",
  // order confirmed
  "Order Placed!": "ऑर्डर हो गया!",
  "Order ID:": "ऑर्डर नंबर:",
  "Final Total": "अंतिम कुल",
  "Tap to send order confirmation to": "ऑर्डर की पुष्टि भेजने के लिए दबाएँ:",
  "on WhatsApp.": "को WhatsApp पर।",
  "📦 Track Your Order": "📦 अपना ऑर्डर ट्रैक करें",
  "Done": "ठीक है",
  // tracking
  "Track Order": "ऑर्डर ट्रैक करें",
  "Track": "ट्रैक करें",
  "Your recent orders on this device": "इस फ़ोन पर आपके हाल के ऑर्डर",
  "Or enter your Order Number (e.g. ORD1234) — you got this when you placed the order.": "या अपना ऑर्डर नंबर डालें (जैसे ORD1234) — ऑर्डर करते समय मिला था।",
  "e.g. ORD1234": "जैसे ORD1234",
  "Mobile number used for the order": "ऑर्डर में दिया गया मोबाइल नंबर",
  "Please enter an order number.": "कृपया ऑर्डर नंबर डालें।",
  "Please enter the mobile number used while ordering.": "कृपया ऑर्डर करते समय दिया गया मोबाइल नंबर डालें।",
  "Order": "ऑर्डर",
  "Order not found. Check the order number and the mobile number you used while ordering.": "ऑर्डर नहीं मिला। ऑर्डर नंबर और ऑर्डर में दिया मोबाइल नंबर जाँच लें।",
  "Something went wrong, please try again.": "कुछ गड़बड़ हो गई, कृपया दोबारा कोशिश करें।",
  "Order Placed": "ऑर्डर हो गया",
  "Order Accepted": "ऑर्डर स्वीकार हुआ",
  "Packing Complete": "पैकिंग पूरी",
  "Ready": "तैयार",
  "Out for Delivery": "डिलीवरी के लिए निकला",
  "Delivered": "डिलीवर हो गया",
  "Ready for Pickup": "लेने के लिए तैयार",
  "Picked Up": "ले लिया गया",
  "Booking Requested": "बुकिंग का अनुरोध",
  "Booking Confirmed": "बुकिंग पक्की",
  "Completed": "पूरा हुआ",
  "Preparing": "तैयार हो रहा है",
  "Ready to Serve": "परोसने के लिए तैयार",
  "Served": "परोस दिया गया",
  "🛵 Your order is on the way": "🛵 आपका ऑर्डर रास्ते में है",
  "Delivery Boy": "डिलीवरी वाला",
  "Call": "कॉल करें",
  "Check Another Order": "दूसरा ऑर्डर देखें",
};

export function tr(lang, en) {
  if (lang !== "hi" || en == null) return en;
  return HI[en] || en;
}

// const { lang, t, setLang } = useLang();
export function useLang() {
  const lang = useSyncExternalStore(subscribe, getLang, getLang);
  return { lang, setLang, t: (en) => tr(lang, en) };
}
