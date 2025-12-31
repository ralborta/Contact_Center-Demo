/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable server-side rendering for all pages
  experimental: {
    serverActions: false,
  },
}

module.exports = nextConfig
