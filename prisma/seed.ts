import "dotenv/config";

import { resetDemoData } from "../lib/server/reset-demo";

async function main() {
  console.log("Seeding database with demo data...");
  await resetDemoData();
  console.log("Seed complete: demo data restored.");
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
