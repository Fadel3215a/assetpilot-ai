import type { NextConfig } from "next";
import { GITHUB_PAGES_BASE_PATH } from "./lib/base-path";

/**
 * GitHub Pages project site: https://fadel3215a.github.io/assetpilot-ai/
 * Set GITHUB_PAGES=true when building for deployment.
 */
const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: isGitHubPages ? GITHUB_PAGES_BASE_PATH : "",
  },
  ...(isGitHubPages
    ? {
        basePath: GITHUB_PAGES_BASE_PATH,
        assetPrefix: `${GITHUB_PAGES_BASE_PATH}/`,
      }
    : {}),
};

export default nextConfig;
