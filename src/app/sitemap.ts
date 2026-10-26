import type { MetadataRoute } from "next";

const SITE = "https://www.seyf.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-10-26");
  return [
    { url: `${SITE}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/retiro`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE}/app`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE}/seyf-pitch.html`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/llms.txt`, lastModified, changeFrequency: "weekly", priority: 0.5 },
  ];
}
