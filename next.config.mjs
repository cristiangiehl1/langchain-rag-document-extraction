/** @type {import('next').NextConfig} */
const nextConfig = {
  // These packages rely on native/wasm binaries or Node built-ins and must not be
  // bundled by the server compiler.
  serverExternalPackages: ["@huggingface/transformers", "pdf-parse", "pg"],
};

export default nextConfig;
