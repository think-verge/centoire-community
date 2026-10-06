import { defineConfig } from "orval";

export default defineConfig({
  jobs: {
    input: "./openapi/openapi.json",
    output: {
      mode: "tags-split",
      target: "./src/lib/api/generated",
      schemas: "./src/lib/api/generated/model",
      client: "react-query",
      clean: true,
      override: {
        mutator: { path: "./src/lib/api/http.ts", name: "customInstance" },
        operations: {
          listJobs: { query: { useInfinite: true, useInfiniteQueryParam: "cursor" } },
        },
      },
    },
  },
});
