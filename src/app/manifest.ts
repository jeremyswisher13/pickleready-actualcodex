import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PickleReady",
    short_name: "PickleReady",
    description:
      "Daily pickleball readiness from DUPR, wearable recovery, and match context in one premium mobile-first app.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F0F4FF",
    theme_color: "#2563EB",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      },
      {
        src: "/apple-icon.svg",
        sizes: "180x180",
        type: "image/svg+xml"
      }
    ]
  };
}
