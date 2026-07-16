// Central asset + copy references so any file can pull from one source.

const CDN = "https://customer-assets-lxgj4vgw.emergentagent.net/job_d9840bbe-488c-43b2-bb60-1116d64e8503/artifacts";
const CDN2 = "https://customer-assets-lqy194kg.emergentagent.net/job_vance-wip/artifacts";

export const ASSETS = {
  logoBlack: `${CDN}/2nhu3pin_Untitled%20design%20%284%29.png`,
  logoWhite: `${CDN}/jlsm9cq4_Untitled%20design%20%285%29.png`,
  watermark: `${CDN}/pzblpyw9_Logo%20%2825%29.png`,
  mascot: `${CDN}/sipq6lrr_Showcase%20%283%29.png`,
  iconLock: `${CDN}/f826bkib_1.png`,
  iconLightning: `${CDN2}/egvuba66_2.png`,
  iconStar: `${CDN2}/9kxjnyjo_3.png`,
  iconGrid: `${CDN2}/tj6c7gtc_4.png`,
  iconBoard: `${CDN2}/yvx6pdop_5.png`,
};

// Placeholder portfolio imagery until real case studies are auto-generated in Phase 5.
export const PORTFOLIO_PLACEHOLDERS = [
  {
    id: "sample-1",
    title: "Sable Studio",
    tags: ["Logo", "Brand Identity"],
    image: "https://images.unsplash.com/photo-1623305465231-d884ce752d59?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDJ8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMGNhcmQlMjBtb2NrdXB8ZW58MHx8fHwxNzg0MTY1NDUwfDA&ixlib=rb-4.1.0&q=85",
    accent: "#E7DFD3",
    span: "col-span-12 md:col-span-8 md:row-span-2",
    height: "h-[420px] md:h-[560px]",
  },
  {
    id: "sample-2",
    title: "Loop Athletics",
    tags: ["Logo"],
    image: "https://images.unsplash.com/photo-1544816155-12df9643f363?crop=entropy&cs=srgb&fm=jpg&ixid=M3w8NjA1NjZ8MHwxfHNlYXJjaHwyfHx0b3RlJTIwYmFnJTIwbW9ja3VwfGVufDB8fHx8MTc4NDE2NTQ1MXww&ixlib=rb-4.1.0&q=85",
    accent: "#2C2C2C",
    span: "col-span-12 md:col-span-4",
    height: "h-[260px]",
  },
  {
    id: "sample-3",
    title: "Northline Café",
    tags: ["Brand Identity"],
    image: "https://images.unsplash.com/photo-1695048168808-4bbfa1efdfa7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w8NjA1MDV8MHwxfHNlYXJjaHwxfHxzdG9yZWZyb250JTIwc2lnbiUyMG1vY2t1cHxlbnwwfHx8fDE3ODQxNjU0NTF8MA&ixlib=rb-4.1.0&q=85",
    accent: "#3B3F44",
    span: "col-span-12 md:col-span-4",
    height: "h-[280px]",
  },
  {
    id: "sample-4",
    title: "Meridian Guild",
    tags: ["Brand Identity", "Social Kit"],
    image: "https://images.unsplash.com/photo-1781444456332-f65b7080a179?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHwxfHxicmFuZCUyMGlkZW50aXR5JTIwYm9hcmQlMjBtb2NrdXB8ZW58MHx8fHwxNzg0MTY1NDU4fDA&ixlib=rb-4.1.0&q=85",
    accent: "#F0EAD8",
    span: "col-span-12 md:col-span-6",
    height: "h-[320px]",
  },
  {
    id: "sample-5",
    title: "Halcyon Type",
    tags: ["Logo", "Brand Identity"],
    image: "https://images.unsplash.com/photo-1520764588094-8fc067746a8e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzR8MHwxfHNlYXJjaHwzfHx0eXBvZ3JhcGh5JTIwc3BlY2ltZW4lMjBtb2NrdXB8ZW58MHx8fHwxNzg0MTY1NDU4fDA&ixlib=rb-4.1.0&q=85",
    accent: "#1F1B18",
    span: "col-span-12 md:col-span-6",
    height: "h-[320px]",
  },
];

export const PORTFOLIO_TAG_ORDER = ["All", "Logo", "Brand Identity", "Social Kit"];

export const COMMISSION_TYPES = [
  "Logo Design",
  "Brand Identity Package",
  "Social Media Kit",
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
