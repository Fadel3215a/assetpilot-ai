import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { parseRole } from "@/lib/auth";
import { ROLE_LEVEL, type UserRole } from "@/types";
import type { Session } from "next-auth";

/**
 * Stage 4.3 + Stage 3.3 — Proxy (Next 16 replacement for middleware).
 *
 * The front door is deny-by-default. An identity is derived from either the
 * active Auth.js session (browser traffic) or a configured service API key
 * (`x-api-key`); client-supplied role/identity headers are never trusted.
 * Unauthenticated API requests receive 401, unauthenticated page requests are
 * redirected to the dashboard, and insufficient roles receive 403. Every route
 * and server action re-checks authorization in lib/auth.ts.
 *
 *   - /curation, /reviews, /production-ready  -> CURATOR or ADMIN
 *   - /api/storage/presigned-url, /api/ai/stream -> CURATOR or ADMIN
 *   - all other matched API routes            -> VIEWER or higher
 * A lightweight in-memory rate-limit placeholder stays on the two heavy
 * endpoints (/api/ai/stream, /api/export).
 */

const STREAM_PATH = "/api/ai/stream";
const EXPORT_PATH = "/api/export";

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
 * Resolves the caller's identity from an Auth.js session or a valid service API
 * key. Returns null when neither is present — there is intentionally no
 * anonymous/demo default.
 */
function resolveIdentity(request: NextRequest, session: Session | null): Identity | null {
  const sessionRole = parseRole(session?.user?.role);
  if (session?.user?.id && sessionRole) {
    return {
      role: sessionRole,
      userId: session.user.id,
      userName: session.user.name ?? "User",
      userEmail: session.user.email ?? undefined,
    };
  }

  const apiRole = apiKeyRole(request);
  if (apiRole) {
    return { role: apiRole, userId: "service", userName: "API Service" };
  }

  return null;
}

function normalizePath(pathname: string): string {
  // next.config.ts sets trailingSlash: true, so real request paths carry a
  // trailing slash ("/api/ai/stream/"). Exact-path checks (curator APIs and
  // rate-limit keys) must compare against the normalized form.
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function requiresCurator(pathname: string): boolean {
  if (CURATOR_ONLY_APIS.includes(pathname)) return true;
  return CURATOR_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function unauthorized(): Response {
  return NextResponse.json(
    { ok: false, error: "Authentication required.", code: "UNAUTHENTICATED" },
    { status: 401 },
  );
}

function forbidden(isApi: boolean): Response {
  const message = "Requires the CURATOR or ADMIN role.";
  if (isApi) {
    return NextResponse.json(
      { ok: false, error: message, code: "FORBIDDEN" },
      { status: 403 },
    );
  }
  return new Response(
    JSON.stringify({
      ok: false,
      error: `${message} Sign in with a Curator or Admin account.`,
      code: "FORBIDDEN",
    }),
    { status: 403, headers: { "content-type": "application/json" } },
  );
}

function rateLimits(request: NextRequest): { limited: boolean; remaining: number } {
  const path = normalizePath(request.nextUrl.pathname);
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
  const pathname = normalizePath(request.nextUrl.pathname);
  const isApi = pathname.startsWith("/api/");
  const identity = resolveIdentity(request, request.auth);

  if (!identity) {
    return isApi ? unauthorized() : NextResponse.redirect(new URL("/", request.url));
  }

  const required: UserRole = requiresCurator(pathname) ? "CURATOR" : "VIEWER";
  if (ROLE_LEVEL[identity.role] < ROLE_LEVEL[required]) {
    return forbidden(isApi);
  }

  const { limited, remaining } = rateLimits(request);

  const response = NextResponse.next();
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
    "/api/assets/:path*/vector",
    "/api/assets/:path*/renditions",
    "/api/export",
    "/api/export/stream",
    "/api/jobs",
    "/api/jobs/:path*",
    "/api/storage/presigned-url",
    "/api/search",
    "/api/search/analytics",
    "/api/search/reindex",
    "/curation/:path*",
    "/reviews/:path*",
    "/production-ready/:path*",
  ],
};
