import "dotenv/config";

import { prisma } from "../lib/db";
import { hashPassword } from "../lib/passwords";

const USAGE =
  "Usage: npm run user:create -- <email> <password> [VIEWER|CURATOR|ADMIN] [name]";

/**
 * Creates a user with a bcrypt-hashed password. This is the only sanctioned way
 * to provision accounts while self-registration is not implemented.
 */
async function main() {
  const [email, password, roleArg, name] = process.argv.slice(2);

  if (!email || !password) {
    console.error(USAGE);
    process.exit(1);
  }

  const role = (roleArg ?? "VIEWER").toUpperCase();
  if (role !== "VIEWER" && role !== "CURATOR" && role !== "ADMIN") {
    console.error(USAGE);
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: { password: passwordHash, role },
    create: {
      email: normalizedEmail,
      name: name?.trim() || normalizedEmail,
      password: passwordHash,
      role,
    },
    select: { id: true, email: true, role: true },
  });

  console.log(`User ready: ${user.email} (${user.role})`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("User creation failed:", error);
  process.exit(1);
});
