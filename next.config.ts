import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Ensure server-only modules are never bundled for the browser
  serverExternalPackages: [],
  // Allow local network access during development
  allowedDevOrigins: ['192.168.1.38'],
}

export default nextConfig
