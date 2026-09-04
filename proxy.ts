import { NextResponse, type NextRequest } from "next/server";
import { parseRole, ROLE_HEADER } from "@/lib/auth";
import type { UserRole } from "@/types";

/**
 * Stage 4.3 — Proxy (Next 16 replacement for middleware).
 *
 * Validates the incoming session/API identity and attaches a normalized
 * `x-user-role` header so guarded API routes and server functions can trust the
 * caller's role. Also enforces a lightweight in-memory rate-limit placeholder
 * on the two heavy endpoints (/api/ai/stream, /api/export).
 *
 * NOTE: This is an optimistic front-door check. Authorization is enforced for
 * real inside each route/server function via lib/auth.ts.
 */

const STREAM_PATH = "/api/ai/stream";
const EXPORT_PATH = "/api/export";

const DEFAULT_ROLE = process.env.DEMO_USER_ROLE && parseRole(process.env.DEMO_USER_ROLE)
  ? (process.env.DEMO_USER_ROLE as UserRole)
  : "ADMIN";

const API_KEYS: string[] = process.env.API_KEYS
  ? process.env.API_KEYS.split(",").map((s) => s.trim()).filter(Boolean)
  : [];

interface RateBucket {
  start: number;
  count: number;
}

const WINDOW_MS = 60_000;
const LIMITS: Record<string, number> = {
  [STREAM_PATH]: 40,
  [EXPORT_PATH]: 60,
};

const buckets = new Map<string, RateBucket>();

function clientKey(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function apiKeyRole(request: NextRequest): UserRole | null {
  const key = request.headers.get("x-api-key");
  if (!key || API_KEYS.length === 0) return null;
  return API_KEYS.includes(key) ? "ADMIN" : null;
}

/**
 * Resolves the caller's role. Priority: validated API key (ADMIN) > explicit
 * role header > demo default.
 */
function resolveRole(request: NextRequest): {
  role: UserRole;
  userId: string;
  userName: string;
  userEmail?: string;
} {
  const apiRole = apiKeyRole(request);
  const headerRole = parseRole(request.headers.get(ROLE_HEADER));
  const role = apiRole ?? headerRole ?? DEFAULT_ROLE;
  return {
    role,
    userId: request.headers.get("x-user-id") ?? "system",
    userName: request.headers.get("x-user-name") ?? "Demo User",
    userEmail: request.headers.get("x-user-email") ?? undefined,
  };
}

function rateLimits(request: NextRequest): { limited: boolean; remaining: number } {
  const path = request.nextUrl.pathname;
  const limit = LIMITS[path];
  if (!limit) return { limited: false, remaining: -1 };
  const now = Date.now();
  const key = `${path}:${clientKey(request)}`;
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.start >= WINDOW_MS) {
    buckets.set(key, { start: now, count: 1 });
    return { limited: false, remaining: limit - 1 };
  }
  bucket.count += 1;
  return { limited: bucket.count > limit, remaining: Math.max(0, limit - bucket.count) };
}

export function proxy(request: NextRequest): NextResponse | Response {
  const identity = resolveRole(request);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(ROLE_HEADER, identity.role);
  requestHeaders.set("x-user-id", identity.userId);
  requestHeaders.set("x-user-name", identity.userName);
  if (identity.userEmail) requestHeaders.set("x-user-email", identity.userEmail);

  const { limited, remaining } = rateLimits(request);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-rate-limit-remaining", String(remaining));
  response.headers.set("x-rate-limit-window", String(WINDOW_MS));

  if (limited) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded. Try again shortly." },
      {
        status: 429,
        headers: {
          "content-type": "application/json",
          "x-rate-limit-remaining": "0",
          "retry-after": String(Math.ceil(WINDOW_MS / 1000)),
        },
      },
    );
  }

  return response;
}

export const config = {
  matcher: ["/api/ai/stream", "/api/export", "/api/jobs/:path*", "/api/storage/presigned-url"],
};
