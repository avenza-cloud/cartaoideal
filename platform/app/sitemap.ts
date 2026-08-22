import type { MetadataRoute } from "next";
import { getAllCards } from "@/lib/cards";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/cartoes`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/chat`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/perfil`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  const cardRoutes: MetadataRoute.Sitemap = getAllCards().map((card) => ({
    url: `${siteUrl}/cartoes/${card.card_stable_id}`,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...cardRoutes];
}
