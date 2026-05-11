import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    globals: false,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      // server-only throws on import outside RSC; map it to a noop in tests.
      "server-only": path.resolve(__dirname, "./tests/server-only-shim.ts"),
    },
  },
});
