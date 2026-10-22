import { hashPassword, isBcryptHash, verifyStoredPassword } from "../lib/passwords";

const failures: string[] = [];

function check(condition: boolean, label: string): void {
  if (!condition) failures.push(label);
}

/**
 * Offline verification of the password storage rules:
 * hashPassword emits bcrypt, verifyStoredPassword accepts correct passwords,
 * rejects wrong passwords, and rejects legacy plaintext outright.
 */
async function main() {
  const hash = await hashPassword("correct-horse-battery-staple");

  check(isBcryptHash(hash), "hashPassword emits a bcrypt hash");
  check(
    await verifyStoredPassword("correct-horse-battery-staple", hash),
    "correct password verifies",
  );
  check(
    !(await verifyStoredPassword("wrong-password", hash)),
    "wrong password is rejected",
  );
  check(
    !(await verifyStoredPassword("plaintext-password", "plaintext-password")),
    "legacy plaintext storage is rejected",
  );

  if (failures.length > 0) {
    console.error("Auth verification FAILED:");
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log("Auth verification passed.");
}

void main();
