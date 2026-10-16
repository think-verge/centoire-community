import axios, { type AxiosError, type AxiosRequestConfig } from "axios";

export type ErrorType<E> = AxiosError<E> & { message: string };

export const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL ?? ""}/api/v1`,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  try {
    let token: string | null = null;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      token = params.get("invite");
      if (!token) {
        const stored = sessionStorage.getItem("centoire_pending_circle_invite");
        if (stored) {
          const parsed = JSON.parse(stored);
          token = parsed?.token || null;
        }
      }
    }
    if (token) {
      config.headers = config.headers || {};
      config.headers["X-Invite-Token"] = token;
    }
  } catch {
    // ignore
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") {
      error.message = detail;
    }
    return Promise.reject(error);
  },
);

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> =>
  apiClient(config).then((response) => response.data as T);

export default customInstance;
