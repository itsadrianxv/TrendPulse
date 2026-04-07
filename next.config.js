/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  reactCompiler: true,
  images: {
    unoptimized: true
  },
  turbopack: {
    root: __dirname
  }
};

module.exports = nextConfig;
