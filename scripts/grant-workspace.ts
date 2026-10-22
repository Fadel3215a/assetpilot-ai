import "dotenv/config";

import { prisma } from "../lib/db";

const USAGE = "Usage: npm run workspace:grant -- <email> <workspace-slug> [--create]";

/**
 * P0.2 — the only sanctioned way to make workspace data visible to an account.
 *
 * Grants are NEVER implied by signup, role, or a client-supplied workspace id:
 * an account sees a workspace only when a WorkspaceMember row exists for it
 * (and, for the seeded demo identities, only while demo mode is enabled).
 *
 *   <email>            existing user account (see `npm run user:create`)
 *   <workspace-slug>   target workspace, e.g. `legacy`
 *   --create           create the workspace if the slug does not exist yet
 */
async function main() {
  const args = process.argv.slice(2);
  const create = args.includes("--create");
  const [emailArg, slugArg] = args.filter((a) => a !== "--create");

  if (!emailArg || !slugArg) {
    console.error(USAGE);
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  const slug = slugArg.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  });
  if (!user) {
    console.error(`No user with email "${email}". Create it first: npm run user:create -- <email> <password> [role]`);
    await prisma.$disconnect();
    process.exit(1);
  }

  let workspace = await prisma.workspace.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });
  if (!workspace && create) {
    workspace = await prisma.workspace.create({
      data: { slug, name: slugArg.trim() },
      select: { id: true, slug: true, name: true },
    });
    console.log(`Workspace created: ${workspace.slug} (${workspace.name})`);
  }
  if (!workspace) {
    console.error(`No workspace with slug "${slug}". Add --create to provision it.`);
    await prisma.$disconnect();
    process.exit(1);
  }

  const membership = await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    create: { workspaceId: workspace.id, userId: user.id },
    update: {},
    select: { id: true },
  });

  console.log(
    `Granted ${user.email} (${user.role}) membership ${membership.id} on workspace "${workspace.slug}".`,
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Workspace grant failed:", error);
  process.exit(1);
});
