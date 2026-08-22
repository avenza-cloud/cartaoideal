import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Gate the core scoring/data logic (pure modules the suite covers).
      include: [
        "lib/card-value.ts",
        "lib/brl.ts",
        "lib/cards.ts",
        "lib/fee-waiver.ts",
        "lib/fee-waiver-badges.ts",
        "lib/filter-cards.ts",
        "lib/scoring.ts",
      ],
      thresholds: {
        lines: 90,
        statements: 88,
        functions: 80,
        branches: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Stub out server-only so unit tests can import server modules
      "server-only": path.resolve(__dirname, "lib/__tests__/__mocks__/server-only.ts"),
    },
  },
});
