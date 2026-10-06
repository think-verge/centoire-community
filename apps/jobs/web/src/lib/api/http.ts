import type { AxiosRequestConfig } from "axios";
import { createHttp } from "@centoire/web-platform";

/** One same-origin client for jobs-api and core (auth, notifications): nginx/vite route by path. */
export const http = createHttp(`${import.meta.env.VITE_API_BASE_URL ?? ""}/api/v1`);

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> =>
  http(config).then((response) => response.data as T);

export default customInstance;
