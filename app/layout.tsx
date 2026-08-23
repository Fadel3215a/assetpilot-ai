import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  AssetsProvider,
  type AssetsProviderInitialState,
} from "@/lib/assets-context";
import {
  getActivity,
  getAssets,
  getComparisons,
  getCollections,
  getFeedbackEntries,
  getIgnoredDuplicateIds,
} from "@/lib/server/queries";
import "./globals.css";

export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AssetPilot AI | AI-Assisted Digital Asset Curation",
    template: "%s | AssetPilot AI",
  },
  description:
    "An independent portfolio project exploring human-in-the-loop AI-assisted digital asset curation, metadata management, quality control, and production readiness.",
  applicationName: "AssetPilot AI",
};

async function loadInitialState(): Promise<AssetsProviderInitialState> {
  const [collections, assets, activity, comparisons, feedback, ignoredDuplicateIds] =
    await Promise.all([
      getCollections(),
      getAssets(),
      getActivity(),
      getComparisons(),
      getFeedbackEntries(),
      getIgnoredDuplicateIds(),
    ]);

  return {
    collections,
    assets,
    activity,
    comparisons,
    feedback,
    ignoredDuplicateIds,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialState = await loadInitialState();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <AssetsProvider initialState={initialState}>{children}</AssetsProvider>
      </body>
    </html>
  );
}
