import type { NextConfig } from "next";

/**
 * GitHub Pages project site: https://fadel3215a.github.io/assetpilot-ai/
 * Set GITHUB_PAGES=true when building for deployment.
 */
const repoBasePath = "/assetpilot-ai";
const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  ...(isGitHubPages
    ? {
        basePath: repoBasePath,
        assetPrefix: `${repoBasePath}/`,
      }
    : {}),
};

export default nextConfig;
