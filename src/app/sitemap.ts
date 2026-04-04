import type { MetadataRoute } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://swisher-pickleready-codex.web.app";
const lastModified = new Date();

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: appUrl,
      lastModified
    },
    {
      url: `${appUrl}/about`,
      lastModified
    },
    {
      url: `${appUrl}/privacy`,
      lastModified
    }
  ];
}
