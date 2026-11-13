import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  serverExternalPackages: ['@node-rs/argon2', 'sharp', 'pg', 'bullmq', 'ioredis', 'nodemailer'],
};

export default nextConfig;

