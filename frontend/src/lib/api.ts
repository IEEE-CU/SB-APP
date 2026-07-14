import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    } else if (err.response?.status === 403) {
      console.warn('Permission Denied (403)');
      // If desired, dispatch an event or use a toast here. For now, we reject gracefully.
    }
    return Promise.reject(err);
  },
);

export default api;
