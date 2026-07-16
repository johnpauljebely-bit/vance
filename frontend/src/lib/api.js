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
