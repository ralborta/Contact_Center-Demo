/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Remove env config - use environment variables directly
  output: 'standalone',
}

module.exports = nextConfig
