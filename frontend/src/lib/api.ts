import axios from "axios";
import { applyRateLimitMessage } from "./rateLimit";
import { withCache, defaultAdapter, clearApiCache } from "./apiCache";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
});

api.defaults.adapter = withCache(defaultAdapter);

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      clearApiCache();
      window.location.href = "/login";
    }
    // 429: readable message only, no automatic retry.
    applyRateLimitMessage(err);
    return Promise.reject(err);
  },
);

export default api;
