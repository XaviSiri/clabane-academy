import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { config } from "dotenv";

config({ path: ".env.test" });

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    // The Next.js "standalone" build output copies the whole project tree
    // (including tests/) into .next/standalone — exclude it explicitly so
    // Vitest doesn't pick up and run that stale copy too.
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
});
