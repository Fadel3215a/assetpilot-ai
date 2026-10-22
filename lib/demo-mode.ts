/**
 * Demo-mode gate.
 *
 * The seeded demo identities and one-click login affordances are development /
 * demo conveniences. In production (`NODE_ENV=production`) they are disabled
 * unless `NEXT_PUBLIC_DEMO_MODE="true"` is set explicitly. This keeps demo
 * credentials out of production by default while preserving the local demo
 * workflow.
 */
export function isDemoModeEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_DEMO_MODE?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV !== "production";
}
