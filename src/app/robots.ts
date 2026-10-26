import type { MetadataRoute } from "next";

// Dominio canónico fijo: NEXT_PUBLIC_SITE_URL todavía apunta al despliegue viejo en algunos entornos.
const SITE = "https://www.seyf.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Buscadores y crawlers de IA (incluidos los de jueces) leen todo menos las rutas de API.
      { userAgent: "*", allow: ["/", "/llms.txt", "/.well-known/stellar.toml"], disallow: ["/api/"] },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
