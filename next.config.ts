import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Fija la raíz del workspace a este proyecto (evita que Next infiera un
  // lockfile externo cuando hay varios package-lock.json en el sistema).
  turbopack: {
    root: path.join(__dirname),
  },
  // Clientes con JS en caché aún llaman /api/soroswap/*; redirigimos al SDEX nativo.
  async rewrites() {
    return [
      { source: "/api/soroswap/quote", destination: "/api/sdex/quote" },
      { source: "/api/soroswap/build", destination: "/api/sdex/build" },
      { source: "/api/soroswap/send", destination: "/api/sdex/send" },
    ];
  },
};

export default nextConfig;
