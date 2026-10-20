import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/.git/**", "output/**"],
    coverage: {
      provider: "v8",
    },
  },
  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },
});
