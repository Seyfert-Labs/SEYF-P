import path from "node:path";
import type { NextConfig } from "next";

// La raíz es `ship-it/` para poder importar `ship-it/deployments.json`
// (Turbopack no resuelve archivos fuera de su raíz).
const root = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  turbopack: { root },
  outputFileTracingRoot: root,
};

export default nextConfig;
