import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";

import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/dm-sans/800.css";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://swisher-pickleready-codex.web.app";
const metadataBase = new URL(appUrl);

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "PickleReady",
    template: "%s | PickleReady"
  },
  description:
    "PickleReady helps pickleball players understand whether a rough day came from fatigue, readiness, or the matchup.",
  applicationName: "PickleReady",
  keywords: ["pickleball", "DUPR", "Whoop", "readiness", "performance", "match logging"],
  alternates: {
    canonical: "/"
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    url: appUrl,
    siteName: "PickleReady",
    title: "PickleReady",
    description:
      "Daily pickleball readiness from DUPR, wearable recovery, and match context in one premium mobile-first app.",
    images: [
      {
        url: "/og-card.svg",
        width: 1200,
        height: 630,
        alt: "PickleReady app preview"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "PickleReady",
    description:
      "Daily pickleball readiness from DUPR, wearable recovery, and match context in one premium mobile-first app.",
    images: ["/og-card.svg"]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PickleReady"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#F0F4FF",
  colorScheme: "light"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
