import axios, { type AxiosInstance } from "axios";

/** axios client for the Centoire API: cookie auth, and the server's `detail` copied into `error.message`. */
export function createHttp(baseURL: string): AxiosInstance {
  const client = axios.create({ baseURL, withCredentials: true });
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const detail = error.response?.data?.detail;
      if (typeof detail === "string") error.message = detail;
      return Promise.reject(error);
    },
  );
  return client;
}
