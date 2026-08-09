/** @type {import('next').NextConfig} */
const nextConfig = {
  // These packages rely on native binaries or Node built-ins and must not be
  // bundled by the server compiler.
  serverExternalPackages: ["pdf-parse", "pg"],
  // The prompt files are read at runtime with fs.readFileSync, so Next's output
  // tracing can't detect them automatically. Include them in the /api/chat bundle
  // so they ship with the Vercel serverless function.
  outputFileTracingIncludes: {
    "/api/chat": ["./src/lib/prompt/**"],
  },
};

export default nextConfig;
