import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const client = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("vance_admin_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default client;

export const publicApi = {
  getSettings: () => client.get("/settings/public").then((r) => r.data),
  getTestimonials: () => client.get("/testimonials").then((r) => r.data),
  getPortfolio: (tag) =>
    client
      .get("/portfolio", { params: tag && tag !== "All" ? { tag } : {} })
      .then((r) => r.data),
  getPortfolioHome: () => client.get("/portfolio/home").then((r) => r.data),
  getPortfolioItem: (id) => client.get(`/portfolio/${id}`).then((r) => r.data),
  submitRequest: (payload) => client.post("/requests", payload).then((r) => r.data),
  uploadReference: (file) => {
    const form = new FormData();
    form.append("file", file);
    return client
      .post("/uploads/reference", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
};
export const authApi = {
  adminLogin: (email, password) =>
    client.post("/auth/admin/login", { email, password }).then((r) => r.data),
  me: () => client.get("/auth/me").then((r) => r.data),
};



export const adminApi = {
  getSummary: () => client.get("/admin/dashboard/summary").then((r) => r.data),
  listRequests: (status) =>
    client
      .get("/admin/requests", { params: status && status !== "All" ? { status } : {} })
      .then((r) => r.data),
  markRead: (id) => client.post(`/admin/requests/${id}/read`).then((r) => r.data),
  acceptRequest: (id, reason) =>
    client
      .post(`/admin/requests/${id}/accept`, { reason: reason || null })
      .then((r) => r.data),
  declineRequest: (id, reason) =>
    client
      .post(`/admin/requests/${id}/decline`, { reason: reason || null })
      .then((r) => r.data),
  listOrders: (status) =>
    client
      .get("/admin/orders", { params: status && status !== "All" ? { status } : {} })
      .then((r) => r.data),
  getOrder: (id) => client.get(`/admin/orders/${id}`).then((r) => r.data),
  updateOrderStatus: (id, status) =>
    client.patch(`/admin/orders/${id}/status`, { status }).then((r) => r.data),
  getSettings: () => client.get("/admin/settings").then((r) => r.data),
  updateSettings: (patch) =>
    client.patch("/admin/settings", patch).then((r) => r.data),
};

// Client portal + admin messages/portfolio/automation clients — separate token key
const clientClient = axios.create({ baseURL: API_BASE, timeout: 30000 });
clientClient.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("vance_client_token");
  if (t && cfg.headers) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export const portalApi = {
  login: (email, password) =>
    client.post("/portal/login", { email, password: password || null }).then((r) => r.data),
  verify: (token) => client.post("/portal/verify", { token }).then((r) => r.data),
  me: () => clientClient.get("/portal/me").then((r) => r.data),
  listOrders: () => clientClient.get("/portal/orders").then((r) => r.data),
  getOrder: (id) => clientClient.get(`/portal/orders/${id}`).then((r) => r.data),
  listMessages: (id) => clientClient.get(`/portal/orders/${id}/messages`).then((r) => r.data),
  sendMessage: (id, body, attachments = []) =>
    clientClient
      .post(`/portal/orders/${id}/messages`, { body, attachment_file_ids: attachments })
      .then((r) => r.data),
  submitReview: (id, quote, rating) =>
    clientClient
      .post(`/portal/orders/${id}/review`, { quote, rating })
      .then((r) => r.data),
};

export const adminMsgApi = {
  list: (orderId) =>
    client.get(`/admin/orders/${orderId}/messages`).then((r) => r.data),
  send: (orderId, body, attachments = []) =>
    client
      .post(`/admin/orders/${orderId}/messages`, { body, attachment_file_ids: attachments })
      .then((r) => r.data),
};

export const portfolioApi = {
  list: () => client.get("/admin/portfolio").then((r) => r.data),
  create: (payload) => client.post("/admin/portfolio", payload).then((r) => r.data),
  update: (id, patch) => client.patch(`/admin/portfolio/${id}`, patch).then((r) => r.data),
  remove: (id) => client.delete(`/admin/portfolio/${id}`).then((r) => r.data),
};

export const automationApi = {
  get: () => client.get("/admin/automation").then((r) => r.data),
  update: (patch) => client.patch("/admin/automation", patch).then((r) => r.data),
  listMockups: () => client.get("/admin/mockups").then((r) => r.data),
  showcasePrepare: (orderId, logoUrl) =>
    client
      .post(`/admin/orders/${orderId}/showcase/prepare`, { logo_url: logoUrl })
      .then((r) => r.data),
  showcaseGenerate: (orderId, payload) =>
    client
      .post(`/admin/orders/${orderId}/showcase/generate`, payload)
      .then((r) => r.data),
  showcasePublish: (orderId, payload) =>
    client
      .post(`/admin/orders/${orderId}/showcase/publish`, payload)
      .then((r) => r.data),
  watermarkPreviewUrl: (logoUrl) =>
    `${API_BASE}/admin/watermark/preview?logo_url=${encodeURIComponent(logoUrl)}`,
};
export const ORDER_STATUSES = [
  "Accepted – Awaiting Deposit",
  "Awaiting Manual Payment Confirmation",
  "In Queue",
  "Sketching",
  "Final Review",
  "Delivered – Awaiting Final Payment",
  "Delivered – Awaiting Review",
  "Closed",
];

export const TASK_BOARD_COLUMNS = [
  "In Queue",
  "Sketching",
  "Final Review",
  "Delivered – Awaiting Final Payment",
  "Delivered – Awaiting Review",
];
