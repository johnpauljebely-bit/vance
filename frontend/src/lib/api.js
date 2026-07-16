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

// Canonical order status list — matches backend
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
