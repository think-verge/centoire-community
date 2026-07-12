import { defineConfig } from "orval";

export default defineConfig({
  centoire: {
    input: "./openapi/openapi.json",
    output: {
      mode: "tags-split",
      target: "./src/lib/api/generated",
      schemas: "./src/lib/api/generated/model",
      client: "react-query",
      clean: true,
      override: {
        mutator: {
          path: "./src/lib/api/http.ts",
          name: "customInstance",
        },
        operations: {
          // Feed + list endpoints get infinite queries keyed on the cursor param
          getFeedForYou: { query: { useInfinite: true, useInfiniteQueryParam: "cursor" } },
          getFeedFollowing: { query: { useInfinite: true, useInfiniteQueryParam: "cursor" } },
          getFeedDiscover: { query: { useInfinite: true, useInfiniteQueryParam: "cursor" } },
        },
      },
    },
  },
});
