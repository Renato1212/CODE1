/** @type {import('next').NextConfig} */
const isPages = process.env.GH_PAGES === "1";
const basePath = isPages ? "/CODE1" : "";

const nextConfig = {
  reactStrictMode: true,
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
};
export default nextConfig;
