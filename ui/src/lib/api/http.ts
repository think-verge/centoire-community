import axios, { type AxiosError, type AxiosRequestConfig } from "axios";

export type ErrorType<E> = AxiosError<E> & { message: string };

export const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL ?? ""}/api/v1`,
  withCredentials: true,
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
