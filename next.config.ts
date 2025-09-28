
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */

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
