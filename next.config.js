/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Exclude Node.js modules from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        path: false,
        os: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        'better-sqlite3': false,
        bcryptjs: false,
      };
    }
    return config;
  },
  // Ensure server-only modules stay server-side
  serverComponentsExternalPackages: ['better-sqlite3', 'bcryptjs'],
};

module.exports = nextConfig;
