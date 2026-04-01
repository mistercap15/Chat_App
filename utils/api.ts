import axios from "axios";
import { BASE_URL } from "./constants";
import useAuthStore from "@/store/useAuthStore";

const MAX_RETRIES = 3;
const INITIAL_DELAY = 1000;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    if (error.response?.status === 429 && (!config._retryCount || config._retryCount < MAX_RETRIES)) {
      config._retryCount = (config._retryCount || 0) + 1;

      const retryAfter = error.response.headers['retry-after'];
      const delay = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : INITIAL_DELAY * Math.pow(2, config._retryCount - 1);

      await new Promise((resolve) => setTimeout(resolve, delay));
      return api(config);
    }

    console.error("API Error:", error);
    return Promise.reject(error);
  }
);

export default api;
