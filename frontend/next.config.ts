import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Включаем standalone output для Docker
  output: 'standalone',
  
  // API URL из переменных окружения
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },
  
  // Оптимизация изображений
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lk.housler.ru',
      },
    ],
  },
};

export default nextConfig;
