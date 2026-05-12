import path from "path";
import { fileURLToPath } from "url";

import type { NextConfig } from "next";

/** Keep Turbopack scoped to this app when a parent folder (e.g. Documents) has its own lockfile. */
const turbopackRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: turbopackRoot,
  },
};

export default nextConfig;
