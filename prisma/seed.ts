import "dotenv/config";

import { prisma } from "../lib/db";
import { isDemoModeEnabled } from "../lib/demo-mode";
import { resetDemoData } from "../lib/server/reset-demo";

async function main() {
  // The seed script wipes the workspace and re-creates the known demo
  // identities, so it is demo-mode only.
  if (!isDemoModeEnabled()) {
    console.error(
      'Demo seeding is disabled. Set NEXT_PUBLIC_DEMO_MODE="true" to allow the demo dataset and demo accounts to be (re)created.',
    );
    process.exit(1);
  }

  // P0.2 — seeding targets the explicit `legacy` workspace (created on demand)
  // and only ever rewrites THAT workspace's rows.
  const workspace = await prisma.workspace.upsert({
    where: { slug: "legacy" },
    create: { slug: "legacy", name: "Legacy workspace", isLegacy: true },
    update: {},
  });

  console.log(`Seeding database with demo data (workspace "${workspace.slug}")...`);
  await resetDemoData(workspace.id);
  console.log("Seed complete: demo data restored.");
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
