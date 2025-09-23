
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    allowedDevOrigins: [
        "https://6000-firebase-studio-1758641818345.cluster-c23mj7ubf5fxwq6nrbev4ugaxa.cloudworkstations.dev",
        "http://localhost:9002",
        "http://localhost:3000"
    ]
  },
  typescript: {
    ignoreBuildErrors: false, // Changed to false for production readiness
  },
  eslint: {
    ignoreDuringBuilds: false, // Changed to false for production readiness
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'drive.google.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
