import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Fija la raíz del workspace a este proyecto (evita que Next infiera un
  // lockfile externo cuando hay varios package-lock.json en el sistema).
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
