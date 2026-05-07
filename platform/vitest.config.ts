import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Stub out server-only so unit tests can import server modules
      "server-only": path.resolve(__dirname, "lib/__tests__/__mocks__/server-only.ts"),
    },
  },
});
