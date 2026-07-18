// Central asset + copy references so any file can pull from one source.

const CDN = "https://customer-assets-lxgj4vgw.emergentagent.net/job_d9840bbe-488c-43b2-bb60-1116d64e8503/artifacts";
const CDN2 = "https://customer-assets-lqy194kg.emergentagent.net/job_vance-wip/artifacts";

// Same env var every other API call in this app uses — resolves to the
// local backend in dev, the live one in production, instead of hardcoding
// one or the other.
const BACKEND_BASE = process.env.REACT_APP_BACKEND_URL;

export const ASSETS = {
  logoBlack: `${BACKEND_BASE}/api/files/brand-logo-black`,
  logoWhite: `${BACKEND_BASE}/api/files/brand-logo-white`,
  watermark: `${BACKEND_BASE}/api/files/brand-logo-white`,
  mascot: `${CDN}/sipq6lrr_Showcase%20%283%29.png`,
  iconLock: `${CDN}/f826bkib_1.png`,
  iconLightning: `${CDN2}/egvuba66_2.png`,
  iconStar: `${CDN2}/9kxjnyjo_3.png`,
  iconGrid: `${CDN2}/tj6c7gtc_4.png`,
  iconBoard: `${CDN2}/yvx6pdop_5.png`,
};

export const PORTFOLIO_TAG_ORDER = ["All", "Logo", "Brand Identity", "Social Kit"];

export const COMMISSION_TYPES = [
  "Logo Design",
  "Banner Design",
  "Brand Identity",
  "Custom Commission",
];

export const FAQ = [
  {
    q: "How long does a commission take?",
    a: "Turnaround time depends on the complexity of the project. You'll get an estimated timeline once your request is accepted.",
  },
  {
    q: "How many revisions are included?",
    a: "Revision requests are generally accommodated, but may be denied at our discretion depending on scope and project stage.",
  },
  {
    q: "What payment methods do you accept?",
    a: "Stripe (cards, most countries), Interac e-Transfer (Canada), and Robux (via in-game purchase, manually confirmed). A 50% deposit is required to begin work, with the remaining 50% due on delivery.",
  },
  {
    q: "What's your refund policy?",
    a: "All payments are final. No refunds are issued once a deposit has been made.",
  },
  {
    q: "Can an order be paused?",
    a: "Yes — orders may be paused by us at any time, for any reason.",
  },
  {
    q: "Do you offer unlimited revisions?",
    a: "Revision requests are considered on a case-by-case basis and may be denied at our discretion.",
  },
  {
    q: "What do you need from me to get started?",
    a: "A short brief describing your vision, any reference images or inspiration, and your brand's name/tagline if you have one.",
  },
];
