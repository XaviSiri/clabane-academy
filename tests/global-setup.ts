import { execSync } from "child_process";
import { config } from "dotenv";

export default function globalSetup() {
  config({ path: ".env.test" });
  // Apply migrations to the dedicated test database before any test runs.
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env },
  });
}
