import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Existe um package-lock.json em C:\Users\bruno; fixa a raiz no projeto.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
