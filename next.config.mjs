/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    forceSwcTransforms: true,
  },
  poweredByHeader: false,
};

export default nextConfig;
