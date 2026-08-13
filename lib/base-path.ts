/** GitHub Pages project-site base path (no trailing slash). */
export const GITHUB_PAGES_BASE_PATH = "/assetpilot-ai";

/**
 * Inlined at build time via next.config when GITHUB_PAGES=true.
 * Falls back to pathname detection on the client for GitHub Pages project sites.
 */
export function getBasePath(): string {
  const fromEnv = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  if (fromEnv) {
    return fromEnv;
  }

  if (typeof window !== "undefined") {
    const { pathname } = window.location;
    if (
      pathname === GITHUB_PAGES_BASE_PATH ||
      pathname.startsWith(`${GITHUB_PAGES_BASE_PATH}/`)
    ) {
      return GITHUB_PAGES_BASE_PATH;
    }
  }

  return "";
}

/**
 * Prefix a public/static asset path for GitHub Pages when required.
 * Leaves blob:, http(s):, and data: URLs unchanged.
 * Use only for public-folder assets — not for Next.js route paths.
 */
export function withBasePath(path: string): string {
  if (!path) return path;

  if (/^(blob:|https?:|data:)/i.test(path)) {
    return path;
  }

  const base = getBasePath();
  if (!base) {
    return path;
  }

  if (path === base || path.startsWith(`${base}/`)) {
    return path;
  }

  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Resolve thumbnail, preview, or other public media paths. */
export function resolvePublicAssetPath(path: string): string {
  return withBasePath(path);
}
