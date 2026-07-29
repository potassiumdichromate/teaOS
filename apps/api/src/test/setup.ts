// Must run before any app module (config/env.js in particular) is imported —
// vitest's `setupFiles` guarantees that. Points the app at the separate
// nvei_test database created by globalSetup.ts instead of the real `nvei`
// database, whose data is real historical proof (mainnet tx hashes etc.)
// recorded throughout knowledge_base.md and must never be touched by tests.
process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/nvei_test";

import { afterEach } from "vitest";
import { resetDb } from "./resetDb.js";

afterEach(async () => {
  await resetDb();
});
