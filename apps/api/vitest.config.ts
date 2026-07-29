import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    globalSetup: ["./src/test/globalSetup.ts"],
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 15000,
    hookTimeout: 30000,
    // All test files share one real Postgres database (nvei_test, see
    // globalSetup.ts) with no per-test transaction isolation — running files
    // in parallel caused real cross-file races (one file's afterEach
    // truncation deleting rows another file's test had just created).
    // Sequential execution trades some wall-clock time for correctness here.
    fileParallelism: false,
    // Real-infra tests (real drand mainnet, real 0G mainnet) are opt-in via
    // RUN_LIVE_TESTS=1 — see src/test/README.md. Excluded by default so
    // `npm test` never needs a funded wallet or makes real gas-spending
    // transactions just to run in CI.
    exclude: ["**/node_modules/**", "**/*.live.test.ts"],
  },
});
