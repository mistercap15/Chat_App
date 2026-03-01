import axios from "axios";
import { BASE_URL } from "./constants";
import useAuthStore from "@/store/useAuthStore";
import useUserStore from "@/store/useUserStore";
import { router } from "expo-router";

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

let isRefreshing = false;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;

    // Handle 401 — attempt token refresh once
    if (error.response?.status === 401 && !config._retried && !isRefreshing) {
      config._retried = true;
      isRefreshing = true;
      try {
        const token = useAuthStore.getState().token;
        const refreshResponse = await axios.post(
          `${BASE_URL}/api/auth/token/refresh`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const newToken = refreshResponse.data.token;
        useAuthStore.getState().setToken(newToken);
        config.headers.Authorization = `Bearer ${newToken}`;
        isRefreshing = false;
        return api(config);
      } catch {
        isRefreshing = false;
        useAuthStore.getState().clearToken();
        useUserStore.getState().clearUser();
        router.replace("/(tabs)/settings/register");
        return Promise.reject(error);
      }
    }

    if (error.response?.status === 429 && (!config._retryCount || config._retryCount < MAX_RETRIES)) {
      config._retryCount = (config._retryCount || 0) + 1;

      const retryAfter = error.response.headers['retry-after'];
      const delay = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : INITIAL_DELAY * Math.pow(2, config._retryCount - 1);

      await new Promise((resolve) => setTimeout(resolve, delay));
      return api(config);
    }

    return Promise.reject(error);
  }
);

export default api;
