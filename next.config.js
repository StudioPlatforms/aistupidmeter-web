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

  compiler: {
    // Strip console output from production builds.
    //
    // The app carries ~205 console calls, 83 of them in HomeClient alone, and
    // they were all shipping to real users' browsers — every period switch
    // dumped a wall of "⚡ User changed to…", "🚀 CLIENT CACHE HIT…",
    // "🚫 Degraded models to exclude…" into the console. Fine while debugging,
    // unprofessional for anyone who opens devtools on the live site.
    //
    // Done at build time rather than by deleting the call sites so local `next
    // dev` keeps every log. error and warn are kept deliberately: genuine
    // failures should still be visible in production.
    removeConsole:
      process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
};

module.exports = nextConfig;
