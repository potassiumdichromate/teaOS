// Runs once, in a plain Node process, before any test file/worker starts.
// Creates (if needed) a real, separate Postgres database — nvei_test, on the
// same local Docker Postgres container every dev/live run already uses — and
// pushes the real schema to it. Tests run against real Postgres, never a
// mocked DB, per this project's standing rule (see docs/DATABASE.md); the
// separate database exists only so tests can never touch the real historical
// demo data (the actual mainnet-anchored papers/results recorded throughout
// knowledge_base.md) that lives in the main `nvei` database.
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const HOST_PORT = "5433";
const ADMIN_URL = `postgresql://postgres:postgres@localhost:${HOST_PORT}/postgres`;
const TEST_DB = "nvei_test";
const TEST_URL = `postgresql://postgres:postgres@localhost:${HOST_PORT}/${TEST_DB}`;

export default async function globalSetup() {
  const admin = new PrismaClient({ datasources: { db: { url: ADMIN_URL } } });
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE ${TEST_DB}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes("already exists")) throw err;
  } finally {
    await admin.$disconnect();
  }

  execSync(
    "npx prisma db push --schema=../../prisma/schema.prisma --skip-generate --accept-data-loss",
    {
      cwd: process.cwd(), // apps/api, when invoked via the workspace's `npm test`
      env: { ...process.env, DATABASE_URL: TEST_URL },
      stdio: "inherit",
    },
  );
}
