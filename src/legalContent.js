// ============================================================
// LEGAL PAGE CONTENT
// ============================================================
// IMPORTANT: Yeh ek reasonable STARTING DRAFT hai, kisi lawyer ne
// review nahi kiya hai. Live jaane se pehle (especially payment
// collection aur Khata/financial-ledger feature ki wajah se) ek
// lawyer se ek baar zaroor check karwa lena — kuch hazaar rupaye ka
// kharcha hai lekin galat/adhoori legal terms se bahut bada risk bach
// jaata hai.
//
// Neeche jahan bhi [ ] mein likha hai, use apni real details se
// badal dena (business naam, email, phone, address, company type).
// ============================================================

export const PLATFORM_NAME = "[Apni Online Dukaan]";
export const SUPPORT_EMAIL = "[officialhector365@gmail.com]";
export const SUPPORT_PHONE = "[+91 8959992195]";
export const BUSINESS_ADDRESS = "[110/4 Chachai Abad, Amlai Road, Ward No. 03, PinCode 484116, Dist Anuppur, Madhya Pradesh]";

export const TERMS_CONTENT = [
  {
    heading: "1. Introduction",
    body: `Welcome to ${PLATFORM_NAME} ("we", "us", "our", "Platform"). We provide a software-as-a-service platform that allows shop owners ("Merchant", "you") to create an online storefront, manage products and orders, track customer credit ("Khata"), accept walk-in billing (Quick Bill/POS), and related tools.

By creating an account or using the Platform, you agree to these Terms of Service. If you do not agree, please do not use the Platform.`,
  },
  {
    heading: "2. Who Can Use This Platform",
    body: `You must be at least 18 years old and legally capable of entering into a binding contract to register as a Merchant. You are responsible for ensuring that your use of the Platform, and the products/services you sell through it, comply with all applicable laws (including but not limited to FSSAI, drug licensing for pharmacies, weights & measures rules, and GST regulations, as applicable to your business type).`,
  },
  {
    heading: "3. Subscription & Billing",
    body: [
      "The Platform is offered on a paid subscription basis. Current pricing is displayed at the time of signup or in your account settings.",
      "Certain early-adopter (\"Founding Member\") pricing may be offered for a limited number of Merchants and, where stated, is locked for as long as your subscription remains continuously active. If your subscription lapses and is later reactivated, founding-member pricing may not be guaranteed to continue.",
      "Subscription fees are billed in advance (monthly, quarterly, half-yearly, or yearly as chosen) via our payment partner (Razorpay). Prices may change for new subscribers or renewal cycles with prior notice; existing locked-in pricing (where applicable) will be honored as described above.",
      "If a subscription payment fails or is not renewed, your storefront and admin access may be suspended until payment is completed. We are not responsible for any loss of business resulting from suspension due to non-payment.",
    ],
  },
  {
    heading: "4. Merchant Responsibilities",
    body: [
      "You are solely responsible for the accuracy of product listings, prices, stock levels, and descriptions you upload.",
      "You are responsible for fulfilling orders placed by your customers through the Platform, and for any disputes, refunds, or quality issues relating to the products/services you sell.",
      "You must not upload content that is illegal, infringes intellectual property rights, or misrepresents your products.",
      "You are responsible for keeping your login credentials confidential and for all activity that occurs under your account.",
    ],
  },
  {
    heading: "5. Our Role — Technology Provider Only",
    body: `${PLATFORM_NAME} provides the technology (software, hosting, order management) that enables you to run your own online and offline retail business. We are not a party to the sale contract between you and your customers, and we do not take ownership of, inspect, or guarantee any product or service sold through your store. Any dispute regarding product quality, delivery, or pricing is strictly between you and your customer.`,
  },
  {
    heading: "6. Khata (Customer Credit Ledger) Feature",
    body: `The Khata feature is a bookkeeping/record-keeping tool that allows you to track amounts owed to you by your customers ("credit" or "udhaar"). It is provided purely as a convenience for record-keeping.

${PLATFORM_NAME} is NOT a lender, NBFC, or financial institution, does not extend credit to any party, does not guarantee collection of any amount recorded in Khata, and is not responsible for disputes between you and your customer regarding Khata balances. You are responsible for the accuracy of entries you make and for recovering amounts owed to you through lawful means.`,
  },
  {
    heading: "7. Payments Collected Through the Platform",
    body: `Where the Platform facilitates payment collection (UPI/online payment display for your own customers, or your own subscription payment to us), such payments are processed through third-party payment gateways (e.g., Razorpay). We do not store your customers' full payment card or banking credentials. You are responsible for maintaining a valid UPI ID/payment details for receiving payments from your customers — ${PLATFORM_NAME} is not liable for misdirected payments due to incorrect details entered by you.`,
  },
  {
    heading: "8. Prohibited Use",
    body: [
      "Using the Platform to sell illegal, counterfeit, or prohibited goods.",
      "Attempting to interfere with, hack, or disrupt the Platform's systems.",
      "Using the Platform to harass, defraud, or mislead customers.",
      "Reselling or sub-licensing access to the Platform without our written permission.",
    ],
  },
  {
    heading: "9. Suspension & Termination",
    body: `We may suspend or terminate your account if you breach these Terms, engage in fraudulent activity, or fail to pay subscription fees. You may stop using the Platform and request account closure at any time by contacting us — see our Refund & Cancellation Policy for billing implications.`,
  },
  {
    heading: "10. Limitation of Liability",
    body: `To the maximum extent permitted by law, ${PLATFORM_NAME} shall not be liable for any indirect, incidental, or consequential damages (including loss of business, revenue, or data) arising from your use of the Platform. Our total liability for any claim shall not exceed the subscription fees paid by you in the three (3) months preceding the claim.`,
  },
  {
    heading: "11. Changes to These Terms",
    body: `We may update these Terms from time to time. Material changes will be notified through the Platform or via the contact details on your account. Continued use after changes take effect constitutes acceptance of the updated Terms.`,
  },
  {
    heading: "12. Governing Law",
    body: `These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts at [Aapka Shahar, Madhya Pradesh].`,
  },
  {
    heading: "13. Contact Us",
    body: `For any questions about these Terms, contact us at:\n${SUPPORT_EMAIL} | ${SUPPORT_PHONE}\n${BUSINESS_ADDRESS}`,
  },
];

export const PRIVACY_CONTENT = [
  {
    heading: "1. Overview",
    body: `This Privacy Policy explains how ${PLATFORM_NAME} ("we", "us") collects, uses, and protects information when you use our platform — whether you are a Merchant using our tools to run your store, or a customer placing an order on a Merchant's storefront.`,
  },
  {
    heading: "2. Information We Collect",
    body: [
      "Merchant account information: name, email, phone number, business name, address, UPI ID, business type, and login credentials.",
      "Customer order information (collected on behalf of Merchants): name, phone number, delivery address, and order details, provided by customers when placing an order on a Merchant's storefront.",
      "Khata records: credit/payment entries a Merchant records against a customer's phone number.",
      "Payment information: processed by our payment partner (Razorpay) for subscription billing. We do not store full card numbers or banking credentials on our own servers.",
      "Usage data: basic technical information such as device type and general usage patterns, used to maintain and improve the Platform.",
    ],
  },
  {
    heading: "3. How We Use Information",
    body: [
      "To create and manage Merchant accounts and storefronts.",
      "To enable order placement, delivery tracking, and Khata record-keeping between Merchants and their customers.",
      "To process subscription billing and send related notifications.",
      "To provide customer support and respond to queries.",
      "To improve, secure, and maintain the Platform.",
    ],
  },
  {
    heading: "4. Data Storage & Third-Party Processors",
    body: `Data is stored using third-party cloud infrastructure providers (including Supabase for database/storage and Vercel for hosting), and payment processing is handled by Razorpay. These providers may store data on servers located in India or other jurisdictions in accordance with their own security and compliance standards. We take reasonable steps to work with providers that maintain industry-standard security practices.`,
  },
  {
    heading: "5. Sharing of Information",
    body: `We do not sell your personal information. Information is shared only: (a) between a Merchant and their own customers as necessary to fulfil orders (e.g., a customer's phone/address is visible to the Merchant they ordered from); (b) with service providers (hosting, payment processing) strictly to operate the Platform; (c) where required by law, court order, or to protect the rights and safety of users or the Platform.`,
  },
  {
    heading: "6. Data Security",
    body: `We use reasonable technical and organizational measures (including access controls and row-level data isolation between Merchant accounts) to protect information from unauthorized access. However, no online system can be guaranteed 100% secure, and you use the Platform at your own risk in this regard.`,
  },
  {
    heading: "7. Data Retention",
    body: `We retain account, order, and Khata data for as long as your account is active, and for a reasonable period after closure as required for legal, accounting, or dispute-resolution purposes.`,
  },
  {
    heading: "8. Your Rights",
    body: `You may request access to, correction of, or deletion of your personal information by contacting us at the details below. Merchants are responsible for handling similar requests from their own end customers regarding order/Khata data recorded against them, and may contact us for assistance in doing so.`,
  },
  {
    heading: "9. Children's Privacy",
    body: `The Platform is intended for use by adults (18+) operating or transacting with a retail business. We do not knowingly collect personal information from children.`,
  },
  {
    heading: "10. Changes to This Policy",
    body: `We may update this Privacy Policy from time to time. Material changes will be notified through the Platform. Continued use after changes take effect constitutes acceptance of the updated Policy.`,
  },
  {
    heading: "11. Contact Us",
    body: `For privacy-related questions or requests, contact us at:\n${SUPPORT_EMAIL} | ${SUPPORT_PHONE}\n${BUSINESS_ADDRESS}`,
  },
];

export const REFUND_CONTENT = [
  {
    heading: "1. Subscription Fees",
    body: `Subscription fees paid for access to the ${PLATFORM_NAME} platform (monthly, quarterly, half-yearly, or yearly plans) are billed in advance and are generally non-refundable once a billing cycle has started, except as described below.`,
  },
  {
    heading: "2. Cancellation",
    body: `You may cancel your subscription at any time from your account settings or by contacting us. Cancellation stops future billing but does not entitle you to a refund for the current, already-paid billing period — you will continue to have access until the end of the period you have already paid for.`,
  },
  {
    heading: "3. Exceptions — When a Refund May Be Considered",
    body: [
      "A duplicate/accidental payment was charged for the same billing period.",
      "A technical failure on our part prevented you from accessing the Platform for a significant continuous period, and we were unable to resolve it in a reasonable time.",
      "Any refund granted under this section is at our sole discretion and, where approved, will be processed to the original payment method within 7–10 business days.",
    ],
  },
  {
    heading: "4. Orders Placed on a Merchant's Storefront",
    body: `${PLATFORM_NAME} is a technology platform and is not the seller of products/services listed on a Merchant's storefront. Refunds, cancellations, or quality disputes for an order (e.g., wrong item, damaged goods, non-delivery) must be resolved directly with the Merchant from whom the order was placed. We encourage Merchants to clearly communicate their own refund/cancellation terms to their customers.`,
  },
  {
    heading: "5. Founding Member / Promotional Pricing",
    body: `Where locked-in promotional pricing has been offered (e.g., a discounted "Founding Member" rate), this pricing applies only while your subscription remains continuously active. It does not itself entitle you to any refund of the difference between promotional and standard pricing under any circumstance.`,
  },
  {
    heading: "6. How to Request a Refund",
    body: `To request a refund under the exceptions listed above, contact us with your account details and reason for the request:\n${SUPPORT_EMAIL} | ${SUPPORT_PHONE}`,
  },
];
