import "dotenv/config";

import { hashPassword, isBcryptHash } from "../lib/passwords";
import { prisma } from "../lib/db";

/**
 * One-time migration: re-hashes any stored user password that is still stored
 * in plaintext (legacy rows created before bcrypt was introduced). Passwords
 * are read and written but never printed.
 */
async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, password: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const user of users) {
    if (!user.password || isBcryptHash(user.password)) {
      skipped += 1;
      continue;
    }
    const hash = await hashPassword(user.password);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hash },
    });
    updated += 1;
  }

  console.log(
    `Password migration complete: ${updated} hashed, ${skipped} already hashed or empty.`,
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Password migration failed:", error);
  process.exit(1);
});
