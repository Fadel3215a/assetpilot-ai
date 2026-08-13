import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AssetsProvider } from "@/lib/assets-context";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <AssetsProvider>{children}</AssetsProvider>
      </body>
    </html>
  );
}
