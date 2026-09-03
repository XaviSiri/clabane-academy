/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a minimal, self-contained server bundle for the Docker image
  // (see Dockerfile) instead of shipping the full node_modules tree.
  output: "standalone",
};

export default nextConfig;
