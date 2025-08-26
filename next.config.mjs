/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Enable static exports for better performance
  output: 'export',
  // Since we're deploying to a subdomain
  basePath: '',
  images: {
    unoptimized: true,
  },
}

export default nextConfig