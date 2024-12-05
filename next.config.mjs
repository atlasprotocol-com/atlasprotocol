/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    forceSwcTransforms: true,
  },
  poweredByHeader: false,
};

export default nextConfig;
