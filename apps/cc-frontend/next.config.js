/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Force all pages to be client-side only
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
