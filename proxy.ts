import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { parseRole, ROLE_HEADER } from "@/lib/auth";
import { ROLE_LEVEL, type UserRole } from "@/types";
import type { Session } from "next-auth";

/**
 * Stage 4.3 + Stage 3.3 — Proxy (Next 16 replacement for middleware).
 *
 * Validates the incoming identity and attaches a normalized `x-user-role`
 * header so guarded API routes and server functions can trust the caller's
 * role. Since Stage 3.3 the active Auth.js session is decoded here (JWT, via
 * the auth() middleware wrapper) and is the authoritative role source when a
 * session cookie is present; API-key / header / demo fallbacks apply for
 * service-to-service and pre-login demo traffic.
 *
 * Fine-grained route protection is also enforced at this front door and
 * re-checked inside every route/server function (see lib/auth.ts):
 *   - /curation, /reviews, /production-ready  -> CURATOR or ADMIN
 *   - /api/storage/presigned-url, /api/ai/stream -> CURATOR or ADMIN
 * A lightweight in-memory rate-limit placeholder stays on the two heavy
 * endpoints (/api/ai/stream, /api/export).
 */

const STREAM_PATH = "/api/ai/stream";
const EXPORT_PATH = "/api/export";

const DEFAULT_ROLE = (() => {
  const demo = process.env.DEMO_USER_ROLE;
  return demo && parseRole(demo) ? (demo as UserRole) : "ADMIN";
})();

const API_KEYS: string[] = process.env.API_KEYS
  ? process.env.API_KEYS.split(",").map((s) => s.trim()).filter(Boolean)
  : [];

const CURATOR_ONLY_PREFIXES = ["/curation", "/reviews", "/production-ready"];
const CURATOR_ONLY_APIS = [STREAM_PATH, "/api/storage/presigned-url"];

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

type Identity = {
  role: UserRole;
  userId: string;
  userName: string;
  userEmail?: string;
};

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
 * Resolves the caller's role. Priority: Auth.js session (authenticated browser
 * user) > validated API key (service, ADMIN) > explicit role header > demo
 * default. Session-derived identity fields override the header placeholders.
 */
function resolveIdentity(request: NextRequest, session: Session | null): Identity {
  const sessionRole = parseRole(session?.user?.role);
  const apiRole = apiKeyRole(request);
  const headerRole = parseRole(request.headers.get(ROLE_HEADER));
  const role = sessionRole ?? apiRole ?? headerRole ?? DEFAULT_ROLE;

  const userId =
    session?.user?.id ?? request.headers.get("x-user-id") ?? "system";
  const userName =
    session?.user?.name ?? request.headers.get("x-user-name") ?? "Demo User";
  const userEmail =
    session?.user?.email ?? request.headers.get("x-user-email") ?? undefined;

  return { role, userId, userName, userEmail };
}

function attachIdentityHeaders(
  requestHeaders: Headers,
  identity: Identity,
): void {
  requestHeaders.set(ROLE_HEADER, identity.role);
  requestHeaders.set("x-user-id", identity.userId);
  requestHeaders.set("x-user-name", identity.userName);
  if (identity.userEmail) requestHeaders.set("x-user-email", identity.userEmail);
}

function requiresCurator(pathname: string): boolean {
  if (CURATOR_ONLY_APIS.includes(pathname)) return true;
  return CURATOR_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function forbidden(request: NextRequest, identity: Identity): Response {
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  const headers = new Headers({ "content-type": "application/json" });
  attachIdentityHeaders(headers, identity);
  if (isApi) {
    return NextResponse.json(
      { ok: false, error: "Requires the CURATOR or ADMIN role.", code: "FORBIDDEN" },
      { status: 403, headers },
    );
  }
  return new Response(
    JSON.stringify({
      ok: false,
      error: "Requires the CURATOR or ADMIN role. Sign in with a Curator or Admin account.",
      code: "FORBIDDEN",
    }),
    { status: 403, headers },
  );
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

type AugmentedRequest = NextRequest & { auth: Session | null };
type ProxyRunner = (request: NextRequest, event: NextFetchEvent) => NextResponse | Response;

const authRunner = auth((request: AugmentedRequest) => {
  const identity = resolveIdentity(request, request.auth);

  const requestHeaders = new Headers(request.headers);
  attachIdentityHeaders(requestHeaders, identity);

  // Stage 3.3 — protected surfaces require a curator-level identity.
  if (requiresCurator(request.nextUrl.pathname)) {
    const level = ROLE_LEVEL[identity.role];
    if (level < ROLE_LEVEL.CURATOR) {
      return forbidden(request, identity);
    }
  }

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
});

const runProxy = authRunner as unknown as ProxyRunner;

export function proxy(
  request: NextRequest,
  event: NextFetchEvent,
): Promise<NextResponse | Response> {
  return Promise.resolve(runProxy(request, event));
}

export const config = {
  matcher: [
    "/api/ai/stream",
    "/api/export",
    "/api/export/stream",
    "/api/jobs/:path*",
    "/api/storage/presigned-url",
    "/api/search",
    "/curation/:path*",
    "/reviews/:path*",
    "/production-ready/:path*",
  ],
};