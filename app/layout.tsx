import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "@/components/providers/session-provider";
import { LoginGateProvider } from "@/components/providers/login-gate";
import {
  AssetsProvider,
  type AssetsProviderInitialState,
} from "@/lib/assets-context";
import { getDemoAccounts } from "@/lib/server/demo-accounts";
import {
  getActivity,
  getAssets,
  getComparisons,
  getCollections,
  getFeedbackEntries,
  getIgnoredDuplicateIds,
} from "@/lib/server/queries";
import { resolveWorkspaceContext } from "@/lib/server/workspace-context";
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

/** Empty shell rendered before sign-in / when the account has no workspace. */
const EMPTY_INITIAL_STATE: AssetsProviderInitialState = {
  collections: [],
  assets: [],
  activity: [],
  comparisons: [],
  feedback: [],
  ignoredDuplicateIds: [],
};

async function loadInitialState(workspaceId: string): Promise<AssetsProviderInitialState> {
  const [collections, assets, activity, comparisons, feedback, ignoredDuplicateIds] =
    await Promise.all([
      getCollections(workspaceId),
      getAssets(workspaceId),
      getActivity(workspaceId),
      getComparisons(workspaceId),
      getFeedbackEntries(workspaceId),
      getIgnoredDuplicateIds(workspaceId),
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
  // P0.2 — private inventory is loaded only for a signed-in account with a
  // workspace membership. Anonymous visitors (and membership-less accounts)
  // get the empty shell: no private workspace data is ever read for them.
  // LoginGate shows the sign-in dialog; sign-in triggers router.refresh(),
  // which re-runs this server render with the fresh session.
  const workspace = await resolveWorkspaceContext();
  const initialState = workspace
    ? await loadInitialState(workspace.workspaceId)
    : EMPTY_INITIAL_STATE;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <SessionProvider>
          <LoginGateProvider demoAccounts={getDemoAccounts()}>
            <AssetsProvider initialState={initialState}>{children}</AssetsProvider>
          </LoginGateProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
